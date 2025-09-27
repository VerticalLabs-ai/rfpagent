import type { Portal } from "@shared/schema";
import { ValidationResult, PortalConfiguration } from '../types';

export class PortalDetectionService {
  private portalConfigurations: Map<string, PortalConfiguration> = new Map();

  constructor() {
    this.initializePortalConfigurations();
  }

  /**
   * Detect portal type from URL
   */
  detectPortalType(url: string): string {
    const hostname = this.extractHostname(url);

    // Direct hostname matches
    const portalTypeMap: Record<string, string> = {
      'vendor.bonfirehub.com': 'bonfire_hub',
      'bonfirehub.com': 'bonfire_hub',
      'sam.gov': 'sam.gov',
      'findrfp.com': 'findrfp',
      'find-rfp.com': 'findrfp',
      'phlcontracts.phila.gov': 'philadelphia',
      'financeonline.austintexas.gov': 'austin_finance',
      'austintexas.gov': 'austin_finance'
    };

    // Check for exact matches first
    if (portalTypeMap[hostname]) {
      return portalTypeMap[hostname];
    }

    // Check for subdomain patterns
    if (hostname.includes('bonfire')) return 'bonfire_hub';
    if (hostname.includes('sam.gov')) return 'sam.gov';
    if (hostname.includes('austin')) return 'austin_finance';
    if (hostname.includes('phila.gov')) return 'philadelphia';

    // Default to generic for unknown portals
    return 'generic';
  }

  /**
   * Get portal configuration for a specific type
   */
  getPortalConfiguration(portalType: string): PortalConfiguration | null {
    return this.portalConfigurations.get(portalType) || null;
  }

  /**
   * Validate URL and detect portal characteristics
   */
  validateAndDetectPortal(url: string): ValidationResult {
    try {
      const parsedUrl = new URL(url);

      // Security validations
      if (parsedUrl.protocol !== 'https:') {
        return {
          isValid: false,
          error: 'Only HTTPS URLs are allowed for security'
        };
      }

      // Block private/localhost IPs
      const hostname = parsedUrl.hostname.toLowerCase();
      const privateIpRegex = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost$|0\.0\.0\.0$)/;
      if (privateIpRegex.test(hostname)) {
        return {
          isValid: false,
          error: 'Private IP addresses and localhost are not allowed'
        };
      }

      // Detect portal type
      const portalType = this.detectPortalType(url);

      return {
        isValid: true,
        portalType
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format'
      };
    }
  }

  /**
   * Check if portal requires authentication
   */
  requiresAuthentication(portalType: string): boolean {
    const config = this.getPortalConfiguration(portalType);
    return config?.authRequired ?? false;
  }

  /**
   * Get selectors for a portal type
   */
  getPortalSelectors(portalType: string): PortalConfiguration['selectors'] | null {
    const config = this.getPortalConfiguration(portalType);
    return config?.selectors || null;
  }

  /**
   * Extract hostname from URL
   */
  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Initialize portal configurations
   */
  private initializePortalConfigurations(): void {
    // Bonfire Hub configuration
    this.portalConfigurations.set('bonfire_hub', {
      type: 'bonfire_hub',
      authRequired: true,
      baseUrl: 'https://vendor.bonfirehub.com',
      selectors: {
        loginForm: 'form[action*="login"], .login-form',
        usernameField: 'input[name="username"], input[name="email"], #username, #email',
        passwordField: 'input[name="password"], #password',
        opportunityList: '.opportunity-list, .bid-list, .rfp-list',
        opportunityItem: '.opportunity-row, .bid-item, .rfp-item'
      }
    });

    // SAM.gov configuration
    this.portalConfigurations.set('sam.gov', {
      type: 'sam.gov',
      authRequired: false, // Public access available
      baseUrl: 'https://sam.gov',
      selectors: {
        opportunityList: '.search-results, .opportunity-results',
        opportunityItem: '.search-result-item, .opportunity-item'
      }
    });

    // FindRFP configuration
    this.portalConfigurations.set('findrfp', {
      type: 'findrfp',
      authRequired: false,
      baseUrl: 'https://findrfp.com',
      selectors: {
        opportunityList: '.rfp-listings, .opportunities',
        opportunityItem: '.rfp-item, .opportunity'
      }
    });

    // Philadelphia configuration
    this.portalConfigurations.set('philadelphia', {
      type: 'philadelphia',
      authRequired: false,
      baseUrl: 'https://phlcontracts.phila.gov',
      selectors: {
        opportunityList: '.contract-list, .bid-list',
        opportunityItem: '.contract-item, .bid-item'
      }
    });

    // Austin Finance configuration
    this.portalConfigurations.set('austin_finance', {
      type: 'austin_finance',
      authRequired: false,
      baseUrl: 'https://financeonline.austintexas.gov',
      selectors: {
        opportunityList: '.opportunity-list, .bid-opportunities',
        opportunityItem: '.opportunity, .bid-opportunity'
      }
    });

    // Generic configuration
    this.portalConfigurations.set('generic', {
      type: 'generic',
      authRequired: false,
      baseUrl: '',
      selectors: {
        opportunityList: '.opportunities, .rfp-list, .bid-list, .procurements',
        opportunityItem: '.opportunity, .rfp, .bid, .procurement'
      }
    });
  }

  /**
   * Add or update portal configuration
   */
  registerPortalConfiguration(config: PortalConfiguration): void {
    this.portalConfigurations.set(config.type, config);
    console.log(`📋 Registered portal configuration for: ${config.type}`);
  }

  /**
   * Get all registered portal types
   */
  getRegisteredPortalTypes(): string[] {
    return Array.from(this.portalConfigurations.keys());
  }

  /**
   * Check if portal type is supported
   */
  isPortalTypeSupported(portalType: string): boolean {
    return this.portalConfigurations.has(portalType);
  }
}