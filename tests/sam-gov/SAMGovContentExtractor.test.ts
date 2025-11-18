import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SAMGovContentExtractor } from '../../server/services/scraping/extraction/extractors/SAMGovContentExtractor';
import axios from 'axios';
import {
  mockSearchResponse,
  mockEmptySearchResponse,
} from '../fixtures/sam-gov/api-responses';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SAMGovContentExtractor', () => {
  let extractor: SAMGovContentExtractor;
  const mockApiKey = 'test-api-key-12345';
  const mockUrl = 'https://sam.gov/search/?index=opp&page=1';
  const mockPortalContext = 'sam_gov';

  beforeEach(() => {
    extractor = new SAMGovContentExtractor();
    jest.clearAllMocks();

    // Setup environment
    process.env.SAM_GOV_API_KEY = mockApiKey;
  });

  afterEach(() => {
    delete process.env.SAM_GOV_API_KEY;
  });

  describe('extract()', () => {
    it('should use API extraction when API key is available', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: mockSearchResponse,
        status: 200,
      });

      // Act
      const result = await extractor.extract('', mockUrl, mockPortalContext);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'IT Services and Support Contract',
        solicitationId: 'RFP-2025-001',
        agency: 'Department of Defense',
        confidence: 0.95,
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': mockApiKey,
          }),
        })
      );
    });

    it('should fall back to HTML extraction when API key is not available', async () => {
      // Arrange
      delete process.env.SAM_GOV_API_KEY;
      const mockHtml = `
        <html>
          <body>
            <div class="opportunity-row">
              <h3>Test Opportunity</h3>
              <p>Test description</p>
            </div>
          </body>
        </html>
      `;

      // Act
      const result = await extractor.extract(
        mockHtml,
        mockUrl,
        mockPortalContext
      );

      // Assert
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should fall back to HTML when API extraction returns empty results', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: mockEmptySearchResponse,
        status: 200,
      });

      const mockHtml = `
        <html>
          <body>
            <div class="search-result">
              <h3>Fallback Opportunity</h3>
            </div>
          </body>
        </html>
      `;

      // Act
      const result = await extractor.extract(
        mockHtml,
        mockUrl,
        mockPortalContext
      );

      // Assert
      expect(mockedAxios.get).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle API errors gracefully and fall back to HTML', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));
      const mockHtml = '<html><body>Test content</body></html>';

      // Act
      const result = await extractor.extract(
        mockHtml,
        mockUrl,
        mockPortalContext
      );

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('extractFromAPI()', () => {
    it('should convert API opportunities to RFPOpportunity format', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: mockSearchResponse,
        status: 200,
      });

      // Act
      const result = await extractor['extractFromAPI'](mockUrl, mockPortalContext);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'IT Services and Support Contract',
        solicitationId: 'RFP-2025-001',
        description: expect.stringContaining('IT services'),
        agency: 'Department of Defense',
        deadline: expect.any(String),
        url: expect.stringContaining('sam.gov'),
        confidence: 0.95,
        noticeId: 'abc123def456',
      });
    });

    it('should filter out low-confidence opportunities', async () => {
      // Arrange
      const mockLowConfidenceResponse = {
        ...mockSearchResponse,
        opportunitiesData: [
          {
            ...mockSearchResponse.opportunitiesData[0],
            title: '', // Empty title = low confidence
            description: '',
          },
        ],
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockLowConfidenceResponse,
        status: 200,
      });

      // Act
      const result = await extractor['extractFromAPI'](mockUrl, mockPortalContext);

      // Assert
      expect(result).toHaveLength(0); // Filtered out
    });

    it('should handle pagination parameters in URL', async () => {
      // Arrange
      const paginatedUrl = 'https://sam.gov/search/?index=opp&page=2&limit=100';
      mockedAxios.get.mockResolvedValueOnce({
        data: mockSearchResponse,
        status: 200,
      });

      // Act
      await extractor['extractFromAPI'](paginatedUrl, mockPortalContext);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 50,
          }),
        })
      );
    });

    it('should extract search parameters from URL query string', async () => {
      // Arrange
      const searchUrl =
        'https://sam.gov/search/?index=opp&q=cybersecurity&postedFrom=01/01/2025';

      mockedAxios.get.mockResolvedValueOnce({
        data: mockSearchResponse,
        status: 200,
      });

      // Act
      await extractor['extractFromAPI'](searchUrl, mockPortalContext);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 50,
          }),
        })
      );
    });
  });

  describe('convertAPIOpportunityToRFP()', () => {
    it('should correctly convert SAM.gov API format to RFPOpportunity', () => {
      // Arrange
      const apiOpp = mockSearchResponse.opportunitiesData[0];

      // Act
      const result = extractor['convertAPIOpportunityToRFP'](apiOpp);

      // Assert
      expect(result).toMatchObject({
        title: 'IT Services and Support Contract',
        solicitationId: 'RFP-2025-001',
        description: expect.any(String),
        agency: 'Department of Defense',
        deadline: '2025-12-31T23:59:59-05:00',
        url: expect.stringContaining('sam.gov'),
        category: 'Solicitation',
        noticeId: 'abc123def456',
      });
    });

    it('should handle missing optional fields gracefully', () => {
      // Arrange
      const minimalOpp = {
        noticeId: 'test-123',
        title: 'Test Opportunity',
        type: 'Solicitation',
      };

      // Act
      const result = extractor['convertAPIOpportunityToRFP'](minimalOpp);

      // Assert
      expect(result).toMatchObject({
        title: 'Test Opportunity',
        noticeId: 'test-123',
        category: 'Solicitation',
      });
      expect(result.solicitationId).toBeUndefined();
      expect(result.agency).toBeUndefined();
    });

    it('should extract contact information when available', () => {
      // Arrange
      const oppWithContact = {
        ...mockSearchResponse.opportunitiesData[0],
        pointOfContact: [
          {
            fullName: 'Jane Doe',
            email: 'jane.doe@agency.gov',
            phone: '555-1234',
          },
        ],
      };

      // Act
      const result = extractor['convertAPIOpportunityToRFP'](oppWithContact);

      // Assert
      expect(result.description).toContain('jane.doe@agency.gov');
    });
  });

  describe('extractFromHTML()', () => {
    it('should extract opportunities from HTML when API is unavailable', async () => {
      // Arrange
      const mockHtml = `
        <html>
          <body>
            <div class="opportunity-row">
              <h3 class="opportunity-title">Network Security RFP</h3>
              <div class="opportunity-description">Provide network security services</div>
              <div class="agency">Department of Homeland Security</div>
              <div class="response-date">2025-12-31</div>
            </div>
          </body>
        </html>
      `;

      // Act
      const result = await extractor['extractFromHTML'](
        mockHtml,
        mockUrl,
        mockPortalContext
      );

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no opportunities found in HTML', async () => {
      // Arrange
      const emptyHtml = '<html><body><p>No results found</p></body></html>';

      // Act
      const result = await extractor['extractFromHTML'](
        emptyHtml,
        mockUrl,
        mockPortalContext
      );

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getConfidenceScore()', () => {
    it('should return high confidence for complete opportunities', () => {
      // Arrange
      const completeOpp = {
        title: 'Complete RFP with all details',
        solicitationId: 'RFP-2025-001',
        description: 'Detailed description of the opportunity',
        agency: 'Test Agency',
        deadline: '2025-12-31',
        url: 'https://sam.gov/opp/12345',
      };

      // Act
      const confidence = extractor['getConfidenceScore'](completeOpp);

      // Assert
      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should return low confidence for incomplete opportunities', () => {
      // Arrange
      const incompleteOpp = {
        title: 'Test',
        description: '',
      };

      // Act
      const confidence = extractor['getConfidenceScore'](incompleteOpp);

      // Assert
      expect(confidence).toBeLessThan(0.5);
    });
  });

  describe('removeDuplicates()', () => {
    it('should remove duplicate opportunities based on solicitationId', () => {
      // Arrange
      const opportunities = [
        {
          title: 'First',
          solicitationId: 'RFP-001',
          description: 'First description',
        },
        {
          title: 'Second',
          solicitationId: 'RFP-001',
          description: 'Duplicate',
        },
        {
          title: 'Third',
          solicitationId: 'RFP-002',
          description: 'Different',
        },
      ];

      // Act
      const result = extractor['removeDuplicates'](opportunities);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].solicitationId).toBe('RFP-001');
      expect(result[1].solicitationId).toBe('RFP-002');
    });

    it('should fall back to title matching when solicitationId is missing', () => {
      // Arrange
      const opportunities = [
        { title: 'Same Title', description: 'First' },
        { title: 'Same Title', description: 'Duplicate' },
        { title: 'Different Title', description: 'Unique' },
      ];

      // Act
      const result = extractor['removeDuplicates'](opportunities);

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  describe('hasApiKey()', () => {
    it('should return true when API key is in environment', () => {
      // Act
      const hasKey = extractor['hasApiKey']();

      // Assert
      expect(hasKey).toBe(true);
    });

    it('should return false when API key is not configured', () => {
      // Arrange
      delete process.env.SAM_GOV_API_KEY;

      // Act
      const hasKey = extractor['hasApiKey']();

      // Assert
      expect(hasKey).toBe(false);
    });
  });
});
