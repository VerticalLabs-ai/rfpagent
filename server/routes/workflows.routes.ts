import { Router } from 'express';
import { storage } from '../storage';
import { aiAgentOrchestrator } from '../services/aiAgentOrchestrator';
import { mastraWorkflowEngine } from '../services/mastraWorkflowEngine';
import { proposalGenerationOrchestrator } from '../services/proposalGenerationOrchestrator';
import { workflowCoordinator } from '../services/workflowCoordinator';
import { agentRegistryService } from '../services/agentRegistryService';

const router = Router();

/**
 * Get suspended workflows
 */
router.get('/suspended', async (req, res) => {
  try {
    const suspendedWorkflows =
      await mastraWorkflowEngine.getSuspendedWorkflows();
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
    const workflowState = await workflowCoordinator.getGlobalWorkflowState();
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
    const phaseStats = await workflowCoordinator.getPhaseStatistics();
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
    const status = await mastraWorkflowEngine.getWorkflowStatus(workflowId);

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
    const { rfpId, documentIds, analysisType = 'standard' } = req.body;

    if (!rfpId || !documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({
        error: 'rfpId and documentIds array are required',
      });
    }

    console.log(`🔄 Starting document processing workflow for RFP: ${rfpId}`);

    const workflowResult =
      await mastraWorkflowEngine.executeDocumentProcessingWorkflow({
        rfpId,
        documentIds,
        analysisType,
        priority: 5,
      });

    res.json({
      success: true,
      workflowId: workflowResult.workflowId,
      message: 'Document processing workflow started successfully',
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
    const { portalIds, searchCriteria, maxRfps = 50 } = req.body;

    if (!portalIds || !Array.isArray(portalIds)) {
      return res.status(400).json({
        error: 'portalIds array is required',
      });
    }

    console.log(
      `🔍 Starting RFP discovery workflow for portals: ${portalIds.join(', ')}`
    );

    const workflowResult =
      await mastraWorkflowEngine.executeRfpDiscoveryWorkflow({
        portalIds,
        searchCriteria,
        maxRfps,
        priority: 5,
      });

    res.json({
      success: true,
      workflowId: workflowResult.workflowId,
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

    const workflowResult =
      await proposalGenerationOrchestrator.generateProposal({
        rfpId,
        companyProfileId,
        proposalType,
        priority: 5,
      });

    res.json({
      success: true,
      workflowId: workflowResult.workflowId,
      proposalId: workflowResult.proposalId,
      message: 'Proposal generation workflow started successfully',
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
    const workflow = await mastraWorkflowEngine.getWorkflowDetails(workflowId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
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

    const result = await mastraWorkflowEngine.suspendWorkflow(
      workflowId,
      reason
    );

    if (!result) {
      return res
        .status(404)
        .json({ error: 'Workflow not found or cannot be suspended' });
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
      resumeData
    );

    if (!result) {
      return res
        .status(404)
        .json({ error: 'Workflow not found or cannot be resumed' });
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
      reason
    );

    if (!result) {
      return res
        .status(404)
        .json({ error: 'Workflow not found or cannot be cancelled' });
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
    const workflowState = await workflowCoordinator.getRfpWorkflowState(rfpId);

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

    const result = await workflowCoordinator.transitionWorkflow(
      workflowId,
      targetPhase,
      transitionData
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to transition workflow',
        details: result.error,
      });
    }

    res.json({
      success: true,
      workflowId,
      currentPhase: result.currentPhase,
      message: 'Workflow transitioned successfully',
    });
  } catch (error) {
    console.error('Error transitioning workflow:', error);
    res.status(500).json({ error: 'Failed to transition workflow' });
  }
});

export default router;
