import { EventEmitter } from 'events';
import { Response } from 'express';

export interface ProgressUpdate {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  details?: any;
  timestamp: Date;
}

export interface RFPProcessingProgress {
  rfpId?: string;
  url: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  status: 'initializing' | 'processing' | 'completed' | 'failed';
  steps: ProgressUpdate[];
  error?: string;
}

class ProgressTracker extends EventEmitter {
  private progressMap: Map<string, RFPProcessingProgress> = new Map();
  private sseClients: Map<string, Response[]> = new Map();
  private workflowTypes: Map<
    string,
    'rfp_processing' | 'submission_materials'
  > = new Map();

  // Memory leak protection - limit map sizes
  private readonly MAX_PROGRESS_ENTRIES = 1000;
  private readonly MAX_WORKFLOW_TYPES = 1000;

  // Processing steps definitions for different workflows
  private readonly WORKFLOW_STEPS = {
    rfp_processing: [
      { id: 'portal_detection', name: 'Detecting Portal Type' },
      { id: 'page_navigation', name: 'Navigating to RFP Page' },
      { id: 'data_extraction', name: 'Extracting RFP Information' },
      { id: 'document_discovery', name: 'Discovering Documents' },
      { id: 'document_download', name: 'Downloading Documents' },
      { id: 'database_save', name: 'Saving to Database' },
      { id: 'ai_analysis', name: 'AI Analysis & Proposal Generation' },
      { id: 'completion', name: 'Processing Complete' },
    ],
    submission_materials: [
      { id: 'initialization', name: 'Initializing Generation Process' },
      { id: 'rfp_analysis', name: 'Analyzing RFP Requirements' },
      { id: 'company_profile', name: 'Loading Company Profile' },
      { id: 'content_generation', name: 'Generating Proposal Content' },
      { id: 'compliance_check', name: 'Validating Compliance' },
      { id: 'document_assembly', name: 'Assembling Documents' },
      { id: 'quality_review', name: 'Quality Review & Validation' },
      { id: 'completion', name: 'Materials Ready for Review' },
    ],
  };

  // Default to RFP processing steps for backward compatibility
  private readonly PROCESSING_STEPS = this.WORKFLOW_STEPS.rfp_processing;

  /**
   * Start tracking a new processing job
   */
  startTracking(
    sessionId: string,
    url: string,
    workflowType: 'rfp_processing' | 'submission_materials' = 'rfp_processing'
  ): void {
    // Memory leak protection - enforce size limits
    if (this.progressMap.size >= this.MAX_PROGRESS_ENTRIES) {
      const oldestKey = this.progressMap.keys().next().value;
      if (oldestKey) {
        this.progressMap.delete(oldestKey);
        this.sseClients.delete(oldestKey);
      }
    }
    if (this.workflowTypes.size >= this.MAX_WORKFLOW_TYPES) {
      const oldestKey = this.workflowTypes.keys().next().value;
      if (oldestKey) {
        this.workflowTypes.delete(oldestKey);
      }
    }

    const steps = this.WORKFLOW_STEPS[workflowType] || this.PROCESSING_STEPS;

    const progress: RFPProcessingProgress = {
      url,
      totalSteps: steps.length,
      completedSteps: 0,
      currentStep: steps[0].name,
      status: 'initializing',
      steps: steps.map(step => ({
        step: step.name,
        status: 'pending',
        message: `${step.name} - Waiting`,
        timestamp: new Date(),
      })),
    };

    this.progressMap.set(sessionId, progress);
    this.workflowTypes.set(sessionId, workflowType);
    this.broadcastProgress(sessionId);
  }

  /**
   * Update progress for a specific step
   */
  updateStep(
    sessionId: string,
    stepId: string,
    status: 'in_progress' | 'completed' | 'failed',
    message: string,
    details?: any
  ): void {
    const progress = this.progressMap.get(sessionId);
    if (!progress) return;

    // Get the correct workflow steps for this session
    const workflowType = this.workflowTypes.get(sessionId) || 'rfp_processing';
    const steps = this.WORKFLOW_STEPS[workflowType] || this.PROCESSING_STEPS;

    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;

    // Update the specific step
    progress.steps[stepIndex] = {
      step: steps[stepIndex].name,
      status,
      message,
      details,
      timestamp: new Date(),
    };

    // Update overall progress
    if (status === 'in_progress') {
      progress.currentStep = steps[stepIndex].name;
      progress.status = 'processing';
    } else if (status === 'completed') {
      progress.completedSteps++;

      // Move to next step if available
      if (stepIndex + 1 < steps.length) {
        progress.currentStep = steps[stepIndex + 1].name;
      }

      // Check if all steps are completed
      if (progress.completedSteps === progress.totalSteps) {
        progress.status = 'completed';
      }
    } else if (status === 'failed') {
      progress.status = 'failed';
      progress.error = message;
    }

    this.progressMap.set(sessionId, progress);
    this.broadcastProgress(sessionId);
  }

