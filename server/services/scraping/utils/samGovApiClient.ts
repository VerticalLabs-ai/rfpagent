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
        'User-Agent':
          'RFPAgent/2.0 (Government RFP Management System; Contact: support@rfpagent.com)',
        Accept: 'application/json',
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
  async getOpportunityById(
    noticeId: string
  ): Promise<SAMGovOpportunity | null> {
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
          title: response.opportunitiesData[0].title,
        });
        return response.opportunitiesData[0];
      }

      logger.warn('SAM.gov opportunity not found', { noticeId });
      return null;
    } catch (error) {
      logger.error(
        'Failed to fetch SAM.gov opportunity',
        error instanceof Error ? error : new Error(String(error)),
        { noticeId }
      );
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
          limit: rateLimitLimit,
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
          logger.error('SAM.gov API non-retryable error', lastError, {
            attempt,
          });
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
          delay = Math.min(
            delay * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxDelayMs
          );
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
