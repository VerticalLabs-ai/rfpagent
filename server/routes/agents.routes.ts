import { Router } from 'express';
import { aiAgentOrchestrator } from '../services/aiAgentOrchestrator';
import { agentRegistryService } from '../services/agentRegistryService';
import { workflowCoordinator } from '../services/workflowCoordinator';

const router = Router();

/**
 * Get agent activity
 */
router.get('/activity', async (req, res) => {
  try {
    const agentActivity = await aiAgentOrchestrator.getAgentActivity();
    res.json(agentActivity);
  } catch (error) {
    console.error('Error fetching agent activity:', error);
    res.status(500).json({ error: 'Failed to fetch agent activity' });
  }
});

/**
 * Get agent performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const performanceMetrics = await aiAgentOrchestrator.getPerformanceMetrics(
      timeframe as string
    );
    res.json(performanceMetrics);
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

/**
 * Get agent coordination status
 */
router.get('/coordination', async (req, res) => {
  try {
    const coordinationStatus =
      await aiAgentOrchestrator.getCoordinationStatus();
    res.json(coordinationStatus);
  } catch (error) {
    console.error('Error fetching agent coordination:', error);
    res.status(500).json({ error: 'Failed to fetch agent coordination' });
  }
});

/**
 * Get agent registry
 */
router.get('/registry', async (req, res) => {
  try {
    const agentRegistry = await agentRegistryService.getAllAgents();
    res.json(agentRegistry);
  } catch (error) {
    console.error('Error fetching agent registry:', error);
    res.status(500).json({ error: 'Failed to fetch agent registry' });
  }
});

/**
 * Get work items
 */
router.get('/work-items', async (req, res) => {
  try {
    const { status, agentType, limit = '50' } = req.query;

    const workItems = await workflowCoordinator.getWorkItems({
      status: status as string,
      agentType: agentType as string,
      limit: parseInt(limit as string),
    });

    res.json(workItems);
  } catch (error) {
    console.error('Error fetching work items:', error);
    res.status(500).json({ error: 'Failed to fetch work items' });
  }
});

export default router;
