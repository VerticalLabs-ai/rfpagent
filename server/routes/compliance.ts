import express from 'express';
import { complianceIntegrationService } from '../services/complianceIntegrationService';
import { storage } from '../storage';

const router = express.Router();

/**
 * Compliance API Routes
 *
 * Provides endpoints for compliance analysis management and batch processing
 */

/**
 * Trigger compliance analysis for a specific RFP
 * POST /api/compliance/analyze/:rfpId
 */
router.post('/analyze/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    if (!rfpId) {
      return res.status(400).json({
        error: 'RFP ID is required'
      });
    }

    console.log(`🔍 Triggering compliance analysis for RFP: ${rfpId}`);

    const result = await complianceIntegrationService.triggerComplianceAnalysisForDiscoveredRFP(rfpId);

    res.json({
      success: result.success,
      rfpId: result.rfpId,
      result: result.complianceData || null,
      error: result.error || null,
      metadata: result.metadata || null
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Compliance analysis failed:', error);
    res.status(500).json({
      error: 'Failed to trigger compliance analysis',
      details: errorMessage
    });
  }
});

/**
 * Batch process unprocessed RFPs for compliance analysis
 * POST /api/compliance/batch-process
 */
router.post('/batch-process', async (req, res) => {
  try {
    const { limit = 20, dryRun = false } = req.body;

    console.log(`🔄 Starting batch compliance processing (limit: ${limit}, dryRun: ${dryRun})`);

    if (dryRun) {
      // For dry run, just return what would be processed
      const { rfps: allRfps } = await storage.getAllRFPs({ limit: 1000 });

      const unprocessedRfps = allRfps.filter(rfp =>
        !rfp.requirements ||
        !rfp.complianceItems ||
        !rfp.riskFlags ||
        (Array.isArray(rfp.requirements) && rfp.requirements.length === 0)
      ).slice(0, limit);

      return res.json({
        success: true,
        dryRun: true,
        summary: {
          totalRfps: allRfps.length,
          unprocessedRfps: unprocessedRfps.length,
          wouldProcess: Math.min(unprocessedRfps.length, limit)
        },
        rfpsSummary: unprocessedRfps.slice(0, 10).map(rfp => ({
          id: rfp.id,
          title: rfp.title,
          agency: rfp.agency,
          status: rfp.status
        }))
      });
    }

    // Perform actual batch processing
    const results = await complianceIntegrationService.batchProcessUnprocessedRFPs(limit);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      dryRun: false,
      summary: {
        totalProcessed: results.length,
        successful: successCount,
        errors: errorCount,
        successRate: results.length > 0 ? Math.round((successCount / results.length) * 100) : 0
      },
      results: results.map(r => ({
        rfpId: r.rfpId,
        success: r.success,
        error: r.error || null,
        analysisType: r.metadata?.analysisType || null,
        requirementsCount: r.complianceData?.requirements?.length || 0,
        complianceItemsCount: r.complianceData?.complianceItems?.length || 0,
        riskFlagsCount: r.complianceData?.riskFlags?.length || 0
      }))
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Batch processing failed:', error);
    res.status(500).json({
      error: 'Failed to run batch processing',
      details: errorMessage
    });
  }
});

/**
 * Get compliance status overview
 * GET /api/compliance/status
 */
