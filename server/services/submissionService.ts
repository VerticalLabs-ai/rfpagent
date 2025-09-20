import { storage } from "../storage";
import { ObjectStorageService } from "../objectStorage";
import { submissionOrchestrator } from './submissionOrchestrator';
import { agentMemoryService } from './agentMemoryService';
import { agentRegistryService } from './agentRegistryService';
import type { 
  Submission, 
  Proposal, 
  Portal, 
  RFP,
  SubmissionPipelineRequest,
  SubmissionPipelineResult 
} from '@shared/schema';
import { nanoid } from 'nanoid';

export interface SubmissionOptions {
  sessionId?: string;
  portalCredentials?: {
    username?: string;
    password?: string;
    mfaMethod?: string;
  };
  priority?: number;
  deadline?: Date;
  retryOptions?: {
    maxRetries?: number;
    retryDelay?: number;
  };
  browserOptions?: {
    headless?: boolean;
    timeout?: number;
  };
  metadata?: any;
}

export interface SubmissionStatus {
  submissionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  currentPhase: string;
  progress: number;
  pipelineId?: string;
  estimatedCompletion?: Date;
  error?: string;
  nextSteps?: string[];
  events?: any[];
}

export interface SubmissionResult {
  success: boolean;
  submissionId?: string;
  pipelineId?: string;
  referenceNumber?: string;
  receiptData?: any;
  error?: string;
  retryable?: boolean;
}

/**
 * Comprehensive Submission Service
 * 
 * Orchestrates the complete proposal submission pipeline through government portals
 * with automated portal login, form filling, document uploads, and submission execution.
 * 
 * Features:
 * - Automated portal authentication with MFA support
 * - Intelligent form population using proposal data
 * - Document upload with validation and verification
 * - Real-time progress tracking and status updates
 * - Comprehensive error handling and retry logic
 * - Audit logging and compliance reporting
 * - Integration with 3-tier agent system
 */
export class SubmissionService {
  private objectStorageService = new ObjectStorageService();
  private activeSubmissions: Map<string, any> = new Map();

  constructor() {
    this.initializeSubmissionService();
  }

  /**
   * Initialize submission service and register orchestrator
   */
  private async initializeSubmissionService(): Promise<void> {
    try {
      console.log('🔧 Initializing Submission Service...');

      // Ensure submission orchestrator is initialized
      await this.ensureOrchestratorInitialized();

      console.log('✅ Submission Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Submission Service:', error);
    }
  }

  private async ensureOrchestratorInitialized(): Promise<void> {
    try {
      // Check if orchestrator agents are registered
      const orchestratorAgent = await agentRegistryService.getAgent('submission-orchestrator');
      if (!orchestratorAgent) {
        console.log('🔄 Submission orchestrator not found, will be initialized on first use');
      }
    } catch (error) {
      console.warn('⚠️ Could not verify orchestrator status:', error);
    }
  }

  /**
   * Sanitize options to remove sensitive credentials before logging
   */
  private sanitizeOptionsForLogging(options: SubmissionOptions): any {
    const sanitized = { ...options };
    
    // Remove sensitive credential fields
    if (sanitized.portalCredentials) {
      delete sanitized.portalCredentials;
    }
    
    // Remove any other sensitive metadata
    if (sanitized.metadata) {
      const cleanMetadata = { ...sanitized.metadata };
      // Remove any potential credentials in metadata
      delete cleanMetadata.username;
      delete cleanMetadata.password;
      delete cleanMetadata.credentials;
      delete cleanMetadata.auth;
      sanitized.metadata = cleanMetadata;
    }
    
    return sanitized;
  }

