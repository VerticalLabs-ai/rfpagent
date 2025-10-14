import { storage } from '../../storage';
import type { WorkItem, RFP } from '@shared/schema';

export interface AnalysisProgress {
  rfpId: string;
  workflowId: string;
  phase:
    | 'document_validation'
    | 'text_extraction'
    | 'requirement_parsing'
    | 'compliance_analysis'
    | 'completed';
  progress: number; // 0-100
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  errors: string[];
  metadata: any;
}

export interface AnalysisStepResult {
  stepName: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

/**
 * Analysis Progress Tracker for monitoring and reporting analysis pipeline progress
 */
export class AnalysisProgressTracker {
  private progressMap: Map<string, AnalysisProgress> = new Map();
  private stepHistory: Map<string, AnalysisStepResult[]> = new Map();

  /**
   * Initialize progress tracking for an analysis workflow
   */
  async initializeProgress(params: {
    rfpId: string;
    workflowId: string;
    totalSteps?: number;
  }): Promise<AnalysisProgress> {
    const progress: AnalysisProgress = {
      rfpId: params.rfpId,
      workflowId: params.workflowId,
      phase: 'document_validation',
      progress: 0,
      status: 'pending',
      startTime: new Date(),
      currentStep: 'Initializing analysis workflow',
      totalSteps: params.totalSteps || 4,
      completedSteps: 0,
      errors: [],
      metadata: {
        documentsToProcess: 0,
        documentsProcessed: 0,
        complianceItems: 0,
        requirementsParsed: 0,
      },
    };

    this.progressMap.set(params.workflowId, progress);
    this.stepHistory.set(params.workflowId, []);

    console.log(
      `📈 Initialized progress tracking for workflow: ${params.workflowId}`
    );

    // Create notification for progress tracking start
    try {
      await storage.createNotification({
        type: 'progress',
        title: 'Analysis Started',
        message: `Started analysis workflow for RFP`,
        relatedEntityType: 'rfp',
        relatedEntityId: params.rfpId,
      });
    } catch (error) {
      console.error(
        `Failed to create notification for RFP ${params.rfpId}:`,
        error
      );
      // Continue initialization even if notification fails
    }

    return progress;
  }

  /**
   * Update progress for a workflow step
   */
  async updateProgress(params: {
    workflowId: string;
    phase?: AnalysisProgress['phase'];
    currentStep: string;
    progress?: number;
    status?: AnalysisProgress['status'];
    metadata?: any;
    error?: string;
  }): Promise<AnalysisProgress | null> {
    const progress = this.progressMap.get(params.workflowId);
    if (!progress) {
      console.warn(`❌ Progress not found for workflow: ${params.workflowId}`);
      return null;
    }

    // Update fields
    if (params.phase) progress.phase = params.phase;
    if (params.currentStep) progress.currentStep = params.currentStep;
    if (params.status) progress.status = params.status;
    if (typeof params.progress === 'number')
      progress.progress = params.progress;
    if (params.metadata) {
      progress.metadata = { ...progress.metadata, ...params.metadata };
    }
    if (params.error) {
      progress.errors.push(params.error);
    }

    // Auto-calculate progress based on completed steps if not provided
    if (typeof params.progress !== 'number' && params.status === 'completed') {
      progress.completedSteps++;
      progress.progress = Math.round(
        (progress.completedSteps / progress.totalSteps) * 100
      );
    }

    // Mark as completed if at 100%
    if (progress.progress >= 100) {
      progress.status = 'completed';
      progress.endTime = new Date();
      progress.phase = 'completed';
    }

    console.log(
      `📊 Progress update [${params.workflowId}]: ${progress.currentStep} (${progress.progress}%)`
    );

    // Store progress to memory for persistence
    await this.persistProgress(progress);

    return progress;
  }

  /**
   * Record completion of a workflow step
   */
  async recordStepCompletion(params: {
    workflowId: string;
    stepName: string;
    success: boolean;
    data?: any;
    error?: string;
    duration: number;
  }): Promise<void> {
    const stepResult: AnalysisStepResult = {
      stepName: params.stepName,
      success: params.success,
      data: params.data,
      error: params.error,
      duration: params.duration,
      timestamp: new Date(),
    };

    const history = this.stepHistory.get(params.workflowId) || [];
    history.push(stepResult);
    this.stepHistory.set(params.workflowId, history);

    // Update progress
    await this.updateProgress({
      workflowId: params.workflowId,
      currentStep: `Completed: ${params.stepName}`,
      status: params.success ? 'in_progress' : 'failed',
      error: params.error,
    });

    console.log(
      `🔄 Step recorded [${params.workflowId}]: ${params.stepName} - ${params.success ? 'SUCCESS' : 'FAILED'}`
    );
  }

