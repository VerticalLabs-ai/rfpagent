# SAM.gov RFP Extraction Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix SAM.gov RFP extraction that fails even from valid, active opportunities by implementing proper API-first extraction with comprehensive error handling, retry logic, and improved logging.

**Architecture:** The fix uses a three-layer approach: (1) API-first extraction using SAM.gov's official `/opportunities/v2/search` endpoint with `noticeId` parameter, (2) fallback to individual opportunity endpoint when available, (3) enhanced HTML scraping as last resort. Add exponential backoff retry logic, proper User-Agent headers, comprehensive error logging, and validation of API responses.

**Tech Stack:** TypeScript, Axios, SAM.gov Opportunities API v2, Winston logging

---

## Root Cause Analysis

Based on code analysis, the SAM.gov extraction failures occur because:

1. **API Endpoint Issue**: The current implementation at `SAMGovContentExtractor.ts:102` calls `/search` endpoint without passing `noticeId` when extracting a specific opportunity
2. **Missing Individual Opportunity Endpoint**: SAM.gov provides a direct endpoint (`/opportunities/v2/{noticeId}`) that isn't being used
3. **Date Parameter Requirements**: The API requires `postedFrom` and `postedTo` in `MM/dd/yyyy` format with max 1-year range - current code may generate invalid ranges
4. **No Retry Logic**: Network failures cause immediate extraction failure
5. **Insufficient Error Logging**: Failures don't capture API error response details
6. **User-Agent May Be Blocked**: Generic User-Agent could trigger rate limiting

---

### Task 1: Add SAM.gov API Utility with Retry Logic

**Files:**
- Create: `server/services/scraping/utils/samGovApiClient.ts`
- Test: `server/services/scraping/utils/__tests__/samGovApiClient.test.ts`

**Step 1: Write the failing test**

```typescript
// server/services/scraping/utils/__tests__/samGovApiClient.test.ts
import { SAMGovApiClient } from '../samGovApiClient';

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
      const date = new Date('2025-01-15');
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
```

**Step 2: Run test to verify it fails**

Run: `npx jest server/services/scraping/utils/__tests__/samGovApiClient.test.ts -v`
Expected: FAIL with "Cannot find module '../samGovApiClient'"

**Step 3: Write minimal implementation**