  /**
   * Submit a proposal through the automated submission pipeline
   */
  async submitProposal(
    submissionId: string, 
    options: SubmissionOptions = {}
  ): Promise<SubmissionResult> {
    console.log(`🚀 Starting automated submission for ${submissionId}`);

    try {
      // Validate submission exists
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      // Validate proposal exists
      const proposal = await storage.getProposal(submission.proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${submission.proposalId}`);
      }

      // Validate portal exists
      const portal = await storage.getPortal(submission.portalId);
      if (!portal) {
        throw new Error(`Portal not found: ${submission.portalId}`);
      }

      // Check if submission is already in progress
      if (this.activeSubmissions.has(submissionId)) {
        console.log('⚠️ Submission already in progress');
        return {
          success: false,
          submissionId,
          error: 'Submission already in progress'
        };
      }

      // Validate submission readiness
      const readinessCheck = await this.validateSubmissionReadiness(submission, proposal, portal);
      if (!readinessCheck.ready) {
        throw new Error(`Submission not ready: ${readinessCheck.reason}`);
      }

      // Create session for this submission
      const sessionId = options.sessionId || `submission_${submissionId}_${Date.now()}`;

      // Track active submission
      this.activeSubmissions.set(submissionId, {
        sessionId,
        startedAt: new Date(),
        status: 'initiating'
      });

      // Create audit log (sanitized - NO CREDENTIALS)
      await storage.createAuditLog({
        entityType: 'submission',
        entityId: submissionId,
        action: 'submission_initiated',
        details: {
          proposalId: submission.proposalId,
          portalId: submission.portalId,
          sessionId,
          options: this.sanitizeOptionsForLogging(options)
        }
      });

      // Update submission status to in_progress when pipeline starts
      await storage.updateSubmission(submissionId, {
        status: 'in_progress',
        submissionData: {
          sessionId,
          initiatedAt: new Date(),
          portalName: portal.name,
          automatedSubmission: true
        }
      });

      // Create initial notification
      await storage.createNotification({
        type: "submission",
        title: "Automated Submission Started",
        message: `Automated submission pipeline initiated for ${portal.name}`,
        relatedEntityType: 'submission',
        relatedEntityId: submissionId,
        priority: "high",
        read: false
      });

      // Prepare submission pipeline request
      const pipelineRequest: SubmissionPipelineRequest = {
        submissionId,
        sessionId,
        portalCredentials: options.portalCredentials,
        priority: options.priority || 5,
        deadline: options.deadline,
        retryOptions: {
          maxRetries: options.retryOptions?.maxRetries || 3,
          retryDelay: options.retryOptions?.retryDelay || 30000
        },
        browserOptions: {
          headless: options.browserOptions?.headless ?? false,
          timeout: options.browserOptions?.timeout || 300000
        },
        metadata: {
          submissionInitiatedAt: new Date(),
          portalName: portal.name,
          rfpTitle: readinessCheck.rfp?.title,
          ...options.metadata
        }
      };

      // Store submission request in agent memory for tracking (sanitized - NO CREDENTIALS)
      const sanitizedPipelineRequest = {
        ...pipelineRequest,
        portalCredentials: pipelineRequest.portalCredentials ? '[REDACTED]' : undefined
      };
      
      await agentMemoryService.storeMemory({
        agentId: 'submission-service',
        memoryType: 'working',
        contextKey: `submission_request_${submissionId}`,
        title: `Submission Request - ${portal.name}`,
        content: {
          submissionId,
          sessionId,
          pipelineRequest: sanitizedPipelineRequest,
          initiatedAt: new Date()
        },
        importance: 9,
        tags: ['submission_request', 'active_submission', portal.name],
        metadata: { submissionId, sessionId }
      });

      // Initiate submission pipeline through orchestrator
      const pipelineResult = await submissionOrchestrator.initiateSubmissionPipeline(pipelineRequest);

      if (!pipelineResult.success) {
        // Handle pipeline initiation failure
        await this.handleSubmissionFailure(submissionId, sessionId, pipelineResult.error || 'Pipeline initiation failed');
        
        return {
          success: false,
          submissionId,
          error: pipelineResult.error || 'Pipeline initiation failed',
          retryable: true
        };
      }

      // Update active submission tracking
      this.activeSubmissions.set(submissionId, {
        sessionId,
        pipelineId: pipelineResult.pipelineId,
        startedAt: new Date(),
        status: 'in_progress',
        currentPhase: pipelineResult.currentPhase
      });

      console.log(`✅ Submission pipeline initiated successfully: ${pipelineResult.pipelineId}`);

      return {
        success: true,
        submissionId,
        pipelineId: pipelineResult.pipelineId
      };

    } catch (error) {
      console.error(`❌ Failed to submit proposal ${submissionId}:`, error);
      
      // Clean up active submission tracking
      this.activeSubmissions.delete(submissionId);

      // Handle submission failure
      await this.handleSubmissionFailure(submissionId, options.sessionId, error.message);

      return {
        success: false,
        submissionId,
        error: error instanceof Error ? error.message : 'Submission failed',
        retryable: this.isRetryableError(error)
      };
    }
  }

  /**
   * Get submission status with pipeline details
   */
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatus | null> {
    try {
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return null;
      }

      // Get pipeline status if available
      let pipelineStatus = null;
      const submissionData = submission.submissionData as any;
      if (submissionData?.pipelineId) {
        pipelineStatus = await submissionOrchestrator.getPipelineStatus(submissionData.pipelineId);
      }

      // Get recent events
      const events = await this.getSubmissionEvents(submissionId, 10);

      // Get active submission tracking
      const activeSubmission = this.activeSubmissions.get(submissionId);

      return {
        submissionId,
        status: submission.status as any,
        currentPhase: pipelineStatus?.currentPhase || activeSubmission?.currentPhase || 'unknown',
        progress: pipelineStatus?.progress || 0,
        pipelineId: pipelineStatus?.pipelineId || submissionData?.pipelineId,
        estimatedCompletion: pipelineStatus?.estimatedCompletion,
        error: pipelineStatus?.error || submissionData?.error,
        nextSteps: pipelineStatus?.nextSteps || [],
        events
      };

    } catch (error) {
      console.error(`Error getting submission status for ${submissionId}:`, error);
      return null;
    }
  }

  /**
   * Cancel an active submission
   */
  async cancelSubmission(submissionId: string): Promise<boolean> {
    try {
      console.log(`🛑 Cancelling submission ${submissionId}`);

      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        throw new Error('Submission not found');
      }

      // Cancel pipeline if active
      const submissionData = submission.submissionData as any;
      let pipelineCancelled = false;
      if (submissionData?.pipelineId) {
        pipelineCancelled = await submissionOrchestrator.cancelPipeline(submissionData.pipelineId);
      }

      // Update submission status
      await storage.updateSubmission(submissionId, {
        status: 'cancelled',
        submissionData: {
          ...submissionData,
          cancelledAt: new Date(),
          pipelineCancelled
        }
      });

      // Clean up active submission tracking
      this.activeSubmissions.delete(submissionId);

      // Create cancellation notification
      await storage.createNotification({
        type: "submission",
        title: "Submission Cancelled",
        message: `Submission has been cancelled by user request`,
        relatedEntityType: 'submission',
        relatedEntityId: submissionId,
        priority: "medium",
        read: false
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'submission',
        entityId: submissionId,
        action: 'submission_cancelled',
        details: {
          cancelledAt: new Date(),
          pipelineCancelled
        }
      });

      console.log(`✅ Submission ${submissionId} cancelled successfully`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to cancel submission ${submissionId}:`, error);
      return false;
    }
  }