  /**
   * Set the RFP ID once it's created
   */
  setRfpId(sessionId: string, rfpId: string): void {
    const progress = this.progressMap.get(sessionId);
    if (progress) {
      progress.rfpId = rfpId;
      this.progressMap.set(sessionId, progress);
      this.broadcastProgress(sessionId);
    }
  }

  /**
   * Get current progress for a session
   */
  getProgress(sessionId: string): RFPProcessingProgress | undefined {
    return this.progressMap.get(sessionId);
  }

  /**
   * Register an SSE client for a session
   */
  registerSSEClient(sessionId: string, res: Response): void {
    console.log(`📡 Registering SSE client for session: ${sessionId}`);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    // Add client to the session's client list
    if (!this.sseClients.has(sessionId)) {
      this.sseClients.set(sessionId, []);
    }
    this.sseClients.get(sessionId)!.push(res);
    console.log(
      `📡 SSE client added. Total clients for session ${sessionId}: ${this.sseClients.get(sessionId)!.length}`
    );

    // Send current progress if available
    const progress = this.progressMap.get(sessionId);
    if (progress) {
      console.log(
        `📡 Sending existing progress to new client: ${progress.status}`
      );
      res.write(
        `data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n`
      );
    } else {
      console.log(`📡 No existing progress found for session: ${sessionId}`);
    }

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(
          `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`
        );
      } catch {
        console.log(
          `📡 Heartbeat failed for session ${sessionId}, client will be removed on close`
        );
        // Don't remove here - let the 'close' handler do it
        clearInterval(heartbeat);
      }
    }, 30000); // Send heartbeat every 30 seconds

    // Handle client disconnect - single consolidated handler
    res.on('close', () => {
      console.log(`📡 SSE client disconnected for session: ${sessionId}`);
      clearInterval(heartbeat);
      this.removeSSEClient(sessionId, res);
    });
  }

  /**
   * Remove an SSE client
   */
  private removeSSEClient(sessionId: string, res: Response): void {
    const clients = this.sseClients.get(sessionId);
    if (clients) {
      const index = clients.indexOf(res);
      if (index > -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        this.sseClients.delete(sessionId);
      }
    }
  }

  /**
   * Broadcast progress updates to all connected clients for a session
   */
  private broadcastProgress(sessionId: string): void {
    const progress = this.progressMap.get(sessionId);
    const clients = this.sseClients.get(sessionId);

    if (progress && clients) {
      const data = JSON.stringify({
        type: 'progress',
        data: progress,
      });

      clients.forEach(client => {
        try {
          client.write(`data: ${data}\n\n`);
        } catch (error) {
          console.error('Error sending SSE:', error);
          this.removeSSEClient(sessionId, client);
        }
      });
    }

    // Emit event for other listeners
    this.emit('progress', sessionId, progress);
  }

  /**
   * Mark processing as complete
   */
  completeTracking(sessionId: string, rfpId: string): void {
    this.updateStep(
      sessionId,
      'completion',
      'completed',
      'RFP processing completed successfully',
      { rfpId }
    );

    // Clean up after a delay
    setTimeout(() => {
      this.progressMap.delete(sessionId);
      const clients = this.sseClients.get(sessionId);
      if (clients) {
        clients.forEach(client => {
          try {
            client.write(
              `data: ${JSON.stringify({ type: 'complete', rfpId })}\n\n`
            );
            client.end();
          } catch {
            // Client may already be disconnected
          }
        });
        this.sseClients.delete(sessionId);
      }
    }, 5000);
  }

  /**
   * Mark processing as failed
   */
  failTracking(sessionId: string, error: string): void {
    const progress = this.progressMap.get(sessionId);
    if (progress) {
      progress.status = 'failed';
      progress.error = error;
      this.broadcastProgress(sessionId);

      // Clean up after a delay
      setTimeout(() => {
        this.progressMap.delete(sessionId);
        const clients = this.sseClients.get(sessionId);
        if (clients) {
          clients.forEach(client => {
            try {
              client.write(
                `data: ${JSON.stringify({ type: 'error', error })}\n\n`
              );
              client.end();
            } catch {
              // Client may already be disconnected
            }
          });
          this.sseClients.delete(sessionId);
        }
      }, 5000);
    }
  }

  /**
   * Shutdown and cleanup all resources
   * Should be called on application shutdown to prevent memory leaks
   */
  shutdown(): void {
    console.log('🛑 ProgressTracker shutdown initiated...');

    // Close all SSE clients
    for (const [, clients] of this.sseClients) {
      clients.forEach(client => {
        try {
          client.write(
            `data: ${JSON.stringify({ type: 'shutdown', message: 'Server shutting down' })}\n\n`
          );
          client.end();
        } catch {
          // Client may already be disconnected
        }
      });
    }

    // Clear all data structures
    this.progressMap.clear();
    this.sseClients.clear();
    this.workflowTypes.clear();

    console.log('✅ ProgressTracker shutdown complete');
  }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();
