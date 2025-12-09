import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export interface ScanEvent {
  type:
    | 'scan_started'
    | 'step_update'
    | 'log'
    | 'progress'
    | 'rfp_discovered'
    | 'error'
    | 'scan_completed'
    | 'scan_failed';
  timestamp: Date;
  data: any;
  message?: string;
}

export interface ScanStep {
  step:
    | 'initializing'
    | 'authenticating'
    | 'authenticated'
    | 'navigating'
    | 'extracting'
    | 'parsing'
    | 'saving'
    | 'completed'
    | 'failed';
  progress: number; // 0-100
  message: string;
}

export interface ScanState {
  scanId: string;
  portalId: string;
  portalName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  currentStep: ScanStep;
  errors: string[];
  discoveredRFPs: Array<{
    title: string;
    agency: string;
    sourceUrl: string;
    deadline?: Date;
    estimatedValue?: number;
  }>;
  events: ScanEvent[];
}

export interface ScanSummary {
  scanId: string;
  portalId: string;
  portalName: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  success: boolean;
  rfpCount: number;
  errorCount: number;
}

export class ScanManager {
  private activeScans = new Map<string, ScanState>();
  private scanEmitters = new Map<string, EventEmitter>();
  private scanHistory = new Map<string, ScanSummary[]>(); // portalId -> recent scans
  private readonly MAX_HISTORY_PER_PORTAL = 20;
  private readonly MAX_EVENTS_PER_SCAN = 1000;

  // Memory leak protection - limit active scans
  private readonly MAX_ACTIVE_SCANS = 100;

  // Track cleanup timeout handles
  private cleanupTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Start a new scan and return the scanId
   */
  startScan(portalId: string, portalName: string): string {
    // Memory leak protection - clean up oldest scan if at limit
    if (this.activeScans.size >= this.MAX_ACTIVE_SCANS) {
      const oldestScanId = this.activeScans.keys().next().value;
      if (oldestScanId) {
        console.warn(
          `ScanManager: Max active scans (${this.MAX_ACTIVE_SCANS}) reached, force-cleaning oldest scan ${oldestScanId}`
        );
        this.forceCleanupScan(oldestScanId);
      }
    }

    const scanId = randomUUID();
    const startedAt = new Date();

    const initialStep: ScanStep = {
      step: 'initializing',
      progress: 0,
      message: 'Starting portal scan...',
    };

    const scanState: ScanState = {
      scanId,
      portalId,
      portalName,
      status: 'running',
      startedAt,
      currentStep: initialStep,
      errors: [],
      discoveredRFPs: [],
      events: [],
    };

    // Create EventEmitter for this scan
    const emitter = new EventEmitter();
    // Set max listeners to prevent warnings
    emitter.setMaxListeners(20);
    this.scanEmitters.set(scanId, emitter);
    this.activeScans.set(scanId, scanState);

    // Safety timeout - force cleanup after 30 minutes if scan doesn't complete
    const timeout = setTimeout(
      () => {
        console.warn(`ScanManager: Scan ${scanId} timeout - force completing`);
        this.completeScan(scanId, false);
      },
      30 * 60 * 1000
    ); // 30 minutes
    this.cleanupTimeouts.set(scanId, timeout);

    // Emit initial event
    this.emitEvent(scanId, {
      type: 'scan_started',
      timestamp: startedAt,
      data: { portalId, portalName },
      message: `Started scanning ${portalName}`,
    });

    console.log(`ScanManager: Started scan ${scanId} for portal ${portalName}`);
    return scanId;
  }

