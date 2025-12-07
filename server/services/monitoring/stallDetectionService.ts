/**
 * Stall Detection Service
 *
 * Monitors RFP proposal generations to detect, alert, and recover from
 * stalled workflows that get stuck in "drafting" status indefinitely.
 *
 * Key Features:
 * - Detects RFPs stuck in drafting beyond configurable timeout
 * - Automatic retry with configurable max attempts
 * - Notifications for stalls and failures
 * - Manual intervention endpoints (restart, cancel)
 * - Database-backed state (survives server restarts)
 */

import { storage } from '../../storage';

export interface StalledRFP {
  id: string;
  title: string;
  status: string;
  generationStartedAt: Date | null;
  generationTimeoutMinutes: number;
  generationAttempts: number;
  maxGenerationAttempts: number;
  lastGenerationError: string | null;
  progress: number;
}

export interface StallHandlerResult {
  rfpId: string;
  action: 'retry' | 'failed' | 'cancelled';
  newAttemptCount?: number;
  error?: string;
  notificationCreated: boolean;
}

export class StallDetectionService {
  private storageInstance: typeof storage = storage;
  private checkIntervalMs: number = 5 * 60 * 1000; // Check every 5 minutes
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Set storage instance (for testing with mocks)
   */
  setStorage(mockStorage: any): void {
    this.storageInstance = mockStorage;
  }

  /**
   * Detect RFPs that are stalled in "drafting" status
   */
  async detectStalledRFPs(): Promise<StalledRFP[]> {
    console.log('🔍 Checking for stalled RFP generations...');

    try {
      const stalledRFPs = await this.storageInstance.getStalledRFPs();

      if (stalledRFPs.length > 0) {
        console.log(`⚠️ Found ${stalledRFPs.length} stalled RFP generation(s)`);
      }

      return stalledRFPs;
    } catch (error) {
      console.error('❌ Error detecting stalled RFPs:', error);
      return [];
    }
  }

  /**
   * Handle a single stalled RFP - retry or mark as failed
   */
  async handleStalledRFP(rfp: StalledRFP): Promise<StallHandlerResult> {
    console.log(`🔧 Handling stalled RFP: ${rfp.id} (${rfp.title})`);

    const canRetry = rfp.generationAttempts < rfp.maxGenerationAttempts;

    if (canRetry) {
      return await this.retryGeneration(rfp);
    } else {
      return await this.markAsFailed(rfp);
    }
  }

  /**
   * Retry proposal generation for a stalled RFP
   */
  private async retryGeneration(rfp: StalledRFP): Promise<StallHandlerResult> {
    const newAttemptCount = rfp.generationAttempts + 1;

    console.log(
      `🔄 Retrying generation for RFP ${rfp.id} (attempt ${newAttemptCount}/${rfp.maxGenerationAttempts})`
    );

    try {
      // Reset RFP status to discovered so it can be re-queued
      await this.storageInstance.updateRFP(rfp.id, {
        status: 'discovered',
        progress: 0,
        generationAttempts: newAttemptCount,
        generationStartedAt: null,
        lastGenerationError: `Stall detected after ${rfp.generationTimeoutMinutes} minutes. Retry ${newAttemptCount}/${rfp.maxGenerationAttempts}.`,
      });

      // Create notification
      await this.storageInstance.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Retry',
        message: `Proposal generation for "${rfp.title}" stalled and is being retried (attempt ${newAttemptCount}/${rfp.maxGenerationAttempts}).`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });

