import cron from 'node-cron';
import {
  PortalMonitoringService,
  PortalScanResult,
} from './portal-monitoring-service';
import { IStorage } from '../storage';
import { Portal } from '@shared/schema';

export interface ScheduledJob {
  portalId: string;
  portalName: string;
  cronExpression: string;
  task: cron.ScheduledTask;
  lastRun?: Date;
  nextRun?: Date;
  isActive: boolean;
}

export class PortalSchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private globalScanJob?: cron.ScheduledTask;

  constructor(
    private storage: IStorage,
    private monitoringService: PortalMonitoringService
  ) {}

  /**
   * Initialize the scheduler with all active portals
   */
  async initialize(): Promise<void> {
    console.log('Initializing Portal Scheduler Service...');

    try {
      // Load all active portals and create individual schedules
      const activePortals = await this.storage.getActivePortals();

      for (const portal of activePortals) {
        await this.schedulePortalMonitoring(portal);
      }

      // Set up global scan job (runs every 6 hours as a backup)
      this.scheduleGlobalScan();

      console.log(
        `Portal Scheduler initialized with ${activePortals.length} portals`
      );
      console.log('Scheduled jobs:', Array.from(this.jobs.keys()));
    } catch (error) {
      console.error('Failed to initialize Portal Scheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule monitoring for a specific portal based on its scan frequency
   */
  async schedulePortalMonitoring(portal: Portal): Promise<void> {
    try {
      // Remove existing job if it exists
      if (this.jobs.has(portal.id)) {
        this.unschedulePortal(portal.id);
      }

      // Create cron expression based on portal's scan frequency (hours)
      const cronExpression = this.createCronExpression(portal.scanFrequency);

      console.log(
        `Scheduling portal "${portal.name}" with frequency: every ${portal.scanFrequency} hours (${cronExpression})`
      );

      // Create and start the scheduled task
      const task = cron.schedule(
        cronExpression,
        async () => {
          await this.executePortalScan(portal.id, portal.name);
        },
        {
          scheduled: true,
          name: `portal-monitor-${portal.id}`,
          timezone: 'America/Chicago', // iByte is in Texas
        }
      );

      // Store job info
      const scheduledJob: ScheduledJob = {
        portalId: portal.id,
        portalName: portal.name,
        cronExpression,
        task,
        nextRun: this.getNextRun(cronExpression),
        isActive: true,
      };

      this.jobs.set(portal.id, scheduledJob);

      console.log(
        `Successfully scheduled portal monitoring for: ${portal.name}`
      );
    } catch (error) {
      console.error(`Failed to schedule portal ${portal.name}:`, error);
    }
  }

  /**
   * Execute portal scan and handle results
   */
  private async executePortalScan(
    portalId: string,
    portalName: string
  ): Promise<void> {
    const startTime = new Date();
    console.log(
      `[SCHEDULER] Starting scheduled scan for portal: ${portalName}`
    );

    try {
      const result = await this.monitoringService.scanPortal(portalId);

      // Update job last run time
      const job = this.jobs.get(portalId);
      if (job) {
        job.lastRun = startTime;
        job.nextRun = this.getNextRun(job.cronExpression);
      }

      // Log results
      console.log(`[SCHEDULER] Scan completed for ${portalName}:`, {
        success: result.success,
        newRFPs: result.discoveredRFPs.length,
        errors: result.errors.length,
        duration: result.scanDuration,
      });

      // Send notifications if there were errors or new discoveries
      if (result.errors.length > 0) {
        await this.handleScanErrors(portalId, portalName, result);
      }

      if (result.discoveredRFPs.length > 0) {
        await this.handleNewDiscoveries(portalId, portalName, result);
      }
    } catch (error) {
      console.error(`[SCHEDULER] Failed to scan portal ${portalName}:`, error);

      // Create error notification
      await this.storage.createNotification({
        type: 'discovery',
        title: 'Portal Scan Failed',
        message: `Scheduled scan failed for portal "${portalName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        relatedEntityType: 'portal',
        relatedEntityId: portalId,
        isRead: false,
      });
    }
  }

  /**
   * Handle scan errors by creating notifications and updating portal status
   */
  private async handleScanErrors(
    portalId: string,
    portalName: string,
    result: PortalScanResult
  ): Promise<void> {
    try {
      await this.storage.createNotification({
        type: 'discovery',
        title: 'Portal Scan Errors',
        message: `Portal "${portalName}" scan completed with ${result.errors.length} errors: ${result.errors.join(', ')}`,
        relatedEntityType: 'portal',
        relatedEntityId: portalId,
        isRead: false,
      });
    } catch (error) {
      console.error('Failed to create error notification:', error);
    }
  }

  /**
   * Handle new RFP discoveries by creating notifications
   */
  private async handleNewDiscoveries(
    portalId: string,
    portalName: string,
    result: PortalScanResult
  ): Promise<void> {
    try {
      const count = result.discoveredRFPs.length;
      const message =
        count === 1
          ? `Found 1 new RFP on portal "${portalName}": ${result.discoveredRFPs[0].title}`
          : `Found ${count} new RFPs on portal "${portalName}"`;

      await this.storage.createNotification({
        type: 'discovery',
        title: 'New RFPs Discovered',
        message,
        relatedEntityType: 'portal',
        relatedEntityId: portalId,
        isRead: false,
      });
    } catch (error) {
      console.error('Failed to create discovery notification:', error);
    }
  }

  /**
   * Schedule a global scan that monitors all portals (backup job)
   */
  private scheduleGlobalScan(): void {
    // Run every 6 hours as a backup to individual portal schedules
    this.globalScanJob = cron.schedule(
      '0 */6 * * *',
      async () => {
        console.log('[SCHEDULER] Running global portal scan...');
        try {
          const results = await this.monitoringService.scanAllPortals();
          const totalNewRFPs = results.reduce(
            (sum, result) => sum + result.discoveredRFPs.length,
            0
          );
          const failedScans = results.filter(result => !result.success).length;

          console.log(
            `[SCHEDULER] Global scan completed: ${totalNewRFPs} new RFPs, ${failedScans} failed scans`
          );

          // Create summary notification if there are significant results
          if (totalNewRFPs > 0 || failedScans > 0) {
            await this.storage.createNotification({
              type: 'discovery',
              title: 'Global Portal Scan Summary',
              message: `Global scan completed: ${totalNewRFPs} new RFPs discovered across ${results.length} portals. ${failedScans} portals had errors.`,
              isRead: false,
            });
          }
        } catch (error) {
          console.error('[SCHEDULER] Global scan failed:', error);
        }
      },
      {
        scheduled: true,
        name: 'global-portal-scan',
        timezone: 'America/Chicago',
      }
    );

    console.log('Global portal scan scheduled (every 6 hours)');
  }

  /**
   * Create cron expression from scan frequency in hours
   */
  private createCronExpression(frequencyHours: number): string {
    if (frequencyHours <= 1) {
      // Every hour at minute 0
      return '0 * * * *';
    } else if (frequencyHours <= 6) {
      // Every N hours
      return `0 */${frequencyHours} * * *`;
    } else if (frequencyHours <= 12) {
      // Twice daily
      return '0 6,18 * * *';
    } else {
      // Once daily at 6 AM
      return '0 6 * * *';
    }
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRun(cronExpression: string): Date | undefined {
    try {
      const task = cron.schedule(cronExpression, () => {}, {
        scheduled: false,
      });
      // This is a simplified approach - in production you'd use a proper cron parser
      return new Date(Date.now() + 60 * 60 * 1000); // Approximate next hour
    } catch (error) {
      console.error('Failed to calculate next run time:', error);
      return undefined;
    }
  }

  /**
   * Update a portal's monitoring schedule
   */
  async updatePortalSchedule(portalId: string): Promise<void> {
    try {
      const portal = await this.storage.getPortal(portalId);
      if (!portal) {
        throw new Error(`Portal not found: ${portalId}`);
      }

      await this.schedulePortalMonitoring(portal);
      console.log(`Updated schedule for portal: ${portal.name}`);
    } catch (error) {
      console.error(`Failed to update schedule for portal ${portalId}:`, error);
      throw error;
    }
  }

  /**
   * Remove portal from scheduling
   */
  unschedulePortal(portalId: string): void {
    const job = this.jobs.get(portalId);
    if (job) {
      job.task.stop();
      job.task.destroy();
      this.jobs.delete(portalId);
      console.log(`Unscheduled portal monitoring for: ${job.portalName}`);
    }
  }

  /**
   * Get all active scheduled jobs
   */
  getActiveJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).filter(job => job.isActive);
  }

  /**
   * Get job status for a specific portal
   */
  getPortalJobStatus(portalId: string): ScheduledJob | undefined {
    return this.jobs.get(portalId);
  }

  /**
   * Manually trigger a portal scan (outside of schedule)
   */
  async triggerManualScan(portalId: string): Promise<PortalScanResult> {
    console.log(`[SCHEDULER] Manual scan triggered for portal: ${portalId}`);
    return await this.monitoringService.scanPortal(portalId);
  }

  /**
   * Pause a portal's scheduled monitoring
   */
  pausePortalMonitoring(portalId: string): void {
    const job = this.jobs.get(portalId);
    if (job && job.isActive) {
      job.task.stop();
      job.isActive = false;
      console.log(`Paused monitoring for portal: ${job.portalName}`);
    }
  }

  /**
   * Resume a portal's scheduled monitoring
   */
  resumePortalMonitoring(portalId: string): void {
    const job = this.jobs.get(portalId);
    if (job && !job.isActive) {
      job.task.start();
      job.isActive = true;
      console.log(`Resumed monitoring for portal: ${job.portalName}`);
    }
  }

  /**
   * Cleanup all scheduled jobs (for shutdown)
   */
  shutdown(): void {
    console.log('Shutting down Portal Scheduler Service...');

    // Stop all individual portal jobs
    for (const [portalId, job] of this.jobs.entries()) {
      try {
        job.task.stop();
        job.task.destroy();
      } catch (error) {
        console.error(`Error stopping job for portal ${portalId}:`, error);
      }
    }
    this.jobs.clear();

    // Stop global scan job
    if (this.globalScanJob) {
      try {
        this.globalScanJob.stop();
        this.globalScanJob.destroy();
      } catch (error) {
        console.error('Error stopping global scan job:', error);
      }
    }

    console.log('Portal Scheduler Service shutdown complete');
  }
}
