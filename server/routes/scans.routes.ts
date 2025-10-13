import { Router } from 'express';
import { storage } from '../storage';
import { scanManager } from '../services/portals/scan-manager';

const router = Router();

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
