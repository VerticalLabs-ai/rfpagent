import { getMastraScrapingService } from '../../server/services/scrapers/mastraScrapingService';

describe('Portal Scraping with Downloads', () => {
  it('should have scanPortalWithDocuments method defined', async () => {
    const service = await getMastraScrapingService();

    // This test verifies the integration exists
    expect(service.scanPortalWithDocuments).toBeDefined();
    expect(typeof service.scanPortalWithDocuments).toBe('function');
  });

  it('should have parseSizeString helper method', async () => {
    const service = await getMastraScrapingService();

    // Access the private method via casting for testing
    const serviceCasted = service as any;
    expect(serviceCasted.parseSizeString).toBeDefined();
    expect(typeof serviceCasted.parseSizeString).toBe('function');
  });
});