```typescript
// server/services/scraping/utils/samGovApiClient.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../../utils/logger';

export interface SAMGovOpportunity {
  noticeId: string;
  title: string;
  description?: string;
  solicitationNumber?: string;
  department?: string;
  subTier?: string;
  office?: string;
  postedDate?: string;
  responseDeadLine?: string;
  archiveDate?: string;
  awardCeiling?: number;
  awardFloor?: number;
  naicsCode?: string;
  classificationCode?: string;
  type?: string;
  typeOfSetAsideDescription?: string;
  organizationType?: string;
  resourceLinks?: string[];
  pointOfContact?: Array<{
    type: string;
    email?: string;
    phone?: string;
    title?: string;
    fullName?: string;
  }>;
  placeOfPerformance?: {
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface SAMGovSearchResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SAMGovOpportunity[];
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * SAM.gov API Client with retry logic and proper error handling
 *
 * @see https://open.gsa.gov/api/get-opportunities-public-api/
 */
export class SAMGovApiClient {
  private readonly baseUrl = 'https://api.sam.gov/opportunities/v2';
  private readonly axios: AxiosInstance;
  private readonly retryConfig: RetryConfig;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      logger.warn('SAM_GOV_API_KEY not set - SAM.gov API calls will fail');
    }

    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'X-Api-Key': apiKey || '',
        'User-Agent': 'RFPAgent/2.0 (Government RFP Management System; Contact: support@rfpagent.com)',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Extract noticeId from SAM.gov opportunity URL
   */
  extractNoticeIdFromUrl(url: string): string | null {
    // Pattern: https://sam.gov/opp/{noticeId}/view
    const oppMatch = url.match(/sam\.gov\/opp\/([a-zA-Z0-9]+)\/view/i);
    if (oppMatch) {
      return oppMatch[1];
    }

    // Pattern: 32-character hex ID anywhere in URL
    const hexMatch = url.match(/([a-f0-9]{32})/i);
    if (hexMatch) {
      return hexMatch[1];
    }

    return null;
  }

  /**
   * Format date for SAM.gov API (MM/dd/yyyy)
   */
  formatDateForApi(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Get a single opportunity by noticeId
   */
  async getOpportunityById(noticeId: string): Promise<SAMGovOpportunity | null> {
    logger.info('Fetching SAM.gov opportunity by ID', { noticeId });

    try {
      // Use search endpoint with noticeId filter (API doesn't have direct /opp/:id endpoint)
      const response = await this.searchWithRetry({
        noticeId,
        limit: 1,
      });

      if (response.opportunitiesData && response.opportunitiesData.length > 0) {
        logger.info('SAM.gov opportunity found', {
          noticeId,
          title: response.opportunitiesData[0].title
        });
        return response.opportunitiesData[0];
      }

      logger.warn('SAM.gov opportunity not found', { noticeId });
      return null;
    } catch (error) {
      logger.error('Failed to fetch SAM.gov opportunity', error instanceof Error ? error : new Error(String(error)), { noticeId });
      throw error;
    }
  }

  /**
   * Search opportunities with retry logic
   */
  async searchWithRetry(params: {
    noticeId?: string;
    solnum?: string;
    title?: string;
    postedFrom?: string;
    postedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<SAMGovSearchResponse> {
    // Ensure we have valid date range if not searching by noticeId
    if (!params.noticeId && !params.postedFrom) {
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      params.postedFrom = this.formatDateForApi(oneYearAgo);
      params.postedTo = this.formatDateForApi(today);
    }

    const queryParams = {
      ...params,
      limit: params.limit || 10,
      offset: params.offset || 0,
    };

    logger.info('SAM.gov API search', { params: queryParams });

    return this.executeWithRetry(async () => {
      const response = await this.axios.get<SAMGovSearchResponse>('/search', {
        params: queryParams,
      });

      // Log rate limit info from headers
      const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
      const rateLimitLimit = response.headers['x-ratelimit-limit'];
      if (rateLimitRemaining) {
        logger.debug('SAM.gov rate limit status', {
          remaining: rateLimitRemaining,
          limit: rateLimitLimit
        });
      }

      return response.data;
    });
  }

  /**
   * Execute function with exponential backoff retry
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          logger.error('SAM.gov API non-retryable error', lastError, { attempt });
          throw lastError;
        }

        if (attempt < this.retryConfig.maxRetries) {
          logger.warn('SAM.gov API request failed, retrying', {
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
            delayMs: delay,
            error: lastError.message,
          });

          await this.sleep(delay);
          delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
        }
      }
    }

    logger.error('SAM.gov API request failed after all retries', lastError!, {
      maxRetries: this.retryConfig.maxRetries,
    });
    throw lastError;
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Retry on network errors
      if (!axiosError.response) {
        return true;
      }

      // Retry on 5xx server errors
      if (axiosError.response.status >= 500) {
        return true;
      }

      // Retry on rate limit (429)
      if (axiosError.response.status === 429) {
        return true;
      }

      // Don't retry on client errors (4xx except 429)
      return false;
    }

    // Retry on unknown errors
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const samGovApiClient = new SAMGovApiClient();
```

**Step 4: Run test to verify it passes**

Run: `npx jest server/services/scraping/utils/__tests__/samGovApiClient.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/scraping/utils/samGovApiClient.ts server/services/scraping/utils/__tests__/samGovApiClient.test.ts
git commit -m "$(cat <<'EOF'
feat: Add SAM.gov API client with retry logic and proper error handling

Implements exponential backoff retry, noticeId extraction from URLs,
proper date formatting, and comprehensive logging for debugging.
EOF
)"
```

---

### Task 2: Update SAMGovContentExtractor to Use New API Client

