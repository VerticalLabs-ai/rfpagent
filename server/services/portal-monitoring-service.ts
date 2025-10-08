import { Portal, RFP, InsertRFP, InsertNotification } from '@shared/schema';
import { IStorage } from '../storage';
import { getMastraScrapingService } from './mastraScrapingService';
import { scanManager } from './scan-manager';

export interface DiscoveredRFP {
  title: string;
  description?: string;
  agency: string;
  sourceUrl: string;
  deadline?: Date;
  estimatedValue?: number;
  portalId: string;
}

export interface PortalScanResult {
  portalId: string;
  success: boolean;
  discoveredRFPs: DiscoveredRFP[];
  errors: string[];
  scanDuration: number;
}

export interface PortalSelectors {
  rfpList: string;
  rfpItem: string;
  title: string;
  agency?: string;
  deadline?: string;
  value?: string;
  link: string;
  description?: string;
}

export interface PortalFilters {
  minValue?: number;
  maxValue?: number;
  businessTypes?: string[];
  keywords?: string[];
  excludeKeywords?: string[];
}

export class PortalMonitoringService {
  private mastraService: ReturnType<typeof getMastraScrapingService>;

  constructor(private storage: IStorage) {
    this.mastraService = getMastraScrapingService();
  }

  /**
   * Scan a specific portal for new RFPs with real-time event emission
   */
  async scanPortalWithEvents(
    portalId: string,
    scanId: string
  ): Promise<PortalScanResult> {
    const startTime = Date.now();

    try {
      scanManager.log(scanId, 'info', `Starting scan for portal: ${portalId}`);
      scanManager.updateStep(
        scanId,
        'initializing',
        5,
        'Retrieving portal configuration...'
      );

      // Use secure credential method for login-required portals
      const portal = await this.storage.getPortalWithCredentials(portalId);
      if (!portal) {
        const error = `Portal not found: ${portalId}`;
        scanManager.log(scanId, 'error', error);
        scanManager.completeScan(scanId, false);
        throw new Error(error);
      }

      scanManager.updateStep(
        scanId,
        'initializing',
        10,
        `Portal configured: ${portal.name}`
      );

      // Update scan timestamp
      await this.storage.updatePortal(portalId, {
        lastScanned: new Date(),
        status: 'active',
        lastError: null,
      });

      scanManager.updateStep(
        scanId,
        'authenticating',
        15,
        `Starting Browserbase/Mastra intelligent scraping`
      );
      scanManager.log(
        scanId,
        'info',
        `Using Browserbase/Mastra for intelligent scraping of: ${portal.name}`
      );

      const discoveredRFPs: DiscoveredRFP[] = [];
      const errors: string[] = [];

      try {
        scanManager.updateStep(
          scanId,
          'authenticating',
          20,
          `Connecting to portal: ${portal.url}`
        );
        scanManager.log(
          scanId,
          'info',
          `Starting Mastra/Browserbase scraping for: ${portal.url}`
        );

        // The MastraScrapingService handles everything: authentication, navigation, extraction
        await this.mastraService.scrapePortal(portal);

        scanManager.updateStep(
          scanId,
          'extracting',
          60,
          'Portal content extracted, processing RFPs...'
        );

        // Get the RFPs that were discovered and saved by MastraScrapingService
        const recentRFPs = await this.storage.getRFPsByPortal(portal.id);
        const todaysRFPs = recentRFPs.filter(rfp => {
          const rfpDate = new Date(rfp.updatedAt);
          const today = new Date();
          return rfpDate.toDateString() === today.toDateString();
        });

        scanManager.updateStep(
          scanId,
          'parsing',
          80,
          `Processing ${todaysRFPs.length} discovered RFPs...`
        );

        // Convert to DiscoveredRFP format for consistency with the existing interface
        const mastraRFPs: DiscoveredRFP[] = todaysRFPs.map(rfp => ({
          title: rfp.title,
          description: rfp.description || '',
          agency: rfp.agency,
          sourceUrl: rfp.sourceUrl,
          deadline: rfp.deadline ? new Date(rfp.deadline) : undefined,
          estimatedValue: rfp.estimatedValue
            ? parseFloat(rfp.estimatedValue) || undefined
            : undefined,
          portalId: portal.id,
        }));

        discoveredRFPs.push(...mastraRFPs);

        // Record each RFP discovery
        for (const rfp of mastraRFPs) {
          scanManager.recordRFPDiscovery(scanId, {
            title: rfp.title,
            agency: rfp.agency,
            sourceUrl: rfp.sourceUrl,
            deadline: rfp.deadline,
            estimatedValue: rfp.estimatedValue,
          });
        }

        scanManager.updateStep(
          scanId,
          'saving',
          90,
          `Saving ${mastraRFPs.length} RFPs to database...`
        );
        scanManager.log(
          scanId,
          'info',
          `Mastra/Browserbase discovered ${mastraRFPs.length} RFPs from portal: ${portal.name}`
        );
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Mastra scraping error';
        const structuredError = (error as any)?.structured;

        // Enhanced error handling for Bonfire Hub authentication issues with structured error support
        const isBonfireHub =
          portal.url.includes('bonfirehub.com') ||
          portal.url.includes('vendor.bonfire');
        const isAuthError =
          errorMsg.toLowerCase().includes('authentication') ||
          errorMsg.toLowerCase().includes('login') ||
          errorMsg.toLowerCase().includes('credentials') ||
          errorMsg.toLowerCase().includes('unauthorized');

        if (isBonfireHub && isAuthError) {
          let specificGuidance =
            '💡 Bonfire Hub uses Euna Supplier Network authentication. Verify username/password are correct and account is active.';
          let errorCode = 'BONFIRE_AUTH_UNKNOWN';
          let isRecoverable = false;

          // Use structured error information if available
          if (structuredError) {
            errorCode = structuredError.code;
            isRecoverable = structuredError.recoverable;

            // Provide specific guidance based on structured error code
            switch (structuredError.code) {
              case 'BONFIRE_AUTH_TIMEOUT':
                specificGuidance =
                  '⏰ Authentication timeout: The portal may be slow or experiencing issues. This is recoverable - retry recommended.';
                break;
              case 'BONFIRE_AUTH_2FA_REQUIRED':
                specificGuidance =
                  '🔐 Two-factor authentication detected: This portal requires manual 2FA verification. Account needs manual intervention.';
                break;
              case 'BONFIRE_AUTH_SSO_REQUIRED':
                specificGuidance =
                  '🔗 Single Sign-On detected: This portal uses SSO authentication. Account needs SSO configuration.';
                break;
              case 'BONFIRE_AUTH_CREDENTIALS_INVALID':
                specificGuidance =
                  '🚫 Login rejected: Credentials appear invalid. Check username/password and account status.';
                break;
              case 'BONFIRE_AUTH_FORM_CHANGED':
                specificGuidance =
                  '🔧 Form structure changed: The login form may have been updated. This is recoverable - form detection will adapt.';
                break;
              default:
                specificGuidance =
                  '💡 Bonfire Hub authentication failed. Check credentials and portal status.';
            }
          } else {
            // Fallback to legacy error pattern matching
            if (errorMsg.includes('Password field never appeared')) {
              specificGuidance =
                '🔑 Password field issue: The login form may have changed, or 2FA/SSO is required. Check if your account uses single sign-on.';
              errorCode = 'BONFIRE_AUTH_FORM_CHANGED';
              isRecoverable = true;
            } else if (errorMsg.includes('timed out')) {
              specificGuidance =
                '⏰ Authentication timeout: The portal may be slow or experiencing issues. Try again later or check portal status.';
              errorCode = 'BONFIRE_AUTH_TIMEOUT';
              isRecoverable = true;
            } else if (errorMsg.includes('still on login page')) {
              specificGuidance =
                '🚫 Login rejected: Check username/password, account status, or if 2FA is required.';
              errorCode = 'BONFIRE_AUTH_CREDENTIALS_INVALID';
            } else if (errorMsg.includes('2FA required')) {
              specificGuidance =
                '🔐 Two-factor authentication detected: This portal requires manual 2FA verification.';
              errorCode = 'BONFIRE_AUTH_2FA_REQUIRED';
            } else if (errorMsg.includes('No observe results found')) {
              specificGuidance =
                '🔍 Form field detection failed: The portal login form may have changed structure or be blocked by security features.';
              errorCode = 'BONFIRE_AUTH_FORM_CHANGED';
              isRecoverable = true;
            }
          }

          const enhancedError = `🔥 Bonfire Hub Authentication Error [${errorCode}]: ${errorMsg}`;
          const recoveryNote = isRecoverable
            ? ' (Recoverable - retry recommended)'
            : ' (Manual intervention required)';

          errors.push(enhancedError);
          scanManager.log(scanId, 'error', enhancedError + recoveryNote);
          scanManager.log(scanId, 'info', specificGuidance);

          // Log structured error details for debugging
          if (structuredError) {
            scanManager.log(
              scanId,
              'info',
              `Error context: Phase=${structuredError.context?.phase}, URL=${structuredError.context?.targetUrl}`
            );
          }

          console.error(
            `🔥 Bonfire Hub authentication failed for ${portal.name} [${errorCode}]:`,
            error
          );
        } else {
          errors.push(errorMsg);
          scanManager.log(
            scanId,
            'error',
            `Error in Mastra/Browserbase scraping: ${errorMsg}`
          );
          console.error(
            `Error in Mastra/Browserbase scraping for ${portal.name}:`,
            error
          );
        }
      }

      // Note: MastraScrapingService already handles RFP saving and deduplication
      const savedRFPs = discoveredRFPs; // Already saved by MastraScrapingService

      // Update portal status
      await this.storage.updatePortal(portalId, {
        status: errors.length > 0 ? 'error' : 'active',
        lastError: errors.length > 0 ? errors.join('; ') : null,
        errorCount: errors.length > 0 ? portal.errorCount + 1 : 0,
      });

      const scanDuration = Date.now() - startTime;
      const success = errors.length === 0;

      if (success) {
        scanManager.updateStep(
          scanId,
          'completed',
          100,
          `Scan completed successfully. Found ${discoveredRFPs.length} RFPs.`
        );
      } else {
        scanManager.updateStep(
          scanId,
          'failed',
          100,
          `Scan completed with ${errors.length} errors.`
        );
      }

      scanManager.completeScan(scanId, success);

      console.log(
        `Portal scan completed for ${portal.name} in ${scanDuration}ms`
      );

      return {
        portalId,
        success,
        discoveredRFPs: discoveredRFPs,
        errors,
        scanDuration,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown scan error';
      const scanDuration = Date.now() - startTime;

      scanManager.log(scanId, 'error', `Portal scan failed: ${errorMsg}`);
      scanManager.completeScan(scanId, false);

      console.error(`Portal scan failed for ${portalId}:`, error);

      // Update portal with error status
      try {
        const portal = await this.storage.getPortal(portalId);
        if (portal) {
          await this.storage.updatePortal(portalId, {
            status: 'error',
            lastError: errorMsg,
            errorCount: portal.errorCount + 1,
          });
        }
      } catch (updateError) {
        console.error('Failed to update portal error status:', updateError);
      }

      return {
        portalId,
        success: false,
        discoveredRFPs: [],
        errors: [errorMsg],
        scanDuration,
      };
    }
  }

  /**
   * Scan a specific portal for new RFPs (legacy method without events)
   */
  async scanPortal(portalId: string): Promise<PortalScanResult> {
    const startTime = Date.now();

    try {
      console.log(`Starting scan for portal: ${portalId}`);

      // Use secure credential method for login-required portals
      const portal = await this.storage.getPortalWithCredentials(portalId);
      if (!portal) {
        throw new Error(`Portal not found: ${portalId}`);
      }

      // Update scan timestamp
      await this.storage.updatePortal(portalId, {
        lastScanned: new Date(),
        status: 'active',
        lastError: null,
      });

      console.log(
        `Using Browserbase/Mastra for intelligent scraping of: ${portal.name}`
      );

      const discoveredRFPs: DiscoveredRFP[] = [];
      const errors: string[] = [];

      try {
        // Use MastraScrapingService (Browserbase) instead of local Puppeteer
        console.log(`Starting Mastra/Browserbase scraping for: ${portal.url}`);

        // The MastraScrapingService handles everything: authentication, navigation, extraction
        await this.mastraService.scrapePortal(portal);

        // Get the RFPs that were discovered and saved by MastraScrapingService
        const recentRFPs = await this.storage.getRFPsByPortal(portal.id);
        const todaysRFPs = recentRFPs.filter(rfp => {
          const rfpDate = new Date(rfp.updatedAt);
          const today = new Date();
          return rfpDate.toDateString() === today.toDateString();
        });

        // Convert to DiscoveredRFP format for consistency with the existing interface
        const mastraRFPs: DiscoveredRFP[] = todaysRFPs.map(rfp => ({
          title: rfp.title,
          description: rfp.description || '',
          agency: rfp.agency,
          sourceUrl: rfp.sourceUrl,
          deadline: rfp.deadline ? new Date(rfp.deadline) : undefined,
          estimatedValue: rfp.estimatedValue
            ? parseFloat(rfp.estimatedValue) || undefined
            : undefined,
          portalId: portal.id,
        }));

        discoveredRFPs.push(...mastraRFPs);
        console.log(
          `Mastra/Browserbase discovered ${mastraRFPs.length} RFPs from portal: ${portal.name}`
        );
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Mastra scraping error';
        errors.push(errorMsg);
        console.error(
          `Error in Mastra/Browserbase scraping for ${portal.name}:`,
          error
        );
      }

      // Note: MastraScrapingService already handles RFP saving and deduplication
      // For interface consistency, we still return the discoveredRFPs count
      const savedRFPs = discoveredRFPs; // Already saved by MastraScrapingService

      // Update portal status
      await this.storage.updatePortal(portalId, {
        status: errors.length > 0 ? 'error' : 'active',
        lastError: errors.length > 0 ? errors.join('; ') : null,
        errorCount: errors.length > 0 ? portal.errorCount + 1 : 0,
      });

      // Create notifications for new RFPs (handled by MastraScrapingService)
      // Note: MastraScrapingService already creates discovery notifications
      // if (savedRFPs.length > 0) {
      //   await this.createDiscoveryNotifications(savedRFPs, portal);
      // }

      const scanDuration = Date.now() - startTime;
      console.log(
        `Portal scan completed for ${portal.name} in ${scanDuration}ms`
      );

      return {
        portalId,
        success: errors.length === 0,
        discoveredRFPs: discoveredRFPs,
        errors,
        scanDuration,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown scan error';
      const scanDuration = Date.now() - startTime;

      console.error(`Portal scan failed for ${portalId}:`, error);

      // Update portal with error status
      try {
        const portal = await this.storage.getPortal(portalId);
        if (portal) {
          await this.storage.updatePortal(portalId, {
            status: 'error',
            lastError: errorMsg,
            errorCount: portal.errorCount + 1,
          });
        }
      } catch (updateError) {
        console.error('Failed to update portal error status:', updateError);
      }

      return {
        portalId,
        success: false,
        discoveredRFPs: [],
        errors: [errorMsg],
        scanDuration,
      };
    }
  }

  /**
   * Handle login for portals that require authentication
   */
  private async handleLogin(page: any, portal: Portal): Promise<void> {
    // Generic login handling - can be customized per portal
    try {
      // Look for common login form elements
      await page.waitForSelector(
        'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]',
        { timeout: 10000 }
      );

      const usernameSelector =
        'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]';
      const passwordSelector = 'input[type="password"]';
      const submitSelector =
        'input[type="submit"], button[type="submit"], button[data-testid*="login"], button[data-testid*="signin"], [role="button"][aria-label*="Login"], [role="button"][aria-label*="Sign In"]';

      await page.type(usernameSelector, portal.username!);
      await page.type(passwordSelector, portal.password!);
      await page.click(submitSelector);

      await page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 15000,
      });

      // Check for login success
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        throw new Error('Login may have failed - still on login page');
      }

      console.log('Login successful for portal:', portal.name);
    } catch (error) {
      throw new Error(
        `Login failed for portal ${portal.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract RFPs from the portal page using configured selectors
   */
  private async extractRFPs(
    page: any,
    selectors: PortalSelectors,
    filters: PortalFilters,
    portal: Portal
  ): Promise<DiscoveredRFP[]> {
    const rfps: DiscoveredRFP[] = [];

    try {
      // Wait for RFP list to load
      await page.waitForSelector(selectors.rfpList, { timeout: 15000 });

      // Extract RFPs using page.evaluate to run in browser context
      const extractedData = await page.evaluate(
        (sel: PortalSelectors, portalUrl: string) => {
          const items = document.querySelectorAll(sel.rfpItem);
          const results: any[] = [];

          items.forEach((item: Element) => {
            try {
              const titleElement = item.querySelector(sel.title);
              const linkElement = item.querySelector(sel.link);
              const agencyElement = sel.agency
                ? item.querySelector(sel.agency)
                : null;
              const deadlineElement = sel.deadline
                ? item.querySelector(sel.deadline)
                : null;
              const valueElement = sel.value
                ? item.querySelector(sel.value)
                : null;
              const descElement = sel.description
                ? item.querySelector(sel.description)
                : null;

              if (!titleElement || !linkElement) return;

              const title = titleElement.textContent?.trim() || '';
              const agency =
                agencyElement?.textContent?.trim() || 'Unknown Agency';
              const description = descElement?.textContent?.trim() || '';

              let sourceUrl = linkElement.getAttribute('href') || '';
              // Convert relative URLs to absolute
              if (sourceUrl.startsWith('/')) {
                const baseUrl = new URL(portalUrl);
                sourceUrl = `${baseUrl.origin}${sourceUrl}`;
              } else if (sourceUrl.startsWith('http') === false) {
                sourceUrl = `${portalUrl}/${sourceUrl}`;
              }

              // Parse deadline
              let deadline: Date | undefined;
              if (deadlineElement) {
                const deadlineText = deadlineElement.textContent?.trim();
                if (deadlineText) {
                  const parsed = new Date(deadlineText);
                  if (!isNaN(parsed.getTime())) {
                    deadline = parsed;
                  }
                }
              }

              // Parse estimated value
              let estimatedValue: number | undefined;
              if (valueElement) {
                const valueText = valueElement.textContent?.trim();
                if (valueText) {
                  const numericValue = parseFloat(
                    valueText.replace(/[^0-9.-]/g, '')
                  );
                  if (!isNaN(numericValue)) {
                    estimatedValue = numericValue;
                  }
                }
              }

              results.push({
                title,
                agency,
                description,
                sourceUrl,
                deadline: deadline?.toISOString(),
                estimatedValue,
              });
            } catch (error) {
              console.error('Error processing RFP item:', error);
            }
          });

          return results;
        },
        selectors,
        portal.url
      );

      // Process and filter extracted data
      for (const item of extractedData) {
        // Apply filters
        if (!this.passesFilters(item, filters)) {
          continue;
        }

        const rfp: DiscoveredRFP = {
          title: item.title,
          description: item.description,
          agency: item.agency,
          sourceUrl: item.sourceUrl,
          deadline: item.deadline ? new Date(item.deadline) : undefined,
          estimatedValue: item.estimatedValue,
          portalId: portal.id,
        };

        rfps.push(rfp);
      }

      // Limit results per portal scan
      return rfps.slice(0, portal.maxRfpsPerScan);
    } catch (error) {
      console.error('Error extracting RFPs:', error);
      throw new Error(
        `Failed to extract RFPs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if an RFP passes the configured filters
   */
  private passesFilters(rfp: any, filters: PortalFilters): boolean {
    // Value filters
    if (
      filters.minValue &&
      rfp.estimatedValue &&
      rfp.estimatedValue < filters.minValue
    ) {
      return false;
    }
    if (
      filters.maxValue &&
      rfp.estimatedValue &&
      rfp.estimatedValue > filters.maxValue
    ) {
      return false;
    }

    // Keyword filters
    if (filters.keywords && filters.keywords.length > 0) {
      const text = `${rfp.title} ${rfp.description}`.toLowerCase();
      const hasKeyword = filters.keywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Exclude keywords
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      const text = `${rfp.title} ${rfp.description}`.toLowerCase();
      const hasExcludedKeyword = filters.excludeKeywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      );
      if (hasExcludedKeyword) return false;
    }

    return true;
  }

  /**
   * Remove duplicate RFPs based on sourceUrl
   */
  private async deduplicateRFPs(
    rfps: DiscoveredRFP[]
  ): Promise<DiscoveredRFP[]> {
    const uniqueUrls = new Set<string>();
    const deduplicated: DiscoveredRFP[] = [];

    for (const rfp of rfps) {
      if (uniqueUrls.has(rfp.sourceUrl)) {
        continue;
      }

      // Check if RFP already exists in database
      const existingRFP = await this.storage.getRFPBySourceUrl(rfp.sourceUrl);
      if (existingRFP) {
        continue;
      }

      uniqueUrls.add(rfp.sourceUrl);
      deduplicated.push(rfp);
    }

    return deduplicated;
  }

  /**
   * Save discovered RFPs to database
   */
  private async saveDiscoveredRFPs(rfps: DiscoveredRFP[]): Promise<RFP[]> {
    const savedRFPs: RFP[] = [];

    for (const rfp of rfps) {
      try {
        const insertData: InsertRFP = {
          title: rfp.title,
          description: rfp.description || null,
          agency: rfp.agency,
          portalId: rfp.portalId,
          sourceUrl: rfp.sourceUrl,
          deadline: rfp.deadline || null,
          estimatedValue: rfp.estimatedValue
            ? rfp.estimatedValue.toString()
            : null,
          status: 'discovered',
          progress: 0,
        };

        const savedRFP = await this.storage.createRFP(insertData);
        savedRFPs.push(savedRFP);

        console.log(`Saved new RFP: ${rfp.title} from ${rfp.agency}`);
      } catch (error) {
        console.error(`Failed to save RFP ${rfp.title}:`, error);
      }
    }

    return savedRFPs;
  }

  /**
   * Create notifications for newly discovered RFPs
   */
  private async createDiscoveryNotifications(
    rfps: RFP[],
    portal: Portal
  ): Promise<void> {
    for (const rfp of rfps) {
      try {
        const notification: InsertNotification = {
          type: 'discovery',
          title: 'New RFP Discovered',
          message: `Found new RFP "${rfp.title}" from ${rfp.agency} on ${portal.name}`,
          relatedEntityType: 'rfp',
          relatedEntityId: rfp.id,
          isRead: false,
        };

        await this.storage.createNotification(notification);
      } catch (error) {
        console.error(
          `Failed to create notification for RFP ${rfp.id}:`,
          error
        );
      }
    }
  }

  /**
   * Get default selectors for common government portals
   */
  private getDefaultSelectors(portalName: string): PortalSelectors {
    const name = portalName.toLowerCase();

    // SAM.gov selectors
    if (name.includes('sam.gov') || name.includes('sam')) {
      return {
        rfpList: '.search-results',
        rfpItem: '.search-result-item',
        title: '.search-result-title a',
        agency: '.search-result-agency',
        deadline: '.search-result-deadline',
        link: '.search-result-title a',
        value: '.search-result-value',
        description: '.search-result-description',
      };
    }

    // Generic fallback selectors
    return {
      rfpList: 'main, .content, #content, .results',
      rfpItem: 'tr, .item, .listing, .opportunity',
      title: 'a, .title, h2, h3, th:first-child',
      agency: '.agency, .department, .organization',
      deadline: '.deadline, .due-date, .closing-date',
      link: 'a',
      value: '.value, .amount, .estimate',
      description: '.description, .summary, .details',
    };
  }

  /**
   * Scan all active portals
   */
  async scanAllPortals(): Promise<PortalScanResult[]> {
    const portals = await this.storage.getActivePortals();
    const results: PortalScanResult[] = [];

    console.log(`Starting scan of ${portals.length} active portals`);

    for (const portal of portals) {
      try {
        const result = await this.scanPortal(portal.id);
        results.push(result);

        // Add delay between portal scans to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to scan portal ${portal.name}:`, error);
        results.push({
          portalId: portal.id,
          success: false,
          discoveredRFPs: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          scanDuration: 0,
        });
      }
    }

    console.log(
      `Completed scanning ${portals.length} portals. Total new RFPs: ${results.reduce((sum, r) => sum + r.discoveredRFPs.length, 0)}`
    );

    return results;
  }
}
