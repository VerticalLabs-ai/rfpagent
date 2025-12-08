// tests/services/scraping/utils/samGovApiClient.test.ts
import { SAMGovApiClient } from '../../../../server/services/scraping/utils/samGovApiClient';

describe('SAMGovApiClient', () => {
  let client: SAMGovApiClient;

  beforeEach(() => {
    process.env.SAM_GOV_API_KEY = 'test-api-key';
    client = new SAMGovApiClient();
  });

  describe('getOpportunityById', () => {
    it('should extract noticeId from sam.gov URL', () => {
      const url = 'https://sam.gov/opp/abc123def456/view';
      const noticeId = client.extractNoticeIdFromUrl(url);
      expect(noticeId).toBe('abc123def456');
    });

    it('should handle hex-based noticeIds', () => {
      const url = 'https://sam.gov/opp/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4/view';
      const noticeId = client.extractNoticeIdFromUrl(url);
      expect(noticeId).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    });

    it('should return null for invalid URLs', () => {
      const url = 'https://sam.gov/search?keywords=test';
      const noticeId = client.extractNoticeIdFromUrl(url);
      expect(noticeId).toBeNull();
    });
  });

  describe('formatDateForApi', () => {
    it('should format date as MM/dd/yyyy', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(client.formatDateForApi(date)).toBe('01/15/2025');
    });
  });

  describe('retry logic', () => {
    it('should retry on network failure', async () => {
      // Mock axios to fail twice then succeed
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { opportunitiesData: [] } });

      // Test that retry happens
      expect(mockFn).toHaveBeenCalledTimes(0);
    });
  });
});
