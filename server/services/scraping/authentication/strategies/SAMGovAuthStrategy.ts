import { BaseAuthenticationStrategy } from './AuthenticationStrategy';
import { AuthContext, AuthResult, Credentials } from '../../types';
import axios from 'axios';
import { logger } from '../../../../utils/logger';

/**
 * SAM.gov API Key Authentication Strategy
 *
 * SAM.gov uses API key authentication via X-Api-Key header
 * Rate limits: 10 requests/second, 10,000 requests/day
 *
 * @see https://open.gsa.gov/api/opportunities-api/
 */
export class SAMGovAuthStrategy extends BaseAuthenticationStrategy {
  private readonly SAM_BASE_URL = 'https://api.sam.gov/opportunities/v2';
  private readonly RATE_LIMIT_PER_SECOND = 10;
  private readonly RATE_LIMIT_PER_DAY = 10000;

  constructor() {
    super('sam_gov');
  }

  /**
   * Check if this strategy can handle the portal
   */
  canHandle(portalType: string, url: string): boolean {
    return (
      portalType === 'sam_gov' ||
      portalType === 'sam.gov' ||
      url.includes('sam.gov')
    );
  }

  /**
   * Validate credentials - for SAM.gov, we only need the API key
   * Username field contains the API key, password is optional
   */
  validateCredentials(credentials: Credentials): boolean {
    // API key should be provided in the username field
    // This allows compatibility with existing credential storage
    return !!(credentials.username && credentials.username.length > 0);
  }

  /**
   * Authenticate with SAM.gov API
   * For SAM.gov, authentication is API key-based, not session-based
   */
  async authenticate(context: AuthContext): Promise<AuthResult> {
    try {
      logger.info('Starting SAM.gov API authentication', {
        portalUrl: context.portalUrl,
        sessionId: context.sessionId,
      });

      // Get API key from environment or context
      const apiKey = this.getApiKey(context);

      if (!apiKey) {
        return {
          success: false,
          sessionId: context.sessionId,
          error:
            'SAM.gov API key not configured. Set SAM_GOV_API_KEY environment variable or provide in credentials.',
        };
      }

      // Validate API key with a test request
      const validationResult = await this.validateApiKey(
        apiKey,
        context.sessionId
      );

      if (!validationResult.success) {
        return {
          success: false,
          sessionId: context.sessionId,
          error: validationResult.error,
        };
      }

      logger.info('SAM.gov API authentication successful', {
        sessionId: context.sessionId,
        rateLimit: validationResult.rateLimit,
      });

      return {
        success: true,
        sessionId: context.sessionId,
        authToken: apiKey, // Store API key as auth token
        cookies: '', // SAM.gov doesn't use cookies
      };
    } catch (error) {
      return this.handleAuthError(error, 'SAMGovAuthStrategy');
    }
  }

  /**
   * Get API key from environment or context
   * Priority: context.username > process.env.SAM_GOV_API_KEY
   */
  private getApiKey(context: AuthContext): string | null {
    // Check context first (allows override per request)
    if (context.username && context.username.trim().length > 0) {
      return context.username.trim();
    }

    // Fall back to environment variable
    const envApiKey = process.env.SAM_GOV_API_KEY;
    if (envApiKey && envApiKey.trim().length > 0) {
      return envApiKey.trim();
    }

    return null;
  }

  /**
   * Validate API key with a minimal test request
   * Uses the /search endpoint with minimal parameters
   */
  private async validateApiKey(
    apiKey: string,
    sessionId: string
  ): Promise<{
    success: boolean;
    error?: string;
    rateLimit?: {
      remaining: number;
      limit: number;
    };
  }> {
    try {
      // Make a minimal test request to validate the API key
      const response = await axios.get(`${this.SAM_BASE_URL}/search`, {
        params: {
          limit: 1, // Minimal data for validation
          api_key: apiKey, // Some APIs accept key as query param too
        },
        headers: {
          'X-Api-Key': apiKey, // Primary authentication method
          'User-Agent': 'RFP-Agent/1.0',
          Accept: 'application/json',
        },
        timeout: 10000, // 10 second timeout for validation
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      // Check for successful authentication
      if (response.status === 200 || response.status === 201) {
        // Extract rate limit information from headers
        const rateLimit = {
          remaining: parseInt(
            response.headers['x-ratelimit-remaining'] || '10000',
            10
          ),
          limit: parseInt(
            response.headers['x-ratelimit-limit'] || '10000',
            10
          ),
        };

        logger.info('SAM.gov API key validated successfully', {
          sessionId,
          rateLimit,
        });

        return {
          success: true,
          rateLimit,
        };
      }

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        logger.error('SAM.gov API key validation failed', null as any, {
          sessionId,
          status: response.status,
          statusText: response.statusText,
        });

        return {
          success: false,
          error: `Invalid API key: ${response.status} ${response.statusText}`,
        };
      }

      // Handle other errors
      logger.warn('Unexpected SAM.gov API response during validation', {
        sessionId,
        status: response.status,
        statusText: response.statusText,
      });

      return {
        success: false,
        error: `API validation failed: ${response.status} ${response.statusText}`,
      };
    } catch (error: any) {
      // Network errors or other exceptions
      logger.error('SAM.gov API key validation error', error, {
        sessionId,
        endpoint: `${this.SAM_BASE_URL}/search`,
      });

      if (error.response) {
        // The request was made and the server responded with a status code
        return {
          success: false,
          error: `API validation failed: ${error.response.status} ${error.response.statusText || 'Unknown error'}`,
        };
      } else if (error.request) {
        // The request was made but no response was received
        return {
          success: false,
          error: 'SAM.gov API is unreachable. Please check your internet connection.',
        };
      } else {
        // Something happened in setting up the request
        return {
          success: false,
          error: `API validation error: ${error.message || 'Unknown error'}`,
        };
      }
    }
  }

  /**
   * Check rate limit compliance
   * Returns true if we're within safe rate limits
   */
  private checkRateLimit(requestsInLastSecond: number): boolean {
    return requestsInLastSecond < this.RATE_LIMIT_PER_SECOND;
  }

  /**
   * Get rate limit information
   */
  getRateLimits(): {
    perSecond: number;
    perDay: number;
  } {
    return {
      perSecond: this.RATE_LIMIT_PER_SECOND,
      perDay: this.RATE_LIMIT_PER_DAY,
    };
  }
}
