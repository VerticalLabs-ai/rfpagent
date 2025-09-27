import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * Get all notifications with optional limit
 */
router.get('/', async (req, res) => {
  try {
    const { limit = "50" } = req.query;
    const notifications = await storage.getAllNotifications(parseInt(limit as string));
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/**
 * Get unread notifications
 */
router.get('/unread', async (req, res) => {
  try {
    const notifications = await storage.getUnreadNotifications();
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    res.status(500).json({ error: "Failed to fetch unread notifications" });
  }
});

/**
 * Mark notification as read (POST)
 */
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.markNotificationRead(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/**
 * Clear all unread notifications
 */
router.post('/clear-all', async (req, res) => {
  try {
    const unreadNotifications = await storage.getUnreadNotifications(); // Only get unread notifications
    await Promise.all(
      unreadNotifications.map(notification =>
        storage.markNotificationRead(notification.id)
      )
    );
    res.json({ success: true, cleared: unreadNotifications.length });
  } catch (error) {
    console.error("Error clearing all notifications:", error);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

/**
 * Mark notification as read (PUT)
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.markNotificationRead(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

export default router;