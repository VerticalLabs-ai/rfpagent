import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  scans,
  scanEvents,
  type Scan,
  type ScanEvent,
  type InsertScan,
  type InsertScanEvent,
} from '@shared/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for managing portal scans and scan events
 * Handles scan lifecycle, events, and history tracking
 */
export class ScanRepository extends BaseRepository<typeof scans> {
  constructor() {
    super(scans);
  }

  /**
   * Create a new scan
   */
  async createScan(scan: InsertScan): Promise<Scan> {
    const [newScan] = await db.insert(scans).values(scan).returning();
    return newScan;
  }

  /**
   * Update a scan
   */
  async updateScan(scanId: string, updates: Partial<Scan>): Promise<Scan> {
    const [updatedScan] = await db
      .update(scans)
      .set(updates)
      .where(eq(scans.id, scanId))
      .returning();
    return updatedScan;
  }

  /**
   * Get a scan by ID
   */
  async getScan(scanId: string): Promise<Scan | undefined> {
    const [scan] = await db.select().from(scans).where(eq(scans.id, scanId));
    return scan || undefined;
  }

  /**
   * Get scans for a portal
   */
  async getScansByPortal(
    portalId: string,
    limit: number = 10
  ): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.portalId, portalId))
      .orderBy(desc(scans.startedAt))
      .limit(limit);
  }

  /**
   * Get active scans for a portal
   */
  async getActiveScansByPortal(portalId: string): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(and(eq(scans.portalId, portalId), eq(scans.status, 'running')))
      .orderBy(desc(scans.startedAt));
  }

  /**
   * Get all active scans
   */
  async getActiveScans(): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.status, 'running'))
      .orderBy(desc(scans.startedAt));
  }

  /**
   * Add a scan event
   */
  async appendScanEvent(event: InsertScanEvent): Promise<ScanEvent> {
    const [newEvent] = await db.insert(scanEvents).values(event).returning();
    return newEvent;
  }

  /**
   * Get events for a scan
   */
  async getScanEvents(scanId: string): Promise<ScanEvent[]> {
    return await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.scanId, scanId))
      .orderBy(asc(scanEvents.timestamp));
  }

  /**
   * Get scan history for a portal
   */
  async getScanHistory(portalId: string, limit: number = 20): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.portalId, portalId))
      .orderBy(desc(scans.startedAt))
      .limit(limit);
  }
}

export const scanRepository = new ScanRepository();
