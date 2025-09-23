import { BaseRepository, type BaseFilter, type RepositoryResult, createPaginatedResult } from './BaseRepository';
import { rfps, portals, type RFP, type InsertRFP } from '@shared/schema';
import { eq, and, or, sql, desc, asc, gte, lte } from 'drizzle-orm';
import { db } from '../db';

export interface RFPFilter extends BaseFilter {
  status?: string;
  portalId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  minValue?: number;
  maxValue?: number;
  category?: string;
}

/**
 * RFP repository for RFP-specific database operations
 */
export class RFPRepository extends BaseRepository<typeof rfps, RFP, InsertRFP> {
  constructor() {
    super(rfps);
  }

  /**
   * Get all RFPs with optional filtering and pagination
   */
  async findAllRFPs(filter?: RFPFilter): Promise<RepositoryResult<RFP>> {
    let query = db.select().from(rfps);

    const conditions = [];

    if (filter?.status) {
      conditions.push(eq(rfps.status, filter.status));
    }

    if (filter?.portalId) {
      conditions.push(eq(rfps.portalId, filter.portalId));
    }

    if (filter?.search) {
      conditions.push(
        or(
          sql`${rfps.title} ILIKE ${`%${filter.search}%`}`,
          sql`${rfps.description} ILIKE ${`%${filter.search}%`}`,
          sql`${rfps.agency} ILIKE ${`%${filter.search}%`}`
        )
      );
    }

    if (filter?.startDate) {
      conditions.push(gte(rfps.deadline, filter.startDate));
    }

    if (filter?.endDate) {
      conditions.push(lte(rfps.deadline, filter.endDate));
    }

    if (filter?.category) {
      conditions.push(sql`${rfps.category} ILIKE ${`%${filter.category}%`}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filter?.orderBy) {
      const column = rfps[filter.orderBy as keyof typeof rfps];
      if (column) {
        query = query.orderBy(filter.direction === 'desc' ? desc(column) : asc(column)) as any;
      }
    } else {
      // Default ordering
      query = query.orderBy(desc(rfps.createdAt)) as any;
    }

    let data: RFP[];
    if (filter?.limit) {
      data = await query.limit(filter.limit).offset(filter?.offset || 0);
    } else {
      data = await query;
    }

    const total = await this.count(conditions.length > 0 ? and(...conditions) : undefined);

    if (filter?.limit) {
      const page = Math.floor((filter.offset || 0) / filter.limit) + 1;
      return createPaginatedResult(data, total, page, filter.limit);
    }

    return { data, total };
  }

  /**
   * Find RFP by source URL
   */
  async findBySourceUrl(sourceUrl: string): Promise<RFP | undefined> {
    return await this.findOneBy('sourceUrl', sourceUrl);
  }

  /**
   * Get RFPs by status
   */
  async findByStatus(status: string): Promise<RFP[]> {
    return await this.findBy('status', status);
  }

  /**
   * Get RFPs by portal
   */
  async findByPortal(portalId: string): Promise<RFP[]> {
    return await this.findBy('portalId', portalId);
  }

  /**
   * Get RFPs with portal details
   */
  async findWithPortalDetails(filter?: RFPFilter): Promise<any[]> {
    let query = db
      .select({
        rfp: rfps,
        portal: {
          id: portals.id,
          name: portals.name,
          url: portals.url,
          status: portals.status
        }
      })
      .from(rfps)
      .leftJoin(portals, eq(rfps.portalId, portals.id));

    const conditions = [];

    if (filter?.status) {
      conditions.push(eq(rfps.status, filter.status));
    }

    if (filter?.portalId) {
      conditions.push(eq(rfps.portalId, filter.portalId));
    }

    if (filter?.search) {
      conditions.push(
        or(
          sql`${rfps.title} ILIKE ${`%${filter.search}%`}`,
          sql`${rfps.description} ILIKE ${`%${filter.search}%`}`,
          sql`${rfps.agency} ILIKE ${`%${filter.search}%`}`
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(rfps.createdAt));
  }

  /**
   * Get active RFPs (not expired)
   */
  async getActiveRFPs(): Promise<RFP[]> {
    const now = new Date();
    return await this.executeRaw(
      `
      SELECT * FROM rfps
      WHERE status = 'active'
      AND (deadline IS NULL OR deadline > $1)
      ORDER BY deadline ASC NULLS LAST
      `,
      [now]
    );
  }

  /**
   * Get expiring RFPs (deadline within specified days)
   */
  async getExpiringRFPs(days: number = 7): Promise<RFP[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return await this.executeRaw(
      `
      SELECT * FROM rfps
      WHERE status = 'active'
      AND deadline IS NOT NULL
      AND deadline BETWEEN $1 AND $2
      ORDER BY deadline ASC
      `,
      [now, futureDate]
    );
  }

  /**
   * Get RFP statistics
   */
  async getRFPStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    draft: number;
    submitted: number;
    avgResponseTime: number | null;
  }> {
    const now = new Date();

    const [stats] = await this.executeRaw(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' AND (deadline IS NULL OR deadline > $1) THEN 1 END) as active,
        COUNT(CASE WHEN deadline IS NOT NULL AND deadline <= $1 THEN 1 END) as expired,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        AVG(
          CASE WHEN deadline IS NOT NULL AND created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (deadline - created_at)) / 86400
          END
        ) as avg_response_time_days
      FROM rfps
    `, [now]);

    return {
      total: Number(stats.total),
      active: Number(stats.active),
      expired: Number(stats.expired),
      draft: Number(stats.draft),
      submitted: Number(stats.submitted),
      avgResponseTime: stats.avg_response_time_days ? Number(stats.avg_response_time_days) : null
    };
  }

  /**
   * Search RFPs by text
   */
  async searchRFPs(query: string, limit: number = 50): Promise<RFP[]> {
    return await this.executeRaw(
      `
      SELECT *
      FROM rfps
      WHERE (
        title ILIKE $1
        OR description ILIKE $1
        OR agency ILIKE $1
        OR category ILIKE $1
      )
      ORDER BY
        CASE
          WHEN title ILIKE $1 THEN 1
          WHEN description ILIKE $1 THEN 2
          WHEN agency ILIKE $1 THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT $2
      `,
      [`%${query}%`, limit]
    );
  }

  /**
   * Get RFPs by category
   */
  async findByCategory(category: string): Promise<RFP[]> {
    return await this.executeRaw(
      `
      SELECT * FROM rfps
      WHERE category ILIKE $1
      ORDER BY created_at DESC
      `,
      [`%${category}%`]
    );
  }

  /**
   * Get unique categories
   */
  async getCategories(): Promise<string[]> {
    const results = await this.executeRaw(`
      SELECT DISTINCT category
      FROM rfps
      WHERE category IS NOT NULL
      AND category != ''
      ORDER BY category
    `);

    return results.map(r => r.category).filter(Boolean);
  }

  /**
   * Get unique agencies
   */
  async getAgencies(): Promise<string[]> {
    const results = await this.executeRaw(`
      SELECT DISTINCT agency
      FROM rfps
      WHERE agency IS NOT NULL
      AND agency != ''
      ORDER BY agency
    `);

    return results.map(r => r.agency).filter(Boolean);
  }

  /**
   * Update RFP status
   */
  async updateStatus(id: string, status: string): Promise<RFP | undefined> {
    return await this.update(id, { status });
  }

  /**
   * Get RFPs needing analysis
   */
  async getRFPsNeedingAnalysis(): Promise<RFP[]> {
    return await this.executeRaw(`
      SELECT * FROM rfps
      WHERE status = 'active'
      AND analysis IS NULL
      ORDER BY created_at ASC
    `);
  }

  /**
   * Bulk update RFP statuses
   */
  async bulkUpdateStatus(ids: string[], status: string): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await this.executeRaw(
      `
      UPDATE rfps
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2)
      `,
      [status, ids]
    );

    return result.rowCount || 0;
  }

  /**
   * Get RFPs with upcoming deadlines for notifications
   */
  async getRFPsForDeadlineNotifications(hoursAhead: number = 24): Promise<RFP[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return await this.executeRaw(
      `
      SELECT * FROM rfps
      WHERE status = 'active'
      AND deadline IS NOT NULL
      AND deadline BETWEEN $1 AND $2
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE entity_type = 'rfp'
        AND entity_id = rfps.id
        AND type = 'deadline_reminder'
        AND created_at > NOW() - INTERVAL '${hoursAhead} hours'
      )
      ORDER BY deadline ASC
      `,
      [now, future]
    );
  }
}