      // Create audit log
      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfp.id,
        action: 'generation_retry',
        details: {
          attemptNumber: newAttemptCount,
          maxAttempts: rfp.maxGenerationAttempts,
          previousProgress: rfp.progress,
          stallDurationMinutes: rfp.generationTimeoutMinutes,
        },
      });

      return {
        rfpId: rfp.id,
        action: 'retry',
        newAttemptCount,
        notificationCreated: true,
      };
    } catch (error) {
      console.error(`❌ Error retrying generation for RFP ${rfp.id}:`, error);
      return {
        rfpId: rfp.id,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Mark RFP as failed after exhausting retry attempts
   */
  private async markAsFailed(rfp: StalledRFP): Promise<StallHandlerResult> {
    console.log(
      `❌ Marking RFP ${rfp.id} as failed after ${rfp.maxGenerationAttempts} attempts`
    );

    try {
      await this.storageInstance.updateRFP(rfp.id, {
        status: 'discovered', // Reset to discovered so user can manually retry
        progress: 0,
        generationStartedAt: null,
        lastGenerationError: `Generation failed after ${rfp.maxGenerationAttempts} attempts. Manual intervention required.`,
      });

      // Create high-priority notification
      await this.storageInstance.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Failed',
        message: `Proposal generation for "${rfp.title}" failed after ${rfp.maxGenerationAttempts} attempts. Manual intervention required.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });

      // Create audit log
      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfp.id,
        action: 'generation_failed',
        details: {
          totalAttempts: rfp.maxGenerationAttempts,
          lastProgress: rfp.progress,
          requiresManualIntervention: true,
        },
      });

      return {
        rfpId: rfp.id,
        action: 'failed',
        notificationCreated: true,
      };
    } catch (error) {
      console.error(`❌ Error marking RFP ${rfp.id} as failed:`, error);
      return {
        rfpId: rfp.id,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Cancel a stalled generation manually
   */
  async cancelStalledGeneration(
    rfpId: string,
    reason?: string
  ): Promise<StallHandlerResult> {
    console.log(`🚫 Cancelling stalled generation for RFP: ${rfpId}`);

    try {
      const rfp = await this.storageInstance.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      await this.storageInstance.updateRFP(rfpId, {
        status: 'discovered',
        progress: 0,
        generationStartedAt: null,
        lastGenerationError: reason || 'Generation cancelled by user.',
      });

      await this.storageInstance.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Cancelled',
        message: `Proposal generation for "${rfp.title}" was cancelled. ${reason || ''}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
      });

      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfpId,
        action: 'generation_cancelled',
        details: {
          reason: reason || 'User requested cancellation',
          previousProgress: rfp.progress,
          previousStatus: rfp.status,
        },
      });

      return {
        rfpId,
        action: 'cancelled',
        notificationCreated: true,
      };
    } catch (error) {
      console.error(`❌ Error cancelling generation for RFP ${rfpId}:`, error);
      return {
        rfpId,
        action: 'cancelled',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Manually restart generation for an RFP
   */
  async restartGeneration(rfpId: string): Promise<StallHandlerResult> {
    console.log(`🔄 Manually restarting generation for RFP: ${rfpId}`);

    try {
      const rfp = await this.storageInstance.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Reset to discovered state with fresh attempt counter
      await this.storageInstance.updateRFP(rfpId, {
        status: 'discovered',
        progress: 0,
        generationAttempts: 0,
        generationStartedAt: null,
        lastGenerationError: null,
      });

      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfpId,
        action: 'generation_restart',
        details: {
          previousProgress: rfp.progress,
          previousStatus: rfp.status,
          previousAttempts: rfp.generationAttempts,
        },
      });

      return {
        rfpId,
        action: 'retry',
        newAttemptCount: 0,
        notificationCreated: false,
      };
    } catch (error) {
      console.error(`❌ Error restarting generation for RFP ${rfpId}:`, error);
      return {
        rfpId,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Run stall detection check and handle all stalled RFPs
   */
  async runStallCheck(): Promise<StallHandlerResult[]> {
    const stalledRFPs = await this.detectStalledRFPs();
    const results: StallHandlerResult[] = [];

    for (const rfp of stalledRFPs) {
      const result = await this.handleStalledRFP(rfp);
      results.push(result);
    }

    if (results.length > 0) {
      console.log(`✅ Processed ${results.length} stalled RFP(s)`);
    }

    return results;
  }

  /**
   * Start automated stall detection monitoring
   */
  startMonitoring(): void {
    if (this.intervalId) {
      console.log('⚠️ Stall detection monitoring already running');
      return;
    }

    console.log(
      `🚀 Starting stall detection monitoring (interval: ${this.checkIntervalMs / 1000}s)`
    );

    // Run immediately on start
    this.runStallCheck().catch(err =>
      console.error('Error in initial stall check:', err)
    );

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runStallCheck().catch(err =>
        console.error('Error in stall check:', err)
      );
    }, this.checkIntervalMs);
  }

  /**
   * Stop automated stall detection monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Stall detection monitoring stopped');
    }
  }

  /**
   * Get current monitoring status
   */
  isMonitoring(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get check interval in milliseconds
   */
  getCheckIntervalMs(): number {
    return this.checkIntervalMs;
  }

  /**
   * Set check interval (useful for testing)
   */
  setCheckIntervalMs(intervalMs: number): void {
    this.checkIntervalMs = intervalMs;
    // Restart monitoring if already running with new interval
    if (this.intervalId) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
}

// Export singleton instance
export const stallDetectionService = new StallDetectionService();
