import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Create a proper mock factory that will be applied to each test
const createAxiosMock = () => {
  const mockGet = jest.fn();
  return {
    create: jest.fn(() => ({
      get: mockGet,
    })),
    isAxiosError: (error: unknown) =>
      error && typeof error === 'object' && 'isAxiosError' in error,
    mockGet,
  };
};

// Mock axios before tests run
let axiosMock = createAxiosMock();

jest.mock('axios', () => axiosMock);

describe('SAM.gov 503 Recovery Integration', () => {
  let originalEnv: string | undefined;
  const testTimeout = 30000;

  beforeEach(() => {
    originalEnv = process.env.SAM_GOV_API_KEY;
    process.env.SAM_GOV_API_KEY = 'test-integration-key';
    // Reset mock for each test
    axiosMock = createAxiosMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SAM_GOV_API_KEY = originalEnv;
    } else {
      delete process.env.SAM_GOV_API_KEY;
    }
  });

  describe('Retry Configuration', () => {
    it(
      'should use extended retry config (5 retries, 30s max delay)',
      async () => {
        // Import fresh to get mocked version
        jest.resetModules();
        jest.doMock('axios', () => axiosMock);

        const { SAMGovApiClient } = await import(
          '../../../server/services/scraping/utils/samGovApiClient'
        );

        const client = new SAMGovApiClient({
          maxRetries: 5,
          initialDelayMs: 2000,
          maxDelayMs: 30000,
        });

        // Access private config through type assertion
        const config = (
          client as unknown as {
            retryConfig: { maxRetries: number; maxDelayMs: number };
          }
        ).retryConfig;

        expect(config.maxRetries).toBe(5);
        expect(config.maxDelayMs).toBe(30000);

        console.log('✅ Extended retry config applied correctly');
      },
      testTimeout
    );
  });

  describe('503 Error Handling', () => {
    it(
      'should successfully recover after transient 503 errors',
      async () => {
        let callCount = 0;

        // Reset modules and setup fresh mock
        jest.resetModules();

        const mockGetFn = jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) {
            const error = new Error('Service Unavailable') as Error & {
              response?: { status: number; headers?: Record<string, string> };
              isAxiosError?: boolean;
            };
            error.response = { status: 503, headers: {} };
            error.isAxiosError = true;
            throw error;
          }
          return {
            data: {
              totalRecords: 1,
              opportunitiesData: [
                {
                  noticeId: 'test123',
                  title: 'Test Opportunity After Recovery',
                  department: 'Test Agency',
                },
              ],
            },
            headers: {},
          };
        });

        jest.doMock('axios', () => ({
          create: jest.fn(() => ({
            get: mockGetFn,
          })),
          isAxiosError: (error: unknown) =>
            error && typeof error === 'object' && 'isAxiosError' in error,
        }));

        const { SAMGovApiClient } = await import(
          '../../../server/services/scraping/utils/samGovApiClient'
        );

        const client = new SAMGovApiClient({
          maxRetries: 5,
          initialDelayMs: 100, // Short for testing
          maxDelayMs: 500,
        });

        console.log('🧪 Testing 503 recovery with retries...');

        const result = await client.searchWithRetry({
          noticeId: 'test123',
          limit: 1,
        });

        expect(callCount).toBe(3); // Failed twice, succeeded once
        expect(result.opportunitiesData).toHaveLength(1);
        expect(result.opportunitiesData[0].title).toBe(
          'Test Opportunity After Recovery'
        );

        console.log(`✅ Recovered after ${callCount - 1} retries`);
      },
      testTimeout
    );

    it(
      'should throw after exhausting retries on persistent 503',
      async () => {
        jest.resetModules();

        const mockGetFn = jest.fn().mockImplementation(async () => {
          const error = new Error('Service Unavailable') as Error & {
            response?: { status: number; headers?: Record<string, string> };
            isAxiosError?: boolean;
          };
          error.response = { status: 503, headers: {} };
          error.isAxiosError = true;
          throw error;
        });

        jest.doMock('axios', () => ({
          create: jest.fn(() => ({
            get: mockGetFn,
          })),
          isAxiosError: (error: unknown) =>
            error && typeof error === 'object' && 'isAxiosError' in error,
        }));

        const { SAMGovApiClient } = await import(
          '../../../server/services/scraping/utils/samGovApiClient'
        );

        const client = new SAMGovApiClient({
          maxRetries: 2,
          initialDelayMs: 50,
          maxDelayMs: 100,
        });

        console.log('🧪 Testing persistent 503 exhaustion...');

        await expect(
          client.searchWithRetry({ noticeId: 'test123', limit: 1 })
        ).rejects.toThrow('Service Unavailable');

        expect(mockGetFn).toHaveBeenCalledTimes(3); // Initial + 2 retries

        console.log('✅ Correctly throws after exhausting retries');
      },
      testTimeout
    );

    it(
      'should not retry on 404 errors',
      async () => {
        jest.resetModules();

        const mockGetFn = jest.fn().mockImplementation(async () => {
          const error = new Error('Not Found') as Error & {
            response?: { status: number; headers?: Record<string, string> };
            isAxiosError?: boolean;
          };
          error.response = { status: 404, headers: {} };
          error.isAxiosError = true;
          throw error;
        });

        jest.doMock('axios', () => ({
          create: jest.fn(() => ({
            get: mockGetFn,
          })),
          isAxiosError: (error: unknown) =>
            error && typeof error === 'object' && 'isAxiosError' in error,
        }));

        const { SAMGovApiClient } = await import(
          '../../../server/services/scraping/utils/samGovApiClient'
        );

        const client = new SAMGovApiClient({
          maxRetries: 3,
          initialDelayMs: 50,
        });

        console.log('🧪 Testing no retry for 404...');

        await expect(
          client.searchWithRetry({ noticeId: 'invalid', limit: 1 })
        ).rejects.toThrow('Not Found');

        expect(mockGetFn).toHaveBeenCalledTimes(1); // No retries for 404

        console.log('✅ 404 errors do not trigger retries');
      },
      testTimeout
    );
  });

  describe('Retry-After Header Support', () => {
    it(
      'should respect Retry-After header from 503 response',
      async () => {
        let callCount = 0;
        let actualDelay = 0;
        let lastCallTime = 0;

        jest.resetModules();

        const mockGetFn = jest.fn().mockImplementation(async () => {
          const now = Date.now();
          if (lastCallTime > 0) {
            actualDelay = now - lastCallTime;
          }
          lastCallTime = now;
          callCount++;

          if (callCount === 1) {
            const error = new Error('Service Unavailable') as Error & {
              response?: {
                status: number;
                headers?: Record<string, string>;
              };
              isAxiosError?: boolean;
            };
            error.response = {
              status: 503,
              headers: { 'retry-after': '1' }, // 1 second
            };
            error.isAxiosError = true;
            throw error;
          }
          return {
            data: {
              totalRecords: 1,
              opportunitiesData: [{ noticeId: 'test', title: 'Success' }],
            },
            headers: {},
          };
        });

        jest.doMock('axios', () => ({
          create: jest.fn(() => ({
            get: mockGetFn,
          })),
          isAxiosError: (error: unknown) =>
            error && typeof error === 'object' && 'isAxiosError' in error,
        }));

        const { SAMGovApiClient } = await import(
          '../../../server/services/scraping/utils/samGovApiClient'
        );

        const client = new SAMGovApiClient({
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 5000,
        });

        console.log('🧪 Testing Retry-After header...');

        const result = await client.searchWithRetry({
          noticeId: 'test',
          limit: 1,
        });

        expect(result.opportunitiesData).toHaveLength(1);
        // Should have waited at least close to 1000ms (the Retry-After value)
        expect(actualDelay).toBeGreaterThan(500);

        console.log(`✅ Respected Retry-After header (delay: ${actualDelay}ms)`);
      },
      testTimeout
    );
  });

  describe('Rate Limit (429) Handling', () => {
    it(
      'should retry on 429 rate limit errors',
      async () => {
        let callCount = 0;

        jest.resetModules();

        const mockGetFn = jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 1) {
            const error = new Error('Too Many Requests') as Error & {
              response?: { status: number; headers?: Record<string, string> };
              isAxiosError?: boolean;
            };
            error.response = { status: 429, headers: {} };
            error.isAxiosError = true;
            throw error;
          }
          return {
            data: {
              totalRecords: 1,
              opportunitiesData: [
                { noticeId: 'test', title: 'After Rate Limit' },
              ],
            },
            headers: {},
          };
        });

        jest.doMock('axios', () => ({
          create: jest.fn(() => ({
            get: mockGetFn,
          })),
          isAxiosError: (error: unknown) =>
            error && typeof error === 'object' && 'isAxiosError' in error,
        }));

        const { SAMGovApiClient } = await import(
          '../../../server/services/scraping/utils/samGovApiClient'
        );

        const client = new SAMGovApiClient({
          maxRetries: 3,
          initialDelayMs: 50,
          maxDelayMs: 200,
        });

        console.log('🧪 Testing 429 rate limit recovery...');

        const result = await client.searchWithRetry({
          noticeId: 'test',
          limit: 1,
        });

        expect(callCount).toBe(2);
        expect(result.opportunitiesData[0].title).toBe('After Rate Limit');

        console.log('✅ Recovered from rate limit');
      },
      testTimeout
    );
  });
});
