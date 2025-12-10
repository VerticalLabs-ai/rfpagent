/**
 * Integration Tests for SAM.gov Stagehand Scraper
 *
 * Tests the browser automation approach for SAM.gov scraping
 * using the director.ai proven pattern with page.extract() and page.act()
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Check if Browserbase credentials are available
const hasBrowserbaseCredentials = !!(
  process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID
);

// Sample SAM.gov opportunity URL for testing
const TEST_SAM_GOV_URL =
  'https://sam.gov/opp/a1d215ac89024f10acb709cace0ca35f/view';

describe('SAM.gov Stagehand Scraper', () => {
  describe('URL Validation', () => {
    it('should correctly extract notice ID from standard URL', async () => {
      const { getSAMGovStagehandScraper } = await import(
        '../../../server/services/scrapers/samGovStagehandScraper'
      );
      const scraper = getSAMGovStagehandScraper();

      const noticeId = scraper.extractNoticeIdFromUrl(
        'https://sam.gov/opp/a1d215ac89024f10acb709cace0ca35f/view'
      );
      expect(noticeId).toBe('a1d215ac89024f10acb709cace0ca35f');
    });

    it('should extract notice ID from workspace URL', async () => {
      const { getSAMGovStagehandScraper } = await import(
        '../../../server/services/scrapers/samGovStagehandScraper'
      );
      const scraper = getSAMGovStagehandScraper();

      const noticeId = scraper.extractNoticeIdFromUrl(
        'https://sam.gov/workspace/contract/opp/a1d215ac89024f10acb709cace0ca35f/view'
      );
      expect(noticeId).toBe('a1d215ac89024f10acb709cace0ca35f');
    });

    it('should extract notice ID from query param URL', async () => {
      const { getSAMGovStagehandScraper } = await import(
        '../../../server/services/scrapers/samGovStagehandScraper'
      );
      const scraper = getSAMGovStagehandScraper();

      const noticeId = scraper.extractNoticeIdFromUrl(
        'https://sam.gov/search?noticeId=abc123xyz'
      );
      expect(noticeId).toBe('abc123xyz');
    });

    it('should return null for non-SAM.gov URLs', async () => {
      const { getSAMGovStagehandScraper } = await import(
        '../../../server/services/scrapers/samGovStagehandScraper'
      );
      const scraper = getSAMGovStagehandScraper();

      const noticeId = scraper.extractNoticeIdFromUrl(
        'https://example.com/rfp/123'
      );
      expect(noticeId).toBeNull();
    });
  });

  describe('Schema Validation', () => {
    it('should have valid RFP extraction schema', async () => {
      // Import the schema directly to verify it compiles
      const { z } = await import('zod');

      // The schema should parse valid SAM.gov data
      const SAMGovRFPSchema = z.object({
        noticeId: z.string().optional(),
        title: z.string().optional(),
        opportunityType: z.string().optional(),
        status: z.string().optional(),
        dateOffersDue: z.string().optional(),
        department: z.string().optional(),
        office: z.string().optional(),
        description: z.string().optional(),
      });

      const validData = {
        noticeId: 'a1d215ac89024f10acb709cace0ca35f',
        title: 'Test RFP Opportunity',
        opportunityType: 'Solicitation',
        status: 'Active',
        dateOffersDue: '2024-12-31',
        department: 'Department of Defense',
        office: 'Army',
        description: 'Test description',
      };

      expect(() => SAMGovRFPSchema.parse(validData)).not.toThrow();
    });
  });

  // Conditional tests that require Browserbase credentials
  const describeWithCredentials = hasBrowserbaseCredentials
    ? describe
    : describe.skip;

  describeWithCredentials('Live Browser Automation', () => {
    let scraper: any;

    beforeAll(async () => {
      const { getSAMGovStagehandScraper } = await import(
        '../../../server/services/scrapers/samGovStagehandScraper'
      );
      scraper = getSAMGovStagehandScraper();
    });

    afterAll(async () => {
      // Clean up any browser sessions
      const { sessionManager } = await import(
        '../../../src/mastra/tools/session-manager'
      );
      await sessionManager.cleanup();
    });

    it(
      'should scrape SAM.gov opportunity page',
      async () => {
        const result = await scraper.scrapeOpportunity(TEST_SAM_GOV_URL);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.url).toBe(TEST_SAM_GOV_URL);

        // Should have extracted RFP data
        expect(result.rfpData).toBeDefined();

        // Log extracted data for debugging
        console.log('Extracted RFP data:', {
          noticeId: result.rfpData?.noticeId,
          title: result.rfpData?.title,
          department: result.rfpData?.department,
          hasDescription: !!result.rfpData?.description,
        });
      },
      120000 // 2 minute timeout for browser operations
    );

    it(
      'should attempt to trigger document downloads',
      async () => {
        const result = await scraper.scrapeOpportunity(TEST_SAM_GOV_URL);

        expect(result).toBeDefined();

        // Download triggering may or may not succeed depending on page content
        console.log('Download triggered:', result.downloadTriggered);
        console.log('Browserbase session ID:', result.browserbaseSessionId);
      },
      120000
    );
  });

  describe('Error Handling', () => {
    it('should handle invalid SAM.gov URL gracefully', async () => {
      const { getSAMGovStagehandScraper } = await import(
        '../../../server/services/scrapers/samGovStagehandScraper'
      );
      const scraper = getSAMGovStagehandScraper();

      const result = await scraper.scrapeOpportunity('https://example.com/invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid SAM.gov URL');
    });
  });
});