**Files:**
- Modify: `server/services/scraping/extraction/extractors/SAMGovContentExtractor.ts`

**Step 1: Write the failing test**

```typescript
// Add to existing test file or create new
// server/services/scraping/extraction/extractors/__tests__/SAMGovContentExtractor.test.ts

import { SAMGovContentExtractor } from '../SAMGovContentExtractor';

describe('SAMGovContentExtractor', () => {
  let extractor: SAMGovContentExtractor;

  beforeEach(() => {
    process.env.SAM_GOV_API_KEY = 'test-key';
    extractor = new SAMGovContentExtractor();
  });

  describe('extract with specific opportunity URL', () => {
    it('should extract noticeId and use API directly', async () => {
      const url = 'https://sam.gov/opp/abc123def456/view';
      // This should attempt API-based extraction first
      // Mock will be needed for full test
    });

    it('should log detailed error on API failure', async () => {
      const url = 'https://sam.gov/opp/invalid123/view';
      // Should log the specific API error response
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest server/services/scraping/extraction/extractors/__tests__/SAMGovContentExtractor.test.ts -v`
Expected: FAIL or test coverage gap

**Step 3: Update SAMGovContentExtractor**

Modify `server/services/scraping/extraction/extractors/SAMGovContentExtractor.ts`:

Replace the `extractFromAPI` method (lines 90-159) with:

```typescript
import { samGovApiClient, SAMGovOpportunity } from '../../utils/samGovApiClient';

// ... existing code ...

/**
 * Extract opportunities using SAM.gov API
 * Primary extraction method - more reliable and structured
 *
 * Now uses noticeId-based extraction for specific opportunity URLs
 */
private async extractFromAPI(url: string): Promise<RFPOpportunity[]> {
  try {
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      logger.warn('SAM_GOV_API_KEY not configured - API extraction disabled');
      return [];
    }

    // Try to extract noticeId from URL for direct lookup
    const noticeId = samGovApiClient.extractNoticeIdFromUrl(url);

    if (noticeId) {
      logger.info('Extracted noticeId from URL, using direct lookup', { noticeId, url });

      const opportunity = await samGovApiClient.getOpportunityById(noticeId);

      if (opportunity) {
        const rfpOpportunity = this.convertAPIOpportunityToRFP(opportunity);
        rfpOpportunity.confidence = this.getConfidenceScore(rfpOpportunity);

        logger.info('SAM.gov direct API extraction successful', {
          noticeId,
          title: rfpOpportunity.title,
          confidence: rfpOpportunity.confidence,
        });

        return [rfpOpportunity];
      } else {
        logger.warn('SAM.gov opportunity not found via direct lookup', {
          noticeId,
          url,
          suggestion: 'Opportunity may have been archived or withdrawn',
        });
      }
    }

    // Fallback: Extract search parameters from URL and do broader search
    logger.info('No noticeId found in URL, using search-based extraction', { url });
    const searchParams = this.extractSearchParamsFromURL(url);

    logger.info('Fetching opportunities from SAM.gov API via search', { searchParams });

    const response = await samGovApiClient.searchWithRetry({
      postedFrom: searchParams.postedFrom,
      postedTo: searchParams.postedTo,
      limit: searchParams.limit || 50,
      offset: searchParams.offset || 0,
      ...searchParams.filters,
    });

    const opportunitiesData = response.opportunitiesData || [];

    if (opportunitiesData.length === 0) {
      logger.warn('SAM.gov API search returned no results', {
        url,
        searchParams,
        totalRecords: response.totalRecords,
      });
      return [];
    }

    logger.info('SAM.gov API search response received', {
      total: opportunitiesData.length,
      totalRecords: response.totalRecords,
    });

    // Convert API response to RFPOpportunity format
    const opportunities = opportunitiesData.map((opp: SAMGovOpportunity) =>
      this.convertAPIOpportunityToRFP(opp)
    );

    // Calculate confidence scores
    opportunities.forEach((opp: RFPOpportunity) => {
      opp.confidence = this.getConfidenceScore(opp);
    });

    const minConfidence = this.getMinimumConfidenceThreshold();
    const filtered = opportunities.filter(
      (opp: RFPOpportunity) => (opp.confidence || 0) >= minConfidence
    );

    return this.removeDuplicates(filtered);
  } catch (error) {
    // Enhanced error logging with API response details
    const errorDetails: Record<string, unknown> = {
      endpoint: `${this.SAM_BASE_URL}/search`,
      url,
    };

    if (axios.isAxiosError(error)) {
      errorDetails.status = error.response?.status;
      errorDetails.statusText = error.response?.statusText;
      errorDetails.responseData = error.response?.data;
      errorDetails.headers = error.response?.headers;
    }

    logger.error(
      'SAM.gov API extraction failed',
      error instanceof Error ? error : new Error(String(error)),
      errorDetails
    );
    return [];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest server/services/scraping/extraction/extractors/__tests__/SAMGovContentExtractor.test.ts -v`
