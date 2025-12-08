// tests/services/scrapers/samGovIntegration.test.ts

import { SAMGovApiClient } from '../../../server/services/scraping/utils/samGovApiClient';

describe('SAM.gov Integration', () => {
  const client = new SAMGovApiClient();

  describe('extractNoticeIdFromUrl', () => {
    const testCases = [
      {
        url: 'https://sam.gov/opp/abc123/view',
        expected: 'abc123',
        description: 'standard opportunity URL',
      },
      {
        url: 'https://sam.gov/opp/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4/view',
        expected: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        description: '32-char hex ID',
      },
      {
        url: 'https://sam.gov/search?keywords=test',
        expected: null,
        description: 'search URL',
      },
      {
        url: 'https://sam.gov',
        expected: null,
        description: 'homepage',
      },
      {
        url: 'https://sam.gov/opp/XYZ789ABC/view',
        expected: 'XYZ789ABC',
        description: 'mixed case alphanumeric ID',
      },
    ];

    testCases.forEach(({ url, expected, description }) => {
      it(`should handle ${description}`, () => {
        const result = client.extractNoticeIdFromUrl(url);
        expect(result).toBe(expected);
      });
    });
  });

  describe('formatDateForApi', () => {
    it('should format dates correctly with leading zeros', () => {
      // Use explicit UTC dates to avoid timezone issues
      const jan5 = new Date('2025-01-05T12:00:00Z');
      const dec31 = new Date('2025-12-31T12:00:00Z');

      expect(client.formatDateForApi(jan5)).toBe('01/05/2025');
      expect(client.formatDateForApi(dec31)).toBe('12/31/2025');
    });

    it('should handle single digit months and days', () => {
      const march3 = new Date('2025-03-03T12:00:00Z');
      expect(client.formatDateForApi(march3)).toBe('03/03/2025');
    });
  });

  // Skip API tests unless explicitly running integration tests
  describe.skip('API calls (requires SAM_GOV_API_KEY)', () => {
    beforeAll(() => {
      if (!process.env.SAM_GOV_API_KEY) {
        console.warn('Skipping API tests - SAM_GOV_API_KEY not set');
      }
    });

    it('should search for opportunities', async () => {
      const response = await client.searchWithRetry({
        limit: 5,
      });

      expect(response.opportunitiesData).toBeDefined();
      expect(Array.isArray(response.opportunitiesData)).toBe(true);
    });

    it('should handle opportunity not found gracefully', async () => {
      const result = await client.getOpportunityById('nonexistent123');
      expect(result).toBeNull();
    });
  });
});
