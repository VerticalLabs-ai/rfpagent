/**
 * Portal URL Resolver
 *
 * Resolves the correct URL for known portals to ensure we navigate
 * to the actual solicitations/RFP listing page instead of the homepage.
 */

export interface PortalNavigationConfig {
  listingUrl: string;
  requiresAuth?: boolean;
  waitForSelector?: string;
  extractorType?: 'austin' | 'philadelphia' | 'sam_gov' | 'generic';
}

export class PortalUrlResolver {
  private static portalConfigs: Map<string, PortalNavigationConfig> = new Map([
    // Austin Finance Online - Public solicitations listing
    [
      'financeonline.austintexas.gov',
      {
        listingUrl:
          'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitations.cfm',
        requiresAuth: false,
        waitForSelector:
          'table, .solicitation, a[href*="solicitation_details"]',
        extractorType: 'austin',
      },
    ],
    // Philadelphia Public Property
    [
      'property.phila.gov',
      {
        listingUrl: 'https://property.phila.gov/procurement/',
        requiresAuth: false,
        waitForSelector: '.procurement-listing',
        extractorType: 'philadelphia',
      },
    ],
    // SAM.gov - Federal government procurement portal
    [
      'sam.gov',
      {
        listingUrl: 'https://sam.gov/search/?index=opp&page=1',
        requiresAuth: false, // API key authentication, not session-based
        waitForSelector:
          '.opportunity-row, .search-result, [data-testid*="opportunity"]',
        extractorType: 'sam_gov',
      },
    ],
  ]);

  /**
   * Get navigation config for a portal URL
   */
  static getNavigationConfig(portalUrl: string): PortalNavigationConfig | null {
    try {
      const url = new URL(portalUrl);
      const hostname = url.hostname.toLowerCase();

      // Check for exact match
      if (this.portalConfigs.has(hostname)) {
        return this.portalConfigs.get(hostname)!;
      }

      // Check for partial match (subdomain)
      for (const [domain, config] of this.portalConfigs.entries()) {
        if (hostname.includes(domain)) {
          return config;
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to parse portal URL: ${portalUrl}`, error);
      return null;
    }
  }

  /**
   * Resolve the correct listing URL for a portal
   */
  static resolveListingUrl(portalUrl: string): string {
    const config = this.getNavigationConfig(portalUrl);
    return config?.listingUrl || portalUrl;
  }

  /**
   * Check if a portal is a known portal type
   */
  static isKnownPortal(portalUrl: string): boolean {
    return this.getNavigationConfig(portalUrl) !== null;
  }

  /**
   * Get extractor type for a portal
   */
  static getExtractorType(
    portalUrl: string
  ): 'austin' | 'philadelphia' | 'sam_gov' | 'generic' {
    const config = this.getNavigationConfig(portalUrl);
    return config?.extractorType || 'generic';
  }

  /**
   * Register a new portal configuration
   */
  static registerPortal(
    hostname: string,
    config: PortalNavigationConfig
  ): void {
    this.portalConfigs.set(hostname, config);
  }
}
