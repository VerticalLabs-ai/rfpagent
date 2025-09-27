import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * Get audit logs for a specific entity
 */
router.get('/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const logs = await storage.getAuditLogsByEntity(entityType, entityId);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;