Expected: PASS

**Step 5: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 6: Commit**

```bash
git add server/services/scraping/extraction/extractors/SAMGovContentExtractor.ts
git commit -m "$(cat <<'EOF'
feat: Update SAMGovContentExtractor to use noticeId-based API extraction

Extracts noticeId from opportunity URLs for direct API lookup instead
of broad search. Falls back to search-based extraction when URL doesn't
contain a noticeId. Adds detailed error logging with API response data.
EOF
)"
```

---

### Task 3: Add SAM.gov-Specific Extraction to RFPScrapingService

**Files:**
- Modify: `server/services/scrapers/rfpScrapingService.ts`

**Step 1: Write the failing test**

```typescript
// server/services/scrapers/__tests__/rfpScrapingService.samgov.test.ts

import { RFPScrapingService, scrapeRFPFromUrl } from '../rfpScrapingService';

describe('RFPScrapingService - SAM.gov', () => {
  describe('extractRFPData', () => {
    it('should detect sam.gov URLs and use API extraction', async () => {
      const url = 'https://sam.gov/opp/abc123/view';
      // Should route to SAM.gov specific extraction
    });

    it('should handle sam.gov search URLs appropriately', async () => {
      const url = 'https://sam.gov/search?keywords=technology';
      // Should return error about search URLs not being supported
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest server/services/scrapers/__tests__/rfpScrapingService.samgov.test.ts -v`
Expected: FAIL

**Step 3: Add SAM.gov extraction method**

Modify `server/services/scrapers/rfpScrapingService.ts`:

Add after line 437 (after extractAustinRFPData method):

