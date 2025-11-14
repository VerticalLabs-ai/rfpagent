import { eq, and, gte, desc, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { portals, rfps, scans, scanEvents } from '@shared/schema';
import { storage } from '../../storage';
import { pageExtractTool } from '../../../src/mastra/tools';
import { z } from 'zod';
import { PortalUrlResolver } from '../scraping/portal/PortalUrlResolver';
import { AustinFinanceContentExtractor } from '../scraping/extraction/extractors/AustinFinanceContentExtractor';
import { sessionManager } from '../../../src/mastra/tools/session-manager';

/**
 * Incremental Portal Scanning Service
 *
 * This service implements intelligent incremental scanning of RFP portals:
 * 1. Tracks last scan timestamp per portal
 * 2. Detects only new or modified RFPs since last scan
 * 3. Efficiently updates existing RFP records
 * 4. Minimizes redundant scraping operations
 * 5. Integrates with Mastra workflow system
 */

interface ScanOptions {
  portalId: string;
  sessionId?: string;
  forceFullScan?: boolean;
  maxRfpsToScan?: number;
}

interface ScanResult {
  scanId: string;
  portalId: string;
  portalName: string;
  newRfpsCount: number;
  updatedRfpsCount: number;
  unchangedRfpsCount: number;
  errorCount: number;
  duration: number;
  errors: string[];
}

interface RFPCandidate {
  title: string;
  description?: string;
  agency?: string;
  deadline?: string;
  estimatedValue?: string;
  url: string;
  sourceIdentifier?: string; // Portal-specific ID for deduplication
  lastModified?: string;
  category?: string;
}

const rfpCandidateSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  agency: z.string().optional(),
  deadline: z.string().optional(),
  estimatedValue: z.string().optional(),
  url: z.string(),
  sourceIdentifier: z.string().optional(),
  lastModified: z.string().optional(),
  category: z.string().optional(),
});

