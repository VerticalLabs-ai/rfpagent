import { PortalConfiguration, ScrapingContext } from '../types';

/**
 * Configuration service for scraping operations
 */
export class ScrapingConfigurationService {
  private defaultTimeout = 30000; // 30 seconds
  private defaultConcurrency = 3;
  private defaultRetryAttempts = 3;
  private defaultRetryDelay = 2000; // 2 seconds

  private portalSpecificSettings: Map<string, any> = new Map();

  constructor() {
    this.initializePortalSettings();
  }

  /**
   * Get scraping configuration for a portal type
   */
  getScrapingConfig(portalType: string): {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    concurrency: number;
    authRequired: boolean;
    specialHandling?: any;
  } {
    const portalSettings = this.portalSpecificSettings.get(portalType) || {};

    return {
      timeout: portalSettings.timeout || this.defaultTimeout,
      retryAttempts: portalSettings.retryAttempts || this.defaultRetryAttempts,
      retryDelay: portalSettings.retryDelay || this.defaultRetryDelay,
      concurrency: portalSettings.concurrency || this.defaultConcurrency,
      authRequired: portalSettings.authRequired || false,
      specialHandling: portalSettings.specialHandling,
    };
  }

  /**
   * Get extraction instructions for a portal type
   */
  getExtractionInstructions(portalType: string, searchFilter?: string): string {
    const baseInstruction = searchFilter
      ? `find and extract RFP opportunities related to "${searchFilter}"`
      : 'extract all RFP opportunities, procurement notices, and solicitations';

    const portalInstructions: Record<string, string> = {
      bonfire_hub: `${baseInstruction}. Focus on opportunities in the vendor portal dashboard, including bid status, submission requirements, and deadlines. Look for agency contact information and estimated contract values.`,
      sam_gov: `${baseInstruction}. Extract opportunities from SAM.gov search results, including NAICS codes, set-aside types, and place of performance. Pay attention to amendment notices and solicitation documents.`,
      findrfp: `${baseInstruction}. Look for opportunities in the listings with focus on industry categories, geographic regions, and funding amounts. Extract publication dates and response deadlines.`,
      philadelphia: `${baseInstruction}. Focus on Philadelphia city contracts, including department information, contract types, and local business requirements. Extract pre-bid meeting information if available.`,
      austin_finance: `${baseInstruction}. Extract Austin city procurement opportunities with focus on department requirements, local vendor preferences, and sustainability criteria.`,
      generic: `${baseInstruction}. Use general RFP extraction patterns focusing on titles, descriptions, deadlines, and contact information.`,
    };

    return portalInstructions[portalType] || portalInstructions.generic;
  }

  /**
   * Get wait conditions for a portal
   */
  getWaitConditions(portalType: string): {
    loadSelector?: string;
    networkIdle?: boolean;
    customWait?: number;
  } {
    const waitConditions: Record<string, any> = {
      bonfire_hub: {
        loadSelector: '.opportunity-list, .bid-list, .vendor-dashboard',
        networkIdle: true,
        customWait: 3000,
      },
      sam_gov: {
        loadSelector: '.search-results, .opportunity-results',
        networkIdle: true,
        customWait: 2000,
      },
      findrfp: {
        loadSelector: '.rfp-listings, .opportunities',
        networkIdle: false,
        customWait: 1500,
      },
      philadelphia: {
        loadSelector: '.contract-list, .bid-list',
        networkIdle: false,
        customWait: 2000,
      },
      austin_finance: {
        loadSelector: '.opportunity-list, .bid-opportunities',
        networkIdle: false,
        customWait: 2000,
      },
    };

    return waitConditions[portalType] || { customWait: 1000 };
  }