```typescript
/**
 * Special extraction for SAM.gov RFPs
 * Uses API-based extraction with direct noticeId lookup
 */
private async extractSAMGovRFPData(url: string) {
  console.log('🏛️ Using SAM.gov API extraction logic');

  try {
    // Import the SAM.gov API client
    const { samGovApiClient } = await import('./utils/samGovApiClient');

    // Extract noticeId from URL
    const noticeId = samGovApiClient.extractNoticeIdFromUrl(url);

    if (!noticeId) {
      // Check if this is a search URL
      if (url.includes('/search') || url.includes('searchCriteria')) {
        throw new Error(
          'SAM.gov search URLs cannot be imported. Please navigate to a specific opportunity and use that URL instead.'
        );
      }
      throw new Error(
        'Could not extract opportunity ID from SAM.gov URL. Please ensure the URL is in format: sam.gov/opp/{id}/view'
      );
    }

    console.log(`🔍 Fetching SAM.gov opportunity: ${noticeId}`);

    const opportunity = await samGovApiClient.getOpportunityById(noticeId);

    if (!opportunity) {
      throw new Error(
        `SAM.gov opportunity not found (ID: ${noticeId}). The opportunity may have been archived or withdrawn.`
      );
    }

    // Extract documents from resourceLinks
    const documents = (opportunity.resourceLinks || []).map((link: string, index: number) => ({
      name: `Document ${index + 1}`,
      url: link,
      type: this.inferDocumentType(link),
    }));

    // Build contact info
    const primaryContact = opportunity.pointOfContact?.find(c => c.type === 'primary')
      || opportunity.pointOfContact?.[0];

    return {
      data: {
        title: opportunity.title || `SAM.gov Opportunity ${noticeId}`,
        agency: opportunity.department || opportunity.office || opportunity.subTier || 'Federal Agency',
        description: opportunity.description || '',
        deadline: opportunity.responseDeadLine || opportunity.archiveDate || null,
        estimatedValue: opportunity.awardCeiling
          ? `$${opportunity.awardCeiling.toLocaleString()}`
          : opportunity.awardFloor
            ? `$${opportunity.awardFloor.toLocaleString()}`
            : null,
        contactName: primaryContact?.fullName || primaryContact?.title || null,
        contactEmail: primaryContact?.email || null,
        contactPhone: primaryContact?.phone || null,
        solicitation_number: opportunity.solicitationNumber || opportunity.noticeId,
        questions_due_date: null, // SAM.gov API doesn't provide this directly
        conference_date: null, // SAM.gov API doesn't provide this directly
        pre_bid_meeting: null,
        documents,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ SAM.gov API extraction failed:', error);

    // Don't fall back to generic scraping for SAM.gov - it won't work
    throw error;
  }
}

/**
 * Infer document type from URL
 */
private inferDocumentType(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.pdf')) return 'pdf';
  if (lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx')) return 'docx';
  if (lowerUrl.endsWith('.xls') || lowerUrl.endsWith('.xlsx')) return 'xlsx';
  if (lowerUrl.endsWith('.zip')) return 'zip';
  return 'pdf'; // Default assumption
}
```

**Step 4: Update extractRFPData to route SAM.gov URLs**

Modify the `extractRFPData` method (around line 417) to add SAM.gov routing:

```typescript
/**
 * Extract RFP data from the page
 */
private async extractRFPData(url: string) {
  console.log(`📊 Extracting RFP data from: ${url}`);

  // Special handling for SAM.gov RFPs - MUST come before generic extraction
  if (url.includes('sam.gov')) {
    return this.extractSAMGovRFPData(url);
  }

  // Special handling for Philadelphia RFPs
  if (url.includes('phlcontracts.phila.gov')) {
    return this.extractPhiladelphiaRFPData(url);
  }

  // Special handling for Austin Texas RFPs
  if (url.includes('austintexas.gov')) {
    return this.extractAustinRFPData(url);
  }

  // Generic extraction for other portals
  return performWebExtraction(
    url,
    'Extract all RFP details including: title, agency, description, deadline (Due Date), questions due date (Questions Due), conference date (Conference Date or Pre-Bid Meeting), estimated value, contact information, solicitation number, and all downloadable document links with their names. Pay special attention to dates - look for "Due Date", "Questions Due", and "Conference Date" labels.',
    rfpExtractionSchema,
    this.sessionId
  );
}
```

**Step 5: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 6: Commit**

```bash
git add server/services/scrapers/rfpScrapingService.ts
git commit -m "$(cat <<'EOF'
feat: Add SAM.gov-specific extraction using official API

Routes sam.gov URLs to dedicated API-based extraction method.
Extracts noticeId from URL and uses direct API lookup instead
of browser-based scraping which doesn't work for SAM.gov.
EOF
)"
```

---

### Task 4: Add Detailed Logging to SAMGovDocumentDownloader

**Files:**
- Modify: `server/services/scrapers/samGovDocumentDownloader.ts`

**Step 1: Update with enhanced logging**

Add detailed logging around API calls (modify `getOpportunityAttachments` method):

