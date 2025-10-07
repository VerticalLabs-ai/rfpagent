import { Router } from 'express';
import { saflaSystemIntegration } from '../services/saflaSystemIntegration';
import { workflowCoordinator } from '../services/workflowCoordinator';

const router = Router();

/**
 * SAFLA System Monitoring API Routes
 *
 * These endpoints allow you to monitor and interact with the self-improving system
 */

// Get system status and health
router.get('/status', async (req, res) => {
  try {
    const status = await saflaSystemIntegration.getSystemStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get comprehensive system report
router.get('/report', async (req, res) => {
  try {
    const report = await saflaSystemIntegration.generateSystemReport();
    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get real-time learning dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || '24h';
    const dashboard =
      await workflowCoordinator.generatePerformanceDashboard(timeframe);

    // Transform the response to match frontend expectations
    res.json({
      success: true,
      data: {
        timeframe,
        systemHealth: dashboard.systemHealth?.overall || 75,
        learningMetrics: {
          learningRate: dashboard.learningMetrics?.learningRate || 0,
          knowledgeGrowth: dashboard.learningMetrics?.knowledgeGrowth || 0,
          adaptationSuccess: dashboard.learningMetrics?.adaptationSuccess || 0,
        },
        performanceMetrics: {
          proposalWinRate: dashboard.performanceMetrics?.proposalWinRate || 0,
          parsingAccuracy: dashboard.performanceMetrics?.parsingAccuracy || 0,
          portalNavigationSuccess: dashboard.performanceMetrics?.portalNavigationSuccess || 0,
          avgProcessingTime: dashboard.performanceMetrics?.documentProcessingTime || 0,
        },
        improvementOpportunities: dashboard.improvementOpportunities?.map(opp => ({
          area: opp.component,
          priority: opp.impact as 'high' | 'medium' | 'low',
          description: opp.opportunity,
          potentialImpact: opp.impact === 'high' ? 25 : opp.impact === 'medium' ? 15 : 5,
        })) || [],
        alerts: dashboard.alerts?.map(alert => ({
          type: alert.severity === 'critical' ? 'error' as const :
                alert.severity === 'warning' ? 'warning' as const :
                'success' as const,
          message: alert.message,
          timestamp: alert.timestamp,
        })) || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating SAFLA dashboard:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Demonstrate learning workflow
router.post('/demonstrate/:scenario', async (req, res) => {
  try {
    const scenario = req.params.scenario as
      | 'portal_discovery'
      | 'document_processing'
      | 'proposal_generation';

    if (
      ![
        'portal_discovery',
        'document_processing',
        'proposal_generation',
      ].includes(scenario)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Invalid scenario. Must be one of: portal_discovery, document_processing, proposal_generation',
      });
    }

    const demonstration =
      await saflaSystemIntegration.demonstrateLearningWorkflow(scenario);

    res.json({
      success: true,
      data: demonstration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Show continuous improvement cycle
router.get('/improvement-cycle', async (req, res) => {
  try {
    const cycle =
      await saflaSystemIntegration.demonstrateContinuousImprovement();

    res.json({
      success: true,
      data: cycle,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Initialize the SAFLA system
router.post('/initialize', async (req, res) => {
  try {
    const result = await saflaSystemIntegration.initializeSystem();

    res.json({
      success: true,
      data: result,
      message: result.success
        ? 'SAFLA system initialized successfully'
        : 'SAFLA system initialization failed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Trigger memory consolidation
router.post('/consolidate-memory', async (req, res) => {
  try {
    const result =
      await workflowCoordinator.consolidateSystemMemory('triggered');

    res.json({
      success: true,
      data: result,
      message: 'Memory consolidation triggered successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get improvement plan
router.get('/improvement-plan', async (req, res) => {
  try {
    const focusAreas = req.query.focusAreas as string;
    const areas = focusAreas ? focusAreas.split(',') : undefined;

    const plan = await workflowCoordinator.createSystemImprovementPlan(areas);

    res.json({
      success: true,
      data: plan,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Record learning event manually
router.post('/record-learning', async (req, res) => {
  try {
    const { portalId, learningType, data, success } = req.body;

    if (!portalId || !learningType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: portalId, learningType, data',
      });
    }

    let result;

    switch (learningType) {
      case 'portal':
        result = await workflowCoordinator.recordPortalLearning(
          portalId,
          data,
          success
        );
        break;
      case 'document':
        result = await workflowCoordinator.recordDocumentLearning(
          data.documentId,
          data,
          data.accuracy || 0.8
        );
        break;
      case 'proposal':
        result = await workflowCoordinator.recordProposalLearning(
          data.proposalId,
          data
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          error:
            'Invalid learningType. Must be one of: portal, document, proposal',
        });
    }

    res.json({
      success: true,
      data: result,
      message: `${learningType} learning event recorded successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
