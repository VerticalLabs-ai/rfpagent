import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * Get dashboard metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await storage.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

export default router;
