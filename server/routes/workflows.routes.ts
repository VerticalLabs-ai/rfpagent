import { Router } from 'express';
import { storage } from '../storage';
import { aiAgentOrchestrator } from '../services/orchestrators/aiAgentOrchestrator';
import { agentMonitoringService } from '../services/agents/agentMonitoringService';
import { mastraWorkflowEngine } from '../services/workflows/mastraWorkflowEngine';
import { proposalGenerationOrchestrator } from '../services/orchestrators/proposalGenerationOrchestrator';
import { workflowCoordinator } from '../services/workflows/workflowCoordinator';
import { agentRegistryService } from '../services/agents/agentRegistryService';
import { analysisOrchestrator } from '../services/orchestrators/analysisOrchestrator';
import {
  discoveryOrchestrator,
  type DiscoveryWorkflowRequest,
} from '../services/orchestrators/discoveryOrchestrator';

const router = Router();

/**
 * Get suspended workflows
 */
router.get('/suspended', async (req, res) => {
  try {
    const suspendedWorkflows = mastraWorkflowEngine
      .getAllActiveWorkflows()
      .filter(workflow => workflow.status === 'suspended');
    res.json(suspendedWorkflows);
  } catch (error) {
    console.error('Error fetching suspended workflows:', error);
    res.status(500).json({ error: 'Failed to fetch suspended workflows' });
  }
});

/**
 * Get workflow state
 */
router.get('/state', async (req, res) => {
  try {
    const workflowState = await agentMonitoringService.getWorkflowOverview();
    res.json(workflowState);
  } catch (error) {
    console.error('Error fetching workflow state:', error);
    res.status(500).json({ error: 'Failed to fetch workflow state' });
  }
});

/**
 * Get phase statistics
 */
router.get('/phase-stats', async (req, res) => {
  try {
    const phaseStats = await agentMonitoringService.getPhaseStatistics();
    res.json(phaseStats);
  } catch (error) {
    console.error('Error fetching phase statistics:', error);
    res.status(500).json({ error: 'Failed to fetch phase statistics' });
  }
});

/**
 * Get workflow status by ID
 */
router.get('/:workflowId/status', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const status =
      mastraWorkflowEngine.getWorkflowPhaseState(workflowId) || null;

    if (!status) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    res.status(500).json({ error: 'Failed to fetch workflow status' });
  }
});

/**
 * Execute document processing workflow
 */
