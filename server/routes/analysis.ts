import express from 'express';
import { AnalysisOrchestrator } from '../services/analysisOrchestrator';
import { analysisProgressTracker } from '../services/analysisProgressTracker';
import { analysisTestRunner } from '../services/analysisTestRunner';
import { storage } from '../storage';

const router = express.Router();
const analysisOrchestrator = new AnalysisOrchestrator();

/**
 * Analysis API Routes for Phase 7: Analysis Pipeline Integration
 */

/**
 * Start analysis workflow for an RFP
 * POST /api/analysis/start
 */
router.post('/start', async (req, res) => {
  try {
    const { rfpId, sessionId, companyProfileId, priority } = req.body;

    if (!rfpId || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: rfpId and sessionId',
      });
    }

    console.log(`🔬 Starting analysis workflow for RFP: ${rfpId}`);

    const result = await analysisOrchestrator.executeAnalysisWorkflow({
      rfpId,
      sessionId,
      companyProfileId,
      priority: priority || 5,
    });

    res.json({
      success: true,
      result,
      message: 'Analysis workflow started successfully',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Analysis workflow start failed:', error);
    res.status(500).json({
      error: 'Failed to start analysis workflow',
      details: errorMessage,
    });
  }
});

/**
 * Get analysis progress for an RFP
 * GET /api/analysis/progress/:rfpId
 */
router.get('/progress/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    const progressData = analysisProgressTracker.getRFPProgress(rfpId);
    const progressSummary = analysisProgressTracker.getProgressSummary();

    res.json({
      success: true,
      rfpId,
      workflows: progressData,
      summary: progressSummary,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Get progress failed:', error);
    res.status(500).json({
      error: 'Failed to get analysis progress',
      details: errorMessage,
    });
  }
});

/**
 * Get analysis progress for a specific workflow
 * GET /api/analysis/workflow/:workflowId/progress
 */
router.get('/workflow/:workflowId/progress', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const progress = analysisProgressTracker.getProgress(workflowId);
    const stepHistory = analysisProgressTracker.getStepHistory(workflowId);

    if (!progress) {
      return res.status(404).json({
        error: 'Workflow progress not found',
      });
    }

    res.json({
      success: true,
      workflowId,
      progress,
      stepHistory,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Get workflow progress failed:', error);
    res.status(500).json({
      error: 'Failed to get workflow progress',
      details: errorMessage,
    });
  }
});

/**
 * Get analysis results for an RFP
 * GET /api/analysis/results/:rfpId
 */
router.get('/results/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    const rfp = await storage.getRFP(rfpId);
    const documents = await storage.getDocumentsByRFP(rfpId);

    if (!rfp) {
      return res.status(404).json({
        error: 'RFP not found',
      });
    }

    // Extract analysis results
    const analysisResults = {
      rfp: {
        id: rfp.id,
        title: rfp.title,
        status: rfp.status,
        requirements: rfp.requirements || [],
        complianceItems: rfp.complianceItems || [],
        riskFlags: rfp.riskFlags || [],
      },
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        extractedText: doc.extractedText,
        parsedData: doc.parsedData,
      })),
      summary: {
        totalDocuments: documents.length,
        documentsWithText: documents.filter(d => d.extractedText).length,
        documentsWithAnalysis: documents.filter(d => d.parsedData).length,
        requirementsCount: Array.isArray(rfp.requirements)
          ? rfp.requirements.length
          : 0,
        complianceItemsCount: Array.isArray(rfp.complianceItems)
          ? rfp.complianceItems.length
          : 0,
        riskFlagsCount: Array.isArray(rfp.riskFlags) ? rfp.riskFlags.length : 0,
      },
    };

    res.json({
      success: true,
      rfpId,
      analysisResults,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Get analysis results failed:', error);
    res.status(500).json({
      error: 'Failed to get analysis results',
      details: errorMessage,
    });
  }
});

/**
 * Run analysis pipeline tests
 * POST /api/analysis/test
 */
router.post('/test', async (req, res) => {
  try {
    const { testType = 'smoke' } = req.body;

    console.log(`🧪 Running analysis pipeline test: ${testType}`);

    let testResults;

    if (testType === 'smoke') {
      const smokeTestResult = await analysisTestRunner.runSmokeTest();
      testResults = {
        testType: 'smoke',
        success: smokeTestResult,
        message: smokeTestResult ? 'Smoke test passed' : 'Smoke test failed',
      };
    } else if (testType === 'comprehensive') {
      const comprehensiveResults = await analysisTestRunner.runAnalysisTests();
      const passedTests = comprehensiveResults.filter(r => r.success).length;
      const totalTests = comprehensiveResults.length;

      testResults = {
        testType: 'comprehensive',
        success: passedTests === totalTests,
        results: comprehensiveResults,
        summary: {
          totalTests,
          passedTests,
          failedTests: totalTests - passedTests,
          passRate: Math.round((passedTests / totalTests) * 100),
        },
      };
    } else {
      return res.status(400).json({
        error: 'Invalid test type. Use "smoke" or "comprehensive"',
      });
    }

    res.json({
      success: true,
      testResults,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Analysis test failed:', error);
    res.status(500).json({
      error: 'Failed to run analysis test',
      details: errorMessage,
    });
  }
});

/**
 * Get analysis pipeline status
 * GET /api/analysis/status
 */
router.get('/status', async (req, res) => {
  try {
    const progressSummary = analysisProgressTracker.getProgressSummary();

    // Get system metrics
    const systemStatus = {
      analysisOrchestrator: 'active',
      progressTracker: 'active',
      specialists: {
        documentProcessor: 'ready',
        requirementsExtractor: 'ready',
        complianceChecker: 'ready',
      },
      services: {
        documentParsingService: 'available',
        documentIntelligenceService: 'available',
        aiService: 'available',
      },
    };

    res.json({
      success: true,
      status: systemStatus,
      metrics: progressSummary,
      timestamp: new Date().toISOString(),
      version: '7.0.0', // Phase 7 implementation
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('❌ Get analysis status failed:', error);
    res.status(500).json({
      error: 'Failed to get analysis status',
      details: errorMessage,
    });
  }
});

export default router;
