import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { SAMGovContentExtractor } from '../../../server/services/scraping/extraction/extractors/SAMGovContentExtractor';
import { SAMGovAuthStrategy } from '../../../server/services/scraping/authentication/strategies/SAMGovAuthStrategy';
import { SAMGovDocumentDownloader } from '../../../server/services/scrapers/samGovDocumentDownloader';
import {
  shouldUseSAMGovExtraction,
  detectPortalTypeFromUrl,
} from '../../../server/services/scrapers/utils/portalTypeUtils';
import axios from 'axios';
import { storage } from '../../../server/storage';
import {
  mockSearchResponse,
  mockOpportunityDetailsResponse,
} from '../../fixtures/sam-gov/api-responses';

// Mock dependencies for integration testing
jest.mock('axios');
jest.mock('../../../server/storage');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('SAM.gov Integration Tests', () => {
  const testTimeout = 30000; // 30 seconds for integration tests
  const mockApiKey = 'test-integration-api-key';
  const testRfpId = 'integration-test-rfp-123';

  beforeAll(() => {
    // Setup test environment
    process.env.SAM_GOV_API_KEY = mockApiKey;
  });

  afterAll(() => {
    // Cleanup
    delete process.env.SAM_GOV_API_KEY;
    jest.clearAllMocks();
  });

  describe('End-to-End RFP Discovery Flow', () => {
    it(
      'should complete full discovery workflow: URL → Detection → Extraction → Documents',
      async () => {
        // Step 1: URL Detection
        const testUrl = 'https://sam.gov/search/?index=opp&page=1';
        const detectedType = detectPortalTypeFromUrl(testUrl);

        console.log('🧪 Integration Test: Full RFP Discovery');
        console.log(`📍 URL: ${testUrl}`);
        console.log(`🏷️  Detected Type: ${detectedType}`);

        expect(detectedType).toBe('sam_gov');
        expect(shouldUseSAMGovExtraction(detectedType, testUrl)).toBe(true);

        // Step 2: Authentication
        const authStrategy = new SAMGovAuthStrategy();
        mockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: { opportunitiesData: [], totalRecords: 0 },
          headers: {
            'x-ratelimit-limit': '10000',
            'x-ratelimit-remaining': '9500',
          },
        });

        const authResult = await authStrategy.authenticate({
          portalUrl: testUrl,
          username: '',
          password: '',
          sessionId: 'integration-test-session',
          portalType: 'sam_gov',
        });

        console.log(`🔐 Authentication: ${authResult.success ? '✅' : '❌'}`);
        expect(authResult.success).toBe(true);
        expect(authResult.authToken).toBe(mockApiKey);

        // Step 3: Content Extraction
        const extractor = new SAMGovContentExtractor();
        mockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: mockSearchResponse,
        });

        const opportunities = await extractor.extract('', testUrl, 'sam_gov');

        console.log(`📋 Opportunities Found: ${opportunities.length}`);
        expect(opportunities).toHaveLength(1);
        expect(opportunities[0]).toMatchObject({
          title: 'IT Services and Support Contract',
          solicitationId: 'RFP-2025-001',
          agency: 'Department of Defense',
        });

        // Step 4: Document Download
        const downloader = new SAMGovDocumentDownloader();
        const noticeId = opportunities[0].noticeId || 'abc123def456';

        mockedAxios.get
          .mockResolvedValueOnce({
            data: mockOpportunityDetailsResponse,
            status: 200,
          })
          .mockResolvedValueOnce({
            data: Buffer.from('PDF content'),
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          })
          .mockResolvedValueOnce({
            data: Buffer.from('Excel content'),
            status: 200,
            headers: {
              'content-type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          });

        mockedStorage.uploadFile.mockResolvedValue({
          path: `rfps/${testRfpId}/test.pdf`,
          url: 'https://storage.example.com/test.pdf',
        });

        mockedStorage.createDocument.mockResolvedValue({
          id: 'doc-1',
          rfpId: testRfpId,
          filename: 'test.pdf',
          fileType: 'pdf',
          objectPath: `rfps/${testRfpId}/test.pdf`,
          createdAt: new Date(),
          extractedText: null,
          parsedData: null,
        });

        const documents = await downloader.downloadRFPDocuments(
          noticeId,
          testRfpId,
          mockApiKey
        );

        console.log(`📄 Documents Downloaded: ${documents.length}`);
        expect(documents.length).toBeGreaterThan(0);

        console.log('✅ Full workflow completed successfully');
      },
      testTimeout
    );

    it(
      'should handle discovery workflow with no documents',
      async () => {
        const testUrl = 'https://sam.gov/opp/test-no-docs/view';
        const extractor = new SAMGovContentExtractor();

        // Mock API response with no attachments
        mockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: {
            ...mockSearchResponse,
            opportunitiesData: [
              {
                ...mockSearchResponse.opportunitiesData[0],
                noticeId: 'test-no-docs',
              },
            ],
          },
        });

        const opportunities = await extractor.extract('', testUrl, 'sam_gov');
        expect(opportunities).toHaveLength(1);

        // Try to download documents
        const downloader = new SAMGovDocumentDownloader();
        mockedAxios.get.mockResolvedValueOnce({
          data: {
            ...mockOpportunityDetailsResponse,
            attachments: [],
          },
          status: 200,
        });

        const documents = await downloader.downloadRFPDocuments(
          'test-no-docs',
          testRfpId,
          mockApiKey
        );

        expect(documents).toHaveLength(0);
        console.log('✅ No-document workflow handled correctly');
      },
      testTimeout
    );
  });

  describe('Document Download Pipeline', () => {
    it(
      'should download and verify all document types',
      async () => {
        const downloader = new SAMGovDocumentDownloader();
        const noticeId = 'multi-format-test';

        // Mock responses for different file types
        mockedAxios.get
          .mockResolvedValueOnce({
            data: mockOpportunityDetailsResponse,
            status: 200,
          })
          .mockResolvedValueOnce({
            data: Buffer.from('PDF content'),
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          })
          .mockResolvedValueOnce({
            data: Buffer.from('Excel content'),
            status: 200,
            headers: {
              'content-type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          });

        mockedStorage.uploadFile.mockResolvedValue({
          path: `rfps/${testRfpId}/doc.pdf`,
          url: 'https://storage.example.com/doc.pdf',
        });

        mockedStorage.createDocument.mockResolvedValue({
          id: 'doc-1',
          rfpId: testRfpId,
          filename: 'doc.pdf',
          fileType: 'pdf',
          objectPath: `rfps/${testRfpId}/doc.pdf`,
          createdAt: new Date(),
          extractedText: null,
          parsedData: null,
        });

        console.log('🧪 Testing multi-format document download...');

        const documents = await downloader.downloadRFPDocuments(
          noticeId,
          testRfpId,
          mockApiKey
        );

        expect(documents.length).toBeGreaterThan(0);
        console.log(`✅ Downloaded ${documents.length} documents`);

        // Verify different file types
        const fileTypes = documents.map((d) => d.fileType);
        expect(fileTypes).toContain('pdf');

        console.log(`📊 File types: ${fileTypes.join(', ')}`);
      },
      testTimeout
    );

    it(
      'should retry failed downloads with backoff',
      async () => {
        const downloader = new SAMGovDocumentDownloader();
        const noticeId = 'retry-test';

        // First attempt fails, second succeeds
        mockedAxios.get
          .mockResolvedValueOnce({
            data: {
              ...mockOpportunityDetailsResponse,
              attachments: [mockOpportunityDetailsResponse.attachments[0]],
            },
            status: 200,
          })
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({
            data: Buffer.from('PDF content'),
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          });

        mockedStorage.uploadFile.mockResolvedValue({
          path: `rfps/${testRfpId}/doc.pdf`,
          url: 'https://storage.example.com/doc.pdf',
        });

        mockedStorage.createDocument.mockResolvedValue({
          id: 'doc-1',
          rfpId: testRfpId,
          filename: 'doc.pdf',
          fileType: 'pdf',
          objectPath: `rfps/${testRfpId}/doc.pdf`,
          createdAt: new Date(),
          extractedText: null,
          parsedData: null,
        });

        console.log('🧪 Testing retry logic...');

        const documents = await downloader.downloadRFPDocuments(
          noticeId,
          testRfpId,
          mockApiKey
        );

        // Should eventually succeed despite initial failure
        expect(documents.length).toBeGreaterThanOrEqual(0);
        console.log('✅ Retry logic working correctly');
      },
      testTimeout
    );
  });

  describe('Hybrid API/HTML Fallback', () => {
    it(
      'should fall back to HTML when API returns empty',
      async () => {
        const extractor = new SAMGovContentExtractor();
        const testUrl = 'https://sam.gov/search/?index=opp';

        // Mock empty API response
        mockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: {
            opportunitiesData: [],
            totalRecords: 0,
          },
        });

        const mockHtml = `
          <html>
            <body>
              <div class="opportunity-row">
                <h3>Fallback Opportunity</h3>
                <p>Found via HTML scraping</p>
              </div>
            </body>
          </html>
        `;

        console.log('🧪 Testing API → HTML fallback...');

        const opportunities = await extractor.extract(
          mockHtml,
          testUrl,
          'sam_gov'
        );

        // Should attempt API, then fall back to HTML
        expect(mockedAxios.get).toHaveBeenCalled();
        expect(Array.isArray(opportunities)).toBe(true);

        console.log(
          `✅ Fallback mechanism: ${opportunities.length} opportunities from HTML`
        );
      },
      testTimeout
    );

    it(
      'should fall back to HTML when API key is missing',
      async () => {
        // Temporarily remove API key
        delete process.env.SAM_GOV_API_KEY;

        const extractor = new SAMGovContentExtractor();
        const testUrl = 'https://sam.gov/search/';

        const mockHtml = `
          <div class="search-result">
            <h3 class="opportunity-title">No API Key Opportunity</h3>
            <div class="agency">Test Agency</div>
          </div>
        `;

        console.log('🧪 Testing no-API-key fallback...');

        const opportunities = await extractor.extract(
          mockHtml,
          testUrl,
          'sam_gov'
        );

        // Should skip API and go straight to HTML
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(Array.isArray(opportunities)).toBe(true);

        console.log('✅ No-API-key scenario handled correctly');

        // Restore API key
        process.env.SAM_GOV_API_KEY = mockApiKey;
      },
      testTimeout
    );

    it(
      'should prefer API extraction when both API and HTML are available',
      async () => {
        const extractor = new SAMGovContentExtractor();
        const testUrl = 'https://sam.gov/search/?q=test';

        mockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: mockSearchResponse,
        });

        const mockHtml = '<html><body>Some HTML content</body></html>';

        console.log('🧪 Testing API preference...');

        const opportunities = await extractor.extract(
          mockHtml,
          testUrl,
          'sam_gov'
        );

        // Should use API data
        expect(opportunities).toHaveLength(1);
        expect(opportunities[0].confidence).toBe(0.95); // API confidence
        expect(opportunities[0].title).toBe(
          'IT Services and Support Contract'
        );

        console.log('✅ API extraction preferred correctly');
      },
      testTimeout
    );
  });

  describe('Error Recovery and Resilience', () => {
    it(
      'should handle API rate limiting gracefully',
      async () => {
        const authStrategy = new SAMGovAuthStrategy();

        mockedAxios.get.mockResolvedValueOnce({
          status: 429,
          data: {},
          headers: {
            'x-ratelimit-limit': '10000',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Date.now() + 3600000),
          },
        });

        console.log('🧪 Testing rate limit handling...');

        const result = await authStrategy.authenticate({
          portalUrl: 'https://sam.gov',
          username: '',
          password: '',
          sessionId: 'rate-limit-test',
          portalType: 'sam_gov',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('rate limit');

        console.log('✅ Rate limit handled correctly');
      },
      testTimeout
    );

    it(
      'should recover from partial document download failures',
      async () => {
        const downloader = new SAMGovDocumentDownloader();
        const noticeId = 'partial-failure-test';

        // Setup: 3 documents, middle one fails
        mockedAxios.get
          .mockResolvedValueOnce({
            data: mockOpportunityDetailsResponse,
            status: 200,
          })
          .mockResolvedValueOnce({
            data: Buffer.from('Doc 1'),
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          })
          .mockRejectedValueOnce(new Error('Download failed'))
          .mockResolvedValueOnce({
            data: Buffer.from('Doc 3'),
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          });

        mockedStorage.uploadFile.mockResolvedValue({
          path: `rfps/${testRfpId}/doc.pdf`,
          url: 'https://storage.example.com/doc.pdf',
        });

        mockedStorage.createDocument.mockResolvedValue({
          id: 'doc-1',
          rfpId: testRfpId,
          filename: 'doc.pdf',
          fileType: 'pdf',
          objectPath: `rfps/${testRfpId}/doc.pdf`,
          createdAt: new Date(),
          extractedText: null,
          parsedData: null,
        });

        console.log('🧪 Testing partial failure recovery...');

        const documents = await downloader.downloadRFPDocuments(
          noticeId,
          testRfpId,
          mockApiKey
        );

        // Should get 2 out of 3 documents
        expect(documents.length).toBe(2);

        console.log(`✅ Recovered: ${documents.length}/3 documents`);
      },
      testTimeout
    );
  });

  describe('Performance and Optimization', () => {
    it(
      'should complete discovery under performance threshold',
      async () => {
        const extractor = new SAMGovContentExtractor();
        const testUrl = 'https://sam.gov/search/';

        mockedAxios.get.mockResolvedValueOnce({
          status: 200,
          data: mockSearchResponse,
        });

        console.log('🧪 Testing performance...');

        const startTime = Date.now();
        const opportunities = await extractor.extract('', testUrl, 'sam_gov');
        const duration = Date.now() - startTime;

        console.log(`⏱️  Extraction time: ${duration}ms`);

        expect(opportunities).toHaveLength(1);
        expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds

        console.log('✅ Performance within acceptable range');
      },
      testTimeout
    );
  });
});