router.post('/document-processing/execute', async (req, res) => {
  try {
    const {
      rfpId,
      companyProfileId,
      analysisType = 'standard',
      priority = 5,
      deadline,
      options = {},
    } = req.body;

    if (!rfpId) {
      return res.status(400).json({ error: 'rfpId is required' });
    }

    console.log(`🔄 Starting document processing workflow for RFP: ${rfpId}`);

    const sessionId = `analysis_${rfpId}_${Date.now()}`;
    const workflowResult = await analysisOrchestrator.executeAnalysisWorkflow({
      rfpId,
      sessionId,
      companyProfileId,
      priority,
      deadline: deadline ? new Date(deadline) : undefined,
    });

    res.json({
      ...workflowResult,
      analysisType,
      sessionId,
      message: workflowResult.success
        ? 'Document processing workflow started successfully'
        : workflowResult.error ||
          'Failed to start document processing workflow',
    });
  } catch (error) {
    console.error('Error executing document processing workflow:', error);
    res.status(500).json({
      error: 'Failed to execute document processing workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Execute RFP discovery workflow
 */
router.post('/rfp-discovery/execute', async (req, res) => {
  try {
    const {
      portalIds,
      searchCriteria,
      maxRfps = 50,
      sessionId,
      workflowId,
      priority = 5,
      deadline,
      options = {},
    } = req.body;

    if (!portalIds || !Array.isArray(portalIds)) {
      return res.status(400).json({
        error: 'portalIds array is required',
      });
    }

    console.log(
      `🔍 Starting RFP discovery workflow for portals: ${portalIds.join(', ')}`
    );

    const discoveryOptions: DiscoveryWorkflowRequest['options'] = {
      fullScan: options?.fullScan,
      deepExtraction: options?.deepExtraction,
      realTimeNotifications: options?.realTimeNotifications,
      maxRetries: options?.maxRetries,
      searchCriteria,
      maxRfps,
    };

    const result = await discoveryOrchestrator.createDiscoveryWorkflow({
      portalIds,
      sessionId: sessionId || `discovery-${Date.now()}`,
      workflowId,
      priority,
      deadline: deadline ? new Date(deadline) : undefined,
      options: discoveryOptions,
    });

    res.json({
      success: result.success,
      workflowId: result.workflowId,
      createdWorkItems: result.createdWorkItems.length,
      assignedAgents: result.assignedAgents.map(agent => agent.agentId),
      message: 'RFP discovery workflow started successfully',
    });
  } catch (error) {
    console.error('Error executing RFP discovery workflow:', error);
    res.status(500).json({
      error: 'Failed to execute RFP discovery workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Execute proposal generation workflow
 */
router.post('/proposal-generation/execute', async (req, res) => {
  try {
    const { rfpId, companyProfileId, proposalType = 'standard' } = req.body;

    if (!rfpId || !companyProfileId) {
      return res.status(400).json({
        error: 'rfpId and companyProfileId are required',
      });
    }

    console.log(`📝 Starting proposal generation workflow for RFP: ${rfpId}`);

    const pipelineResult =
      await proposalGenerationOrchestrator.createProposalGenerationPipeline({
        rfpId,
        companyProfileId,
        proposalType,
      });

    if (!pipelineResult.success) {
      return res.status(500).json({
        success: false,
        error:
          pipelineResult.error ||
          'Failed to start proposal generation pipeline',
      });
    }

    res.json({
      success: true,
      pipelineId: pipelineResult.pipelineId,
      message: 'Proposal generation pipeline started successfully',
      metadata: pipelineResult,
    });
  } catch (error) {
    console.error('Error executing proposal generation workflow:', error);
    res.status(500).json({
      error: 'Failed to execute proposal generation workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get workflow details by ID
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflowDetails =
      mastraWorkflowEngine.getWorkflowPhaseState(workflowId) ||
      (await analysisOrchestrator.getWorkflowStatus(workflowId));

    if (!workflowDetails) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflowDetails);
  } catch (error) {
    console.error('Error fetching workflow details:', error);
    res.status(500).json({ error: 'Failed to fetch workflow details' });
  }
});

/**
 * Suspend a workflow
 */
router.post('/:workflowId/suspend', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { reason } = req.body;

    const result = await mastraWorkflowEngine.pauseWorkflow(
      workflowId,
      'api_gateway',
      reason
    );

    if (!result.success) {
      return res.status(404).json({
        error: result.error || 'Workflow not found or cannot be suspended',
      });
    }

    res.json({
      success: true,
      workflowId,
      message: 'Workflow suspended successfully',
    });
  } catch (error) {
    console.error('Error suspending workflow:', error);
    res.status(500).json({ error: 'Failed to suspend workflow' });
  }
});

/**
 * Resume a suspended workflow
 */
router.post('/:workflowId/resume', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { resumeData } = req.body;

    const result = await mastraWorkflowEngine.resumeWorkflow(
      workflowId,
      'api_gateway',
      resumeData?.reason
    );

    if (!result.success) {
      return res.status(404).json({
        error: result.error || 'Workflow not found or cannot be resumed',
      });
    }

    res.json({
      success: true,
      workflowId,
      message: 'Workflow resumed successfully',
    });
  } catch (error) {
    console.error('Error resuming workflow:', error);
    res.status(500).json({ error: 'Failed to resume workflow' });
  }
});

/**
 * Cancel a workflow
 */
router.post('/:workflowId/cancel', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { reason } = req.body;

    const result = await mastraWorkflowEngine.cancelWorkflow(
      workflowId,
      'api_gateway',
      reason
    );

    if (!result.success) {
      return res.status(404).json({
        error: result.error || 'Workflow not found or cannot be cancelled',
      });
    }

    res.json({
      success: true,
      workflowId,
      message: 'Workflow cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling workflow:', error);
    res.status(500).json({ error: 'Failed to cancel workflow' });
  }
});

/**
 * Get workflow state for specific RFP
 */
router.get('/state/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const activeWorkflows = workflowCoordinator.getActiveWorkflows();
    const workflowState = activeWorkflows.find(
      workflow => workflow.data?.rfpId === rfpId
    );

    if (!workflowState) {
      return res
        .status(404)
        .json({ error: 'No workflow state found for this RFP' });
    }

    res.json(workflowState);
  } catch (error) {
    console.error('Error fetching RFP workflow state:', error);
    res.status(500).json({ error: 'Failed to fetch RFP workflow state' });
  }
});

/**
 * Transition workflow to next phase
 */
router.post('/:workflowId/transition', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { targetPhase, transitionData } = req.body;

    if (!targetPhase) {
      return res.status(400).json({ error: 'targetPhase is required' });
    }

    const transitionResult = await mastraWorkflowEngine.transitionWorkflowPhase(
      workflowId,
      targetPhase,
      'api_gateway',
      'manual',
      undefined,
      transitionData
    );

    if (!transitionResult.success) {
      return res.status(400).json({
        error: 'Failed to transition workflow',
        details: transitionResult.error,
      });
    }

    res.json({
      success: true,
      workflowId,
      state: transitionResult.state,
      message: 'Workflow transitioned successfully',
    });
  } catch (error) {
    console.error('Error transitioning workflow:', error);
    res.status(500).json({ error: 'Failed to transition workflow' });
  }
});

export default router;
