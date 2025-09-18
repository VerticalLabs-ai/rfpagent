import puppeteer from 'puppeteer';
import { Portal, RFP, InsertRFP, InsertNotification } from '@shared/schema';
import { IStorage } from '../storage';

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
  constructor(private storage: IStorage) {}

  /**
   * Scan a specific portal for new RFPs
   */
  async scanPortal(portalId: string): Promise<PortalScanResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting scan for portal: ${portalId}`);
      
      const portal = await this.storage.getPortal(portalId);
      if (!portal) {
        throw new Error(`Portal not found: ${portalId}`);
      }

      // Update scan timestamp
      await this.storage.updatePortal(portalId, {
        lastScanned: new Date(),
        status: 'active',
        lastError: null,
      });

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      const discoveredRFPs: DiscoveredRFP[] = [];
      const errors: string[] = [];

      try {
        // Navigate to portal
        console.log(`Navigating to: ${portal.url}`);
        await page.goto(portal.url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Handle login if required
        if (portal.loginRequired && portal.username && portal.password) {
          console.log('Logging in to portal...');
          await this.handleLogin(page, portal);
        }

        // Extract RFPs using selectors
        const selectors: PortalSelectors = portal.selectors as PortalSelectors || this.getDefaultSelectors(portal.name);
        const filters: PortalFilters = portal.filters as PortalFilters || {};

        const rfps = await this.extractRFPs(page, selectors, filters, portal);
        discoveredRFPs.push(...rfps);

        console.log(`Discovered ${rfps.length} RFPs from portal: ${portal.name}`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown extraction error';
        errors.push(errorMsg);
        console.error(`Error extracting RFPs from ${portal.name}:`, error);
      }

      await browser.close();

      // Process discovered RFPs
      const deduplicatedRFPs = await this.deduplicateRFPs(discoveredRFPs);
      const savedRFPs = await this.saveDiscoveredRFPs(deduplicatedRFPs);

      // Update portal status
      await this.storage.updatePortal(portalId, {
        status: errors.length > 0 ? 'error' : 'active',
        lastError: errors.length > 0 ? errors.join('; ') : null,
        errorCount: errors.length > 0 ? portal.errorCount + 1 : 0,
      });

      // Create notifications for new RFPs
      if (savedRFPs.length > 0) {
        await this.createDiscoveryNotifications(savedRFPs, portal);
      }

      const scanDuration = Date.now() - startTime;
      console.log(`Portal scan completed for ${portal.name} in ${scanDuration}ms`);

      return {
        portalId,
        success: errors.length === 0,
        discoveredRFPs: deduplicatedRFPs,
        errors,
        scanDuration,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown scan error';
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
      await page.waitForSelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]', { timeout: 10000 });
      
      const usernameSelector = 'input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]';
      const passwordSelector = 'input[type="password"]';
      const submitSelector = 'input[type="submit"], button[type="submit"], button:contains("Login"), button:contains("Sign In")';

      await page.type(usernameSelector, portal.username!);
      await page.type(passwordSelector, portal.password!);
      await page.click(submitSelector);
      
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      
      // Check for login success
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        throw new Error('Login may have failed - still on login page');
      }
      
      console.log('Login successful for portal:', portal.name);
    } catch (error) {
      throw new Error(`Login failed for portal ${portal.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract RFPs from the portal page using configured selectors
   */
  private async extractRFPs(page: any, selectors: PortalSelectors, filters: PortalFilters, portal: Portal): Promise<DiscoveredRFP[]> {
    const rfps: DiscoveredRFP[] = [];

    try {
      // Wait for RFP list to load
      await page.waitForSelector(selectors.rfpList, { timeout: 15000 });

      // Extract RFPs using page.evaluate to run in browser context
      const extractedData = await page.evaluate((sel: PortalSelectors, portalUrl: string) => {
        const items = document.querySelectorAll(sel.rfpItem);
        const results: any[] = [];

        items.forEach((item: Element) => {
          try {
            const titleElement = item.querySelector(sel.title);
            const linkElement = item.querySelector(sel.link);
            const agencyElement = sel.agency ? item.querySelector(sel.agency) : null;
            const deadlineElement = sel.deadline ? item.querySelector(sel.deadline) : null;
            const valueElement = sel.value ? item.querySelector(sel.value) : null;
            const descElement = sel.description ? item.querySelector(sel.description) : null;

            if (!titleElement || !linkElement) return;

            const title = titleElement.textContent?.trim() || '';
            const agency = agencyElement?.textContent?.trim() || 'Unknown Agency';
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
                const numericValue = parseFloat(valueText.replace(/[^0-9.-]/g, ''));
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
      }, selectors, portal.url);

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
      throw new Error(`Failed to extract RFPs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an RFP passes the configured filters
   */
  private passesFilters(rfp: any, filters: PortalFilters): boolean {
    // Value filters
    if (filters.minValue && rfp.estimatedValue && rfp.estimatedValue < filters.minValue) {
      return false;
    }
    if (filters.maxValue && rfp.estimatedValue && rfp.estimatedValue > filters.maxValue) {
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
  private async deduplicateRFPs(rfps: DiscoveredRFP[]): Promise<DiscoveredRFP[]> {
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
          estimatedValue: rfp.estimatedValue ? rfp.estimatedValue.toString() : null,
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
  private async createDiscoveryNotifications(rfps: RFP[], portal: Portal): Promise<void> {
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
        console.error(`Failed to create notification for RFP ${rfp.id}:`, error);
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

    console.log(`Completed scanning ${portals.length} portals. Total new RFPs: ${results.reduce((sum, r) => sum + r.discoveredRFPs.length, 0)}`);

    return results;
  }
}