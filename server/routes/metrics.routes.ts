import { Router } from 'express';
import { workflowCoordinator } from '../services/workflowCoordinator';
import { aiAgentOrchestrator } from '../services/aiAgentOrchestrator';

const router = Router();

/**
 * Get workflow metrics
 */
router.get('/workflow-metrics', async (req, res) => {
  try {
    const workflowMetrics = await workflowCoordinator.getWorkflowMetrics();
    res.json(workflowMetrics);
  } catch (error) {
    console.error('Error fetching workflow metrics:', error);
    res.status(500).json({ error: 'Failed to fetch workflow metrics' });
  }
});

/**
 * Get system health status
 */
router.get('/system-health', async (req, res) => {
  try {
    const systemHealth = {
      agents: await aiAgentOrchestrator.getSystemHealth(),
      workflows: await workflowCoordinator.getSystemHealth(),
      timestamp: new Date().toISOString(),
      status: 'healthy', // This would be computed based on the above metrics
    };

    // Determine overall system status
    const agentHealthy = systemHealth.agents.status === 'healthy';
    const workflowHealthy = systemHealth.workflows.status === 'healthy';

    if (!agentHealthy || !workflowHealthy) {
      systemHealth.status = 'degraded';
    }

    res.json(systemHealth);
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      error: 'Failed to fetch system health',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
