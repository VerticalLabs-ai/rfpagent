/**
 * Comprehensive Retry/Backoff/DLQ Service for RFP Processing
 * Handles failed work items with sophisticated retry mechanisms and dead letter queuing
 */

export interface RetryPolicy {
  taskType: string;
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  jitterPercent: number;
  retryableErrors: string[];
  permanentFailureErrors: string[];
  customConditions?: Record<string, any>;
}

export interface RetryAttempt {
  attempt: number;
  timestamp: Date;
  delayMs: number;
  reason: string;
  context?: Record<string, any>;
}

export interface DLQEntry {
  id: string;
  originalWorkItemId: string;
  workItemData: Record<string, any>;
  failureReason: string;
  failureCount: number;
  lastFailureAt: Date;
  canBeReprocessed: boolean;
  escalated: boolean;
  metadata: Record<string, any>;
}

export interface RetryResult {
  shouldRetry: boolean;
  nextRetryAt?: Date;
  delayMs?: number;
  reason: string;
  attempt: number;
  moveToDLQ?: boolean;
}

export class RetryBackoffDlqService {
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private activeRetries: Map<string, RetryAttempt[]> = new Map();
  private dlqEntries: Map<string, DLQEntry> = new Map();

  constructor() {
    this.initializeDefaultRetryPolicies();

    // Check environment variables to enable automatic background services
    const autoRetryScheduler = process.env.AUTO_RETRY_SCHEDULER === 'true';
    const autoDlqMonitor = process.env.AUTO_DLQ_MONITOR === 'true';

    if (autoRetryScheduler) {
      console.log(
        '🔄 Auto-starting retry scheduler (enabled via AUTO_RETRY_SCHEDULER=true)'
      );
      this.startRetryScheduler();
    } else {
      console.log(
        '⏸️ Retry scheduler disabled by default (set AUTO_RETRY_SCHEDULER=true to enable)'
      );
    }

    if (autoDlqMonitor) {
      console.log(
        '🔄 Auto-starting DLQ monitor (enabled via AUTO_DLQ_MONITOR=true)'
      );
      this.startDLQMonitor();
    } else {
      console.log(
        '⏸️ DLQ monitor disabled by default (set AUTO_DLQ_MONITOR=true to enable)'
      );
    }
  }

