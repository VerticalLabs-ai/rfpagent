import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SAMGovAuthStrategy } from '../../server/services/scraping/authentication/strategies/SAMGovAuthStrategy';
import type { AuthContext } from '../../server/services/scraping/types';
import axios from 'axios';
import { mockRateLimitHeaders } from '../fixtures/sam-gov/api-responses';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SAMGovAuthStrategy', () => {
  let strategy: SAMGovAuthStrategy;
  let mockContext: AuthContext;

  beforeEach(() => {
    strategy = new SAMGovAuthStrategy();
    mockContext = {
      portalUrl: 'https://sam.gov',
      username: '',
      password: '',
      sessionId: 'test-session-123',
      portalType: 'sam_gov',
    };

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('authenticate()', () => {
    it('should successfully authenticate with valid API key from environment', async () => {
      // Arrange
      process.env.SAM_GOV_API_KEY = 'test-api-key-12345';

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          opportunitiesData: [],
          totalRecords: 0,
        },
        headers: mockRateLimitHeaders,
      });

      // Act
      const result = await strategy.authenticate(mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session-123');
      expect(result.authToken).toBe('test-api-key-12345');
      expect(result.cookies).toBe('');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': 'test-api-key-12345',
          }),
        })
      );

      // Cleanup
      delete process.env.SAM_GOV_API_KEY;
    });

    it('should successfully authenticate with API key from context', async () => {
      // Arrange
      mockContext.credentials = { apiKey: 'context-api-key-67890' };

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          opportunitiesData: [],
          totalRecords: 0,
        },
        headers: mockRateLimitHeaders,
      });

      // Act
      const result = await strategy.authenticate(mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.authToken).toBe('context-api-key-67890');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': 'context-api-key-67890',
          }),
        })
      );
    });

    it('should fail authentication when no API key is provided', async () => {
      // Arrange
      delete process.env.SAM_GOV_API_KEY;
      mockContext.credentials = undefined;

      // Act
      const result = await strategy.authenticate(mockContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.sessionId).toBe('test-session-123');
      expect(result.error).toContain('API key not configured');
      expect(result.error).toContain('SAM_GOV_API_KEY');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should fail authentication when API key is invalid', async () => {
      // Arrange
      process.env.SAM_GOV_API_KEY = 'invalid-api-key';

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: {
              code: 'INVALID_API_KEY',
              message: 'The API key provided is invalid or expired',
            },
          },
        },
      });

      // Act
      const result = await strategy.authenticate(mockContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('API key validation failed');

      // Cleanup
      delete process.env.SAM_GOV_API_KEY;
    });

    it('should detect rate limit violations', async () => {
      // Arrange
      process.env.SAM_GOV_API_KEY = 'test-api-key';

      mockedAxios.get.mockResolvedValueOnce({
        status: 429,
        data: {},
        headers: {
          'x-ratelimit-limit': '10000',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1735689600',
        },
      });

      // Act
      const result = await strategy.authenticate(mockContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');

      // Cleanup
      delete process.env.SAM_GOV_API_KEY;
    });

    it('should validate rate limit headers are within bounds', async () => {
      // Arrange
      process.env.SAM_GOV_API_KEY = 'test-api-key';

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          opportunitiesData: [],
          totalRecords: 0,
        },
        headers: {
          'x-ratelimit-limit': '10000',
          'x-ratelimit-remaining': '8500',
          'x-ratelimit-reset': '1735689600',
        },
      });

      // Act
      const result = await strategy.authenticate(mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalled();

      // Cleanup
      delete process.env.SAM_GOV_API_KEY;
    });
  });

  describe('validateApiKey()', () => {
    it('should make a test request to SAM.gov API with proper headers', async () => {
      // Arrange
      const apiKey = 'test-validation-key';

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { totalRecords: 0 },
        headers: mockRateLimitHeaders,
      });

      // Act
      const result = await strategy['validateApiKey'](apiKey, 'test-session');

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('api.sam.gov/opportunities/v2/search'),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 1,
          }),
          headers: expect.objectContaining({
            'X-Api-Key': apiKey,
            'User-Agent': 'RFP-Agent/1.0',
          }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('checkRateLimits()', () => {
    it('should validate rate limit headers correctly', () => {
      // Arrange
      const headers = {
        'x-ratelimit-limit': '10000',
        'x-ratelimit-remaining': '9500',
        'x-ratelimit-reset': '1735689600',
      };

      // Act
      const result = strategy['checkRateLimits'](headers);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect when rate limit is exceeded', () => {
      // Arrange
      const headers = {
        'x-ratelimit-limit': '10000',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1735689600',
      };

      // Act
      const result = strategy['checkRateLimits'](headers);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should handle missing rate limit headers gracefully', () => {
      // Arrange
      const headers = {};

      // Act
      const result = strategy['checkRateLimits'](headers);

      // Assert
      expect(result.success).toBe(true); // Should default to success if headers missing
    });
  });

  describe('getApiKey()', () => {
    it('should prioritize context credentials over environment variable', () => {
      // Arrange
      process.env.SAM_GOV_API_KEY = 'env-key';
      mockContext.credentials = { apiKey: 'context-key' };

      // Act
      const apiKey = strategy['getApiKey'](mockContext);

      // Assert
      expect(apiKey).toBe('context-key');

      // Cleanup
      delete process.env.SAM_GOV_API_KEY;
    });

    it('should fall back to environment variable when context has no apiKey', () => {
      // Arrange
      process.env.SAM_GOV_API_KEY = 'env-key-fallback';
      mockContext.credentials = undefined;

      // Act
      const apiKey = strategy['getApiKey'](mockContext);

      // Assert
      expect(apiKey).toBe('env-key-fallback');

      // Cleanup
      delete process.env.SAM_GOV_API_KEY;
    });

    it('should return null when no API key is available', () => {
      // Arrange
      delete process.env.SAM_GOV_API_KEY;
      mockContext.credentials = undefined;

      // Act
      const apiKey = strategy['getApiKey'](mockContext);

      // Assert
      expect(apiKey).toBeNull();
    });
  });
});