  /**
   * Update scan step and progress
   */
  updateStep(
    scanId: string,
    step: ScanStep['step'],
    progress: number,
    message: string
  ): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) return;

    scan.currentStep = { step, progress, message };

    this.emitEvent(scanId, {
      type: 'step_update',
      timestamp: new Date(),
      data: { step, progress },
      message,
    });

    console.log(`ScanManager: ${scanId} - ${step} (${progress}%): ${message}`);
  }

  /**
   * Log a message for the scan
   */
  log(
    scanId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) return;

    this.emitEvent(scanId, {
      type: 'log',
      timestamp: new Date(),
      data: { level, ...data },
      message,
    });

    if (level === 'error') {
      scan.errors.push(message);
    }

    console.log(`ScanManager: ${scanId} [${level.toUpperCase()}] ${message}`);
  }

  /**
   * Record an RFP discovery
   */
  recordRFPDiscovery(
    scanId: string,
    rfp: ScanState['discoveredRFPs'][0]
  ): void {
    const scan = this.activeScans.get(scanId);
    if (!scan) return;

    scan.discoveredRFPs.push(rfp);

    this.emitEvent(scanId, {
      type: 'rfp_discovered',
      timestamp: new Date(),
      data: rfp,
      message: `Discovered RFP: ${rfp.title}`,
    });

    console.log(`ScanManager: ${scanId} - Discovered RFP: ${rfp.title}`);
  }

  /**
   * Mark scan as completed
   */
  completeScan(scanId: string, success: boolean): void {
    const scan = this.activeScans.get(scanId);
    const emitter = this.scanEmitters.get(scanId);

    // Guard against double-completion
    if (!scan || !emitter) {
      if (!scan && !emitter) {
        console.warn(
          `ScanManager: Attempted to complete non-existent or already completed scan ${scanId}`
        );
      }
      return;
    }

    // Check if already completed
    if (scan.status === 'completed' || scan.status === 'failed') {
      console.warn(
        `ScanManager: Scan ${scanId} already completed with status ${scan.status}, ignoring duplicate completion`
      );
      return;
    }

    const completedAt = new Date();
    scan.completedAt = completedAt;
    scan.status = success ? 'completed' : 'failed';

    if (success) {
      scan.currentStep = {
        step: 'completed',
        progress: 100,
        message: `Scan completed successfully. Found ${scan.discoveredRFPs.length} RFPs.`,
      };
    } else {
      scan.currentStep = {
        step: 'failed',
        progress: 100,
        message: `Scan failed. ${scan.errors.length} errors encountered.`,
      };
    }

    const duration = completedAt.getTime() - scan.startedAt.getTime();
    const eventData = {
      duration,
      rfpCount: scan.discoveredRFPs.length,
      errorCount: scan.errors.length,
    };

    // Log detailed completion info
    console.log(
      `ScanManager: ${scanId} - Scan ${success ? 'completed' : 'failed'} for portal ${scan.portalName}`,
      `Duration: ${(duration / 1000).toFixed(2)}s, RFPs: ${scan.discoveredRFPs.length}, Errors: ${scan.errors.length}`
    );

    // Emit completion event
    this.emitEvent(scanId, {
      type: success ? 'scan_completed' : 'scan_failed',
      timestamp: completedAt,
      data: eventData,
      message: scan.currentStep.message,
    });

    // Add to history
    this.addToHistory(scan);

    // Clean up active scan immediately after event emission
    this.cleanupScan(scanId);
  }

  /**
   * Mark scan as timed out with appropriate error messaging
   */
  timeoutScan(scanId: string, reason?: string): void {
    const scan = this.activeScans.get(scanId);
    if (!scan || scan.status !== 'running') {
      return;
    }

    const timeoutMessage =
      reason ||
      'Scan timed out - the portal may be unresponsive or blocking automated access';

    scan.errors.push(timeoutMessage);
    this.log(scanId, 'error', timeoutMessage);

    scan.currentStep = {
      step: 'failed',
      progress: scan.currentStep.progress, // Keep last known progress
      message: timeoutMessage,
    };

    this.completeScan(scanId, false);
  }

  /**
   * Clean up a scan's resources
   */
  private cleanupScan(scanId: string): void {
    // Clear timeout if exists
    const timeout = this.cleanupTimeouts.get(scanId);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupTimeouts.delete(scanId);
    }

    // Remove emitter listeners
    const emitter = this.scanEmitters.get(scanId);
    if (emitter) {
      emitter.removeAllListeners();
      this.scanEmitters.delete(scanId);
    }

    // Remove active scan
    this.activeScans.delete(scanId);

    console.log(`ScanManager: Cleaned up scan ${scanId}`);
  }

  /**
   * Force cleanup a scan without proper completion
   */
  private forceCleanupScan(scanId: string): void {
    const scan = this.activeScans.get(scanId);
    if (scan && scan.status === 'running') {
      scan.status = 'failed';
      scan.errors.push('Scan forcefully terminated due to system limits');
    }
    this.cleanupScan(scanId);
  }

  /**
   * Shutdown and cleanup all resources
   * Should be called on application shutdown to prevent memory leaks
   */
  shutdown(): void {
    console.log('🛑 ScanManager shutdown initiated...');

    // Clear all timeouts
    for (const timeout of this.cleanupTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.cleanupTimeouts.clear();

    // Remove all emitter listeners
    for (const emitter of this.scanEmitters.values()) {
      emitter.removeAllListeners();
    }

    // Clear all data structures
    this.activeScans.clear();
    this.scanEmitters.clear();
    this.scanHistory.clear();

    console.log('✅ ScanManager shutdown complete');
  }

  /**
   * Get current scan state
   */
  getScan(scanId: string): ScanState | undefined {
    return this.activeScans.get(scanId);
  }

  /**
   * Get scan history for a portal
   */
  getScanHistory(portalId: string, limit = 10): ScanSummary[] {
    const history = this.scanHistory.get(portalId) || [];
    return history.slice(0, Math.min(limit, history.length));
  }

  /**
   * Get EventEmitter for a specific scan (for SSE)
   */
  getScanEmitter(scanId: string): EventEmitter | undefined {
    return this.scanEmitters.get(scanId);
  }

  /**
   * Get EventEmitter for a specific scan (for SSE) - alias for compatibility
   */
  getEventEmitter(scanId: string): EventEmitter | undefined {
    return this.scanEmitters.get(scanId);
  }

  /**
   * Get all active scans
   */
  getActiveScans(): ScanState[] {
    return Array.from(this.activeScans.values());
  }

  /**
   * Check if a portal is currently being scanned
   */
  isPortalScanning(portalId: string): boolean {
    return Array.from(this.activeScans.values()).some(
      scan => scan.portalId === portalId
    );
  }

  /**
   * Emit an event for a scan
   */
  private emitEvent(scanId: string, event: ScanEvent): void {
    const scan = this.activeScans.get(scanId);
    const emitter = this.scanEmitters.get(scanId);

    if (scan && emitter) {
      scan.events.push(event);

      // Enforce event limit to prevent unbounded growth
      if (scan.events.length > this.MAX_EVENTS_PER_SCAN) {
        scan.events.shift(); // Remove oldest event
      }

      emitter.emit('event', event);

      // Log important events for debugging
      if (['scan_completed', 'scan_failed', 'error'].includes(event.type)) {
        console.log(
          `ScanManager: Event emitted for ${scanId} - Type: ${event.type}, Message: ${event.message}`
        );
      }
    } else {
      console.warn(
        `ScanManager: Cannot emit event for scan ${scanId} - scan or emitter not found`
      );
    }
  }

  /**
   * Add completed scan to history
   */
  private addToHistory(scan: ScanState): void {
    const summary: ScanSummary = {
      scanId: scan.scanId,
      portalId: scan.portalId,
      portalName: scan.portalName,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      duration: scan.completedAt
        ? scan.completedAt.getTime() - scan.startedAt.getTime()
        : undefined,
      success: scan.status === 'completed',
      rfpCount: scan.discoveredRFPs.length,
      errorCount: scan.errors.length,
    };

    if (!this.scanHistory.has(scan.portalId)) {
      this.scanHistory.set(scan.portalId, []);
    }

    const history = this.scanHistory.get(scan.portalId)!;
    history.unshift(summary); // Add to beginning

    // Keep only the most recent scans
    if (history.length > this.MAX_HISTORY_PER_PORTAL) {
      history.splice(this.MAX_HISTORY_PER_PORTAL);
    }
  }
}

// Export singleton instance
export const scanManager = new ScanManager();
