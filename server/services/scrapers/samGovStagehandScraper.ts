/**
 * SAM.gov Stagehand Scraper
 *
 * Implements browser automation for SAM.gov using the proven Stagehand pattern
 * from director.ai. This approach uses AI-powered extraction and action execution
 * to reliably scrape RFP details and download documents.
 *
 * Key features:
 * - page.extract() with comprehensive schema for RFP details
 * - page.act() for clicking Download All button
 * - Integration with Browserbase session management and download orchestration
 *
 * @see director.ai workflow b7ee607a-61ca-4f41-8b15-b1c10a8e45c1 for reference
 */

import { z } from 'zod';
import { sessionManager } from '../../../src/mastra/tools/session-manager';
import { logger } from '../../utils/logger';
import { storage } from '../../storage';

/**
 * Schema for SAM.gov RFP extraction
 * Matches the structure successfully used by director.ai
 */
const SAMGovRFPSchema = z.object({
  noticeId: z.string().optional().describe('SAM.gov notice/opportunity ID'),
  title: z.string().optional().describe('RFP/opportunity title'),
  opportunityType: z
    .string()
    .optional()
    .describe('Type: Presolicitation, Solicitation, etc.'),
  status: z.string().optional().describe('Active, Inactive, etc.'),
  inactiveDates: z.string().optional().describe('Inactive date range if applicable'),
  dateOffersDue: z.string().optional().describe('Response/offers deadline'),
  publishedDate: z.string().optional().describe('Date originally posted'),
  department: z.string().optional().describe('Federal department'),
  office: z.string().optional().describe('Contracting office'),
  setAside: z.string().optional().describe('Set-aside type (SBA, WOSB, etc.)'),
  productServiceCode: z.string().optional().describe('PSC code'),
  naicsCode: z.string().optional().describe('NAICS classification code'),
  placeOfPerformance: z
    .string()
    .optional()
    .describe('Location for contract performance'),
  primaryContact: z.string().optional().describe('Primary POC name'),
  primaryContactEmail: z.string().optional().describe('Primary POC email'),
  contractingOfficeAddress: z.string().optional().describe('Contracting office address'),
  description: z.string().optional().describe('Full description/scope of work'),
  estimatedValue: z.string().optional().describe('Contract value or ceiling'),
  solicitationNumber: z
    .string()
    .optional()
    .describe('Solicitation number if available'),
});

export type SAMGovRFPData = z.infer<typeof SAMGovRFPSchema>;

/**
 * Result from SAM.gov scraping operation
 */
export interface SAMGovScrapingResult {
  success: boolean;
  rfpData?: SAMGovRFPData;
  downloadTriggered: boolean;
  browserbaseSessionId?: string;
  error?: string;
  url: string;
}

/**
 * SAM.gov Stagehand Scraper
 *
 * Uses the proven director.ai approach for reliable SAM.gov scraping
 */
export class SAMGovStagehandScraper {
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly DOWNLOAD_WAIT_TIMEOUT = 10000;

  /**
   * Extract RFP details and trigger document downloads from a SAM.gov opportunity page
   *
   * @param url - SAM.gov opportunity URL (e.g., https://sam.gov/opp/xxx/view)
   * @param sessionId - Optional session ID for Browserbase session management
   * @returns Scraping result with RFP data and download status
   */
  async scrapeOpportunity(
    url: string,
    sessionId?: string
  ): Promise<SAMGovScrapingResult> {
    const effectiveSessionId = sessionId || `sam-gov-${Date.now()}`;
    let browserbaseSessionId: string | undefined;

    try {
      logger.info('Starting SAM.gov Stagehand scrape', {
        url,
        sessionId: effectiveSessionId,
      });

      // Validate SAM.gov URL
      if (!this.isValidSAMGovUrl(url)) {
        throw new Error(`Invalid SAM.gov URL: ${url}`);
      }

      // Get Stagehand instance and page
      const { stagehand, page } = await sessionManager.getStagehandAndPage(
        effectiveSessionId
      );

      // Store Browserbase session ID for later download retrieval
      browserbaseSessionId = sessionManager.getBrowserbaseSessionId(effectiveSessionId);

      logger.info('Browserbase session initialized', {
        sessionId: effectiveSessionId,
        browserbaseSessionId,
      });

      // Step 1: Navigate to SAM.gov opportunity page
      logger.info('Navigating to SAM.gov opportunity', { url });
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.DEFAULT_TIMEOUT,
      });

      // Wait for page to fully render (SAM.gov has dynamic content)
      await this.waitForSAMGovContent(page);

      // Step 2: Extract RFP details using AI-powered extraction
      logger.info('Extracting RFP details from SAM.gov page');
      const rfpData = await this.extractRFPDetails(page);

      logger.info('RFP data extracted', {
        noticeId: rfpData.noticeId,
        title: rfpData.title?.substring(0, 50),
        hasDescription: !!rfpData.description,
      });

      // Step 3: Trigger document downloads by clicking Download All button
      const downloadTriggered = await this.triggerDocumentDownloads(stagehand, page);

