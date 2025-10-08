import { Router } from 'express';
import { complianceIntegrationService } from '../services/complianceIntegrationService';
import { storage } from '../storage';

const router = Router();

/**
 * Get compliance status and coverage metrics
 */
router.get('/status', async (req, res) => {
  try {
    const status = await complianceIntegrationService.getComplianceStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting compliance status:', error);
    res.status(500).json({ error: 'Failed to get compliance status' });
  }
});

/**
 * Trigger compliance analysis for a specific RFP
 */
router.post('/analyze/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const result =
      await complianceIntegrationService.processRfpCompliance(rfpId);
    res.json(result);
  } catch (error) {
    console.error('Error triggering compliance analysis:', error);
    res.status(500).json({ error: 'Failed to trigger compliance analysis' });
  }
});

/**
 * Batch process unprocessed RFPs for compliance
 */
router.post('/batch-process', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    const results =
      await complianceIntegrationService.batchProcessCompliance(limit);
    res.json({
      processed: results.length,
      results,
      message: `Successfully processed ${results.length} RFPs for compliance`,
    });
  } catch (error) {
    console.error('Error in batch compliance processing:', error);
    res.status(500).json({ error: 'Failed to batch process compliance' });
  }
});

/**
 * Get formatted compliance data for a specific RFP
 */
router.get('/rfp/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const rfp = await storage.getRFP(rfpId);

    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    const complianceData =
      complianceIntegrationService.formatComplianceData(rfp);
    res.json(complianceData);
  } catch (error) {
    console.error('Error getting RFP compliance data:', error);
    res.status(500).json({ error: 'Failed to get RFP compliance data' });
  }
});

/**
 * Force refresh compliance analysis for an RFP
 */
router.post('/refresh/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const result = await complianceIntegrationService.processRfpCompliance(
      rfpId,
      { force: true }
    );
    res.json({
      ...result,
      message: 'Compliance analysis refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing compliance analysis:', error);
    res.status(500).json({ error: 'Failed to refresh compliance analysis' });
  }
});

export default router;
