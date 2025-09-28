import type { AgentMetricsTimeframe } from '@shared/api/agentMonitoring';
import { Router } from 'express';
import { agentMonitoringService } from '../services/agentMonitoringService';

const router = Router();

/**
 * Get agent activity
 */
router.get('/activity', async (req, res) => {
  try {
    const agentActivity = await agentMonitoringService.getRecentActivity(25);
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
    const allowed: AgentMetricsTimeframe[] = ['24h', '7d', '30d'];
    const safeTimeframe = allowed.includes(timeframe as AgentMetricsTimeframe)
      ? (timeframe as AgentMetricsTimeframe)
      : '24h';
    const performanceMetrics =
      await agentMonitoringService.getPerformanceMetrics(safeTimeframe);
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
    const { limit } = req.query;
    const size =
      typeof limit === 'string' && !Number.isNaN(Number(limit))
        ? Number(limit)
        : 25;
    const coordinationStatus =
      await agentMonitoringService.getCoordinationEvents(size);
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
    const agentRegistry = await agentMonitoringService.getRegistrySummary();
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
    const summary = await agentMonitoringService.getWorkItemSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching work items:', error);
    res.status(500).json({ error: 'Failed to fetch work items' });
  }
});

export default router;