  /**
   * Get user agent string for a portal
   */
  getUserAgent(portalType: string): string {
    const userAgents: Record<string, string> = {
      bonfire_hub:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      sam_gov:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      generic:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    return userAgents[portalType] || userAgents.generic;
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimitConfig(portalType: string): {
    requestsPerMinute: number;
    burstLimit: number;
    backoffMultiplier: number;
  } {
    const rateLimits: Record<string, any> = {
      bonfire_hub: {
        requestsPerMinute: 30,
        burstLimit: 5,
        backoffMultiplier: 2,
      },
      sam_gov: {
        requestsPerMinute: 60,
        burstLimit: 10,
        backoffMultiplier: 1.5,
      },
      findrfp: {
        requestsPerMinute: 45,
        burstLimit: 8,
        backoffMultiplier: 2,
      },
      philadelphia: {
        requestsPerMinute: 40,
        burstLimit: 6,
        backoffMultiplier: 2,
      },
      austin_finance: {
        requestsPerMinute: 40,
        burstLimit: 6,
        backoffMultiplier: 2,
      },
    };

    return (
      rateLimits[portalType] || {
        requestsPerMinute: 30,
        burstLimit: 5,
        backoffMultiplier: 2,
      }
    );
  }

  /**
   * Validate scraping context
   */
  validateContext(context: ScrapingContext): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!context.url) {
      errors.push('URL is required');
    }

    if (!context.portalType) {
      errors.push('Portal type is required');
    }

    // URL validation
    if (context.url) {
      try {
        new URL(context.url);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    // Credentials validation
    if (
      context.loginRequired &&
      (!context.credentials?.username || !context.credentials?.password)
    ) {
      errors.push('Credentials required for login-protected portals');
    }

    // Portal-specific validation
    if (context.portalType === 'bonfire_hub' && !context.loginRequired) {
      warnings.push(
        'Bonfire Hub typically requires authentication for full access'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get error handling configuration
   */
  getErrorHandlingConfig(portalType: string): {
    retryableErrors: string[];
    fatalErrors: string[];
    customHandlers?: Record<string, any>;
  } {
    return {
      retryableErrors: [
        'TIMEOUT',
        'NETWORK_ERROR',
        'RATE_LIMITED',
        'TEMPORARY_UNAVAILABLE',
      ],
      fatalErrors: [
        'AUTHENTICATION_FAILED',
        'ACCESS_DENIED',
        'INVALID_CREDENTIALS',
        'PORTAL_MAINTENANCE',
      ],
      customHandlers: {
        bonfire_hub: {
          SESSION_EXPIRED: 'reauthenticate',
          CAPTCHA_REQUIRED: 'notify_manual_intervention',
        },
        sam_gov: {
          RATE_LIMITED: 'exponential_backoff',
          MAINTENANCE_MODE: 'schedule_retry',
        },
      },
    };
  }

  /**
   * Initialize portal-specific settings
   */
  private initializePortalSettings(): void {
    // Bonfire Hub settings
    this.portalSpecificSettings.set('bonfire_hub', {
      timeout: 45000,
      retryAttempts: 3,
      retryDelay: 3000,
      concurrency: 2,
      authRequired: true,
      specialHandling: {
        requiresSession: true,
        supportsPagination: true,
        hasAjaxContent: true,
      },
    });

    // SAM.gov settings
    this.portalSpecificSettings.set('sam_gov', {
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 2000,
      concurrency: 3,
      authRequired: false,
      specialHandling: {
        hasSearchFilters: true,
        supportsPagination: true,
        requiresPoliteDelays: true,
      },
    });

    // FindRFP settings
    this.portalSpecificSettings.set('findrfp', {
      timeout: 25000,
      retryAttempts: 2,
      retryDelay: 1500,
      concurrency: 4,
      authRequired: false,
      specialHandling: {
        hasSimpleStructure: true,
        fastLoading: true,
      },
    });

    // Philadelphia settings
    this.portalSpecificSettings.set('philadelphia', {
      timeout: 35000,
      retryAttempts: 3,
      retryDelay: 2500,
      concurrency: 3,
      authRequired: false,
      specialHandling: {
        requiresPoliteDelays: true,
        hasComplexStructure: true,
      },
    });

    // Austin Finance settings
    this.portalSpecificSettings.set('austin_finance', {
      timeout: 35000,
      retryAttempts: 3,
      retryDelay: 2500,
      concurrency: 3,
      authRequired: false,
      specialHandling: {
        requiresPoliteDelays: true,
        hasComplexStructure: true,
      },
    });
  }

  /**
   * Update portal configuration
   */
  updatePortalSettings(portalType: string, settings: any): void {
    const existing = this.portalSpecificSettings.get(portalType) || {};
    this.portalSpecificSettings.set(portalType, { ...existing, ...settings });
    console.log(`⚙️ Updated configuration for portal: ${portalType}`);
  }

  /**
   * Get all supported portal types
   */
  getSupportedPortalTypes(): string[] {
    return Array.from(this.portalSpecificSettings.keys());
  }
}