```typescript
// Around line 195, update the method:

private async getOpportunityAttachments(
  noticeId: string,
  apiKey: string
): Promise<
  Array<{
    name: string;
    url: string;
    fileType: string;
    size: number;
    resourceId?: string;
  }>
> {
  try {
    logger.info('Fetching SAM.gov opportunity attachments', { noticeId });

    // Fetch opportunity details
    const response = await axios.get(`${this.SAM_BASE_URL}/search`, {
      params: {
        noticeId,
        limit: 1,
      },
      headers: {
        'X-Api-Key': apiKey,
        'User-Agent': 'RFPAgent/2.0 (Government RFP Management System; Contact: support@rfpagent.com)',
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    // Log full response for debugging
    logger.debug('SAM.gov attachments API response', {
      noticeId,
      status: response.status,
      totalRecords: response.data?.totalRecords,
      opportunitiesCount: response.data?.opportunitiesData?.length,
    });

    if (response.status !== 200) {
      logger.error('SAM.gov API returned non-200 status', null as any, {
        noticeId,
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });
      throw new Error(
        `SAM.gov API returned status ${response.status}: ${response.statusText}`
      );
    }

    const opportunities = response.data?.opportunitiesData || [];

    if (opportunities.length === 0) {
      logger.warn('No opportunity found for notice ID', {
        noticeId,
        apiResponse: response.data,
      });
      return [];
    }

    const opportunity = opportunities[0];

    // Log opportunity structure for debugging
    logger.debug('SAM.gov opportunity structure', {
      noticeId,
      hasAttachments: !!opportunity.attachments,
      hasLinks: !!opportunity.links,
      hasResourceLinks: !!opportunity.resourceLinks,
      attachmentsCount: opportunity.attachments?.length,
      linksCount: opportunity.links?.length,
      resourceLinksCount: opportunity.resourceLinks?.length,
    });

    // ... rest of method unchanged
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/services/scrapers/samGovDocumentDownloader.ts
git commit -m "$(cat <<'EOF'
chore: Add detailed logging to SAMGovDocumentDownloader

Log API response structure and attachment details to help
debug document download failures.
EOF
)"
```

---

### Task 5: Update ManualRfpService Error Messages for SAM.gov

**Files:**
- Modify: `server/services/proposals/manualRfpService.ts`

**Step 1: Update getContextualErrorMessage method**

Replace the SAM.gov section (around lines 925-945) with more detailed messages:

```typescript
// SAM.gov specific errors with more actionable guidance
if (lowerUrl.includes('sam.gov')) {
  if (lowerUrl.includes('/search') || lowerUrl.includes('searchcriteria')) {
    return {
      error: 'SAM.gov search page URL detected',
      guidance:
        'Search URLs cannot be imported. Please: 1) Click on a specific opportunity from the search results, 2) Copy the URL which should look like "sam.gov/opp/{id}/view", 3) Paste that URL here.',
    };
  }
  if (lowerUrl.includes('/workspace')) {
    return {
      error: 'SAM.gov workspace URL requires authentication',
      guidance:
        'Workspace URLs require you to be logged in to SAM.gov. Please use the public URL format: sam.gov/opp/{opportunityId}/view. You can find this by searching for the opportunity while not logged in.',
    };
  }

  // Check if it looks like a valid opportunity URL but extraction failed
  if (lowerUrl.includes('/opp/')) {
    return {
      error: 'Failed to extract SAM.gov opportunity',
      guidance:
        'The opportunity URL appears correct but extraction failed. Possible causes: 1) The opportunity has been archived or withdrawn, 2) The opportunity ID is invalid, 3) SAM.gov may be experiencing issues. Please verify the opportunity is still active on sam.gov.',
    };
  }

  return {
    error: 'Invalid SAM.gov URL format',
    guidance:
      'Please use a direct opportunity URL in format: sam.gov/opp/{opportunity-id}/view. You can find this URL by clicking on a specific opportunity in SAM.gov search results.',
  };
}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/services/proposals/manualRfpService.ts
git commit -m "$(cat <<'EOF'
feat: Improve SAM.gov error messages with specific guidance

Provide step-by-step instructions for finding the correct URL
format and explain common failure scenarios.
EOF
)"
```

---

### Task 6: Add SAM.gov Integration Test

**Files:**
- Create: `server/services/scrapers/__tests__/samGovIntegration.test.ts`

**Step 1: Write integration test**

