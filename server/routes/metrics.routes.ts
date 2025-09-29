import { Router } from 'express';
import { agentMonitoringService } from '../services/agentMonitoringService';

const router = Router();

/**
 * Get workflow metrics
 */
router.get('/workflow-metrics', async (req, res) => {
  try {
    const workflowMetrics = await agentMonitoringService.getWorkflowOverview();
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
    const systemHealth = await agentMonitoringService.getSystemHealthSnapshot();
    res.json(systemHealth);
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({
      error: 'Failed to fetch system health',
    });
  }
});

export default router;
