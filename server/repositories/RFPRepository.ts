import {
  BaseRepository,
  type BaseFilter,
  type RepositoryResult,
  createPaginatedResult,
} from './BaseRepository';
import { rfps, portals, type RFP, type InsertRFP } from '@shared/schema';
import { eq, and, or, sql, desc, asc, gte, lte, inArray } from 'drizzle-orm';
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
    let query = db.select().from(rfps) as any;

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
        query = query.orderBy(
          filter.direction === 'desc' ? desc(column) : asc(column)
        ) as any;
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

    const total = await this.count(
      conditions.length > 0 ? and(...conditions) : undefined
    );

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
          status: portals.status,
        },
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
    return await this.executeRaw<RFP>(sql`
      SELECT * FROM rfps
      WHERE status = 'active'
      AND (deadline IS NULL OR deadline > ${now})
      ORDER BY deadline ASC NULLS LAST
    `);
  }

  /**
   * Get expiring RFPs (deadline within specified days)
   */
  async getExpiringRFPs(days: number = 7): Promise<RFP[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return await this.executeRaw<RFP>(sql`
      SELECT * FROM rfps
      WHERE status = 'active'
      AND deadline IS NOT NULL
      AND deadline BETWEEN ${now} AND ${futureDate}
      ORDER BY deadline ASC
    `);
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

    const [stats] = await this.executeRaw<{
      total: string | number | null;
      active: string | number | null;
      expired: string | number | null;
      draft: string | number | null;
      submitted: string | number | null;
      avg_response_time_days: string | number | null;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' AND (deadline IS NULL OR deadline > ${now}) THEN 1 END) as active,
        COUNT(CASE WHEN deadline IS NOT NULL AND deadline <= ${now} THEN 1 END) as expired,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        AVG(
          CASE WHEN deadline IS NOT NULL AND created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (deadline - created_at)) / 86400
          END
        ) as avg_response_time_days
      FROM rfps
    `);

    const normalized = stats ?? {
      total: 0,
      active: 0,
      expired: 0,
      draft: 0,
      submitted: 0,
      avg_response_time_days: null,
    };

    return {
      total: Number(normalized.total ?? 0),
      active: Number(normalized.active ?? 0),
      expired: Number(normalized.expired ?? 0),
      draft: Number(normalized.draft ?? 0),
      submitted: Number(normalized.submitted ?? 0),
      avgResponseTime: normalized.avg_response_time_days
        ? Number(normalized.avg_response_time_days)
        : null,
    };
  }

  /**
   * Search RFPs by text
   */
  async searchRFPs(query: string, limit: number = 50): Promise<RFP[]> {
    const pattern = `%${query}%`;
    return await this.executeRaw<RFP>(sql`
      SELECT *
      FROM rfps
      WHERE (
        title ILIKE ${pattern}
        OR description ILIKE ${pattern}
        OR agency ILIKE ${pattern}
        OR category ILIKE ${pattern}
      )
      ORDER BY
        CASE
          WHEN title ILIKE ${pattern} THEN 1
          WHEN description ILIKE ${pattern} THEN 2
          WHEN agency ILIKE ${pattern} THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT ${limit}
    `);
  }

  /**
   * Get RFPs by category
   */
  async findByCategory(category: string): Promise<RFP[]> {
    const pattern = `%${category}%`;
    return await this.executeRaw<RFP>(sql`
      SELECT * FROM rfps
      WHERE category ILIKE ${pattern}
      ORDER BY created_at DESC
    `);
  }

  /**
   * Get unique categories
   */
  async getCategories(): Promise<string[]> {
    const results = await this.executeRaw<{ category: string | null }>(sql`
      SELECT DISTINCT category
      FROM rfps
      WHERE category IS NOT NULL
      AND category != ''
      ORDER BY category
    `);

    return results
      .map(r => r.category)
      .filter((category): category is string => Boolean(category));
  }

  /**
   * Get unique agencies
   */
  async getAgencies(): Promise<string[]> {
    const results = await this.executeRaw<{ agency: string | null }>(sql`
      SELECT DISTINCT agency
      FROM rfps
      WHERE agency IS NOT NULL
      AND agency != ''
      ORDER BY agency
    `);

    return results
      .map(r => r.agency)
      .filter((agency): agency is string => Boolean(agency));
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
    return await this.executeRaw<RFP>(sql`
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

    const result = await db
      .update(rfps)
      .set({ status, updatedAt: sql`NOW()` })
      .where(inArray(rfps.id, ids));

    return Number(result.rowCount ?? 0);
  }

  /**
   * Get RFPs with upcoming deadlines for notifications
   */
  async getRFPsForDeadlineNotifications(
    hoursAhead: number = 24
  ): Promise<RFP[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return await this.executeRaw<RFP>(sql`
      SELECT * FROM rfps
      WHERE status = 'active'
      AND deadline IS NOT NULL
      AND deadline BETWEEN ${now} AND ${future}
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE entity_type = 'rfp'
        AND entity_id = rfps.id
        AND type = 'deadline_reminder'
        AND created_at > NOW() - INTERVAL '${hoursAhead} hours'
      )
      ORDER BY deadline ASC
    `);
  }
}
