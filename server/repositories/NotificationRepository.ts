import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  notifications,
  type Notification,
  type InsertNotification,
} from '@shared/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for managing notifications
 * Handles notification CRUD operations and read status tracking
 */
export class NotificationRepository extends BaseRepository<
  typeof notifications
> {
  constructor() {
    super(notifications);
  }

  /**
   * Get all notifications with optional limit
   */
  async getAllNotifications(limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  /**
   * Get only unread notifications
   */
  async getUnreadNotifications(): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .orderBy(desc(notifications.createdAt));
  }

  /**
   * Create a new notification
   */
  async createNotification(
    notification: InsertNotification
  ): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  /**
   * Mark a notification as read
   */
  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }
}

export const notificationRepository = new NotificationRepository();