  /**
   * Initialize default retry policies for different task types
   */
  private initializeDefaultRetryPolicies(): void {
    console.log('🔄 Initializing default retry policies for RFP processing...');

    const policies: RetryPolicy[] = [
      // Portal scanning retry policy
      {
        taskType: 'portal_scan',
        maxRetries: 5,
        initialDelayMs: 2000, // 2 seconds
        backoffMultiplier: 2.0,
        maxDelayMs: 300000, // 5 minutes
        jitterPercent: 10,
        retryableErrors: [
          'NETWORK_ERROR',
          'TIMEOUT',
          'RATE_LIMITED',
          'PORTAL_UNAVAILABLE',
          'CAPTCHA_REQUIRED',
        ],
        permanentFailureErrors: [
          'AUTHENTICATION_FAILED',
          'AUTHORIZATION_DENIED',
          'PORTAL_NOT_FOUND',
          'MALFORMED_URL',
        ],
      },

      // RFP parsing retry policy
      {
        taskType: 'rfp_parsing',
        maxRetries: 3,
        initialDelayMs: 1000, // 1 second
        backoffMultiplier: 1.5,
        maxDelayMs: 60000, // 1 minute
        jitterPercent: 5,
        retryableErrors: ['PARSE_ERROR', 'INCOMPLETE_DATA', 'DOCUMENT_CORRUPT'],
        permanentFailureErrors: [
          'UNSUPPORTED_FORMAT',
          'DOCUMENT_ENCRYPTED',
          'DOCUMENT_EMPTY',
        ],
      },

      // Compliance checking retry policy
      {
        taskType: 'compliance_check',
        maxRetries: 4,
        initialDelayMs: 5000, // 5 seconds
        backoffMultiplier: 1.8,
        maxDelayMs: 600000, // 10 minutes
        jitterPercent: 15,
        retryableErrors: [
          'AI_SERVICE_ERROR',
          'ANALYSIS_TIMEOUT',
          'REFERENCE_DATA_UNAVAILABLE',
        ],
        permanentFailureErrors: [
          'INSUFFICIENT_RFP_DATA',
          'COMPLIANCE_RULES_MISSING',
          'ANALYSIS_IMPOSSIBLE',
        ],
      },

      // Proposal generation retry policy
      {
        taskType: 'proposal_generation',
        maxRetries: 3,
        initialDelayMs: 10000, // 10 seconds
        backoffMultiplier: 2.5,
        maxDelayMs: 1800000, // 30 minutes
        jitterPercent: 20,
        retryableErrors: [
          'AI_GENERATION_ERROR',
          'TEMPLATE_UNAVAILABLE',
          'CONTENT_GENERATION_FAILED',
        ],
        permanentFailureErrors: [
          'REQUIREMENTS_INSUFFICIENT',
          'TEMPLATE_CORRUPT',
          'GENERATION_IMPOSSIBLE',
        ],
      },

      // Portal submission retry policy
      {
        taskType: 'portal_submission',
        maxRetries: 6,
        initialDelayMs: 3000, // 3 seconds
        backoffMultiplier: 1.6,
        maxDelayMs: 900000, // 15 minutes
        jitterPercent: 25,
        retryableErrors: [
          'SUBMISSION_TIMEOUT',
          'PORTAL_BUSY',
          'TEMPORARY_ERROR',
          'NETWORK_INTERRUPTION',
        ],
        permanentFailureErrors: [
          'DEADLINE_PASSED',
          'SUBMISSION_REJECTED',
          'INVALID_CREDENTIALS',
          'PROPOSAL_INVALID',
        ],
      },

      // Document processing retry policy
      {
        taskType: 'document_processing',
        maxRetries: 4,
        initialDelayMs: 2500, // 2.5 seconds
        backoffMultiplier: 2.2,
        maxDelayMs: 480000, // 8 minutes
        jitterPercent: 12,
        retryableErrors: [
          'PROCESSING_ERROR',
          'CONVERSION_FAILED',
          'STORAGE_UNAVAILABLE',
        ],
        permanentFailureErrors: [
          'DOCUMENT_CORRUPTED',
          'FORMAT_UNSUPPORTED',
          'SIZE_EXCEEDED',
        ],
      },

      // AI service interaction retry policy
      {
        taskType: 'ai_service',
        maxRetries: 7,
        initialDelayMs: 1500, // 1.5 seconds
        backoffMultiplier: 1.4,
        maxDelayMs: 120000, // 2 minutes
        jitterPercent: 8,
        retryableErrors: [
          'API_RATE_LIMITED',
          'SERVICE_BUSY',
          'TEMPORARY_UNAVAILABLE',
          'TOKEN_LIMIT_EXCEEDED',
        ],
        permanentFailureErrors: [
          'API_KEY_INVALID',
          'QUOTA_EXCEEDED',
          'REQUEST_TOO_LARGE',
          'MODEL_UNAVAILABLE',
        ],
      },
    ];

    // Register policies
    policies.forEach(policy => {
      this.retryPolicies.set(policy.taskType, policy);
    });

    console.log(
      `✅ Initialized ${policies.length} retry policies for RFP task types`
    );
  }