  /**
   * Retry a failed submission
   */
  async retrySubmission(submissionId: string, options: SubmissionOptions = {}): Promise<SubmissionResult> {
    console.log(`🔄 Retrying submission ${submissionId}`);

    try {
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        throw new Error('Submission not found');
      }

      // Check if submission can be retried
      if (submission.status === 'completed') {
        throw new Error('Cannot retry completed submission');
      }

      if (submission.status === 'in_progress') {
        throw new Error('Submission is currently in progress');
      }

      // Update submission status for retry
      await storage.updateSubmission(submissionId, {
        status: 'pending',
        submissionData: {
          ...(submission.submissionData as any),
          retryInitiatedAt: new Date(),
          previousStatus: submission.status
        }
      });

      // Create retry audit log
      await storage.createAuditLog({
        entityType: 'submission',
        entityId: submissionId,
        action: 'submission_retry',
        details: {
          previousStatus: submission.status,
          retryOptions: options
        }
      });

      // Initiate new submission with retry options
      return await this.submitProposal(submissionId, {
        ...options,
        metadata: {
          ...options.metadata,
          isRetry: true,
          previousStatus: submission.status
        }
      });

    } catch (error) {
      console.error(`❌ Failed to retry submission ${submissionId}:`, error);
      return {
        success: false,
        submissionId,
        error: error instanceof Error ? error.message : 'Retry failed'
      };
    }
  }

  /**
   * Get all active submissions
   */
  getActiveSubmissions(): any[] {
    return Array.from(this.activeSubmissions.entries()).map(([submissionId, data]) => ({
      submissionId,
      ...data
    }));
  }

  /**
   * Get submission analytics and metrics
   */
  async getSubmissionMetrics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'day':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
      }

      // Get submissions in timeframe
      const submissions = await storage.getSubmissionsByDateRange(startDate, endDate);
      
      const metrics = {
        totalSubmissions: submissions.length,
        successfulSubmissions: submissions.filter(s => s.status === 'completed').length,
        failedSubmissions: submissions.filter(s => s.status === 'failed').length,
        pendingSubmissions: submissions.filter(s => s.status === 'pending' || s.status === 'in_progress').length,
        cancelledSubmissions: submissions.filter(s => s.status === 'cancelled').length,
        successRate: 0,
        averageCompletionTime: 0,
        mostActivePortals: {},
        commonFailureReasons: {}
      };

      // Calculate success rate
      if (metrics.totalSubmissions > 0) {
        metrics.successRate = (metrics.successfulSubmissions / metrics.totalSubmissions) * 100;
      }

      // Calculate average completion time
      const completedSubmissions = submissions.filter(s => s.status === 'completed' && s.submittedAt);
      if (completedSubmissions.length > 0) {
        const totalTime = completedSubmissions.reduce((sum, s) => {
          const submissionData = s.submissionData as any;
          if (submissionData?.initiatedAt && s.submittedAt) {
            return sum + (s.submittedAt.getTime() - new Date(submissionData.initiatedAt).getTime());
          }
          return sum;
        }, 0);
        metrics.averageCompletionTime = totalTime / completedSubmissions.length;
      }

      // Get portal activity
      for (const submission of submissions) {
        const portalId = submission.portalId;
        if (portalId) {
          metrics.mostActivePortals[portalId] = (metrics.mostActivePortals[portalId] || 0) + 1;
        }
      }

      return metrics;

    } catch (error) {
      console.error('Error getting submission metrics:', error);
      return {
        totalSubmissions: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        pendingSubmissions: 0,
        successRate: 0,
        error: error.message
      };
    }
  }

  /**
   * Validate submission readiness
   */
  private async validateSubmissionReadiness(
    submission: Submission, 
    proposal: Proposal, 
    portal: Portal
  ): Promise<{ ready: boolean; reason?: string; rfp?: any }> {
    try {
      // Check if proposal is completed
      if (proposal.status !== 'completed') {
        return { ready: false, reason: 'Proposal is not completed' };
      }

      // Check if portal is configured
      if (!portal.url) {
        return { ready: false, reason: 'Portal URL not configured' };
      }

      // Get RFP to check deadline
      const rfp = await storage.getRFP(proposal.rfpId);
      if (!rfp) {
        return { ready: false, reason: 'RFP not found' };
      }

      // Check if deadline has passed
      if (rfp.deadline && new Date(rfp.deadline) < new Date()) {
        return { ready: false, reason: 'RFP deadline has passed' };
      }

      // Check if proposal has required data
      if (!proposal.proposalData) {
        return { ready: false, reason: 'Proposal data is missing' };
      }

      return { ready: true, rfp };

    } catch (error) {
      return { ready: false, reason: `Validation failed: ${error.message}` };
    }
  }

  /**
   * Handle submission failure
   */
  private async handleSubmissionFailure(submissionId: string, sessionId?: string, error?: string): Promise<void> {
    try {
      // Update submission status
      await storage.updateSubmission(submissionId, {
        status: 'failed',
        submissionData: {
          failedAt: new Date(),
          error,
          sessionId
        }
      });

      // Create failure notification
      await storage.createNotification({
        type: "submission",
        title: "Submission Failed",
        message: `Automated submission failed: ${error || 'Unknown error'}`,
        relatedEntityType: 'submission',
        relatedEntityId: submissionId,
        priority: "high",
        read: false
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'submission',
        entityId: submissionId,
        action: 'submission_failed',
        details: {
          error,
          failedAt: new Date(),
          sessionId
        }
      });

      // Clean up active submission tracking
      this.activeSubmissions.delete(submissionId);

    } catch (logError) {
      console.error('Error handling submission failure:', logError);
    }
  }

  /**
   * Get submission events
   */
  private async getSubmissionEvents(submissionId: string, limit: number = 10): Promise<any[]> {
    try {
      // Try to get events from submission_events table
      return await storage.getSubmissionEventsBySubmission(submissionId, limit);
    } catch (error) {
      console.warn('Could not get submission events:', error);
      return [];
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit',
      'server error',
      '5xx',
      'unavailable',
      'portal_authentication_failed',
      'form_validation_error'
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError => errorMessage.includes(retryableError));
  }

  /**
   * Clean up expired sessions and submissions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      const expiredThreshold = 24 * 60 * 60 * 1000; // 24 hours

      for (const [submissionId, data] of this.activeSubmissions.entries()) {
        if (now.getTime() - data.startedAt.getTime() > expiredThreshold) {
          console.log(`🧹 Cleaning up expired submission: ${submissionId}`);
          this.activeSubmissions.delete(submissionId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }
}

// Export singleton instance
export const submissionService = new SubmissionService();