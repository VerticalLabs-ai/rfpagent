import { IStorage, storage } from '../storage';
import type {
  Scan,
  ScanEvent,
  InsertScan,
  InsertScanEvent,
} from '@shared/schema';

export interface ScanHistoryItem {
  id: string;
  portalName: string;
  scanType: 'Automated' | 'Manual';
  status: 'completed' | 'failed' | 'completed_with_warnings' | 'running';
  startTime: string;
  endTime?: string;
  rfpsFound: number;
  errors: Array<{
    code: string;
    message: string;
    recoverable: boolean;
  }>;
  duration: string;
}

export interface ScanHistoryFilter {
  portalName?: string;
  status?:
    | 'all'
    | 'completed'
    | 'failed'
    | 'completed_with_warnings'
    | 'running';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class ScanHistoryService {
  constructor(private storage: IStorage) {}

  /**
   * Get scan history with filtering and pagination
   */
  async getScanHistory(
    filter: ScanHistoryFilter = {}
  ): Promise<ScanHistoryItem[]> {
    try {
      // Use getActiveScans() or getScansByPortal() depending on filter
      let scans: any[] = [];
      if (filter.portalName) {
        const portals = await this.storage.getAllPortals();
        const portal = portals.find(p => p.name === filter.portalName);
        if (portal) {
          scans = await this.storage.getScansByPortal(
            portal.id,
            filter.limit || 50
          );
        }
      } else {
        scans = await this.storage.getActiveScans();
      }

      return scans.map((scan: any) => this.convertScanToHistoryItem(scan));
    } catch (error) {
      console.error('Error fetching scan history:', error);
      return [];
    }
  }

  /**
   * Get scan history count for pagination
   */
  async getScanHistoryCount(filter: ScanHistoryFilter = {}): Promise<number> {
    try {
      const scans = await this.getScanHistory(filter);
      return scans.length;
    } catch (error) {
      console.error('Error fetching scan history count:', error);
      return 0;
    }
  }

  /**
   * Get detailed scan information including events
   */
  async getScanDetails(scanId: string): Promise<{
    scan: Scan;
    events: ScanEvent[];
  } | null> {
    try {
      const scan = await this.storage.getScan(scanId);
      if (!scan) return null;

      const events = await this.storage.getScanEvents(scanId);

      return { scan, events };
    } catch (error) {
      console.error('Error fetching scan details:', error);
      return null;
    }
  }

  /**
   * Get scan statistics
   */
  async getScanStatistics(days: number = 30): Promise<{
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    successRate: number;
    totalRfpsDiscovered: number;
    avgRfpsPerScan: number;
    avgScanDuration: number;
    topPortals: Array<{
      portalName: string;
      scanCount: number;
      successRate: number;
      rfpsDiscovered: number;
    }>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const scans = await this.storage.getActiveScans();

      const totalScans = scans.length;
      const successfulScans = scans.filter(
        (s: any) => s.status === 'completed'
      ).length;
      const failedScans = scans.filter(
        (s: any) => s.status === 'failed'
      ).length;
      const successRate =
        totalScans > 0 ? (successfulScans / totalScans) * 100 : 0;

      const totalRfpsDiscovered = scans.reduce(
        (sum: number, scan: any) => sum + (scan.discoveredRfpsCount || 0),
        0
      );
      const avgRfpsPerScan =
        totalScans > 0 ? totalRfpsDiscovered / totalScans : 0;

      // Calculate average scan duration
      const completedScans = scans.filter(
        (s: any) => s.completedAt && s.startedAt
      );
      const totalDuration = completedScans.reduce((sum: number, scan: any) => {
        const duration =
          new Date(scan.completedAt!).getTime() -
          new Date(scan.startedAt).getTime();
        return sum + duration;
      }, 0);
      const avgScanDuration =
        completedScans.length > 0 ? totalDuration / completedScans.length : 0;

      // Top portals by performance
      const portalStats = new Map<
        string,
        {
          scanCount: number;
          successCount: number;
          rfpsDiscovered: number;
        }
      >();

      scans.forEach((scan: any) => {
        const current = portalStats.get(scan.portalName) || {
          scanCount: 0,
          successCount: 0,
          rfpsDiscovered: 0,
        };

        current.scanCount++;
        if (scan.status === 'completed') {
          current.successCount++;
        }
        current.rfpsDiscovered += scan.discoveredRfpsCount || 0;

        portalStats.set(scan.portalName, current);
      });

      const topPortals = Array.from(portalStats.entries())
        .map(([portalName, stats]) => ({
          portalName,
          scanCount: stats.scanCount,
          successRate: (stats.successCount / stats.scanCount) * 100,
          rfpsDiscovered: stats.rfpsDiscovered,
        }))
        .sort((a, b) => b.rfpsDiscovered - a.rfpsDiscovered)
        .slice(0, 10);

      return {
        totalScans,
        successfulScans,
        failedScans,
        successRate,
        totalRfpsDiscovered,
        avgRfpsPerScan,
        avgScanDuration,
        topPortals,
      };
    } catch (error) {
      console.error('Error calculating scan statistics:', error);
      return {
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        successRate: 0,
        totalRfpsDiscovered: 0,
        avgRfpsPerScan: 0,
        avgScanDuration: 0,
        topPortals: [],
      };
    }
  }

