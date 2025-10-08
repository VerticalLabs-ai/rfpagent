import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { auditLogs, type AuditLog, type InsertAuditLog } from '@shared/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for managing audit logs
 * Tracks all system actions and changes for compliance and debugging
 */
export class AuditLogRepository extends BaseRepository<typeof auditLogs> {
  constructor() {
    super(auditLogs);
  }

  /**
   * Create a new audit log entry
   */
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  /**
   * Get audit logs for a specific entity
   */
  async getAuditLogsByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        )
      )
      .orderBy(desc(auditLogs.timestamp));
  }
}

export const auditLogRepository = new AuditLogRepository();