  /**
   * Determine if a failed work item should be retried
   */
  async shouldRetryWorkItem(
    workItemId: string,
    taskType: string,
    error: string,
    currentRetries: number,
    context?: Record<string, any>
  ): Promise<RetryResult> {
    const policy = this.retryPolicies.get(taskType);
    if (!policy) {
      console.log(`⚠️ No retry policy found for task type: ${taskType}`);
      return {
        shouldRetry: false,
        reason: `No retry policy defined for task type: ${taskType}`,
        attempt: currentRetries + 1,
        moveToDLQ: true,
      };
    }

    // Check if this is a permanent failure
    if (this.isPermanentFailure(error, policy)) {
      return {
        shouldRetry: false,
        reason: `Permanent failure detected: ${error}`,
        attempt: currentRetries + 1,
        moveToDLQ: true,
      };
    }

    // Check if we've exceeded max retries
    if (currentRetries >= policy.maxRetries) {
      return {
        shouldRetry: false,
        reason: `Max retries exceeded (${policy.maxRetries})`,
        attempt: currentRetries + 1,
        moveToDLQ: true,
      };
    }

    // Check if error is retryable
    if (!this.isRetryableError(error, policy)) {
      return {
        shouldRetry: false,
        reason: `Error is not retryable: ${error}`,
        attempt: currentRetries + 1,
        moveToDLQ: true,
      };
    }

    // Calculate retry delay with exponential backoff
    const attempt = currentRetries + 1;
    const delayMs = this.calculateRetryDelay(attempt, policy);
    const nextRetryAt = new Date(Date.now() + delayMs);

    // Record retry attempt
    this.recordRetryAttempt(workItemId, attempt, delayMs, error, context);

    console.log(
      `🔄 Scheduling retry ${attempt}/${policy.maxRetries} for work item ${workItemId} in ${delayMs}ms`
    );

    return {
      shouldRetry: true,
      nextRetryAt,
      delayMs,
      reason: `Retryable error, attempt ${attempt}/${policy.maxRetries}`,
      attempt,
      moveToDLQ: false,
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    // Basic exponential backoff calculation
    let delayMs =
      policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);

    // Apply maximum delay cap
    delayMs = Math.min(delayMs, policy.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitterAmount = delayMs * (policy.jitterPercent / 100);
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
    delayMs = Math.max(0, delayMs + jitter);

    return Math.round(delayMs);
  }

  /**
   * Check if an error represents a permanent failure
   */
  private isPermanentFailure(error: string, policy: RetryPolicy): boolean {
    return policy.permanentFailureErrors.some(
      permanentError =>
        error.includes(permanentError) || error === permanentError
    );
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: string, policy: RetryPolicy): boolean {
    return policy.retryableErrors.some(
      retryableError =>
        error.includes(retryableError) || error === retryableError
    );
  }

  /**
   * Record a retry attempt
   */
  private recordRetryAttempt(
    workItemId: string,
    attempt: number,
    delayMs: number,
    reason: string,
    context?: Record<string, any>
  ): void {
    const retryAttempt: RetryAttempt = {
      attempt,
      timestamp: new Date(),
      delayMs,
      reason,
      context,
    };

    if (!this.activeRetries.has(workItemId)) {
      this.activeRetries.set(workItemId, []);
    }

    this.activeRetries.get(workItemId)!.push(retryAttempt);
  }

  /**
   * Move a work item to the Dead Letter Queue
   */
  async moveToDeadLetterQueue(
    workItemId: string,
    workItemData: Record<string, any>,
    failureReason: string,
    failureCount: number,
    canBeReprocessed: boolean = true,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Import storage dynamically to avoid circular imports
      const { storage } = await import('../../storage');

      const lastFailureAt = new Date();
      const enrichedMetadata = {
        ...metadata,
        movedToDLQAt: lastFailureAt.toISOString(),
        retryHistory: this.activeRetries.get(workItemId) || [],
      };

      // Store in database and capture the database-assigned ID
      const createdEntry = await storage.createDeadLetterQueueEntry({
        originalWorkItemId: workItemId,
        workItemData,
        failureReason,
        failureCount,
        lastFailureAt,
        canBeReprocessed,
        reprocessAttempts: 0,
        maxReprocessAttempts: canBeReprocessed ? 5 : 0,
        metadata: enrichedMetadata,
      });

      // Create in-memory DLQ entry using the database-assigned ID
      const dlqEntry: DLQEntry = {
        id: createdEntry.id, // Use database-assigned ID
        originalWorkItemId: workItemId,
        workItemData,
        failureReason,
        failureCount,
        lastFailureAt,
        canBeReprocessed,
        escalated: false,
        metadata: enrichedMetadata,
      };

      // Store in memory for quick access using the database ID
      this.dlqEntries.set(createdEntry.id, dlqEntry);

      // Clean up retry history
      this.activeRetries.delete(workItemId);

      console.log(
        `💀 Moved work item ${workItemId} to Dead Letter Queue (ID: ${createdEntry.id}): ${failureReason}`
      );

      // Check if this requires immediate escalation
      if (failureCount >= 10 || this.isHighPriorityFailure(failureReason)) {
        await this.escalateDLQEntry(
          createdEntry.id,
          'High failure count or critical error'
        );
      }
    } catch (error) {
      console.error(`❌ Failed to move work item ${workItemId} to DLQ:`, error);
      throw error;
    }
  }

  /**
   * Check if this is a high priority failure requiring immediate escalation
   */
  private isHighPriorityFailure(failureReason: string): boolean {
    const highPriorityErrors = [
      'SECURITY_VIOLATION',
      'DATA_CORRUPTION',
      'SYSTEM_CRITICAL',
      'DEADLINE_MISSED',
      'COMPLIANCE_VIOLATION',
    ];

    return highPriorityErrors.some(error => failureReason.includes(error));
  }

  /**
   * Escalate a DLQ entry for manual intervention
   */
  async escalateDLQEntry(dlqEntryId: string, reason: string): Promise<void> {
    const entry = this.dlqEntries.get(dlqEntryId);
    if (!entry) {
      console.error(`DLQ entry not found: ${dlqEntryId}`);
      return;
    }

    entry.escalated = true;
    entry.metadata.escalatedAt = new Date().toISOString();
    entry.metadata.escalationReason = reason;

    try {
      // Import storage dynamically
      const { storage } = await import('../../storage');

      // Update database record directly using the provided dlqEntryId
      await storage.updateDeadLetterQueueEntry(dlqEntryId, {
        escalatedAt: new Date(),
        metadata: entry.metadata,
      });

      console.log(`🚨 Escalated DLQ entry ${dlqEntryId}: ${reason}`);

      // Here you could integrate with notification systems, ticketing systems, etc.
      await this.sendEscalationNotification(entry, reason);
    } catch (error) {
      console.error(`❌ Failed to escalate DLQ entry ${dlqEntryId}:`, error);
    }
  }

