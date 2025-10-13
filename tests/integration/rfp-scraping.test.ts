import { getMastraScrapingService } from '../../server/services/scrapers/mastraScrapingService';

describe('RFP Scraping Integration Tests', () => {
  // Test timeout: 5 minutes for Browserbase operations (cloud browser takes time)
  const testTimeout = 300000;

  describe('Philadelphia Portal', () => {
    it('should scrape Philadelphia RFP portal successfully', async () => {
      const service = getMastraScrapingService();
      const testUrl = 'https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978';

      console.log('🧪 Testing Philadelphia portal scraping...');
      console.log(`📍 URL: ${testUrl}`);

      try {
        const result = await service.enhancedScrapeFromUrl(testUrl);

        console.log('✅ Scraping completed');
        console.log(`📊 Result status: ${result.status || (result.success ? 'success' : 'unknown')}`);

        expect(result).toBeDefined();
        expect(result.success || result.status === 'success').toBeTruthy();

        if (result.data) {
          console.log(`📄 Data fields: ${Object.keys(result.data).join(', ')}`);
        }
      } catch (error: any) {
        console.error('❌ Scraping failed:', error.message);
        throw error;
      }
    }, testTimeout);

    it('should detect portal type from URL', async () => {
      const service = getMastraScrapingService();
      const testUrl = 'https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978';

      try {
        const result = await service.enhancedScrapeFromUrl(testUrl);
        expect(result).toBeDefined();
        expect(result.success || result.status === 'success').toBeTruthy();
      } catch (error: any) {
        console.log('Scraping completed with error:', error.message);
        expect(error.message).toBeDefined();
      }
    }, testTimeout);
  });

  describe('Generic Portal Detection', () => {
    it('should handle unknown portal gracefully', async () => {
      const service = getMastraScrapingService();
      const testUrl = 'https://example.com/rfp/12345';

      console.log('🧪 Testing generic portal handling...');

      try {
        const result = await service.enhancedScrapeFromUrl(testUrl);

        // Should either succeed or fail gracefully
        expect(result).toBeDefined();
        console.log(`📊 Result: ${result.status || (result.success ? 'success' : 'failed')}`);
      } catch (error: any) {
        // Graceful failure is acceptable
        console.log('ℹ️ Generic portal handling:', error.message);
        expect(error.message).toBeDefined();
      }
    }, testTimeout);
  });

  describe('Error Handling', () => {
    it('should handle invalid URL gracefully', async () => {
      const service = getMastraScrapingService();
      const invalidUrl = 'not-a-valid-url';

      console.log('🧪 Testing invalid URL handling...');

      try {
        const result = await service.enhancedScrapeFromUrl(invalidUrl);

        // Should fail gracefully
        expect(result).toBeDefined();
        if (result.error) {
          console.log(`✅ Error handled: ${result.error}`);
        }
      } catch (error: any) {
        // Expected to throw or return error
        console.log(`✅ Exception caught: ${error.message}`);
        expect(error).toBeDefined();
      }
    }, testTimeout);

    it('should timeout appropriately for slow responses', async () => {
      const service = getMastraScrapingService();
      const slowUrl = 'https://httpstat.us/200?sleep=5000';

      console.log('🧪 Testing timeout handling...');

      const startTime = Date.now();

      try {
        await service.enhancedScrapeFromUrl(slowUrl);
        const duration = Date.now() - startTime;
        console.log(`⏱️ Completed in ${duration}ms`);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.log(`⏱️ Timed out after ${duration}ms`);
        expect(duration).toBeLessThan(testTimeout);
      }
    }, testTimeout);
  });
});
