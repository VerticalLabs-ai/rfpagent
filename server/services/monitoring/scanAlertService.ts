import { IStorage, storage } from '../../storage';
import { captureMessage, withScope } from '@sentry/node';

export interface ScanAlert {
  type: 'scan_failure' | 'portal_stale' | 'consecutive_failures';
  portalId: string;
  portalName: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class ScanAlertService {
  private readonly STALE_THRESHOLD_DAYS = 7;
  private readonly CONSECUTIVE_FAILURE_THRESHOLD = 3;

  constructor(private storage: IStorage) {}

  /**
   * Check all portals for alertable conditions
   */
  async checkPortalHealth(): Promise<ScanAlert[]> {
    const alerts: ScanAlert[] = [];

    try {
      const portals = await this.storage.getActivePortals();
      const now = new Date();

      for (const portal of portals) {
        // Check for stale portals
        if (portal.lastScanned) {
          const lastScanned = new Date(portal.lastScanned);
          const daysSinceLastScan = Math.floor(
            (now.getTime() - lastScanned.getTime()) / (24 * 60 * 60 * 1000)
          );

          if (daysSinceLastScan >= this.STALE_THRESHOLD_DAYS) {
            alerts.push({
              type: 'portal_stale',
              portalId: portal.id,
              portalName: portal.name,
              message: `Portal "${portal.name}" hasn't been scanned in ${daysSinceLastScan} days`,
              severity: daysSinceLastScan >= 30 ? 'critical' : 'warning',
              timestamp: now,
              metadata: { daysSinceLastScan, lastScanned: portal.lastScanned },
            });
          }
        }

        // Check for consecutive failures
        if (portal.errorCount >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
          alerts.push({
            type: 'consecutive_failures',
            portalId: portal.id,
            portalName: portal.name,
            message: `Portal "${portal.name}" has failed ${portal.errorCount} consecutive times`,
            severity: portal.errorCount >= 5 ? 'critical' : 'error',
            timestamp: now,
            metadata: {
              errorCount: portal.errorCount,
              lastError: portal.lastError,
            },
          });
        }
      }

      // Send alerts to Sentry if critical
      for (const alert of alerts) {
        if (alert.severity === 'critical') {
          this.sendToSentry(alert);
        }
      }

      // Create notifications for all alerts
      await this.createNotifications(alerts);

    } catch (error) {
      console.error('Error checking portal health:', error);
    }

    return alerts;
  }

  /**
   * Record a scan failure and check if we need to alert
   */
  async recordScanFailure(
    portalId: string,
    portalName: string,
    error: string
  ): Promise<ScanAlert | null> {
    const portal = await this.storage.getPortal(portalId);
    if (!portal) return null;

    const newErrorCount = (portal.errorCount || 0) + 1;

    // Update portal with new error
    await this.storage.updatePortal(portalId, {
      status: 'error',
      lastError: error,
      errorCount: newErrorCount,
    });

    // Check if we need to alert
    if (newErrorCount >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
      const alert: ScanAlert = {
        type: 'consecutive_failures',
        portalId,
        portalName,
        message: `Portal "${portalName}" has failed ${newErrorCount} consecutive times: ${error}`,
        severity: newErrorCount >= 5 ? 'critical' : 'error',
        timestamp: new Date(),
        metadata: { errorCount: newErrorCount, lastError: error },
      };

      if (alert.severity === 'critical') {
        this.sendToSentry(alert);
      }

      await this.createNotifications([alert]);

      return alert;
    }

    return null;
  }

  /**
   * Record a successful scan (resets error count)
   */
  async recordScanSuccess(portalId: string): Promise<void> {
    await this.storage.updatePortal(portalId, {
      status: 'active',
      errorCount: 0,
      lastError: null,
    });
  }

  private sendToSentry(alert: ScanAlert): void {
    withScope(scope => {
      scope.setTag('service', 'portal-monitoring');
      scope.setTag('alert_type', alert.type);
      scope.setTag('portal_id', alert.portalId);
      scope.setTag('severity', alert.severity);
      scope.setContext('alert', {
        portalName: alert.portalName,
        ...alert.metadata,
      });
      scope.setLevel(alert.severity === 'critical' ? 'fatal' : 'error');
      captureMessage(alert.message);
    });
  }

  private async createNotifications(alerts: ScanAlert[]): Promise<void> {
    for (const alert of alerts) {
      try {
        await this.storage.createNotification({
          type: 'system',
          title: this.getAlertTitle(alert.type),
          message: alert.message,
          relatedEntityType: 'portal',
          relatedEntityId: alert.portalId,
          isRead: false,
        });
      } catch (error) {
        console.error('Failed to create notification for alert:', error);
      }
    }
  }

  private getAlertTitle(type: ScanAlert['type']): string {
    switch (type) {
      case 'scan_failure':
        return 'Portal Scan Failed';
      case 'portal_stale':
        return 'Portal Scan Overdue';
      case 'consecutive_failures':
        return 'Portal Requires Attention';
      default:
        return 'Portal Alert';
    }
  }
}

export const scanAlertService = new ScanAlertService(storage);