      if (downloadTriggered) {
        logger.info('Document downloads triggered', {
          browserbaseSessionId,
          waitTime: this.DOWNLOAD_WAIT_TIMEOUT,
        });

        // Wait for downloads to sync to Browserbase cloud storage
        await new Promise(resolve => setTimeout(resolve, this.DOWNLOAD_WAIT_TIMEOUT));
      }

      return {
        success: true,
        rfpData,
        downloadTriggered,
        browserbaseSessionId,
        url,
      };
    } catch (error: any) {
      logger.error('SAM.gov Stagehand scrape failed', error, {
        url,
        sessionId: effectiveSessionId,
      });

      return {
        success: false,
        downloadTriggered: false,
        error: error.message || 'Unknown error during SAM.gov scraping',
        url,
        browserbaseSessionId,
      };
    }
  }

  /**
   * Scrape and save RFP to database
   *
   * @param url - SAM.gov opportunity URL
   * @param portalId - Portal ID for the RFP
   * @param existingRfpId - Optional existing RFP ID to update
   */
  async scrapeAndSaveRFP(
    url: string,
    portalId: string,
    existingRfpId?: string
  ): Promise<{ rfpId: string; result: SAMGovScrapingResult }> {
    const result = await this.scrapeOpportunity(url);

    if (!result.success || !result.rfpData) {
      throw new Error(result.error || 'Failed to scrape SAM.gov opportunity');
    }

    const rfpData = result.rfpData;

    // Prepare RFP data for storage
    const rfpRecord = {
      title: rfpData.title || 'Untitled SAM.gov Opportunity',
      description: rfpData.description || '',
      agency: rfpData.department || rfpData.office || 'Federal Government',
      sourceUrl: url,
      portalId,
      status: 'discovered' as const,
      progress: 10,
      deadline: rfpData.dateOffersDue ? new Date(rfpData.dateOffersDue) : undefined,
      estimatedValue: rfpData.estimatedValue,
      naicsCode: rfpData.naicsCode,
      setAside: rfpData.setAside,
      solicitationNumber: rfpData.solicitationNumber || rfpData.noticeId,
      requirements: [],
      metadata: {
        noticeId: rfpData.noticeId,
        opportunityType: rfpData.opportunityType,
        productServiceCode: rfpData.productServiceCode,
        placeOfPerformance: rfpData.placeOfPerformance,
        primaryContact: rfpData.primaryContact,
        primaryContactEmail: rfpData.primaryContactEmail,
        contractingOfficeAddress: rfpData.contractingOfficeAddress,
        publishedDate: rfpData.publishedDate,
        scrapedAt: new Date().toISOString(),
        scraperVersion: 'stagehand-v1',
      },
    };

    let rfpId: string;

    if (existingRfpId) {
      // Update existing RFP
      await storage.updateRFP(existingRfpId, {
        ...rfpRecord,
        status: 'parsing',
        progress: 25,
        updatedAt: new Date(),
      });
      rfpId = existingRfpId;
      logger.info('Updated existing RFP with SAM.gov data', { rfpId });
    } else {
      // Create new RFP
      const newRfp = await storage.createRFP(rfpRecord as any);
      rfpId = newRfp.id;
      logger.info('Created new RFP from SAM.gov data', { rfpId });
    }

    // Process downloaded documents if available
    if (result.downloadTriggered && result.browserbaseSessionId) {
      logger.info('Processing downloaded documents', {
        rfpId,
        browserbaseSessionId: result.browserbaseSessionId,
      });

      try {
        // Import orchestrator dynamically to avoid circular deps
        const { documentDownloadOrchestrator } = await import(
          '../downloads/documentDownloadOrchestrator'
        );

        const docsResult = await documentDownloadOrchestrator.processRfpDocuments({
          rfpId,
          browserbaseSessionId: result.browserbaseSessionId,
          expectedDocuments: [],
          retryForSeconds: 30,
        });

        logger.info('Document download processing complete', {
          rfpId,
          totalDownloaded: docsResult.totalDownloaded,
          totalFailed: docsResult.totalFailed,
        });
      } catch (docError: any) {
        logger.warn('Document download processing failed', {
          rfpId,
          error: docError.message,
        });
        // Don't fail the whole operation if doc download fails
      }
    }

    return { rfpId, result };
  }

  /**
   * Wait for SAM.gov page content to load
   * SAM.gov uses dynamic Angular rendering
   */
  private async waitForSAMGovContent(page: any): Promise<void> {
    const contentSelectors = [
      '.usa-prose', // USA Design System prose container
      '.opportunity-header',
      '[class*="opportunity"]',
      '[class*="notice"]',
      '.grid-container',
      'h1', // Title should be visible
    ];

    try {
      logger.debug('Waiting for SAM.gov page content to load');

      // Wait for any of these selectors to appear
      await Promise.race([
        page.waitForSelector(contentSelectors.join(', '), {
          timeout: this.DEFAULT_TIMEOUT,
        }),
        new Promise(resolve => setTimeout(resolve, 5000)), // Minimum wait
      ]);

      // Additional wait for Angular hydration
      await new Promise(resolve => setTimeout(resolve, 2000));

      logger.debug('SAM.gov page content loaded');
    } catch (error) {
      logger.warn('Timeout waiting for SAM.gov content, proceeding anyway', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Extract RFP details using Stagehand page.extract()
   * Uses the schema pattern proven by director.ai
   */
  private async extractRFPDetails(page: any): Promise<SAMGovRFPData> {
    try {
      const instruction = `Extract all the RFP details from this SAM.gov contract opportunity page including:
        - notice ID (the unique identifier for this opportunity)
        - title (the opportunity title/name)
        - opportunity type (Presolicitation, Solicitation, Combined Synopsis/Solicitation, etc.)
        - status (Active, Inactive, etc.)
        - inactive dates if the opportunity is inactive
        - date offers are due (the response deadline)
        - published date (when originally posted)
        - department (the federal department)
        - office (the contracting office)
        - set-aside type (Small Business, WOSB, 8(a), etc.)
        - product/service code (PSC)
        - NAICS code
        - place of performance
        - primary contact name
        - primary contact email
        - contracting office address
        - full description/scope of work
        - estimated contract value if shown
        - solicitation number if different from notice ID`;

      // Use page.extract() with Zod schema - the proven director.ai approach
      const extractedData = await page.extract({
        instruction,
        schema: SAMGovRFPSchema,
      });

      logger.debug('Raw extraction result', { extractedData });

      // Parse through Zod to ensure type safety
      const parsedData = SAMGovRFPSchema.parse(extractedData);

      return parsedData;
    } catch (error: any) {
      logger.error('Failed to extract RFP details', error);

      // Return minimal data on failure
      return {
        title: 'Extraction Failed',
        description: `Failed to extract RFP details: ${error.message}`,
      };
    }
  }

  /**
   * Trigger document downloads by clicking the Download All button
   * Uses Stagehand's act() function for reliable button clicking
   */
  private async triggerDocumentDownloads(
    stagehand: any,
    page: any
  ): Promise<boolean> {
    try {
      logger.info('Attempting to trigger document downloads');

      // First try: Click "Download All" button using act()
      // This is the approach that worked for director.ai
      try {
        await stagehand.act('click the Download All button');
        logger.info('First Download All click executed');

        // Small delay then click again (director.ai does this twice)
        await new Promise(resolve => setTimeout(resolve, 2000));
        await stagehand.act('click the Download All button');
        logger.info('Second Download All click executed');

        return true;
      } catch (actError) {
        logger.warn('act() approach for Download All failed', {
          error: (actError as Error).message,
        });
      }

      // Fallback: Try to find and click download buttons manually
      const downloadButtonSelectors = [
        'button:has-text("Download All")',
        'button:has-text("Download")',
        '[class*="download"]',
        'a[href*="download"]',
        'button[aria-label*="download"]',
      ];

      for (const selector of downloadButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            logger.info('Download button clicked via selector', { selector });

            // Wait and try again (SAM.gov sometimes needs multiple clicks)
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
              const button2 = await page.$(selector);
              if (button2) await button2.click();
            } catch {
              // Ignore second click errors
            }

            return true;
          }
        } catch (selectorError) {
          // Try next selector
          continue;
        }
      }

      // If no download buttons found, try act() with different instructions
      const downloadInstructions = [
        'click the button to download all attachments',
        'click any download link or button',
        'click to download the RFP documents',
      ];

      for (const instruction of downloadInstructions) {
        try {
          await stagehand.act(instruction);
          logger.info('Download action succeeded', { instruction });
          return true;
        } catch {
          continue;
        }
      }

      logger.warn('No download buttons found or clickable on this SAM.gov page');
      return false;
    } catch (error: any) {
      logger.error('Failed to trigger document downloads', error);
      return false;
    }
  }

  /**
   * Validate that URL is a SAM.gov opportunity URL
   */
  private isValidSAMGovUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'sam.gov' ||
        parsed.hostname === 'www.sam.gov' ||
        parsed.hostname.endsWith('.sam.gov')
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract notice ID from SAM.gov URL
   */
  extractNoticeIdFromUrl(url: string): string | null {
    const patterns = [
      /\/opp\/([^/]+)\/view/i, // https://sam.gov/opp/xxx/view
      /\/opp\/([^/]+)/i, // https://sam.gov/opp/xxx
      /noticeId=([^&]+)/i, // Query param
      /opportunity\/([^/]+)/i, // Alternative format
      /workspace\/contract\/opp\/([^/]+)/i, // Workspace format
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}

// Singleton instance
let samGovStagehandScraperInstance: SAMGovStagehandScraper | null = null;

export function getSAMGovStagehandScraper(): SAMGovStagehandScraper {
  if (!samGovStagehandScraperInstance) {
    samGovStagehandScraperInstance = new SAMGovStagehandScraper();
  }
  return samGovStagehandScraperInstance;
}