  /**
   * Create a new scan record
   */
  async createScan(portalId: string, portalName: string): Promise<string> {
    try {
      const scanData: InsertScan = {
        portalId,
        portalName,
        status: 'running',
        currentStep: 'initializing',
        currentProgress: 0,
        discoveredRfpsCount: 0,
        errorCount: 0,
      };

      const scan = await this.storage.createScan(scanData);
      return scan.id;
    } catch (error) {
      console.error('Error creating scan record:', error);
      throw new Error('Failed to create scan record');
    }
  }

  /**
   * Update scan progress and status
   */
  async updateScan(
    scanId: string,
    updates: {
      status?: string;
      currentStep?: string;
      currentProgress?: number;
      currentMessage?: string;
      discoveredRfpsCount?: number;
      errorCount?: number;
      errors?: any[];
      discoveredRfps?: any[];
      completedAt?: Date;
    }
  ): Promise<void> {
    try {
      await this.storage.updateScan(scanId, updates);
    } catch (error) {
      console.error('Error updating scan:', error);
      throw new Error('Failed to update scan');
    }
  }

  /**
   * Add a scan event
   */
  async addScanEvent(
    scanId: string,
    event: {
      type: string;
      level?: string;
      message?: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      const eventData: InsertScanEvent = {
        scanId,
        type: event.type,
        level: event.level,
        message: event.message,
        data: event.data,
      };

      await this.storage.appendScanEvent(eventData);
    } catch (error) {
      console.error('Error adding scan event:', error);
    }
  }

  /**
   * Convert database scan to history item format
   */
  private convertScanToHistoryItem(scan: Scan): ScanHistoryItem {
    const startTime = new Date(scan.startedAt).toISOString();
    const endTime = scan.completedAt
      ? new Date(scan.completedAt).toISOString()
      : undefined;

    // Calculate duration
    let duration = 'N/A';
    if (scan.completedAt) {
      const durationMs =
        new Date(scan.completedAt).getTime() -
        new Date(scan.startedAt).getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      duration = `${minutes}m ${seconds}s`;
    }

    // Determine scan type based on pattern (manual scans might have specific patterns)
    const scanType: 'Automated' | 'Manual' = scan.portalName.includes('Manual')
      ? 'Manual'
      : 'Automated';

    // Convert status to expected format
    let status: 'completed' | 'failed' | 'completed_with_warnings' | 'running';
    if (scan.status === 'completed' && scan.errorCount > 0) {
      status = 'completed_with_warnings';
    } else if (scan.status === 'completed') {
      status = 'completed';
    } else if (scan.status === 'failed') {
      status = 'failed';
    } else {
      status = 'running';
    }

    // Parse errors from scan data
    const errors: Array<{
      code: string;
      message: string;
      recoverable: boolean;
    }> = [];

    if (scan.errors && Array.isArray(scan.errors)) {
      scan.errors.forEach((error: any) => {
        if (typeof error === 'string') {
          errors.push({
            code: 'UNKNOWN_ERROR',
            message: error,
            recoverable: false,
          });
        } else if (error && typeof error === 'object') {
          errors.push({
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || error.toString(),
            recoverable: error.recoverable || false,
          });
        }
      });
    }

    return {
      id: scan.id,
      portalName: scan.portalName,
      scanType,
      status,
      startTime,
      endTime,
      rfpsFound: scan.discoveredRfpsCount || 0,
      errors,
      duration,
    };
  }

  /**
   * Clean up old scan records (keep last N days)
   */
  async cleanupOldScans(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // TODO: Implement deleteOldScans method in storage
      console.log(
        `Would clean up scan records older than ${retentionDays} days (not implemented)`
      );

      return 0;
    } catch (error) {
      console.error('Error cleaning up old scans:', error);
      return 0;
    }
  }
}

export const scanHistoryService = new ScanHistoryService(storage);
