import { BaseRepository, type BaseFilter, type RepositoryResult, createPaginatedResult } from './BaseRepository';
import { portals, type Portal, type InsertPortal } from '@shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../db';

export interface PortalFilter extends BaseFilter {
  status?: 'active' | 'inactive';
  loginRequired?: boolean;
  search?: string;
}

/**
 * Portal repository for portal-specific database operations
 */
export class PortalRepository extends BaseRepository<typeof portals, Portal, InsertPortal> {
  constructor() {
    super(portals);
  }

  /**
   * Get all portals with optional filtering
   */
  async findAllPortals(filter?: PortalFilter): Promise<RepositoryResult<Portal>> {
    let query = db.select({
      id: portals.id,
      name: portals.name,
      url: portals.url,
      status: portals.status,
      loginRequired: portals.loginRequired,
      lastScanned: portals.lastScanned,
      createdAt: portals.createdAt
      // Exclude credentials from public list
    }).from(portals);

    const conditions = [];

    if (filter?.status) {
      conditions.push(eq(portals.status, filter.status));
    }

    if (filter?.loginRequired !== undefined) {
      conditions.push(eq(portals.loginRequired, filter.loginRequired));
    }

    if (filter?.search) {
      conditions.push(
        or(
          sql`${portals.name} ILIKE ${`%${filter.search}%`}`,
          sql`${portals.url} ILIKE ${`%${filter.search}%`}`
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filter?.orderBy) {
      const column = portals[filter.orderBy as keyof typeof portals];
      if (column) {
        query = query.orderBy(filter.direction === 'desc' ? sql`${column} DESC` : sql`${column} ASC`) as any;
      }
    }

    let data: Portal[];
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
  async updateStatus(id: string, status: 'active' | 'inactive'): Promise<Portal | undefined> {
    return await this.update(id, { status });
  }

  /**
   * Update last scanned timestamp
   */
  async updateLastScanned(id: string, lastScanned: Date = new Date()): Promise<Portal | undefined> {
    return await this.update(id, { lastScanned });
  }

  /**
   * Get portals that need scanning
   */
  async getPortalsNeedingScanning(hoursThreshold: number = 24): Promise<Portal[]> {
    const threshold = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

    return await this.executeRaw(
      `
      SELECT * FROM portals
      WHERE status = 'active'
      AND (last_scanned IS NULL OR last_scanned < $1)
      ORDER BY last_scanned ASC NULLS FIRST
      `,
      [threshold]
    );
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

    const [stats] = await this.executeRaw(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN login_required = true THEN 1 END) as require_login,
        COUNT(CASE WHEN last_scanned > $1 THEN 1 END) as recently_scanned
      FROM portals
    `, [recent]);

    return {
      total: Number(stats.total),
      active: Number(stats.active),
      inactive: Number(stats.inactive),
      requireLogin: Number(stats.require_login),
      recentlyScanned: Number(stats.recently_scanned)
    };
  }

  /**
   * Search portals by name or URL
   */
  async searchPortals(query: string, limit: number = 50): Promise<Portal[]> {
    return await this.executeRaw(
      `
      SELECT
        id, name, url, status, login_required,
        last_scanned, created_at, updated_at
      FROM portals
      WHERE (
        name ILIKE $1
        OR url ILIKE $1
      )
      AND status = 'active'
      ORDER BY name
      LIMIT $2
      `,
      [`%${query}%`, limit]
    );
  }

  /**
   * Bulk update portal statuses
   */
  async bulkUpdateStatus(ids: string[], status: 'active' | 'inactive'): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await this.executeRaw(
      `
      UPDATE portals
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2)
      `,
      [status, ids]
    );

    return result.rowCount || 0;
  }

  /**
   * Get portal scan history summary
   */
  async getPortalScanSummary(portalId: string, days: number = 30): Promise<{
    portalId: string;
    totalScans: number;
    successfulScans: number;
    lastScan: Date | null;
    averageInterval: number | null;
  }> {
    const [summary] = await this.executeRaw(
      `
      SELECT
        $1 as portal_id,
        COUNT(*) as total_scans,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_scans,
        MAX(created_at) as last_scan,
        EXTRACT(EPOCH FROM AVG(
          CASE WHEN LAG(created_at) OVER (ORDER BY created_at) IS NOT NULL
          THEN created_at - LAG(created_at) OVER (ORDER BY created_at)
          END
        )) as average_interval_seconds
      FROM scans
      WHERE portal_id = $1
      AND created_at >= NOW() - INTERVAL '$2 days'
      `,
      [portalId, days]
    );

    return {
      portalId: summary.portal_id,
      totalScans: Number(summary.total_scans),
      successfulScans: Number(summary.successful_scans),
      lastScan: summary.last_scan,
      averageInterval: summary.average_interval_seconds ? Number(summary.average_interval_seconds) : null
    };
  }
}