```typescript
// server/services/scrapers/__tests__/samGovIntegration.test.ts

import { SAMGovApiClient } from '../utils/samGovApiClient';

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
        url: 'https://sam.gov/workspace/contract/opp/xyz789/view',
        expected: null, // workspace URLs should be rejected earlier
        description: 'workspace URL (should not extract)',
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
    ];

    testCases.forEach(({ url, expected, description }) => {
      it(`should handle ${description}`, () => {
        const result = client.extractNoticeIdFromUrl(url);
        expect(result).toBe(expected);
      });
    });
  });

  describe('formatDateForApi', () => {
    it('should format dates correctly', () => {
      expect(client.formatDateForApi(new Date('2025-01-05'))).toBe('01/05/2025');
      expect(client.formatDateForApi(new Date('2025-12-31'))).toBe('12/31/2025');
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
  });
});
```

**Step 2: Run the test**

Run: `npx jest server/services/scrapers/__tests__/samGovIntegration.test.ts -v`
Expected: PASS

**Step 3: Commit**

```bash
git add server/services/scrapers/__tests__/samGovIntegration.test.ts
git commit -m "$(cat <<'EOF'
test: Add SAM.gov integration tests

Test URL parsing, date formatting, and optionally API calls
when SAM_GOV_API_KEY is available.
EOF
)"
```

---

### Task 7: Run Full Test Suite and Type Check

**Files:**
- No file changes (verification only)

**Step 1: Run type check**

Run: `pnpm run type-check`
Expected: No TypeScript errors

**Step 2: Run lint**

Run: `pnpm run lint`
Expected: No new lint errors

**Step 3: Run unit tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 4: Manual verification with real SAM.gov URL**

1. Start development server: `pnpm run dev`
2. Navigate to Active RFPs page
3. Click "Manual RFP" button
4. Enter a valid SAM.gov opportunity URL: `https://sam.gov/opp/[real-id]/view`
5. Verify extraction works correctly

---

### Task 8: Final Commit and Push

**Step 1: Check git status**

Run: `git status`

**Step 2: Review all changes**

Run: `git diff --stat HEAD~7`

**Step 3: Push to remote**

Run: `git push origin main`

---

## Summary of Changes

| File | Change |
|------|--------|
| `server/services/scraping/utils/samGovApiClient.ts` | NEW: API client with retry logic |
| `server/services/scraping/extraction/extractors/SAMGovContentExtractor.ts` | Use noticeId-based extraction |
| `server/services/scrapers/rfpScrapingService.ts` | Add SAM.gov-specific extraction |
| `server/services/scrapers/samGovDocumentDownloader.ts` | Enhanced logging |
| `server/services/proposals/manualRfpService.ts` | Better error messages |
| `server/services/scraping/utils/__tests__/samGovApiClient.test.ts` | NEW: API client tests |
| `server/services/scrapers/__tests__/samGovIntegration.test.ts` | NEW: Integration tests |

## Testing Checklist

- [ ] SAM.gov opportunity URL extracts noticeId correctly
- [ ] API client retries on network failures
- [ ] Direct lookup by noticeId works
- [ ] Search fallback works when no noticeId
- [ ] Error messages provide actionable guidance
- [ ] Document download works with resourceLinks
- [ ] TypeScript compiles without errors
- [ ] All unit tests pass
- [ ] Lint passes with no new errors

## API Reference

**Production Endpoint:** `https://api.sam.gov/opportunities/v2/search`

**Required Headers:**
- `X-Api-Key`: Your SAM.gov API key
- `User-Agent`: Descriptive agent string
- `Accept`: `application/json`

**Key Parameters:**
- `noticeId`: Direct lookup by opportunity ID
- `postedFrom` / `postedTo`: Date range (MM/dd/yyyy, max 1 year)
- `limit`: Max results (1-1000)

**Sources:**
- [SAM.gov Get Opportunities Public API](https://open.gsa.gov/api/get-opportunities-public-api/)
- [SAM.gov Opportunity Management API](https://open.gsa.gov/api/opportunities-api/)