  /**
   * Get current progress for a workflow
   */
  getProgress(workflowId: string): AnalysisProgress | null {
    return this.progressMap.get(workflowId) || null;
  }

  /**
   * Get step history for a workflow
   */
  getStepHistory(workflowId: string): AnalysisStepResult[] {
    return this.stepHistory.get(workflowId) || [];
  }

  /**
   * Get progress for all workflows for an RFP
   */
  getRFPProgress(rfpId: string): AnalysisProgress[] {
    const results: AnalysisProgress[] = [];
    for (const progress of Array.from(this.progressMap.values())) {
      if (progress.rfpId === rfpId) {
        results.push(progress);
      }
    }
    return results;
  }

  /**
   * Handle workflow failure
   */
  async markWorkflowFailed(workflowId: string, error: string): Promise<void> {
    await this.updateProgress({
      workflowId,
      status: 'failed',
      currentStep: 'Workflow failed',
      error,
    });

    const progress = this.progressMap.get(workflowId);
    if (progress) {
      progress.endTime = new Date();

      // Create failure notification
      await storage.createNotification({
        type: 'error',
        title: 'Analysis Failed',
        message: `Analysis workflow failed: ${error}`,
        relatedEntityType: 'rfp',
        relatedEntityId: progress.rfpId,
      });
    }
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(workflowId: string, results: any): Promise<void> {
    await this.updateProgress({
      workflowId,
      status: 'completed',
      progress: 100,
      currentStep: 'Analysis workflow completed',
      metadata: {
        completionTime: new Date(),
        results,
      },
    });

    const progress = this.progressMap.get(workflowId);
    if (progress) {
      // Create completion notification
      await storage.createNotification({
        type: 'success',
        title: 'Analysis Complete',
        message: `Analysis workflow completed successfully`,
        relatedEntityType: 'rfp',
        relatedEntityId: progress.rfpId,
      });
    }

    console.log(`✅ Workflow completed: ${workflowId}`);
  }

  /**
   * Persist progress to memory for later retrieval
   */
  private async persistProgress(progress: AnalysisProgress): Promise<void> {
    // Store in agent memory for persistence
    try {
      const memoryData = {
        workflowId: progress.workflowId,
        rfpId: progress.rfpId,
        phase: progress.phase,
        progress: progress.progress,
        status: progress.status,
        currentStep: progress.currentStep,
        metadata: progress.metadata,
        errors: progress.errors,
        timestamp: new Date(),
      };

      // This would ideally be stored in a more permanent store
      // For now, we can use work item updates to track progress
    } catch (error) {
      console.warn(
        `❌ Failed to persist progress for ${progress.workflowId}:`,
        error
      );
    }
  }

  /**
   * Clean up completed workflows (for memory management)
   */
  cleanupCompletedWorkflows(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    for (const [workflowId, progress] of Array.from(
      this.progressMap.entries()
    )) {
      if (
        progress.status === 'completed' &&
        progress.endTime &&
        progress.endTime < cutoffTime
      ) {
        this.progressMap.delete(workflowId);
        this.stepHistory.delete(workflowId);
        console.log(`🗑️ Cleaned up completed workflow: ${workflowId}`);
      }
    }
  }

  /**
   * Get real-time progress updates for frontend
   */
  getProgressSummary(): {
    activeWorkflows: number;
    completedToday: number;
    failedToday: number;
    averageCompletionTime: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activeCount = 0;
    let completedToday = 0;
    let failedToday = 0;
    const completionTimes: number[] = [];

    for (const progress of Array.from(this.progressMap.values())) {
      if (progress.status === 'in_progress' || progress.status === 'pending') {
        activeCount++;
      } else if (progress.endTime && progress.endTime >= today) {
        if (progress.status === 'completed') {
          completedToday++;
          if (progress.endTime && progress.startTime) {
            completionTimes.push(
              progress.endTime.getTime() - progress.startTime.getTime()
            );
          }
        } else if (progress.status === 'failed') {
          failedToday++;
        }
      }
    }

    const averageCompletionTime =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

    return {
      activeWorkflows: activeCount,
      completedToday,
      failedToday,
      averageCompletionTime: Math.round(averageCompletionTime / 1000), // Convert to seconds
    };
  }
}

// Export singleton instance
export const analysisProgressTracker = new AnalysisProgressTracker();

// Auto-cleanup every hour
const cleanupInterval = setInterval(
  () => {
    analysisProgressTracker.cleanupCompletedWorkflows();
  },
  60 * 60 * 1000
);

/**
 * Shutdown function to clean up resources
 */
export function shutdownAnalysisProgressTracker(): void {
  clearInterval(cleanupInterval);
  console.log('Analysis progress tracker shutdown complete');
}
