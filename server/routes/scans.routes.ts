import { Router } from 'express';
import { storage } from '../storage';
import { scanManager } from '../services/portals/scan-manager';
import { PortalMonitoringService } from '../services/monitoring/portal-monitoring-service';

const router = Router();
const portalMonitoringService = new PortalMonitoringService(storage);

/**
 * Trigger a manual portal scan
 * POST /api/scans/trigger
 * Body: { portalId: string, searchFilter?: string }
 */
router.post('/trigger', async (req, res) => {
  try {
    const { portalId, searchFilter } = req.body;

    if (!portalId) {
      return res.status(400).json({ error: 'portalId is required' });
    }

    // Validate and sanitize search filter
    let cleanedFilter: string | undefined = searchFilter;
    if (cleanedFilter) {
      cleanedFilter = cleanedFilter.trim();
      if (cleanedFilter.length === 0 || cleanedFilter.length > 100) {
        return res
          .status(400)
          .json({ error: 'Search filter must be between 1-100 characters' });
      }
    }

    const portal = await storage.getPortal(portalId);

    if (!portal) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    // Check if portal is already being scanned
    if (scanManager.isPortalScanning(portalId)) {
      return res.status(409).json({ error: 'Portal is already being scanned' });
    }

    // Start scan with ScanManager for real-time monitoring
    const scanId = scanManager.startScan(portalId, portal.name);

    // Use monitoring service for enhanced scanning with scan context
    portalMonitoringService
      .scanPortalWithEvents(portal.id, scanId)
      .catch(error => {
        console.error(
          `Portal scan error for ${portal.name} (${portal.id}):`,
          error
        );
        // Ensure scan manager is notified of failure
        try {
          scanManager.log(
            scanId,
            'error',
            `Fatal scan error: ${error instanceof Error ? error.message : String(error)}`
          );
          scanManager.completeScan(scanId, false);
        } catch (managerError) {
          console.error(
            'Failed to update scan manager with error:',
            managerError
          );
        }
      });

    res.status(202).json({
      success: true,
      scanId,
      message: 'Portal scan started. Connect to the scan stream for real-time updates.',
      streamUrl: `/api/scans/${scanId}/stream`,
    });
  } catch (error) {
    console.error('Error triggering portal scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger portal scan'
    });
  }
});

/**
 * Get current scan status
 */
router.get('/:scanId/status', async (req, res) => {
  try {
    const { scanId } = req.params;
    const scan = scanManager.getScan(scanId);

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json({
      scanId: scan.scanId,
      portalId: scan.portalId,
      portalName: scan.portalName,
      status: scan.status,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      currentStep: scan.currentStep,
      discoveredRFPs: scan.discoveredRFPs,
      errors: scan.errors,
      duration: scan.completedAt
        ? scan.completedAt.getTime() - scan.startedAt.getTime()
        : Date.now() - scan.startedAt.getTime(),
    });
  } catch (error) {
    console.error('Error fetching scan status:', error);
    res.status(500).json({ error: 'Failed to fetch scan status' });
  }
});

/**
 * Get all active scans across all portals
 */
router.get('/active', async (req, res) => {
  try {
    const activeScans = scanManager.getActiveScans().map(scan => ({
      scanId: scan.scanId,
      portalId: scan.portalId,
      portalName: scan.portalName,
      status: scan.status,
      startedAt: scan.startedAt,
      currentStep: scan.currentStep,
      discoveredRFPs: scan.discoveredRFPs.length,
      errors: scan.errors.length,
    }));

    res.json(activeScans);
  } catch (error) {
    console.error('Error fetching active scans:', error);
    res.status(500).json({ error: 'Failed to fetch active scans' });
  }
});

/**
 * SSE endpoint for real-time scan streaming
 * GET /api/scans/:scanId/stream
 */
router.get('/:scanId/stream', async (req, res) => {
  try {
    const { scanId } = req.params;

    const scan = scanManager.getScan(scanId);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial scan state
    res.write(
      `data: ${JSON.stringify({
        type: 'initial_state',
        data: {
          scanId: scan.scanId,
          portalId: scan.portalId,
          portalName: scan.portalName,
          status: scan.status,
          currentStep: scan.currentStep,
          discoveredRFPs: scan.discoveredRFPs,
          errors: scan.errors,
          startedAt: scan.startedAt,
        },
      })}\n\n`
    );

    // Subscribe to scan events
    const emitter = scanManager.getEventEmitter(scanId);
    if (emitter) {
      const eventHandler = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        // Close connection when scan completes or fails
        if (event.type === 'scan_completed' || event.type === 'scan_failed') {
          res.end();
        }
      };

      emitter.on('event', eventHandler);

      // Cleanup on client disconnect
      req.on('close', () => {
        emitter.off('event', eventHandler);
        res.end();
      });
    } else {
      // Scan already completed, send completion event and close
      res.write(
        `data: ${JSON.stringify({
          type: scan.status === 'completed' ? 'scan_completed' : 'scan_failed',
          timestamp: scan.completedAt || new Date(),
          data: {
            scanId: scan.scanId,
            discoveredRFPs: scan.discoveredRFPs,
            errors: scan.errors,
          },
        })}\n\n`
      );
      res.end();
    }
  } catch (error) {
    console.error('Error setting up scan stream:', error);
    res.status(500).json({ error: 'Failed to set up scan stream' });
  }
});

/**
 * Get scan details with events
 */
router.get('/:scanId/details', async (req, res) => {
  try {
    const { scanId } = req.params;

    // First check active scans in ScanManager (for running scans)
    const activeScan = scanManager.getScan(scanId);
    if (activeScan) {
      // Return active scan data with events
      res.json({
        ...activeScan,
        id: activeScan.scanId,
        portalId: activeScan.portalId,
        portalName: activeScan.portalName,
        status: activeScan.status,
        startedAt: activeScan.startedAt,
        completedAt: activeScan.completedAt,
        currentStep: activeScan.currentStep.step,
        currentProgress: activeScan.currentStep.progress,
        currentMessage: activeScan.currentStep.message,
        discoveredRfpsCount: activeScan.discoveredRFPs.length,
        errorCount: activeScan.errors.length,
        errors: activeScan.errors,
        discoveredRfps: activeScan.discoveredRFPs,
        events: activeScan.events,
      });
      return;
    }

    // If not in active scans, try database (for historical scans)
    const scan = await storage.getScan(scanId);
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const events = await storage.getScanEvents(scanId);
    res.json({ ...scan, events });
  } catch (error) {
    console.error('Failed to get scan details:', error);
    res.status(500).json({ error: 'Failed to get scan details' });
  }
});

export default router;