  /**
   * Send escalation notification (placeholder for integration)
   */
  private async sendEscalationNotification(
    entry: DLQEntry,
    reason: string
  ): Promise<void> {
    // This could integrate with email, Slack, PagerDuty, etc.
    console.log(
      `📢 ESCALATION NOTIFICATION: Work item ${entry.originalWorkItemId} requires manual intervention`
    );
    console.log(`   Reason: ${reason}`);
    console.log(`   Failure: ${entry.failureReason}`);
    console.log(`   Failure Count: ${entry.failureCount}`);

    // Example integration with notification system
    try {
      // await notificationService.sendAlert({
      //   type: 'dlq_escalation',
      //   workItemId: entry.originalWorkItemId,
      //   reason,
      //   failureReason: entry.failureReason,
      //   priority: 'high'
      // });
    } catch (error) {
      console.error('Failed to send escalation notification:', error);
    }
  }

  /**
   * Attempt to reprocess a DLQ entry
   */
  async reprocessDLQEntry(
    dlqEntryId: string,
    triggeredBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const entry = this.dlqEntries.get(dlqEntryId);
    if (!entry) {
      return { success: false, error: `DLQ entry not found: ${dlqEntryId}` };
    }

    if (!entry.canBeReprocessed) {
      return { success: false, error: 'Entry is marked as non-reprocessable' };
    }

    try {
      // Import storage
      const { storage } = await import('../../storage');

      // Create a new work item from the DLQ entry
      const reprocessedWorkItem = {
        ...entry.workItemData,
        status: 'pending',
        retries: 0,
        assignedAgentId: null,
        metadata: {
          ...entry.workItemData.metadata,
          reprocessedFrom: dlqEntryId,
          reprocessedBy: triggeredBy,
          reprocessedAt: new Date().toISOString(),
          originalFailureReason: entry.failureReason,
          reprocessReason: reason,
        },
      };

      // Create new work item
      const newWorkItem = await storage.createWorkItem(
        reprocessedWorkItem as any
      );

      // Update DLQ entry
      await storage.updateDeadLetterQueueEntry(dlqEntryId, {
        reprocessAttempts: (entry.metadata.reprocessAttempts || 0) + 1,
        metadata: {
          ...entry.metadata,
          reprocessedAt: new Date().toISOString(),
          reprocessedBy: triggeredBy,
          newWorkItemId: newWorkItem.id,
        },
      });

      // Remove from memory DLQ (will be added back if it fails again)
      this.dlqEntries.delete(dlqEntryId);

      console.log(
        `🔄 Reprocessed DLQ entry ${dlqEntryId} as new work item ${newWorkItem.id}`
      );
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to reprocess DLQ entry ${dlqEntryId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Start the retry scheduler that processes pending retries (disabled by default)
   */
  startRetryScheduler(): void {
    console.log('⏰ Starting retry scheduler...');

    setInterval(async () => {
      await this.processScheduledRetries();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process work items that are scheduled for retry
   */
  private async processScheduledRetries(): Promise<void> {
    try {
      const { storage } = await import('../../storage');

      // Get work items that are ready for retry
      const workItems = await storage.getWorkItems();
      const retryableItems = workItems.filter(
        item =>
          item.status === 'failed' &&
          item.nextRetryAt &&
          new Date(item.nextRetryAt) <= new Date() &&
          item.canRetry
      );

      if (retryableItems.length === 0) {
        return;
      }

      console.log(
        `🔄 Processing ${retryableItems.length} scheduled retries...`
      );

      for (const item of retryableItems) {
        try {
          // Reset work item for retry
          await storage.updateWorkItem(item.id, {
            status: 'pending',
            assignedAgentId: null,
            nextRetryAt: null,
            lastRetryAt: new Date(),
            updatedAt: new Date(),
          });

          console.log(
            `⚡ Requeued work item ${item.id} for retry (attempt ${item.retries + 1})`
          );
        } catch (error) {
          console.error(`❌ Failed to requeue work item ${item.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in retry scheduler:', error);
    }
  }

  /**
   * Start the DLQ monitor for proactive management (disabled by default)
   */
  startDLQMonitor(): void {
    console.log('👁️ Starting DLQ monitor...');

    setInterval(async () => {
      await this.monitorDLQHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Monitor DLQ health and perform proactive management
   */
  private async monitorDLQHealth(): Promise<void> {
    try {
      const { storage } = await import('../../storage');
      const dlqEntries = await storage.getDeadLetterQueueEntries();

      const stats = {
        total: dlqEntries.length,
        canReprocess: dlqEntries.filter(
          e => e.canBeReprocessed && !e.escalatedAt
        ).length,
        escalated: dlqEntries.filter(e => e.escalatedAt).length,
        oldEntries: dlqEntries.filter(e => {
          const hoursSinceFailure =
            (Date.now() - new Date(e.lastFailureAt).getTime()) /
            (1000 * 60 * 60);
          return hoursSinceFailure > 24;
        }).length,
      };

      // Log DLQ statistics
      if (stats.total > 0) {
        console.log(
          `📊 DLQ Health: ${stats.total} total, ${stats.canReprocess} reprocessable, ${stats.escalated} escalated, ${stats.oldEntries} old`
        );
      }

      // Alert on high DLQ volume
      if (stats.total > 100) {
        console.log(`🚨 HIGH DLQ VOLUME: ${stats.total} entries detected`);
      }

      // Auto-escalate old entries
      const autoEscalateThresholdHours = 48;
      const oldUnescalatedEntries = dlqEntries.filter(e => {
        const hoursSinceFailure =
          (Date.now() - new Date(e.lastFailureAt).getTime()) / (1000 * 60 * 60);
        return hoursSinceFailure > autoEscalateThresholdHours && !e.escalatedAt;
      });

      for (const entry of oldUnescalatedEntries) {
        await this.escalateDLQEntry(
          entry.id,
          `Auto-escalation: entry older than ${autoEscalateThresholdHours} hours`
        );
      }
    } catch (error) {
      console.error('❌ Error in DLQ monitor:', error);
    }
  }

  /**
   * Get retry statistics for a work item
   */
  getRetryStatistics(workItemId: string): RetryAttempt[] | undefined {
    return this.activeRetries.get(workItemId);
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStatistics(): Promise<{
    totalEntries: number;
    reprocessableEntries: number;
    escalatedEntries: number;
    entriesByTaskType: Record<string, number>;
    entriesByFailureReason: Record<string, number>;
  }> {
    try {
      const { storage } = await import('../../storage');
      const dlqEntries = await storage.getDeadLetterQueueEntries();

      const stats = {
        totalEntries: dlqEntries.length,
        reprocessableEntries: dlqEntries.filter(
          e => e.canBeReprocessed && !e.escalatedAt
        ).length,
        escalatedEntries: dlqEntries.filter(e => e.escalatedAt).length,
        entriesByTaskType: {} as Record<string, number>,
        entriesByFailureReason: {} as Record<string, number>,
      };

      // Group by task type and failure reason
      dlqEntries.forEach(entry => {
        const taskType = entry.workItemData?.taskType || 'unknown';
        stats.entriesByTaskType[taskType] =
          (stats.entriesByTaskType[taskType] || 0) + 1;

        const failureReason = entry.failureReason || 'unknown';
        stats.entriesByFailureReason[failureReason] =
          (stats.entriesByFailureReason[failureReason] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting DLQ statistics:', error);
      return {
        totalEntries: 0,
        reprocessableEntries: 0,
        escalatedEntries: 0,
        entriesByTaskType: {},
        entriesByFailureReason: {},
      };
    }
  }

  /**
   * Update retry policy for a task type
   */
  updateRetryPolicy(taskType: string, policy: Partial<RetryPolicy>): void {
    const existingPolicy = this.retryPolicies.get(taskType);
    if (!existingPolicy) {
      throw new Error(
        `No existing retry policy found for task type: ${taskType}`
      );
    }

    const updatedPolicy: RetryPolicy = {
      ...existingPolicy,
      ...policy,
      taskType, // Ensure taskType cannot be changed
    };

    this.retryPolicies.set(taskType, updatedPolicy);
    console.log(`🔧 Updated retry policy for task type: ${taskType}`);
  }

  /**
   * Get all retry policies
   */
  getAllRetryPolicies(): Record<string, RetryPolicy> {
    const policies: Record<string, RetryPolicy> = {};
    this.retryPolicies.forEach((policy, taskType) => {
      policies[taskType] = policy;
    });
    return policies;
  }
}

// Export singleton instance
export const retryBackoffDlqService = new RetryBackoffDlqService();
