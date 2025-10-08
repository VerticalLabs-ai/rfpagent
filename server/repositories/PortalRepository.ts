import {
  BaseRepository,
  type BaseFilter,
  type RepositoryResult,
  createPaginatedResult,
} from './BaseRepository';
import { portals, type Portal, type InsertPortal } from '@shared/schema';
import { eq, and, or, sql, inArray, type SQL } from 'drizzle-orm';
import { db } from '../db';

export interface PortalFilter extends BaseFilter {
  status?: 'active' | 'inactive';
  loginRequired?: boolean;
  search?: string;
}

/**
 * Portal repository for portal-specific database operations
 */
export class PortalRepository extends BaseRepository<
  typeof portals,
  Portal,
  InsertPortal
> {
  constructor() {
    super(portals);
  }

  /**
   * Get all portals with optional filtering
   */
  async findAllPortals(
    filter?: PortalFilter
  ): Promise<RepositoryResult<Portal>> {
    const conditions: SQL<unknown>[] = [];

    if (filter?.status) {
      conditions.push(eq(portals.status, filter.status));
    }

    if (filter?.loginRequired !== undefined) {
      conditions.push(eq(portals.loginRequired, filter.loginRequired));
    }

    if (filter?.search) {
      const pattern = `%${filter.search}%`;
      const searchCondition = or(
        sql`${portals.name} ILIKE ${pattern}`,
        sql`${portals.url} ILIKE ${pattern}`
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy = filter?.orderBy ?? 'createdAt';
    const direction = filter?.direction ?? 'desc';

    const data = await this.findAll({
      ...(whereClause ? { where: whereClause } : {}),
      orderBy,
      direction,
      limit: filter?.limit,
      offset: filter?.offset,
    });

    const total = whereClause
      ? await this.count(whereClause)
      : await this.count();

    if (filter?.limit) {
      const page = Math.floor((filter.offset || 0) / filter.limit) + 1;
      return createPaginatedResult(data, total, page, filter.limit);
    }

    return { data, total };
  }

  /**
   * Get active portals only
   */
  async getActivePortals(): Promise<Portal[]> {
    return await this.findBy('status', 'active');
  }

  /**
   * Get portal with credentials (for internal use only)
   */
  async findWithCredentials(id: string): Promise<Portal | undefined> {
    return await this.findById(id);
  }

  /**
   * Find portal by URL
   */
  async findByUrl(url: string): Promise<Portal | undefined> {
    return await this.findOneBy('url', url);
  }

  /**
   * Update portal status
   */
  async updateStatus(
    id: string,
    status: 'active' | 'inactive'
  ): Promise<Portal | undefined> {
    return await this.update(id, { status });
  }

  /**
   * Update last scanned timestamp
   */
  async updateLastScanned(
    id: string,
    lastScanned: Date = new Date()
  ): Promise<Portal | undefined> {
    return await this.update(id, { lastScanned });
  }

  /**
   * Get portals that need scanning
   */
  async getPortalsNeedingScanning(
    hoursThreshold: number = 24
  ): Promise<Portal[]> {
    const threshold = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

    return await this.executeRaw<Portal>(sql`
      SELECT * FROM portals
      WHERE status = 'active'
      AND (last_scanned IS NULL OR last_scanned < ${threshold})
      ORDER BY last_scanned ASC NULLS FIRST
    `);
  }

  /**
   * Get portal statistics
   */
  async getPortalStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    requireLogin: number;
    recentlyScanned: number;
  }> {
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const [stats] = await this.executeRaw<{
      total: string | number | null;
      active: string | number | null;
      inactive: string | number | null;
      require_login: string | number | null;
      recently_scanned: string | number | null;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN login_required = true THEN 1 END) as require_login,
        COUNT(CASE WHEN last_scanned > ${recent} THEN 1 END) as recently_scanned
      FROM portals
    `);

    const normalized = stats ?? {
      total: 0,
      active: 0,
      inactive: 0,
      require_login: 0,
      recently_scanned: 0,
    };

    return {
      total: Number(normalized.total ?? 0),
      active: Number(normalized.active ?? 0),
      inactive: Number(normalized.inactive ?? 0),
      requireLogin: Number(normalized.require_login ?? 0),
      recentlyScanned: Number(normalized.recently_scanned ?? 0),
    };
  }

  /**
   * Search portals by name or URL
   */
  async searchPortals(query: string, limit: number = 50): Promise<Portal[]> {
    const pattern = `%${query}%`;
    return await this.executeRaw<Portal>(sql`
      SELECT
        id, name, url, status, login_required,
        last_scanned, created_at, updated_at
      FROM portals
      WHERE (
        name ILIKE ${pattern}
        OR url ILIKE ${pattern}
      )
      AND status = 'active'
      ORDER BY name
      LIMIT ${limit}
    `);
  }

  /**
   * Bulk update portal statuses
   */
  async bulkUpdateStatus(
    ids: string[],
    status: 'active' | 'inactive'
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await db
      .update(portals)
      .set({ status, updatedAt: sql`NOW()` })
      .where(inArray(portals.id, ids));

    return Number(result.rowCount ?? 0);
  }

  /**
   * Get portal scan history summary
   */
  async getPortalScanSummary(
    portalId: string,
    days: number = 30
  ): Promise<{
    portalId: string;
    totalScans: number;
    successfulScans: number;
    lastScan: Date | null;
    averageInterval: number | null;
  }> {
    const [summary] = await this.executeRaw<{
      portal_id: string;
      total_scans: string | number | null;
      successful_scans: string | number | null;
      last_scan: Date | null;
      average_interval_seconds: string | number | null;
    }>(sql`
      SELECT
        ${portalId} as portal_id,
        COUNT(*) as total_scans,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_scans,
        MAX(created_at) as last_scan,
        EXTRACT(EPOCH FROM AVG(
          CASE WHEN LAG(created_at) OVER (ORDER BY created_at) IS NOT NULL
          THEN created_at - LAG(created_at) OVER (ORDER BY created_at)
          END
        )) as average_interval_seconds
      FROM scans
      WHERE portal_id = ${portalId}
      AND created_at >= NOW() - INTERVAL '${days} days'
    `);

    if (!summary) {
      return {
        portalId,
        totalScans: 0,
        successfulScans: 0,
        lastScan: null,
        averageInterval: null,
      };
    }

    return {
      portalId: summary.portal_id,
      totalScans: Number(summary.total_scans ?? 0),
      successfulScans: Number(summary.successful_scans ?? 0),
      lastScan: summary.last_scan,
      averageInterval: summary.average_interval_seconds
        ? Number(summary.average_interval_seconds)
        : null,
    };
  }
}