router.get('/status', async (req, res) => {
  try {
    console.log('📊 Getting compliance status overview');

    // Get all RFPs to analyze compliance coverage
    const { rfps: allRfps } = await storage.getAllRFPs({ limit: 1000 });

    const totalRfps = allRfps.length;
    const rfpsWithCompliance = allRfps.filter(rfp =>
      rfp.requirements &&
      rfp.complianceItems &&
      rfp.riskFlags &&
      Array.isArray(rfp.requirements) &&
      rfp.requirements.length > 0
    );

    const unprocessedRfps = allRfps.filter(rfp =>
      !rfp.requirements ||
      !rfp.complianceItems ||
      !rfp.riskFlags ||
      (Array.isArray(rfp.requirements) && rfp.requirements.length === 0)
    );

    // Analyze risk distribution
    const riskDistribution = {
      high: 0,
      medium: 0,
      low: 0
    };

    rfpsWithCompliance.forEach(rfp => {
      if (rfp.riskFlags && Array.isArray(rfp.riskFlags)) {
        const hasHighRisk = rfp.riskFlags.some((flag: any) => flag.type === 'high');
        const hasMediumRisk = rfp.riskFlags.some((flag: any) => flag.type === 'medium');

        if (hasHighRisk) {
          riskDistribution.high++;
        } else if (hasMediumRisk) {
          riskDistribution.medium++;
        } else {
          riskDistribution.low++;
        }
      }
    });

    // Get processing status
    const processingStatus = complianceIntegrationService.getProcessingStatus();

    const statusOverview = {
      totalRfps,
      rfpsWithCompliance: rfpsWithCompliance.length,
      unprocessedRfps: unprocessedRfps.length,
      complianceCoverage: totalRfps > 0 ? Math.round((rfpsWithCompliance.length / totalRfps) * 100) : 0,
      riskDistribution,
      processing: {
        currentlyProcessing: processingStatus.currentlyProcessing,
        queueSize: processingStatus.queueSize
      },
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      status: statusOverview
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Get compliance status failed:', error);
    res.status(500).json({
      error: 'Failed to get compliance status',
      details: errorMessage
    });
  }
});

/**
 * Get compliance data for a specific RFP (formatted for UI)
 * GET /api/compliance/rfp/:rfpId
 */
router.get('/rfp/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    if (!rfpId) {
      return res.status(400).json({
        error: 'RFP ID is required'
      });
    }

    const rfp = await storage.getRFP(rfpId);

    if (!rfp) {
      return res.status(404).json({
        error: 'RFP not found'
      });
    }

    // Format compliance data for UI
    const complianceData = {
      rfp: {
        id: rfp.id,
        title: rfp.title,
        agency: rfp.agency,
        status: rfp.status,
        deadline: rfp.deadline,
        estimatedValue: rfp.estimatedValue
      },
      requirements: (rfp.requirements as any[]) || [],
      complianceItems: (rfp.complianceItems as any[]) || [],
      riskFlags: (rfp.riskFlags as any[]) || [],
      hasComplianceData: !!(
        rfp.requirements &&
        rfp.complianceItems &&
        rfp.riskFlags &&
        Array.isArray(rfp.requirements) &&
        rfp.requirements.length > 0
      )
    };

    res.json({
      success: true,
      rfpId,
      complianceData
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Get RFP compliance data failed:', error);
    res.status(500).json({
      error: 'Failed to get RFP compliance data',
      details: errorMessage
    });
  }
});

/**
 * Re-analyze compliance for a specific RFP (force refresh)
 * POST /api/compliance/refresh/:rfpId
 */
router.post('/refresh/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    if (!rfpId) {
      return res.status(400).json({
        error: 'RFP ID is required'
      });
    }

    console.log(`🔄 Force refreshing compliance analysis for RFP: ${rfpId}`);

    // Clear existing compliance data first
    await storage.updateRFP(rfpId, {
      requirements: null,
      complianceItems: null,
      riskFlags: null
    });

    // Trigger fresh analysis
    const result = await complianceIntegrationService.triggerComplianceAnalysisForDiscoveredRFP(rfpId);

    res.json({
      success: result.success,
      rfpId: result.rfpId,
      result: result.complianceData || null,
      error: result.error || null,
      metadata: {
        ...result.metadata,
        refreshed: true,
        refreshedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Compliance refresh failed:', error);
    res.status(500).json({
      error: 'Failed to refresh compliance analysis',
      details: errorMessage
    });
  }
});

export default router;