export class IncrementalPortalScanService {
  /**
   * Perform an incremental scan of a portal
   */
  async scanPortal(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    const {
      portalId,
      sessionId = `scan-${Date.now()}`,
      forceFullScan = false,
      maxRfpsToScan = 50,
    } = options;

    console.log(`🔍 Starting incremental scan for portal: ${portalId}`);

    // Get portal details
    const portal = await storage.getPortalWithCredentials(portalId);
    if (!portal) {
      throw new Error(`Portal not found: ${portalId}`);
    }

    // Create scan record
    const scan = await storage.createScan({
      portalId,
      portalName: portal.name,
      status: 'running',
      currentStep: 'initializing',
      currentProgress: 0,
    });

    const errors: string[] = [];
    let newRfpsCount = 0;
    let updatedRfpsCount = 0;
    let unchangedRfpsCount = 0;
    let errorCount = 0;

    try {
      // Emit scan started event
      await this.emitScanEvent(scan.id, 'scan_started', {
        portalId,
        portalName: portal.name,
        forceFullScan,
      });

      // Step 1: Get last scan timestamp
      await this.updateScanProgress(
        scan.id,
        'navigating',
        10,
        'Determining scan scope...'
      );
      const lastScanTime = forceFullScan
        ? null
        : await this.getLastSuccessfulScanTime(portalId);

      if (lastScanTime) {
        console.log(`📅 Last successful scan: ${lastScanTime.toISOString()}`);
        await this.emitScanEvent(scan.id, 'log', {
          level: 'info',
          message: `Incremental scan from ${lastScanTime.toISOString()}`,
        });
      } else {
        console.log(`📅 Full scan (no previous successful scan found)`);
        await this.emitScanEvent(scan.id, 'log', {
          level: 'info',
          message: 'Performing full scan',
        });
      }

      // Step 2: Extract RFP candidates from portal
      await this.updateScanProgress(
        scan.id,
        'extracting',
        30,
        'Extracting RFP opportunities...'
      );
      const candidates = await this.extractRFPCandidates(
        portal,
        sessionId,
        lastScanTime,
        maxRfpsToScan
      );

      console.log(`📊 Found ${candidates.length} RFP candidates`);
      await this.emitScanEvent(scan.id, 'log', {
        level: 'info',
        message: `Extracted ${candidates.length} RFP candidates`,
      });

      // Step 3: Process each candidate
      await this.updateScanProgress(
        scan.id,
        'parsing',
        50,
        `Processing ${candidates.length} candidates...`
      );

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const progress = 50 + Math.floor((i / candidates.length) * 40);

        try {
          await this.updateScanProgress(
            scan.id,
            'parsing',
            progress,
            `Processing ${i + 1}/${candidates.length}: ${candidate.title.substring(0, 50)}...`
          );

          const result = await this.processRFPCandidate(
            portalId,
            candidate,
            lastScanTime
          );

          if (result === 'new') {
            newRfpsCount++;
            await this.emitScanEvent(scan.id, 'rfp_discovered', {
              title: candidate.title,
              url: candidate.url,
            });
          } else if (result === 'updated') {
            updatedRfpsCount++;
            await this.emitScanEvent(scan.id, 'log', {
              level: 'info',
              message: `Updated RFP: ${candidate.title}`,
            });
          } else {
            unchangedRfpsCount++;
          }
        } catch (error) {
          errorCount++;
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error processing ${candidate.title}: ${errorMsg}`);

          await this.emitScanEvent(scan.id, 'error', {
            message: `Failed to process RFP: ${candidate.title}`,
            error: errorMsg,
          });
        }
      }

      // Step 4: Finalize scan
      await this.updateScanProgress(
        scan.id,
        'completed',
        100,
        'Scan completed successfully'
      );

      // Update portal last scanned timestamp
      await db
        .update(portals)
        .set({
          lastScanned: new Date(),
          updatedAt: new Date(),
          errorCount:
            errorCount > 0 ? (portal.errorCount || 0) + errorCount : 0,
          lastError: errors.length > 0 ? errors[0] : null,
        })
        .where(eq(portals.id, portalId));

      // Complete scan record
      const duration = Date.now() - startTime;
      await db
        .update(scans)
        .set({
          status: 'completed',
          completedAt: new Date(),
          discoveredRfpsCount: newRfpsCount,
          errorCount,
          errors: errors.length > 0 ? errors : null,
        })
        .where(eq(scans.id, scan.id));

      await this.emitScanEvent(scan.id, 'scan_completed', {
        newRfps: newRfpsCount,
        updatedRfps: updatedRfpsCount,
        unchangedRfps: unchangedRfpsCount,
        errors: errorCount,
        duration,
      });

      console.log(
        `✅ Scan completed: ${newRfpsCount} new, ${updatedRfpsCount} updated, ${unchangedRfpsCount} unchanged`
      );

      return {
        scanId: scan.id,
        portalId,
        portalName: portal.name,
        newRfpsCount,
        updatedRfpsCount,
        unchangedRfpsCount,
        errorCount,
        duration,
        errors,
      };
    } catch (error) {
      errorCount++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);

      await this.updateScanProgress(
        scan.id,
        'failed',
        0,
        `Scan failed: ${errorMsg}`
      );

      await db
        .update(scans)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorCount,
          errors,
        })
        .where(eq(scans.id, scan.id));

      await this.emitScanEvent(scan.id, 'scan_failed', {
        error: errorMsg,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Get the timestamp of the last successful scan for a portal
   */
  private async getLastSuccessfulScanTime(
    portalId: string
  ): Promise<Date | null> {
    const lastScan = await (db.query as any).scans.findFirst({
      where: and(eq(scans.portalId, portalId), eq(scans.status, 'completed')),
      orderBy: desc(scans.completedAt),
    });

    return lastScan?.completedAt || null;
  }

  /**
   * Extract RFP candidates from portal using Mastra tools
   */
  private async extractRFPCandidates(
    portal: any,
    sessionId: string,
    lastScanTime: Date | null,
    maxResults: number
  ): Promise<RFPCandidate[]> {
    console.log(`🔎 Extracting RFPs from ${portal.url}`);

    // Step 1: Resolve the correct URL for known portals
    const navigationConfig = PortalUrlResolver.getNavigationConfig(portal.url);
    const targetUrl = navigationConfig?.listingUrl || portal.url;
    const extractorType = PortalUrlResolver.getExtractorType(portal.url);

    console.log(`🧭 Portal type detected: ${extractorType}`);
    if (targetUrl !== portal.url) {
      console.log(`🔀 Navigating to listing page: ${targetUrl}`);
    }

    try {
      // Step 2: Use specialized extractor if available, otherwise use generic AI extraction
      if (extractorType === 'austin') {
        return await this.extractWithAustinExtractor(
          targetUrl,
          sessionId,
          lastScanTime,
          maxResults
        );
      } else {
        return await this.extractWithGenericExtractor(
          targetUrl,
          sessionId,
          lastScanTime,
          maxResults,
          portal.filters
        );
      }
    } catch (error) {
      console.error(`❌ Failed to extract RFPs from ${targetUrl}:`, error);
      throw new Error(
        `RFP extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract RFPs using Austin Finance specialized extractor
   */
  private async extractWithAustinExtractor(
    url: string,
    sessionId: string,
    lastScanTime: Date | null,
    maxResults: number
  ): Promise<RFPCandidate[]> {
    console.log(`🏛️ Using Austin Finance specialized extractor`);

    // Get Stagehand page from session manager
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = await sessionManager.getPage(sessionId);

    // Navigate to the portal
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page content - page is properly typed from sessionManager.getPage()
    const content = await page.content();

    // Use Austin Finance extractor
    const extractor = new AustinFinanceContentExtractor();
    const opportunities = await extractor.extract(
      content,
      url,
      'austin_finance'
    );

    console.log(
      `🏛️ Austin extractor found ${opportunities.length} opportunities`
    );

    // Convert to RFPCandidate format
    const candidates: RFPCandidate[] = opportunities.map(opp => ({
      title: opp.title,
      description: opp.description,
      agency: opp.agency || 'City of Austin',
      deadline: opp.deadline,
      estimatedValue: opp.estimatedValue,
      url: opp.url || opp.link || url,
      sourceIdentifier: (opp as any).solicitationId,
      lastModified: (opp as any).postedDate,
      category: opp.category,
    }));

    return candidates.slice(0, maxResults);
  }

  /**
   * Extract RFPs using generic AI-powered extraction
   */
  private async extractWithGenericExtractor(
    url: string,
    sessionId: string,
    lastScanTime: Date | null,
    maxResults: number,
    filters?: any
  ): Promise<RFPCandidate[]> {
    console.log(`🤖 Using generic AI-powered extractor`);

    // Build extraction instruction based on whether this is incremental
    const instruction = lastScanTime
      ? `Extract RFP opportunities posted or modified after ${lastScanTime.toISOString()}. Include: title, description, agency, deadline, estimated value, URL, portal-specific ID, and last modified date. Return up to ${maxResults} most recent opportunities.`
      : `Extract all active RFP opportunities. Include: title, description, agency, deadline, estimated value, URL, portal-specific ID, and last modified date. Return up to ${maxResults} most recent opportunities.`;

    const extractionResult = pageExtractTool?.execute
      ? await pageExtractTool.execute({
          context: {
            url,
            instruction,
            sessionId,
            schema: {
              opportunities: z.array(rfpCandidateSchema),
            },
          },
          runtimeContext: {} as any,
        })
      : { data: { opportunities: [] } };

    const opportunities = (extractionResult as any).data?.opportunities || [];

    // Apply portal-specific filters if configured
    let filtered = opportunities;
    if (filters) {
      filtered = this.applyPortalFilters(opportunities, filters);
      console.log(
        `🔍 Applied filters: ${opportunities.length} -> ${filtered.length} opportunities`
      );
    }

    return filtered.slice(0, maxResults);
  }

  /**
   * Apply portal-specific filters to candidates
   */
  private applyPortalFilters(
    candidates: RFPCandidate[],
    filters: any
  ): RFPCandidate[] {
    if (!filters || typeof filters !== 'object') {
      return candidates;
    }

    return candidates.filter(candidate => {
      // Category filter
      if (
        filters.categories &&
        Array.isArray(filters.categories) &&
        filters.categories.length > 0
      ) {
        if (
          !candidate.category ||
          !filters.categories.includes(candidate.category)
        ) {
          return false;
        }
      }

      // Minimum value filter
      if (filters.minValue && candidate.estimatedValue) {
        const value = this.parseEstimatedValue(candidate.estimatedValue);
        if (value !== null && value < filters.minValue) {
          return false;
        }
      }

      // Keyword filter
      if (
        filters.keywords &&
        Array.isArray(filters.keywords) &&
        filters.keywords.length > 0
      ) {
        const text =
          `${candidate.title} ${candidate.description || ''}`.toLowerCase();
        const hasKeyword = filters.keywords.some((keyword: string) =>
          text.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Process a single RFP candidate (create new or update existing)
   */
  private async processRFPCandidate(
    portalId: string,
    candidate: RFPCandidate,
    lastScanTime: Date | null
  ): Promise<'new' | 'updated' | 'unchanged'> {
    // Find existing RFP by source URL or source identifier
    // Build conditions array to avoid passing undefined to or()
    const conditions = [eq(rfps.sourceUrl, candidate.url)];
    if (candidate.sourceIdentifier) {
      conditions.push(
        sql`${rfps.requirements}->>'sourceIdentifier' = ${candidate.sourceIdentifier}`
      );
    }

    const existingRfps = await (db.query as any).rfps.findMany({
      where: and(eq(rfps.portalId, portalId), or(...conditions)),
    });

    const existingRfp = existingRfps[0];

    // Parse deadline
    const deadline = candidate.deadline
      ? this.parseDeadline(candidate.deadline)
      : null;

    // Parse estimated value
    const estimatedValueNum = candidate.estimatedValue
      ? this.parseEstimatedValue(candidate.estimatedValue)
      : null;

    if (!existingRfp) {
      // Create new RFP
      console.log(`✨ Creating new RFP: ${candidate.title}`);

      await storage.createRFP({
        title: candidate.title,
        description: candidate.description || '',
        agency: candidate.agency || 'Unknown',
        portalId,
        sourceUrl: candidate.url,
        deadline,
        estimatedValue: estimatedValueNum?.toString() || null,
        status: 'discovered',
        progress: 10,
        category: candidate.category,
        analysis: {
          sourceIdentifier: candidate.sourceIdentifier,
          lastModified: candidate.lastModified,
          discoveredInScan: true,
        },
      });

      return 'new';
    }

    // Check if RFP has been modified
    const hasChanges = this.detectChanges(
      existingRfp,
      candidate,
      deadline,
      estimatedValueNum
    );

    if (hasChanges) {
      console.log(`🔄 Updating RFP: ${candidate.title}`);

      await storage.updateRFP(existingRfp.id, {
        title: candidate.title,
        description: candidate.description || existingRfp.description,
        agency: candidate.agency || existingRfp.agency,
        deadline: deadline || existingRfp.deadline,
        estimatedValue:
          estimatedValueNum?.toString() || existingRfp.estimatedValue,
        category: candidate.category || existingRfp.category,
        updatedAt: new Date(),
        analysis: {
          ...((existingRfp.analysis as any) || {}),
          sourceIdentifier: candidate.sourceIdentifier,
          lastModified: candidate.lastModified,
          lastCheckedInScan: new Date().toISOString(),
        },
      });

      return 'updated';
    }

    // No changes, just mark as checked
    await storage.updateRFP(existingRfp.id, {
      analysis: {
        ...((existingRfp.analysis as any) || {}),
        lastCheckedInScan: new Date().toISOString(),
      },
    });

    return 'unchanged';
  }

  /**
   * Detect if an RFP has changes that warrant an update
   */
  private detectChanges(
    existingRfp: any,
    candidate: RFPCandidate,
    deadline: Date | null,
    estimatedValue: number | null
  ): boolean {
    // Title changed
    if (candidate.title !== existingRfp.title) {
      return true;
    }

    // Description changed (if provided)
    if (
      candidate.description &&
      candidate.description !== existingRfp.description
    ) {
      return true;
    }

    // Deadline changed
    if (deadline && existingRfp.deadline) {
      const existingDeadlineTime = new Date(existingRfp.deadline).getTime();
      if (Math.abs(deadline.getTime() - existingDeadlineTime) > 60000) {
        // More than 1 minute difference
        return true;
      }
    } else if (deadline !== existingRfp.deadline) {
      return true;
    }

    // Estimated value changed
    if (estimatedValue !== null && existingRfp.estimatedValue) {
      const existingValue = parseFloat(existingRfp.estimatedValue);
      if (
        !isNaN(existingValue) &&
        Math.abs(estimatedValue - existingValue) > 0.01
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse deadline string to Date
   */
  private parseDeadline(deadlineStr: string): Date | null {
    try {
      const date = new Date(deadlineStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch {
      // Try various formats
    }
    return null;
  }

  /**
   * Parse estimated value to number
   */
  private parseEstimatedValue(valueStr: string): number | null {
    try {
      const cleaned = valueStr.replace(/[$,]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        return parsed;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  /**
   * Update scan progress
   */
  private async updateScanProgress(
    scanId: string,
    step: string,
    progress: number,
    message?: string
  ): Promise<void> {
    await db
      .update(scans)
      .set({
        currentStep: step,
        currentProgress: progress,
        currentMessage: message || null,
      })
      .where(eq(scans.id, scanId));

    await this.emitScanEvent(scanId, 'progress', {
      step,
      progress,
      message,
    });
  }

  /**
   * Emit scan event
   */
  private async emitScanEvent(
    scanId: string,
    type: string,
    data?: any
  ): Promise<void> {
    await storage.appendScanEvent({
      scanId,
      type,
      level: type === 'error' ? 'error' : 'info',
      message: data?.message || null,
      data,
    });
  }

  /**
   * Batch scan multiple portals
   */
  async batchScanPortals(
    portalIds: string[],
    options?: Partial<ScanOptions>
  ): Promise<ScanResult[]> {
    console.log(`🚀 Starting batch scan of ${portalIds.length} portals`);

    const results: ScanResult[] = [];

    for (const portalId of portalIds) {
      try {
        const result = await this.scanPortal({
          portalId,
          ...options,
        });
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to scan portal ${portalId}:`, error);
        // Continue with other portals
      }
    }

    console.log(
      `✅ Batch scan completed: ${results.length}/${portalIds.length} successful`
    );
    return results;
  }
}

// Export singleton instance
export const incrementalPortalScanService = new IncrementalPortalScanService();
