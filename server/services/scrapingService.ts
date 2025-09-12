import puppeteer from "puppeteer";
import { storage } from "../storage";
import { AIService } from "./aiService";
import type { Portal } from "@shared/schema";

export class ScrapingService {
  private aiService = new AIService();

  async scrapeAllPortals(): Promise<void> {
    try {
      const portals = await storage.getAllPortals();
      
      for (const portal of portals) {
        if (portal.status === "active") {
          await this.scrapePortal(portal);
          // Add delay between portal scrapes to be respectful
          await this.delay(5000);
        }
      }
    } catch (error) {
      console.error("Error in scrapeAllPortals:", error);
    }
  }

  async scrapePortal(portal: Portal): Promise<void> {
    console.log(`Starting scrape of ${portal.name}`);
    
    try {
      // Update last scanned timestamp
      await storage.updatePortal(portal.id, { 
        lastScanned: new Date(),
        status: "active"
      });

      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-web-security',
            '--disable-extensions'
          ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        // Navigate to portal
        await page.goto(portal.url, { waitUntil: 'networkidle2' });

        // Handle login if required
        if (portal.loginRequired && portal.username && portal.password) {
          await this.handleLogin(page, portal);
        }

        // Portal-specific scraping logic
        let opportunities;
        switch (portal.name.toLowerCase()) {
          case 'bonfire hub':
            opportunities = await this.scrapeBonfireHub(page);
            break;
          case 'findrfp':
            opportunities = await this.scrapeFindRFP(page);
            break;
          case 'austin finance online':
            opportunities = await this.scrapeAustinFinance(page);
            break;
          case 'sam.gov':
            opportunities = await this.scrapeSAMGov(page);
            break;
          default:
            opportunities = await this.scrapeGeneric(page);
        }

        // Process discovered opportunities
        for (const opportunity of opportunities) {
          await this.processOpportunity(opportunity, portal);
        }

        console.log(`Completed scrape of ${portal.name}: found ${opportunities.length} opportunities`);

      } finally {
        if (browser) {
          await browser.close();
        }
      }

    } catch (error) {
      console.error(`Error scraping ${portal.name}:`, error);
      
      // Update portal status to indicate error
      await storage.updatePortal(portal.id, { 
        status: "error",
        lastScanned: new Date()
      });

      // Create notification about scraping error
      await storage.createNotification({
        type: "discovery",
        title: "Portal Scraping Error",
        message: `Failed to scrape ${portal.name}: ${error.message}`,
        relatedEntityType: "portal",
        relatedEntityId: portal.id
      });
    }
  }

  private async handleLogin(page: any, portal: Portal): Promise<void> {
    try {
      // Look for common login form selectors
      await page.waitForSelector('input[type="email"], input[name="username"], input[name="email"]', { timeout: 10000 });
      
      // Fill username/email
      const usernameSelector = await page.$('input[type="email"], input[name="username"], input[name="email"]');
      if (usernameSelector) {
        await usernameSelector.type(portal.username!);
      }

      // Fill password
      const passwordSelector = await page.$('input[type="password"], input[name="password"]');
      if (passwordSelector) {
        await passwordSelector.type(portal.password!);
      }

      // Submit form
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign In")');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          submitButton.click()
        ]);
      }

      console.log(`Logged into ${portal.name}`);
    } catch (error) {
      console.error(`Login failed for ${portal.name}:`, error);
      throw error;
    }
  }

  private async scrapeBonfireHub(page: any): Promise<any[]> {
    try {
      // Wait for opportunities to load
      await page.waitForSelector('.opportunity-item, .rfp-item, [data-testid="opportunity"]', { timeout: 15000 });

      const opportunities = await page.evaluate(() => {
        const items = document.querySelectorAll('.opportunity-item, .rfp-item, [data-testid="opportunity"]');
        return Array.from(items).map(item => {
          const titleElement = item.querySelector('h3, .title, [data-testid="title"]');
          const agencyElement = item.querySelector('.agency, .department, [data-testid="agency"]');
          const deadlineElement = item.querySelector('.deadline, .due-date, [data-testid="deadline"]');
          const linkElement = item.querySelector('a');
          
          return {
            title: titleElement?.textContent?.trim() || '',
            agency: agencyElement?.textContent?.trim() || '',
            deadline: deadlineElement?.textContent?.trim() || '',
            link: linkElement?.href || '',
            content: item.textContent?.trim() || ''
          };
        }).filter(item => item.title);
      });

      return opportunities;
    } catch (error) {
      console.error("Error scraping Bonfire Hub:", error);
      return [];
    }
  }

  private async scrapeFindRFP(page: any): Promise<any[]> {
    try {
      await page.waitForSelector('.rfp-listing, .search-result, .opportunity', { timeout: 15000 });

      const opportunities = await page.evaluate(() => {
        const items = document.querySelectorAll('.rfp-listing, .search-result, .opportunity');
        return Array.from(items).map(item => {
          const titleElement = item.querySelector('h2, h3, .title');
          const agencyElement = item.querySelector('.agency, .issuer');
          const deadlineElement = item.querySelector('.deadline, .closing-date');
          const linkElement = item.querySelector('a');
          
          return {
            title: titleElement?.textContent?.trim() || '',
            agency: agencyElement?.textContent?.trim() || '',
            deadline: deadlineElement?.textContent?.trim() || '',
            link: linkElement?.href || '',
            content: item.textContent?.trim() || ''
          };
        }).filter(item => item.title);
      });

      return opportunities;
    } catch (error) {
      console.error("Error scraping FindRFP:", error);
      return [];
    }
  }

  private async scrapeAustinFinance(page: any): Promise<any[]> {
    try {
      await page.waitForSelector('.bid-item, .procurement-item, .opportunity', { timeout: 15000 });

      const opportunities = await page.evaluate(() => {
        const items = document.querySelectorAll('.bid-item, .procurement-item, .opportunity');
        return Array.from(items).map(item => {
          const titleElement = item.querySelector('h3, .title, .bid-title');
          const deadlineElement = item.querySelector('.due-date, .deadline, .closing-date');
          const linkElement = item.querySelector('a');
          
          return {
            title: titleElement?.textContent?.trim() || '',
            agency: 'City of Austin',
            deadline: deadlineElement?.textContent?.trim() || '',
            link: linkElement?.href || '',
            content: item.textContent?.trim() || ''
          };
        }).filter(item => item.title);
      });

      return opportunities;
    } catch (error) {
      console.error("Error scraping Austin Finance:", error);
      return [];
    }
  }

  private async scrapeSAMGov(page: any): Promise<any[]> {
    try {
      await page.waitForSelector('.search-results-item, .opportunity-row', { timeout: 15000 });

      const opportunities = await page.evaluate(() => {
        const items = document.querySelectorAll('.search-results-item, .opportunity-row');
        return Array.from(items).map(item => {
          const titleElement = item.querySelector('h3 a, .opportunity-title a');
          const agencyElement = item.querySelector('.department, .agency-name');
          const deadlineElement = item.querySelector('.response-date, .due-date');
          
          return {
            title: titleElement?.textContent?.trim() || '',
            agency: agencyElement?.textContent?.trim() || '',
            deadline: deadlineElement?.textContent?.trim() || '',
            link: titleElement?.href || '',
            content: item.textContent?.trim() || ''
          };
        }).filter(item => item.title);
      });

      return opportunities;
    } catch (error) {
      console.error("Error scraping SAM.gov:", error);
      return [];
    }
  }

  private async scrapeGeneric(page: any): Promise<any[]> {
    try {
      // Generic scraping for unknown portals
      const opportunities = await page.evaluate(() => {
        const items = document.querySelectorAll('tr, .item, .listing, .opportunity, .rfp');
        return Array.from(items).slice(0, 20).map(item => {
          const links = item.querySelectorAll('a');
          const title = links[0]?.textContent?.trim() || '';
          
          return {
            title: title,
            agency: '',
            deadline: '',
            link: links[0]?.href || '',
            content: item.textContent?.trim() || ''
          };
        }).filter(item => item.title && item.title.length > 10);
      });

      return opportunities;
    } catch (error) {
      console.error("Error in generic scraping:", error);
      return [];
    }
  }

  private async processOpportunity(opportunity: any, portal: Portal): Promise<void> {
    try {
      // Use AI to extract structured data
      const rfpDetails = await this.aiService.extractRFPDetails(opportunity.content, opportunity.link);
      
      if (!rfpDetails) {
        return; // Not a relevant opportunity
      }

      // Check if we already have this RFP
      const existingRfps = await storage.getRFPsByPortal(portal.id);
      const exists = existingRfps.some(rfp => 
        rfp.title === rfpDetails.title || 
        rfp.sourceUrl === opportunity.link
      );

      if (exists) {
        return; // Already processed
      }

      // Create new RFP
      const rfp = await storage.createRFP({
        title: rfpDetails.title,
        description: rfpDetails.description,
        agency: rfpDetails.agency,
        portalId: portal.id,
        sourceUrl: opportunity.link,
        deadline: rfpDetails.deadline ? new Date(rfpDetails.deadline) : null,
        estimatedValue: rfpDetails.estimatedValue?.toString(),
        status: "discovered",
        progress: 10
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: rfp.id,
        action: "discovered",
        details: { 
          portal: portal.name,
          sourceUrl: opportunity.link
        }
      });

      // Create notification
      await storage.createNotification({
        type: "discovery",
        title: "New RFP Discovered",
        message: `Found new opportunity: ${rfp.title} from ${rfp.agency}`,
        relatedEntityType: "rfp", 
        relatedEntityId: rfp.id
      });

      console.log(`Created new RFP: ${rfp.title}`);

    } catch (error) {
      console.error("Error processing opportunity:", error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
