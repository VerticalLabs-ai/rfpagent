import { insertPortalSchema } from '@shared/schema';
import { Router } from 'express';
import { z } from 'zod';
import { PortalMonitoringService } from '../services/portal-monitoring-service';
import { PortalSchedulerService } from '../services/portal-scheduler-service';
import { scanManager } from '../services/scan-manager';
import { storage } from '../storage';

const router = Router();

const portalMonitoringService = new PortalMonitoringService(storage);
const portalSchedulerService = new PortalSchedulerService(
  storage,
  portalMonitoringService
);

// Portal Monitoring Validation Schema
const PortalMonitoringConfigSchema = z.object({
  scanFrequency: z.number().int().min(1).max(168).optional(), // 1 hour to 1 week
  maxRfpsPerScan: z.number().int().min(1).max(200).optional(),
  selectors: z
    .object({
      rfpList: z.string(),
      rfpItem: z.string(),
      title: z.string(),
      agency: z.string().optional(),
      deadline: z.string().optional(),
      value: z.string().optional(),
      link: z.string(),
      description: z.string().optional(),
    })
    .optional(),
  filters: z
    .object({
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      businessTypes: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      excludeKeywords: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Get all portals with RFP counts
 */
router.get('/', async (req, res) => {
  try {
    // Use single query with JOIN to get portals with RFP counts (no N+1)
    const portalsWithCounts = await storage.getPortalsWithRFPCounts();

    res.json(portalsWithCounts);
  } catch (error) {
    console.error('Error fetching portals:', error);
    res.status(500).json({ error: 'Failed to fetch portals' });
  }
});

/**
 * Get portal activity
 */
router.get('/activity', async (req, res) => {
  try {
    const activity = await storage.getPortalActivity();
    res.json(activity);
  } catch (error) {
    console.error('Error fetching portal activity:', error);
    res.status(500).json({ error: 'Failed to fetch portal activity' });
  }
});

/**
 * Create a new portal
 */
router.post('/', async (req, res) => {
  try {
    const portalData = insertPortalSchema.parse(req.body);
    const portal = await storage.createPortal(portalData);
    res.status(201).json(portal);
  } catch (error) {
    console.error('Error creating portal:', error);
    res.status(400).json({ error: 'Failed to create portal' });
  }
});

/**
 * Update a portal
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const portal = await storage.updatePortal(id, updates);
    res.json(portal);
  } catch (error) {
    console.error('Error updating portal:', error);
    res.status(400).json({ error: 'Failed to update portal' });
  }
});

/**
 * Delete a portal
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deletePortal(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting portal:', error);
    if (error instanceof Error && error.message === 'Portal not found') {
      return res.status(404).json({ error: 'Portal not found' });
    }
    res.status(500).json({ error: 'Failed to delete portal' });
  }
});

/**
 * Start a portal scan
 */
router.post('/:id/scan', async (req, res) => {
  try {
    const { id } = req.params;
    let { searchFilter } = req.body || {};

    // Validate and sanitize search filter
    if (searchFilter) {
      searchFilter = searchFilter.trim();
      if (searchFilter.length === 0 || searchFilter.length > 100) {
        return res
          .status(400)
          .json({ error: 'Search filter must be between 1-100 characters' });
      }
    }

    const portal = await storage.getPortal(id);

    if (!portal) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    // Check if portal is already being scanned
    if (scanManager.isPortalScanning(id)) {
      return res.status(409).json({ error: 'Portal is already being scanned' });
    }

    // Start scan with ScanManager for real-time monitoring
    const scanId = scanManager.startScan(id, portal.name);

    // Use new monitoring service for enhanced scanning with scan context
    portalMonitoringService
      .scanPortalWithEvents(portal.id, scanId)
      .catch(console.error);

    res.status(202).json({
      scanId,
      message: 'Portal scan started',
    });
  } catch (error) {
    console.error('Error starting portal scan:', error);
    res.status(500).json({ error: 'Failed to start portal scan' });
  }
});

/**
 * Get monitoring status for all portals
 */
router.get('/monitoring/status', async (req, res) => {
  try {
    const portals = await storage.getAllPortals();
    const monitoringStatus = portals.map(portal => ({
      portalId: portal.id,
      portalName: portal.name,
      status: portal.status,
      lastScanned: portal.lastScanned,
      scanFrequency: portal.scanFrequency,
      lastError: portal.lastError,
      errorCount: portal.errorCount,
    }));

    res.json(monitoringStatus);
  } catch (error) {
    console.error('Error fetching portal monitoring status:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring status' });
  }
});

/**
 * SSE endpoint for real-time scan streaming
 */
router.get('/:id/scan/stream', async (req, res) => {
  try {
    const { id: portalId } = req.params;
    const { scanId } = req.query;

    if (!scanId) {
      return res
        .status(400)
        .json({ error: 'scanId query parameter is required' });
    }

    const scan = scanManager.getScan(scanId as string);
    if (!scan || scan.portalId !== portalId) {
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

    // Get event emitter for this scan
    const emitter = scanManager.getScanEmitter(scanId as string);
    if (!emitter) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: 'Scan event stream not available',
        })}\n\n`
      );
      res.end();
      return;
    }

    // Listen for scan events
    const eventHandler = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Close connection if scan is completed or failed
      if (event.type === 'scan_completed' || event.type === 'scan_failed') {
        res.end();
      }
    };

    emitter.on('event', eventHandler);

    // Keep connection alive with heartbeat
    const keepAlive = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 15000);

    // Handle client disconnect - clean up everything
    const cleanup = () => {
      emitter.off('event', eventHandler);
      clearInterval(keepAlive);
      res.end();
      console.log(`SSE connection closed for scan ${scanId}`);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  } catch (error) {
    console.error('Error setting up SSE stream:', error);
    res.status(500).json({ error: 'Failed to setup scan stream' });
  }
});

/**
 * Get scan history for a portal
 */
router.get('/:id/scans/history', async (req, res) => {
  try {
    const { id: portalId } = req.params;
    const { limit = '10' } = req.query;

    const history = scanManager.getScanHistory(
      portalId,
      parseInt(limit as string)
    );
    res.json(history);
  } catch (error) {
    console.error('Error fetching scan history:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

/**
 * Get recent RFP discoveries
 */
router.get('/discoveries/recent', async (req, res) => {
  try {
    const { limit = '10', hours = '24' } = req.query;
    const hoursAgo = new Date(
      Date.now() - parseInt(hours as string) * 60 * 60 * 1000
    );

    // Get RFPs discovered in the last N hours
    const { rfps } = await storage.getAllRFPs({
      limit: parseInt(limit as string),
      status: 'discovered',
    });

    // Filter by discovery time (simplified - in production, add discoveredAfter filter to storage)
    const recentRFPs = rfps.filter(
      rfp => rfp.discoveredAt && new Date(rfp.discoveredAt) > hoursAgo
    );

    res.json(recentRFPs);
  } catch (error) {
    console.error('Error fetching recent discoveries:', error);
    res.status(500).json({ error: 'Failed to fetch recent discoveries' });
  }
});

/**
 * Update portal monitoring configuration
 */
router.put('/:id/monitoring', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body with Zod
    const validationResult = PortalMonitoringConfigSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid monitoring configuration',
        details: validationResult.error.issues,
      });
    }

    const { scanFrequency, maxRfpsPerScan, selectors, filters } =
      validationResult.data;

    const updates: any = {};
    if (scanFrequency !== undefined) updates.scanFrequency = scanFrequency;
    if (maxRfpsPerScan !== undefined) updates.maxRfpsPerScan = maxRfpsPerScan;
    if (selectors) updates.selectors = selectors;
    if (filters) updates.filters = filters;

    const updatedPortal = await storage.updatePortal(id, updates);

    // Update scheduler if scan frequency changed
    if (scanFrequency !== undefined) {
      await portalSchedulerService.updatePortalSchedule(id);
    }

    res.json(updatedPortal);
  } catch (error) {
    console.error('Error updating portal monitoring config:', error);
    res
      .status(500)
      .json({ error: 'Failed to update monitoring configuration' });
  }
});

/**
 * Get portal performance metrics
 */
router.get('/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '7' } = req.query;

    const portal = await storage.getPortal(id);
    if (!portal) {
      return res.status(404).json({ error: 'Portal not found' });
    }

    // Get RFPs discovered from this portal in the last N days
    const daysAgo = new Date(
      Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000
    );
    const portalRFPs = await storage.getRFPsByPortal(id);
    const recentRFPs = portalRFPs.filter(
      rfp => rfp.discoveredAt && new Date(rfp.discoveredAt) > daysAgo
    );

    const metrics = {
      portalId: id,
      portalName: portal.name,
      period: `Last ${days} days`,
      totalRFPs: recentRFPs.length,
      averageValue:
        recentRFPs.reduce((sum, rfp) => {
          const value = rfp.estimatedValue ? parseFloat(rfp.estimatedValue) : 0;
          return sum + value;
        }, 0) / (recentRFPs.length || 1),
      statusBreakdown: recentRFPs.reduce((acc: any, rfp) => {
        acc[rfp.status] = (acc[rfp.status] || 0) + 1;
        return acc;
      }, {}),
      lastScanned: portal.lastScanned,
      errorCount: portal.errorCount,
      successfulScans: Math.max(
        0,
        portalRFPs.length / Math.max(1, portal.maxRfpsPerScan) -
          portal.errorCount
      ),
    };

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching portal metrics:', error);
    res.status(500).json({ error: 'Failed to fetch portal metrics' });
  }
});

export default router;
