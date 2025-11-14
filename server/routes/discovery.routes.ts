import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { validateSchema } from '../middleware/zodValidation';

const router = Router();

// Validation schema for discovery workflow
const discoveryWorkflowSchema = z.object({
  portalIds: z.array(z.string().uuid()).min(1, 'At least one portal ID is required'),
  sessionId: z.string().optional(),
  workflowId: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  deadline: z.coerce.date().optional(),
  options: z.record(z.any()).default({}),
});

/**
 * Trigger a complete discovery workflow for portals
 * Root endpoint for convenience (same as /workflow)
 */
router.post('/', validateSchema(discoveryWorkflowSchema), async (req, res) => {
  try {
    const { discoveryOrchestrator } = await import(
      '../services/orchestrators/discoveryOrchestrator'
    );

    const {
      portalIds,
      sessionId,
      workflowId,
      priority,
      deadline,
      options,
    } = req.body;

    // Validate portal IDs exist
    const portals = await Promise.all(
      portalIds.map((id: string) => storage.getPortal(id))
    );

    const invalidPortalIds = portalIds.filter(
      (id: string, index: number) => !portals[index]
    );
    if (invalidPortalIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid portal IDs',
        invalidIds: invalidPortalIds,
      });
    }

    console.log(
      `🚀 Triggering discovery workflow for portals: ${portalIds.join(', ')}`
    );

    const workflowResult = await discoveryOrchestrator.createDiscoveryWorkflow({
      portalIds,
      sessionId: sessionId || `discovery-${Date.now()}`,
      workflowId,
      priority,
      deadline,
      options,
    });

    res.status(201).json({
      success: workflowResult.success,
      workflowId: workflowResult.workflowId,
      createdWorkItems: workflowResult.createdWorkItems.length,
      assignedAgents: workflowResult.assignedAgents.map(agent => agent.agentId),
      estimatedCompletion: workflowResult.estimatedCompletion ?? null,
      message: `Discovery workflow created successfully for ${portalIds.length} portals`,
    });
  } catch (error) {
    console.error('❌ Failed to create discovery workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create discovery workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger a complete discovery workflow for portals
 * Explicit /workflow endpoint
 */
router.post('/workflow', validateSchema(discoveryWorkflowSchema), async (req, res) => {
  try {
    const { discoveryOrchestrator } = await import(
      '../services/orchestrators/discoveryOrchestrator'
    );

    const {
      portalIds,
      sessionId,
      workflowId,
      priority = 5,
      deadline,
      options = {},
    } = req.body;

    if (!portalIds || !Array.isArray(portalIds) || portalIds.length === 0) {
      return res.status(400).json({
        error: 'portalIds array is required and must not be empty',
      });
    }

    // Validate portal IDs exist
    const portals = await Promise.all(
      portalIds.map((id: string) => storage.getPortal(id))
    );

    const invalidPortalIds = portalIds.filter(
      (id: string, index: number) => !portals[index]
    );
    if (invalidPortalIds.length > 0) {
      return res.status(400).json({
        error: 'Invalid portal IDs',
        invalidIds: invalidPortalIds,
      });
    }

    console.log(
      `🚀 Triggering discovery workflow for portals: ${portalIds.join(', ')}`
    );

    const workflowResult = await discoveryOrchestrator.createDiscoveryWorkflow({
      portalIds,
      sessionId: sessionId || `discovery-${Date.now()}`,
      workflowId,
      priority,
      deadline: deadline ? new Date(deadline) : undefined,
      options,
    });

    res.json({
      success: workflowResult.success,
      workflowId: workflowResult.workflowId,
      createdWorkItems: workflowResult.createdWorkItems.length,
      assignedAgents: workflowResult.assignedAgents.map(agent => agent.agentId),
      estimatedCompletion: workflowResult.estimatedCompletion ?? null,
      message: `Discovery workflow created successfully for ${portalIds.length} portals`,
    });
  } catch (error) {
    console.error('❌ Failed to create discovery workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create discovery workflow',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get discovery workflow status
 */
router.get('/workflow/:workflowId/status', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { discoveryOrchestrator } = await import(
      '../services/orchestrators/discoveryOrchestrator'
    );

    const status = await discoveryOrchestrator.getWorkflowStatus(workflowId);

    if (status) {
      res.json(status);
    } else {
      res.status(404).json({ error: 'Workflow not found' });
    }
  } catch (error) {
    console.error('❌ Failed to get workflow status:', error);
    res.status(500).json({
      error: 'Failed to get workflow status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
