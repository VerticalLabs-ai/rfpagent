import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createTool } from "@mastra/core/tools";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { request } from "undici";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { storage } from "../storage";
import { AIService } from "./aiService";
import type { Portal } from "@shared/schema";
import puppeteer from "puppeteer";
import { 
  performBrowserAuthentication, 
  scrapeWithAuthenticatedSession,
  sessionManager
} from "./stagehandTools";

// Zod schema for agent response validation
const OpportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  agency: z.string().optional(),
  deadline: z.string().optional(),
  estimatedValue: z.string().optional(),
  url: z.string().url().optional(),
  link: z.string().url().optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.5)
});

const AgentResponseSchema = z.object({
  opportunities: z.array(OpportunitySchema).optional(),
  results: z.array(OpportunitySchema).optional(),
  status: z.string().optional(),
  error: z.string().optional()
}).or(OpportunitySchema);

export class MastraScrapingService {
  private aiService = new AIService();
  // private memory: Memory; // Disabled pending vector store configuration
  private agents: Map<string, Agent> = new Map();
  private requestLimiter = pLimit(3); // Limit concurrent requests
  private aiLimiter = pLimit(2); // Limit concurrent AI calls

  constructor() {
    // Temporarily disable memory features to avoid vector store requirement
    // Will re-enable once vector store is properly configured
    // this.memory = new Memory({
    //   options: {
    //     lastMessages: 50
    //   }
    // });

    this.initializeAgents();
  }

  /**
   * Scrape dynamic content using Puppeteer for JavaScript-heavy sites like Austin Finance
   */
  private async scrapeDynamicContent(url: string, sessionData?: any): Promise<string> {
    let browser;
    try {
      console.log(`🤖 Launching Puppeteer browser for ${url}`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent to match our requests
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Set cookies if we have session data
      if (sessionData?.cookies) {
        console.log(`🍪 Setting session cookies for authentication`);
        // Parse cookies and set them
        const cookies = sessionData.cookies.split(';').map((cookie: string) => {
          const [name, value] = cookie.trim().split('=');
          return { name, value, domain: new URL(url).hostname };
        });
        await page.setCookie(...cookies);
      }

      console.log(`🌐 Navigating to ${url} with Puppeteer`);
      
      // Navigate and wait for network to be idle (JavaScript content loaded)
      await page.goto(url, { 
        waitUntil: 'networkidle2', // Wait until no more than 2 network connections for 500ms
        timeout: 30000 
      });

      // Additional wait for any remaining JavaScript to finish
      console.log(`⏳ Waiting for JavaScript content to load completely...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Give extra time for dynamic content

      // Check if we can find table elements or solicitation content
      await page.waitForFunction(() => {
        const tables = document.querySelectorAll('table, .solicitation, [id*="solicitation"], [class*="rfp"]');
        return tables.length > 0;
      }, { timeout: 10000 }).catch(() => {
        console.log(`⚠️ No specific solicitation elements found, proceeding with full page content`);
      });

      // Get the fully rendered HTML
      const html = await page.content();
      console.log(`✅ Successfully scraped ${html.length} characters of dynamic content`);
      
      return html;
      
    } catch (error) {
      console.error(`❌ Dynamic scraping failed for ${url}:`, error instanceof Error ? error.message : String(error));
      throw new Error(`Dynamic content scraping failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (browser) {
        await browser.close();
        console.log(`🔒 Puppeteer browser closed`);
      }
    }
  }

  private initializeAgents(): void {
    // Generic RFP scraper agent
    const genericAgent = this.createGenericRFPAgent();
    this.agents.set('generic', genericAgent);

    // Specialized agents for major portals
    const bonfireAgent = this.createBonfireAgent();
    this.agents.set('bonfire_hub', bonfireAgent);

    const samGovAgent = this.createSAMGovAgent();
    this.agents.set('sam.gov', samGovAgent);

    const findRFPAgent = this.createFindRFPAgent();
    this.agents.set('findrfp', findRFPAgent);
  }

  private createWebScrapingTool() {
    return createTool({
      id: "web-scrape",
      description: "Scrape a website for RFP opportunities using intelligent content analysis",
      inputSchema: z.object({
        url: z.string().describe("URL to scrape"),
        loginRequired: z.boolean().describe("Whether login is required"),
        credentials: z.object({
          username: z.string().optional(),
          password: z.string().optional()
        }).optional().describe("Login credentials if required"),
        portalType: z.string().describe("Type of portal (bonfire, sam.gov, etc.)")
      }),
      execute: async ({ context }) => {
        // Use AI-powered web scraping instead of browser automation
        return await this.intelligentWebScrape(context);
      }
    });
  }

  private createRFPExtractionTool() {
    return createTool({
      id: "extract-rfp-data",
      description: "Extract structured RFP data from web content using AI",
      inputSchema: z.object({
        content: z.string().describe("Raw web content to analyze"),
        url: z.string().describe("Source URL"),
        portalContext: z.string().describe("Portal-specific context and patterns")
      }),
      execute: async ({ context }) => {
        return await this.extractRFPData(context);
      }
    });
  }

  private createAuthenticationTool() {
    return createTool({
      id: "authenticate-portal",
      description: "Handle portal authentication intelligently",
      inputSchema: z.object({
        portalUrl: z.string(),
        username: z.string(),
        password: z.string(),
        authContext: z.string().describe("Portal-specific authentication context")
      }),
      execute: async ({ context }) => {
        return await this.handleAuthentication(context);
      }
    });
  }

  private createGenericRFPAgent(): Agent {
    return new Agent({
      name: "Generic RFP Scraper",
      instructions: `You are an intelligent RFP discovery agent specialized in finding procurement opportunities across various government and corporate portals.

      Your capabilities:
      - Analyze portal structures and adapt to different layouts
      - Identify RFP listings, opportunities, and procurement notices
      - Handle various authentication flows intelligently
      - Extract key information: title, agency, deadline, description, value
      - Learn from previous interactions to improve accuracy
      
      Focus on:
      - Government procurement sites
      - Municipal bidding portals  
      - Corporate supplier portals
      - RFP aggregation sites
      
      Always return structured data with confidence scores for each field.`,
      
      model: openai("gpt-4o"),
      // memory: this.memory, // Disabled pending vector store configuration
      tools: {
        webScrape: this.createWebScrapingTool(),
        extractRFP: this.createRFPExtractionTool(),
        authenticate: this.createAuthenticationTool()
      }
    });
  }

  private createBonfireAgent(): Agent {
    return new Agent({
      name: "Bonfire Hub Specialist",
      instructions: `You are a specialized agent for Bonfire Hub procurement portals. You understand:

      - Bonfire's specific layout patterns and data structures
      - Common authentication flows used by Bonfire portals
      - How to navigate Bonfire's opportunity listings and filters
      - Bonfire's typical RFP presentation format
      - Agency-specific customizations within Bonfire portals

      Key patterns to recognize:
      - Opportunity cards with standardized layouts
      - Deadline formats and timezone handling
      - Attachment and document links
      - Vendor registration requirements
      - Category and classification systems`,

      model: openai("gpt-4o"),
      // memory: this.memory, // Disabled pending vector store configuration
      tools: {
        webScrape: this.createWebScrapingTool(),
        extractRFP: this.createRFPExtractionTool(),
        authenticate: this.createAuthenticationTool()
      }
    });
  }

  private createSAMGovAgent(): Agent {
    return new Agent({
      name: "SAM.gov Federal Specialist",
      instructions: `You are a specialized agent for SAM.gov federal procurement opportunities. You understand:

      - Federal procurement terminology and structures
      - NAICS code classification systems
      - Set-aside categories (Small Business, WOSB, etc.)
      - Federal timeline and response requirements
      - Contract vehicle types (GSA, SEWP, CIO-SP3, etc.)

      SAM.gov specific patterns:
      - Opportunity number formats
      - Department and agency hierarchies
      - Classification code usage
      - Attachment naming conventions
      - Amendment tracking systems`,

      model: openai("gpt-4o"),
      // memory: this.memory, // Disabled pending vector store configuration
      tools: {
        webScrape: this.createWebScrapingTool(),
        extractRFP: this.createRFPExtractionTool(),
        authenticate: this.createAuthenticationTool()
      }
    });
  }

  private createFindRFPAgent(): Agent {
    return new Agent({
      name: "FindRFP Aggregator Specialist", 
      instructions: `You are specialized in FindRFP.com and similar RFP aggregation platforms. You understand:

      - Multi-source aggregation patterns
      - Standardized opportunity formats across different sources
      - Link-through patterns to original portal sources
      - Subscription and access tier differences
      - Cross-referencing with original portal data

      Focus on:
      - Identifying the original source portal for each opportunity
      - Validating aggregated data against source portals
      - Understanding premium vs. free tier data access
      - Handling redirect patterns to original RFPs`,

      model: openai("gpt-4o"),
      // memory: this.memory, // Disabled pending vector store configuration
      tools: {
        webScrape: this.createWebScrapingTool(),
        extractRFP: this.createRFPExtractionTool(),
        authenticate: this.createAuthenticationTool()
      }
    });
  }

  async scrapeAllPortals(): Promise<void> {
    try {
      const portals = await storage.getAllPortals();
      
      // Process portals in parallel with controlled concurrency
      const activePortals = portals.filter(portal => portal.status === "active");
      const results = await Promise.allSettled(
        activePortals.map(portal => this.scrapePortal(portal))
      );

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Portal scraping failed for ${activePortals[index].name}:`, result.reason);
        }
      });

    } catch (error) {
      console.error("Error in scrapeAllPortals:", error instanceof Error ? error.message : String(error));
    }
  }

  async scrapePortal(portal: Portal): Promise<void> {
    console.log(`Starting intelligent scrape of ${portal.name} using Mastra agents`);
    
    try {
      // Update last scanned timestamp
      await storage.updatePortal(portal.id, { 
        lastScanned: new Date(),
        status: "active"
      });

      // Select appropriate agent based on portal type
      const agent = this.selectAgent(portal);
      
      // Create scraping context with portal-specific knowledge
      const context = await this.buildPortalContext(portal);
      
      // For Austin Finance, bypass agent and go direct to working scraper
      let opportunities: any[] = [];
      if (portal.url.includes('austintexas.gov')) {
        console.log(`🎯 Austin Finance detected: Bypassing agent, using direct scraping only`);
        opportunities = []; // Force direct scraping path
      } else {
        // Execute intelligent scraping with error handling for other portals
        try {
          const scrapingPrompt = this.buildScrapingPrompt(portal, context);
          const response = await agent.generateVNext(scrapingPrompt, {
            resourceId: portal.id,
            threadId: `portal-${portal.id}-${Date.now()}`
          });

          // Parse agent response and extract opportunities
          console.log(`🤖 Raw agent response (first 500 chars):`, response.text.substring(0, 500));
          opportunities = this.parseAgentResponse(response.text);
          console.log(`🤖 parseAgentResponse returned ${opportunities.length} opportunities`);
        } catch (agentError) {
          console.error(`🚨 Agent execution failed for ${portal.name}:`, agentError);
          console.log(`🔄 Falling back to direct scraping due to agent error`);
          opportunities = []; // Force fallback to intelligentWebScrape
        }
      }
      
      // If agent didn't call tools or returned no opportunities, call intelligentWebScrape directly
      if (opportunities.length === 0) {
        console.log(`🔄 Agent returned no opportunities, calling intelligentWebScrape directly for ${portal.name}`);
        try {
          console.log(`🔄 Calling intelligentWebScrape for ${portal.name}...`);
          const directScrapeResult = await this.intelligentWebScrape({
            url: portal.url,
            loginRequired: portal.loginRequired,
            credentials: portal.loginRequired ? {
              username: portal.username,
              password: portal.password
            } : null
          });
          
          console.log(`🔄 intelligentWebScrape completed. Result type:`, typeof directScrapeResult);
          console.log(`🔄 directScrapeResult has opportunities?`, directScrapeResult && 'opportunities' in directScrapeResult);
          console.log(`🔄 directScrapeResult.opportunities length:`, directScrapeResult?.opportunities?.length || 'undefined');
          
          if (directScrapeResult && directScrapeResult.opportunities) {
            opportunities = directScrapeResult.opportunities;
            console.log(`✅ Direct scrape found ${opportunities.length} opportunities`);
          } else {
            console.log(`❌ No opportunities found in directScrapeResult:`, directScrapeResult ? Object.keys(directScrapeResult) : 'null/undefined');
          }
        } catch (directScrapeError) {
          console.error(`Direct scrape failed for ${portal.name}:`, directScrapeError);
        }
      }

      // Process discovered opportunities
      console.log(`🔧 Processing ${opportunities.length} opportunities for ${portal.name}`);
      for (let i = 0; i < opportunities.length; i++) {
        const opportunity = opportunities[i];
        console.log(`🔧 Processing opportunity ${i + 1}/${opportunities.length}: ${opportunity.title || opportunity.solicitationId || 'Unknown'}`);
        try {
          await this.processOpportunity(opportunity, portal);
          console.log(`✅ Successfully processed opportunity: ${opportunity.title || opportunity.solicitationId}`);
        } catch (error) {
          console.error(`❌ Error processing opportunity ${opportunity.title || opportunity.solicitationId}:`, error);
        }
      }

      console.log(`Completed intelligent scrape of ${portal.name}: found ${opportunities.length} opportunities`);

    } catch (error) {
      console.error(`Error in intelligent scraping ${portal.name}:`, error);
      
      // Update portal status to indicate error
      await storage.updatePortal(portal.id, { 
        status: "error",
        lastScanned: new Date()
      });

      // Create notification about scraping error
      await storage.createNotification({
        type: "discovery",
        title: "Portal Scraping Error",
        message: `Intelligent scraping failed for ${portal.name}: ${error instanceof Error ? error.message : String(error)}`,
        relatedEntityType: "portal",
        relatedEntityId: portal.id
      });
    }
  }

  private selectAgent(portal: Portal): Agent {
    const portalName = portal.name.toLowerCase().replace(/\s+/g, '_');
    
    // Try to find specialized agent first
    if (this.agents.has(portalName)) {
      return this.agents.get(portalName)!;
    }
    
    // Check for partial matches
    for (const [key, agent] of Array.from(this.agents.entries())) {
      if (key !== 'generic' && portalName.includes(key.split('_')[0])) {
        return agent;
      }
    }
    
    // Fall back to generic agent
    return this.agents.get('generic')!;
  }

  private async buildPortalContext(portal: Portal): Promise<string> {
    // Get historical context from memory and previous scrapes
    const recentRfps = await storage.getRFPsByPortal(portal.id);
    const recentCount = recentRfps.filter(rfp => {
      const daysSinceCreated = (Date.now() - new Date(rfp.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 30;
    }).length;

    return `Portal Context:
    - Name: ${portal.name}
    - URL: ${portal.url}
    - Requires Login: ${portal.loginRequired}
    - Recent RFPs Found: ${recentCount} in last 30 days
    - Portal Status: ${portal.status}
    - Last Successful Scan: ${portal.lastScanned || 'Never'}`;
  }

  private buildScrapingPrompt(portal: Portal, context: string): string {
    // Build specialized prompt based on portal type
    const isAustinFinance = portal.name.toLowerCase().includes('austin finance');
    
    if (isAustinFinance) {
      return `Please scrape the Austin Finance Online portal for procurement opportunities:

${context}

IMPORTANT: You are analyzing the ACTIVE SOLICITATIONS page which contains a table/list of current RFPs.

Your task:
1. Look for the "ACTIVE SOLICITATIONS" table or list on the page
2. Each row contains solicitation information in this pattern:
   - Solicitation ID (e.g. "IFQ 1100 BAS1065", "RFP 8100 SAR3013")
   - Due Date (e.g. "09/12/2025 at 2PM") 
   - Title/Description (e.g. "Gearbox, Unit 6 & 7 Cooling Tower Fan")
   - Detailed description paragraph
3. Extract ALL solicitations from the table/list
4. For each opportunity, extract:
   - Title (from the bold title line)
   - Solicitation ID (the code like IFQ/IFB/RFP + numbers)
   - Due Date (convert to ISO format)
   - Description (full description text)
   - Agency: "City of Austin"
   - Source URL: Construct detail URL if provided (e.g. solicitation_details.cfm?sid=XXXXX)
   - Category: Based on solicitation type (IFQ=Quote, IFB=Bid, RFP=Proposal)

Look specifically for table rows or list items that contain solicitation codes like "IFQ", "IFB", "RFP", "RFQS" followed by numbers.

Return results as structured JSON array with all found solicitations.`;
    }

    return `Please scrape the following RFP portal for procurement opportunities:

${context}

Your task:
1. Navigate to the portal URL: ${portal.url}
${portal.loginRequired ? `2. Authenticate using provided credentials` : '2. Access public listings'}
3. Find all available RFP/procurement opportunities
4. Extract key information for each opportunity:
   - Title
   - Agency/Organization
   - Deadline/Due Date
   - Estimated Value (if available)
   - Description/Summary
   - Source URL/Link
   - Category/Type

Focus on active, open opportunities only. Return results as structured JSON with confidence scores.

Use your specialized knowledge of this portal type to navigate efficiently and extract accurate data.`;
  }

  private parseAgentResponse(response: string): any[] {
    try {
      console.log('🤖 Parsing AI agent response...');
      console.log(`📝 Agent response length: ${response.length} characters`);
      
      // First, try to extract JSON blocks from the response
      const jsonBlocks = this.extractJsonBlocks(response);
      console.log(`🔍 Found ${jsonBlocks.length} JSON blocks in response`);
      
      for (const jsonBlock of jsonBlocks) {
        try {
          const parsedData = JSON.parse(jsonBlock);
          
          // Validate against our schema
          const validationResult = AgentResponseSchema.safeParse(parsedData);
          
          if (validationResult.success) {
            const data = validationResult.data;
            
            // Handle different response formats
            if ('opportunities' in data && Array.isArray(data.opportunities)) {
              return data.opportunities;
            }
            if ('results' in data && Array.isArray(data.results)) {
              return data.results;
            }
            // Single opportunity object
            if ('title' in data) {
              return [data];
            }
          } else {
            console.warn('JSON validation failed:', validationResult.error.issues);
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON block:', parseError);
          continue;
        }
      }
      
      console.warn("No valid JSON opportunities found in agent response");
      console.log(`🚨 Agent response (first 1000 chars):`, response.substring(0, 1000));
      return [];
      
    } catch (error) {
      console.error("Error parsing agent response:", error);
      return [];
    }
  }

  private async intelligentWebScrape(context: any): Promise<any> {
    return await this.requestLimiter(async () => {
      try {
        const { url, loginRequired, credentials } = context;
        
        // Auto-detect portal type based on URL if not provided or unclear
        let portalType = context.portalType;
        if (!portalType || portalType === 'generic') {
          if (url.includes('financeonline.austintexas.gov') || url.includes('austin') && url.includes('finance')) {
            portalType = 'austin finance';
          } else if (url.includes('bonfire')) {
            portalType = 'bonfire';
          } else if (url.includes('sam.gov')) {
            portalType = 'sam.gov';
          } else if (url.includes('findrfp')) {
            portalType = 'findrfp';
          }
        }
        
        console.log(`🔍 Portal type detected: ${portalType} for ${url}`);
        
        console.log(`🔍 Starting intelligent scrape of ${url} (portal type: ${portalType})`);
        
        // Step 1: Fetch the page content
        let sessionData: any = null;
        if (loginRequired && credentials) {
          sessionData = await this.handleAuthentication({
            portalUrl: url,
            username: credentials.username,
            password: credentials.password,
            authContext: `${portalType} portal authentication`
          });
          
          if (!sessionData.authenticated) {
            throw new Error(`Authentication failed for ${url}`);
          }
        }

        // Step 2: Fetch main portal page (use dynamic scraping for Austin Finance)
        let html: string;
        
        if (portalType.toLowerCase().includes('austin') && portalType.toLowerCase().includes('finance')) {
          console.log(`🌐 Austin Finance detected: Using dynamic content scraping with Puppeteer`);
          html = await this.scrapeDynamicContent(url, sessionData);
        } else {
          const response = await request(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              ...(sessionData?.cookies ? { 'Cookie': sessionData.cookies } : {}),
              ...(sessionData?.headers ? sessionData.headers : {})
            },
            bodyTimeout: 30000,
            headersTimeout: 10000
          });

          console.log(`📡 HTTP Response: ${response.statusCode} from ${url}`);
          
          if (response.statusCode >= 400) {
            throw new Error(`HTTP ${response.statusCode}: Failed to fetch ${url}`);
          }

          html = await response.body.text();
        }
        
        console.log(`📄 Fetched ${html.length} characters of HTML content`);
        
        // Step 3: Parse HTML content with Cheerio
        const $ = cheerio.load(html);
        console.log(`🔧 Parsed HTML with Cheerio, found ${$('*').length} elements`);
        
        // Step 4: Extract structured content based on portal type
        console.log(`🎯 Extracting content for portal type: ${portalType}`);
        const extractedContent = this.extractContentByPortalType($, portalType, url);
        console.log(`📊 Extracted ${extractedContent?.length || 0} content sections`);
        
        // Step 5: Look for RFP/opportunity links to fetch additional details
        console.log(`🔗 Looking for opportunity links...`);
        const opportunityLinks = this.findOpportunityLinks($, url, portalType);
        console.log(`🎯 Found ${opportunityLinks?.length || 0} potential opportunity links`);
        
        // Step 6: Fetch additional opportunity details (limited concurrency)
        console.log(`📥 Fetching details for ${Math.min(opportunityLinks?.length || 0, 10)} opportunities...`);
        const detailedOpportunities = await Promise.allSettled(
          (opportunityLinks || []).slice(0, 10).map(link => // Limit to 10 opportunities per scrape
            this.fetchOpportunityDetails(link, sessionData)
          )
        );

        const successfulOpportunities = detailedOpportunities
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value)
          .filter(opp => opp !== null);
        
        console.log(`✅ Successfully fetched ${successfulOpportunities.length} detailed opportunities`);
        
        // Merge detailed opportunities with extracted opportunities - critical fix!
        const extractedOpportunities = extractedContent.opportunities || [];
        const allOpportunities = [...successfulOpportunities, ...extractedOpportunities];
        
        // Remove duplicates based on link or solicitationId
        const uniqueOpportunities = allOpportunities.filter((opportunity, index, arr) => {
          const identifier = opportunity.link || opportunity.url || opportunity.solicitationId || opportunity.title;
          return arr.findIndex(o => (o.link || o.url || o.solicitationId || o.title) === identifier) === index;
        });
        
        console.log(`🔄 intelligentWebScrape returning ${uniqueOpportunities.length} opportunities (${successfulOpportunities.length} detailed + ${extractedOpportunities.length} extracted, ${allOpportunities.length - uniqueOpportunities.length} duplicates removed)`);

        return {
          content: html,
          extractedContent,
          opportunities: uniqueOpportunities,
          opportunityLinks,
          status: 'success',
          timestamp: new Date().toISOString(),
          portalType,
          url
        };
        
      } catch (error) {
        console.error(`Error in intelligentWebScrape for ${context.url}:`, error);
        return {
          error: error instanceof Error ? error.message : String(error),
          status: 'error',
          url: context.url,
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  private async extractRFPData(context: any): Promise<any> {
    // Use AI to extract structured RFP data from content with rate limiting
    return await this.aiLimiter(async () => {
      try {
        return await this.aiService.extractRFPDetails(context.content, context.url);
      } catch (error) {
        console.error('AI extraction error:', error);
        throw error;
      }
    });
  }

  // Removed duplicate getWithRedirects method - using the improved version with loop detection

  private async handleAuthentication(context: any): Promise<any> {
    return await this.requestLimiter(async () => {
      try {
        const { portalUrl, username, password, authContext } = context;
        
        console.log(`Attempting authentication for ${portalUrl}`);
        
        // Step 1: Let all portals go through standard detection to route browser automation properly
        
        // Step 1: Determine the actual login page URL for other portals
        let loginUrl = portalUrl;
        
        // Step 2: Fetch login page with proper redirect and cookie handling
        const { finalResponse, finalUrl, cookieHeader } = await this.getWithRedirects(loginUrl);

        // Check final response status
        if (finalResponse.statusCode !== 200) {
          // HTTP 403 or 401 typically indicates authentication is required - route to browser automation
          if (finalResponse.statusCode === 403 || finalResponse.statusCode === 401) {
            console.log(`🌐 Browser authentication required: HTTP ${finalResponse.statusCode} - portal requires authentication`);
            return await this.handleBrowserAuthentication({
              loginUrl: finalUrl,
              targetUrl: portalUrl,
              username,
              password,
              portal: authContext?.portal
            });
          }
          throw new Error(`Login page fetch failed after following redirects: HTTP ${finalResponse.statusCode} from ${finalUrl}`);
        }

        const loginPageHtml = await finalResponse.body.text();
        const $ = cheerio.load(loginPageHtml);
        
        // Step 2: Analyze authentication method
        const authMethod = this.detectAuthenticationMethod($, portalUrl);
        
        if (authMethod.type === 'none') {
          return {
            authenticated: true,
            method: 'no_auth_required',
            portalUrl
          };
        }
        
        if (authMethod.type === 'unsupported') {
          return {
            authenticated: false,
            error: 'Unsupported authentication method detected',
            method: authMethod.details,
            portalUrl
          };
        }

        // Step 3: Handle form-based authentication
        if (authMethod.type === 'form') {
          return await this.handleFormAuthentication({
            $, 
            portalUrl: finalUrl, // Use final URL after redirects
            username, 
            password, 
            formData: authMethod.formData,
            loginPageResponse: finalResponse, // Use final response after redirects
            cookieHeader // Pass accumulated cookies from redirect chain
          });
        }

        // Step 4: Handle browser-based authentication (OAuth/SSO/Complex forms)
        if (authMethod.type === 'browser_required') {
          console.log(`🌐 Browser authentication required: ${authMethod.details}`);
          return await this.handleBrowserAuthentication({
            loginUrl: finalUrl,
            targetUrl: portalUrl,
            username,
            password,
            portal: authContext?.portal
          });
        }

        // Step 5: Handle other authentication types
        return {
          authenticated: false,
          error: `Authentication type '${authMethod.type}' not yet implemented`,
          method: authMethod.type,
          portalUrl
        };
        
      } catch (error) {
        console.error(`Authentication error for ${context.portalUrl}:`, error);
        return {
          authenticated: false,
          error: error instanceof Error ? error.message : String(error),
          method: 'error',
          portalUrl: context.portalUrl
        };
      }
    });
  }

  private async processOpportunity(opportunity: any, portal: Portal): Promise<void> {
    console.log(`🎯 Starting processOpportunity for: ${opportunity.title || opportunity.solicitationId} from ${portal.name}`);
    try {
      // Enhanced AI analysis with confidence scoring
      console.log(`🤖 Calling AI analysis for: ${opportunity.title || opportunity.solicitationId}`);
      const rfpDetails = await this.aiService.extractRFPDetails(
        opportunity.content || opportunity.description, 
        opportunity.link || opportunity.url
      );
      console.log(`🤖 AI analysis completed. Result:`, rfpDetails ? `Confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%` : 'NULL');
      
      // Lower confidence threshold for Austin Finance due to municipal list pages
      const confidenceThreshold = portal.name.toLowerCase().includes('austin') ? 0.4 : 0.7;
      
      if (!rfpDetails) {
        console.log(`🚫 Skipping opportunity - AI returned null: ${opportunity.title || opportunity.solicitationId}`);
        return;
      }
      
      if (rfpDetails.confidence < confidenceThreshold) {
        console.log(`🚫 Skipping low-confidence opportunity: ${opportunity.title || opportunity.solicitationId} (confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%, threshold: ${(confidenceThreshold * 100).toFixed(1)}%)`);
        return;
      }
      
      console.log(`✅ AI analysis passed: ${opportunity.title || opportunity.solicitationId} (confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%)`);

      // Check for duplicates
      const existingRfps = await storage.getRFPsByPortal(portal.id);
      const exists = existingRfps.some(rfp => 
        rfp.title === rfpDetails.title || 
        rfp.sourceUrl === (opportunity.link || opportunity.url)
      );

      if (exists) {
        return;
      }

      // Create new RFP with enhanced data
      const rfp = await storage.createRFP({
        title: rfpDetails.title,
        description: rfpDetails.description,
        agency: rfpDetails.agency || opportunity.agency,
        portalId: portal.id,
        sourceUrl: opportunity.link || opportunity.url,
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
          sourceUrl: opportunity.link || opportunity.url,
          confidence: rfpDetails.confidence,
          agent: this.selectAgent(portal).name
        }
      });

      // Create notification
      await storage.createNotification({
        type: "discovery",
        title: "New RFP Discovered",
        message: `AI agent found: ${rfp.title} from ${rfp.agency}`,
        relatedEntityType: "rfp", 
        relatedEntityId: rfp.id
      });

      console.log(`🎉 AI agent created new RFP: ${rfp.title} (ID: ${rfp.id})`);
      console.log(`💾 Successfully saved RFP to database with ID: ${rfp.id}`);

    } catch (error) {
      console.error("Error processing opportunity:", error);
    }
  }

  private redactSensitiveCookies(cookies: string | null): string {
    if (!cookies) return 'None';
    
    // Redact sensitive cookie values but keep structure for debugging
    return cookies.replace(
      /(csrf[^=]*|session[^=]*|bm[^=]*)=([^;]+)/gi, 
      '$1=[REDACTED]'
    );
  }

  private mergeCookies(existingCookies: string | null, newCookies: string | null): string | null {
    if (!existingCookies && !newCookies) return null;
    if (!existingCookies) return newCookies;
    if (!newCookies) return existingCookies;
    
    // Parse existing cookies
    const cookieMap = new Map<string, string>();
    
    existingCookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookieMap.set(name, value);
      }
    });
    
    // Add/update with new cookies
    newCookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookieMap.set(name, value);
      }
    });
    
    // Convert back to string
    return Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private async getWithRedirects(url: string, maxRedirects: number = 10, initialCookies?: string | null): Promise<{finalResponse: any, finalUrl: string, cookieHeader: string | null}> {
    let currentUrl = url;
    let redirectCount = 0;
    let currentResponse: any;
    const cookies = new Map<string, string>();
    const visitedUrls = new Set<string>();
    
    // Initialize with any existing cookies
    if (initialCookies) {
      initialCookies.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies.set(name.trim(), value.trim());
        }
      });
    }

    while (redirectCount < maxRedirects) {
      // Loop detection
      if (visitedUrls.has(currentUrl)) {
        throw new Error(`Redirect loop detected: URL ${currentUrl} visited before`);
      }
      visitedUrls.add(currentUrl);
      
      console.log(`🌐 Request ${redirectCount + 1}: ${currentUrl}`);
      
      // Build cookie header from accumulated cookies
      const cookieHeader = Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      const requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      };

      currentResponse = await request(currentUrl, {
        method: 'GET',
        headers: requestHeaders,
        bodyTimeout: 30000,
        headersTimeout: 10000
      });
      
      // Update cookies from response
      const setCookieHeaders = currentResponse.headers['set-cookie'];
      if (setCookieHeaders) {
        const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        cookieArray.forEach(cookieHeader => {
          const [nameValue] = cookieHeader.split(';');
          if (nameValue) {
            const [name, value] = nameValue.split('=');
            if (name && value) {
              cookies.set(name.trim(), value.trim());
              console.log(`🍪 Cookie captured: ${name.trim()}`);
            }
          }
        });
      }

      console.log(`📡 Response ${redirectCount + 1}: HTTP ${currentResponse.statusCode}`);

      // Check if this is a redirect status code
      const isRedirect = [301, 302, 303, 307, 308].includes(currentResponse.statusCode);
      
      if (!isRedirect) {
        // Not a redirect, we're done
        const finalCookieHeader = Array.from(cookies.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');
        
        console.log(`✅ Redirect chain complete: ${redirectCount + 1} requests, ${cookies.size} cookies`);
        return {
          finalResponse: currentResponse,
          finalUrl: currentUrl,
          cookieHeader: finalCookieHeader
        };
      }

      // Handle redirect
      const location = currentResponse.headers.location;
      if (!location) {
        throw new Error(`Redirect response missing Location header: HTTP ${currentResponse.statusCode} from ${currentUrl}`);
      }

      const locationString = Array.isArray(location) ? location[0] : location;
      const nextUrl = new URL(locationString, currentUrl).toString();
      
      console.log(`🔄 Redirect ${redirectCount + 1}: ${currentResponse.statusCode} → ${nextUrl}`);
      
      currentUrl = nextUrl;
      redirectCount++;
    }

    throw new Error(`Too many redirects: exceeded ${maxRedirects} redirects starting from ${url}`);
  }

  // Supporting utility methods for real web scraping
  private extractContentByPortalType($: cheerio.CheerioAPI, portalType: string, url: string): any {
    const content = {
      title: $('title').text(),
      headings: [] as string[],
      links: [] as string[],
      text: '',
      opportunities: [] as any[]
    };

    try {
      // Extract headings
      $('h1, h2, h3, h4').each((_, element) => {
        const text = $(element).text().trim();
        if (text) content.headings.push(text);
      });

      // Portal-specific extraction patterns
      switch (portalType.toLowerCase()) {
        case 'bonfire':
        case 'bonfire_hub':
          content.opportunities = this.extractBonfireOpportunities($, url);
          break;
        case 'sam.gov':
        case 'sam':
          content.opportunities = this.extractSAMGovOpportunities($, url);
          break;
        case 'findrfp':
          content.opportunities = this.extractFindRFPOpportunities($, url);
          break;
        case 'austin finance online':
        case 'austin_finance_online':
        case 'austin finance':
        case 'austin_finance':
          content.opportunities = this.extractAustinFinanceOpportunities($, url);
          break;
        default:
          content.opportunities = this.extractGenericOpportunities($, url);
      }

      // Extract all links for further analysis
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href && text) {
          content.links.push(`${href} (${text})`);
        }
      });

      // Extract main text content
      content.text = $('body').text().replace(/\s+/g, ' ').trim();

    } catch (error) {
      console.error(`Error extracting content for ${portalType}:`, error instanceof Error ? error.message : String(error));
    }

    return content;
  }

  private extractBonfireOpportunities($: cheerio.CheerioAPI, baseUrl: string): any[] {
    const opportunities: any[] = [];
    
    // Common Bonfire selectors
    $('.opportunity-card, .bid-card, .rfp-card, [class*="opportunity"], [class*="bid"]').each((_, element) => {
      const $card = $(element);
      
      const title = $card.find('h3, h4, .title, [class*="title"]').first().text().trim();
      const description = $card.find('.description, .summary, p').first().text().trim();
      const deadline = $card.find('[class*="deadline"], [class*="due"], .date').first().text().trim();
      const agency = $card.find('[class*="agency"], [class*="department"]').first().text().trim();
      const link = $card.find('a').first().attr('href');
      
      if (title && link) {
        opportunities.push({
          title,
          description,
          deadline,
          agency,
          link: new URL(link, baseUrl).toString(),
          source: 'bonfire'
        });
      }
    });
    
    return opportunities;
  }

  private extractSAMGovOpportunities($: cheerio.CheerioAPI, baseUrl: string): any[] {
    const opportunities: any[] = [];
    
    // SAM.gov specific selectors
    $('.opportunity-row, .search-result, [class*="opportunity"]').each((_, element) => {
      const $row = $(element);
      
      const title = $row.find('.opportunity-title, h3, h4').first().text().trim();
      const description = $row.find('.opportunity-description, .description').first().text().trim();
      const agency = $row.find('.agency, .department').first().text().trim();
      const deadline = $row.find('.response-date, .due-date, .deadline').first().text().trim();
      const link = $row.find('a').first().attr('href');
      
      if (title && link) {
        opportunities.push({
          title,
          description,
          agency,
          deadline,
          link: new URL(link, baseUrl).toString(),
          source: 'sam.gov'
        });
      }
    });
    
    return opportunities;
  }

  private extractFindRFPOpportunities($: cheerio.CheerioAPI, baseUrl: string): any[] {
    const opportunities: any[] = [];
    
    // FindRFP specific selectors
    $('.rfp-listing, .opportunity-listing, .search-result').each((_, element) => {
      const $listing = $(element);
      
      const title = $listing.find('.rfp-title, .title, h3').first().text().trim();
      const description = $listing.find('.description, .summary').first().text().trim();
      const agency = $listing.find('.agency, .organization').first().text().trim();
      const deadline = $listing.find('.deadline, .due-date').first().text().trim();
      const link = $listing.find('a').first().attr('href');
      
      if (title && link) {
        opportunities.push({
          title,
          description,
          agency,
          deadline,
          link: new URL(link, baseUrl).toString(),
          source: 'findrfp'
        });
      }
    });
    
    return opportunities;
  }

  private extractAustinFinanceOpportunities($: cheerio.CheerioAPI, baseUrl: string): any[] {
    const opportunities: any[] = [];
    
    console.log(`🔍 Austin Finance: Starting extraction from ${baseUrl}`);
    
    // Target solicitation detail links directly
    const detailLinks = $('a[href*="solicitation_details.cfm"]');
    console.log(`🔗 Austin Finance: Found ${detailLinks.length} detail links`);
    
    detailLinks.each((_, linkElement) => {
      const $link = $(linkElement);
      const href = $link.attr('href');
      
      if (!href) return;
      
      // Find the container element (tr, li, div, etc.) that holds this link
      const $container = $link.closest('tr, li, div, td').length ? $link.closest('tr, li, div, td') : $link.parent();
      let text = $container.text();
      
      // Normalize text - replace NBSP and collapse whitespace
      text = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (text.length < 10) {
        // If container is too small, try a larger parent
        text = $container.parent().text().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      }
      
      console.log(`📄 Austin Finance: Processing container text (${text.length} chars): ${text.substring(0, 100)}...`);
      
      // Use more tolerant ID regex patterns
      const tolerantPattern = /\b(?:IFQ|IFB|RFP|RFQS)\s*[#:\.-]?\s*\d{3,5}(?:\s+[A-Z]{2,}\d{3,5})?\b/i;
      const fallbackPattern = /\b(?:IFQ|IFB|RFP|RFQS)\s*\d+\b/i;
      
      const idMatch = text.match(tolerantPattern) || text.match(fallbackPattern);
      
      if (!idMatch) {
        console.log(`⚠️ Austin Finance: No solicitation ID found in: ${text.substring(0, 50)}...`);
        return;
      }
      
      const solicitationId = idMatch[0].trim();
      console.log(`✅ Austin Finance: Found solicitation ID: ${solicitationId}`);
      
      // Extract title (usually in bold/strong or after ID)
      let title = $container.find('strong, b').first().text().trim();
      if (!title) {
        // Try to find title after the ID
        const afterId = text.substring(text.indexOf(solicitationId) + solicitationId.length).trim();
        const lines = afterId.split(/\n|Due Date|View Details/i);
        title = lines[0] ? lines[0].trim() : '';
      }
      
      // Extract due date
      const dueDateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const dueDate = dueDateMatch ? dueDateMatch[1] : '';
      
      // Extract description (text between title and due date)
      let description = text;
      if (title) description = description.replace(title, '');
      description = description.replace(solicitationId, '');
      if (dueDate) description = description.replace(dueDate, '');
      description = description.replace(/due date:?/i, '').replace(/view details/i, '').trim();
      description = description.substring(0, 500); // Limit length
      
      if (solicitationId && title) {
        const opportunity = {
          title: title,
          solicitationId: solicitationId,
          description: description,
          dueDate: dueDate,
          agency: 'City of Austin',
          link: new URL(href, baseUrl).toString(),
          category: solicitationId.toUpperCase().startsWith('IFQ') ? 'Quote' : 
                   solicitationId.toUpperCase().startsWith('IFB') ? 'Bid' : 
                   solicitationId.toUpperCase().startsWith('RFP') ? 'Proposal' : 'Other',
          source: 'austin_finance'
        };
        
        opportunities.push(opportunity);
        console.log(`🎯 Austin Finance: Created opportunity: ${solicitationId} - ${title}`);
      }
    });
    
    // Remove duplicates based on solicitation ID
    const unique = opportunities.filter((opp, index, self) => 
      index === self.findIndex(o => o.solicitationId === opp.solicitationId)
    );
    
    console.log(`🏛️ Austin Finance: Extracted ${unique.length} opportunities from ${opportunities.length} raw matches`);
    if (unique.length > 0) {
      console.log(`🎯 Austin Finance sample opportunity:`, unique[0]);
    } else {
      console.log(`❌ Austin Finance: No opportunities found. HTML elements: ${$('*').length}, detail links: ${detailLinks.length}`);
    }
    
    return unique;
  }

  private extractGenericOpportunities($: cheerio.CheerioAPI, baseUrl: string): any[] {
    const opportunities: any[] = [];
    
    // Generic selectors for various portal types
    const selectors = [
      '.opportunity', '.rfp', '.bid', '.procurement', '.solicitation',
      '[class*="opportunity"]', '[class*="rfp"]', '[class*="bid"]', 
      '[class*="procurement"]', '[class*="solicitation"]'
    ];
    
    selectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $el = $(element);
        
        const title = $el.find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim();
        const description = $el.find('.description, .summary, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        
        if (title && link && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description,
            link: new URL(link, baseUrl).toString(),
            source: 'generic'
          });
        }
      });
    });
    
    return opportunities;
  }

  private findOpportunityLinks($: cheerio.CheerioAPI, baseUrl: string, portalType: string): string[] {
    const links: string[] = [];
    
    console.log(`🔗 Finding opportunity links for portal type: ${portalType}`);
    
    // Portal-specific link patterns
    if (portalType?.toLowerCase().includes('austin finance')) {
      // Austin Finance specific patterns
      $('a[href*="solicitation_details.cfm"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const fullUrl = new URL(href, baseUrl).toString();
            if (!links.includes(fullUrl)) {
              links.push(fullUrl);
              console.log(`🏛️ Austin Finance detail link found: ${fullUrl}`);
            }
          } catch (error) {
            // Skip malformed URLs
          }
        }
      });
    }
    
    // Generic link detection for all portals
    const rfpKeywords = ['rfp', 'bid', 'proposal', 'opportunity', 'solicitation', 'procurement', 'tender'];
    
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      const title = $(element).attr('title')?.toLowerCase() || '';
      
      if (href && (rfpKeywords.some(keyword => text.includes(keyword) || title.includes(keyword) || href.includes(keyword)))) {
        try {
          const fullUrl = new URL(href, baseUrl).toString();
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        } catch (error) {
          // Skip malformed URLs
        }
      }
    });
    
    console.log(`🔗 Found ${links.length} opportunity links total`);
    return links.slice(0, 20); // Limit to 20 links per page
  }

  private async fetchOpportunityDetails(url: string, sessionData: any): Promise<any> {
    return await this.requestLimiter(async () => {
      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...(sessionData?.cookies ? { 'Cookie': sessionData.cookies } : {}),
            ...(sessionData?.headers ? sessionData.headers : {})
          },
          bodyTimeout: 20000,
          headersTimeout: 10000
        });

        if (response.statusCode !== 200) {
          return null;
        }

        const html = await response.body.text();
        const $ = cheerio.load(html);
        
        // Extract detailed information
        const title = $('h1, h2, .title, [class*="title"]').first().text().trim();
        const description = $('.description, .summary, .content, [class*="description"]').first().text().trim();
        const deadline = $('[class*="deadline"], [class*="due"], .date, [class*="date"]').first().text().trim();
        const agency = $('[class*="agency"], [class*="department"], [class*="organization"]').first().text().trim();
        const value = $('[class*="value"], [class*="amount"], [class*="budget"]').first().text().trim();
        
        return {
          title,
          description,
          deadline,
          agency,
          estimatedValue: value,
          url,
          content: html,
          extractedAt: new Date().toISOString()
        };
        
      } catch (error) {
        console.error(`Error fetching opportunity details from ${url}:`, error);
        return null;
      }
    });
  }

  private detectAuthenticationMethod($: cheerio.CheerioAPI, portalUrl: string): any {
    // Check for common authentication patterns
    const forms = $('form');
    
    if (forms.length === 0) {
      return { type: 'none', details: 'No forms detected' };
    }
    
    // Look for login forms
    const loginForm = forms.filter((_, form) => {
      const $form = $(form);
      const action = $form.attr('action')?.toLowerCase() || '';
      const id = $form.attr('id')?.toLowerCase() || '';
      const className = $form.attr('class')?.toLowerCase() || '';
      
      return action.includes('login') || action.includes('auth') ||
             id.includes('login') || id.includes('auth') ||
             className.includes('login') || className.includes('auth');
    });
    
    if (loginForm.length > 0) {
      const $form = loginForm.first();
      const action = $form.attr('action') || '';
      const method = $form.attr('method')?.toUpperCase() || 'GET';
      
      // Extract form fields
      const fields: any = {};
      $form.find('input, select, textarea').each((_, input) => {
        const $input = $(input);
        const name = $input.attr('name');
        const type = $input.attr('type') || 'text';
        const value = $input.attr('value') || '';
        
        if (name) {
          fields[name] = { type, value };
        }
      });
      
      return {
        type: 'form',
        formData: {
          action: new URL(action || portalUrl, portalUrl).toString(),
          method,
          fields
        }
      };
    }
    
    // Check for OAuth or other authentication methods that require browser automation
    if ($('a[href*="oauth"], a[href*="sso"], a[href*="saml"]').length > 0) {
      return { type: 'browser_required', details: 'OAuth/SSO authentication detected - requires browser automation' };
    }
    
    // Check for complex authentication indicators that suggest browser automation is needed
    const complexAuthIndicators = [
      'data-sitekey', // reCAPTCHA
      'g-recaptcha', // Google reCAPTCHA
      'captcha',     // Generic CAPTCHA
      'microsoft', 'google', 'azure', // SSO providers
      'okta', 'saml', 'adfs'          // Enterprise SSO
    ];
    
    const pageText = $('body').text().toLowerCase();
    const hasComplexAuth = complexAuthIndicators.some(indicator => 
      pageText.includes(indicator) || $(`[class*="${indicator}"], [id*="${indicator}"]`).length > 0
    );
    
    if (hasComplexAuth) {
      return { type: 'browser_required', details: 'Complex authentication detected - requires browser automation' };
    }
    
    // Check for specific portals that we know require browser automation
    const browserRequiredDomains = ['findrfp.com', 'bonfirehub.com'];
    const requiresBrowser = browserRequiredDomains.some(domain => portalUrl.includes(domain));
    
    if (requiresBrowser) {
      return { type: 'browser_required', details: 'Portal requires browser automation for authentication' };
    }
    
    return { type: 'unknown', details: 'Authentication method could not be determined' };
  }

  private async handleFormAuthentication(context: any): Promise<any> {
    const { $, portalUrl, username, password, formData, loginPageResponse, cookieHeader } = context;
    
    try {
      // Let all portals go through standard browser automation detection
      
      // Generic form authentication for other portals
      return await this.handleGenericFormAuthentication(context);
      
    } catch (error) {
      console.error('Form authentication error:', error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'form_authentication_error',
        portalUrl
      };
    }
  }

  private async handleOryKratosAuthentication(context: any): Promise<any> {
    const { portalUrl, username, password, cookieHeader } = context;
    
    try {
      console.log(`🔐 Starting Ory Kratos authentication flow for ${portalUrl}`);
      
      // Step 1: Get the login flow URL with flow ID
      const loginFlowUrl = 'https://account-flows.bonfirehub.com/self-service/login/browser?return_to=https%3A%2F%2Fvendor.bonfirehub.com%2Fopportunities%2Fall';
      console.log(`🌐 Step 1: Getting login flow from ${loginFlowUrl}`);
      
      const { finalResponse: flowResponse, finalUrl: flowFinalUrl, cookieHeader: flowCookies } = await this.getWithRedirects(loginFlowUrl, 10);
      
      if (!flowFinalUrl.includes('/login?flow=')) {
        throw new Error(`Expected login flow URL with flow ID, got: ${flowFinalUrl}`);
      }
      
      // Extract flow ID from URL
      const flowId = new URL(flowFinalUrl).searchParams.get('flow');
      if (!flowId) {
        throw new Error(`Could not extract flow ID from ${flowFinalUrl}`);
      }
      
      console.log(`🎯 Step 1 Complete: Flow ID extracted: ${flowId}`);
      
      // Step 2: Fetch flow JSON to get form action and CSRF token
      const flowJsonUrl = `https://account.bonfirehub.com/login?flow=${flowId}`;
      console.log(`📋 Step 2: Fetching flow JSON from ${flowJsonUrl}`);
      
      const flowJsonResponse = await request(flowJsonUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          ...(flowCookies ? { 'Cookie': flowCookies } : {})
        },
        bodyTimeout: 30000,
        headersTimeout: 10000
      });
      
      if (flowJsonResponse.statusCode !== 200) {
        throw new Error(`Failed to fetch flow JSON: HTTP ${flowJsonResponse.statusCode}`);
      }
      
      const flowData = await flowJsonResponse.body.json() as any;
      console.log(`🎯 Step 2 Complete: Flow JSON fetched, action: ${flowData.ui?.action}`);
      
      // Extract form action URL and CSRF token
      const formAction = flowData.ui?.action;
      if (!formAction) {
        throw new Error(`No form action found in flow JSON`);
      }
      
      // Find CSRF token in hidden fields
      let csrfToken = null;
      const hiddenFields: any = {};
      
      if (flowData.ui?.nodes) {
        for (const node of flowData.ui.nodes) {
          if (node.attributes?.name && node.attributes?.type === 'hidden') {
            hiddenFields[node.attributes.name] = node.attributes.value;
            if (node.attributes.name.includes('csrf')) {
              csrfToken = node.attributes.value;
            }
          }
        }
      }
      
      console.log(`🔒 CSRF token found: ${csrfToken ? 'Yes' : 'No'}`);
      console.log(`📝 Hidden fields found: ${Object.keys(hiddenFields).length}`);
      
      // Step 3: Submit credentials to form action
      console.log(`📤 Step 3: Submitting credentials to ${formAction}`);
      
      const loginPayload: any = {
        method: 'password',
        identifier: username,
        password: password,
        ...hiddenFields // Include all hidden fields including CSRF token
      };
      
      // Get fresh cookies from flow response
      const formCookies = this.extractCookies(flowJsonResponse) || flowCookies;
      const redactedCookies = this.redactSensitiveCookies(formCookies);
      console.log(`🍪 Using cookies for login: ${redactedCookies}`);
      
      const loginSubmitResponse = await request(formAction, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': flowFinalUrl,
          ...(formCookies ? { 'Cookie': formCookies } : {})
        },
        body: new URLSearchParams(loginPayload).toString(),
        bodyTimeout: 30000,
        headersTimeout: 10000
      });
      
      console.log(`📡 Step 3: Login submit response: HTTP ${loginSubmitResponse.statusCode}`);
      
      // Step 4: Follow redirects to complete authentication
      if ([302, 303, 307, 308].includes(loginSubmitResponse.statusCode)) {
        console.log(`🔄 Step 4: Following redirects to complete authentication`);
        
        const location = loginSubmitResponse.headers.location;
        const redirectUrl = Array.isArray(location) ? location[0] : location;
        
        if (!redirectUrl) {
          throw new Error('Login response had redirect status but no Location header');
        }
        
        const fullRedirectUrl = new URL(redirectUrl, formAction).toString();
        console.log(`🌐 Following redirect to: ${fullRedirectUrl}`);
        
        // Merge cookies from login response
        const loginCookies = this.extractCookies(loginSubmitResponse);
        const allCookies = this.mergeCookies(formCookies, loginCookies);
        
        // Follow the redirect chain
        const { finalResponse, finalUrl, cookieHeader: finalCookies } = await this.getWithRedirects(fullRedirectUrl, 10, allCookies);
        
        console.log(`✅ Step 4 Complete: Final URL: ${finalUrl}`);
        console.log(`📡 Final response: HTTP ${finalResponse.statusCode}`);
        
        // Verify we ended up at the target page or a success page
        const isSuccess = finalUrl.includes('vendor.bonfirehub.com') || 
                         finalUrl.includes('opportunities') ||
                         finalResponse.statusCode === 200;
        
        if (isSuccess) {
          console.log(`🎉 Ory Kratos authentication successful!`);
          return {
            authenticated: true,
            cookies: finalCookies,
            headers: {
              'Referer': finalUrl
            },
            method: 'ory_kratos',
            portalUrl: finalUrl,
            flowId
          };
        } else {
          console.log(`❌ Authentication may have failed - unexpected final URL: ${finalUrl}`);
          return {
            authenticated: false,
            error: `Unexpected redirect destination: ${finalUrl}`,
            method: 'ory_kratos_redirect_failed',
            portalUrl,
            flowId
          };
        }
        
      } else if (loginSubmitResponse.statusCode === 200) {
        // Check if we got an error response
        const responseText = await loginSubmitResponse.body.text();
        if (responseText.toLowerCase().includes('error') || responseText.toLowerCase().includes('invalid')) {
          console.log(`❌ Login failed - error response received`);
          return {
            authenticated: false,
            error: 'Invalid credentials or login error',
            method: 'ory_kratos_error',
            portalUrl,
            flowId
          };
        }
        
        // If no redirect and no error, consider it successful
        return {
          authenticated: true,
          cookies: this.extractCookies(loginSubmitResponse),
          method: 'ory_kratos_direct',
          portalUrl,
          flowId
        };
        
      } else {
        throw new Error(`Unexpected login response: HTTP ${loginSubmitResponse.statusCode}`);
      }
      
    } catch (error) {
      console.error(`❌ Ory Kratos authentication failed:`, error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'ory_kratos_error',
        portalUrl
      };
    }
  }

  private async handleGenericFormAuthentication(context: any): Promise<any> {
    const { $, portalUrl, username, password, formData, loginPageResponse, cookieHeader } = context;
    
    try {
      // Build form payload
      const payload: any = {};
      
      Object.keys(formData.fields).forEach(fieldName => {
        const field = formData.fields[fieldName];
        
        // Map common field names to credentials
        const lowerFieldName = fieldName.toLowerCase();
        if (lowerFieldName.includes('user') || lowerFieldName.includes('email') || lowerFieldName.includes('login')) {
          payload[fieldName] = username;
        } else if (lowerFieldName.includes('pass') || lowerFieldName.includes('pwd')) {
          payload[fieldName] = password;
        } else {
          // Keep existing value for hidden fields, tokens, etc.
          payload[fieldName] = field.value;
        }
      });
      
      // Use accumulated cookies from redirect chain, fallback to extracting from final response
      const cookies = cookieHeader || this.extractCookies(loginPageResponse);
      const redactedCookies = this.redactSensitiveCookies(cookies);
      console.log(`🍪 Using cookies for form submission: ${redactedCookies}`);
      
      // Submit login form
      const loginResponse = await request(formData.action, {
        method: formData.method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': portalUrl,
          ...(cookies ? { 'Cookie': cookies } : {})
        },
        body: new URLSearchParams(payload).toString(),
        bodyTimeout: 30000,
        headersTimeout: 10000
      });
      
      // Extract new cookies from login response
      const sessionCookies = this.extractCookies(loginResponse);
      
      // Check if login was successful (look for redirect or absence of login form)
      const loginResponseHtml = await loginResponse.body.text();
      const $loginResponse = cheerio.load(loginResponseHtml);
      
      const hasLoginForm = $loginResponse('form').filter((_, form) => {
        const $form = $loginResponse(form);
        const action = $form.attr('action')?.toLowerCase() || '';
        return action.includes('login') || action.includes('auth');
      }).length > 0;
      
      const isSuccessful = loginResponse.statusCode === 302 || // Redirect after successful login
                          (loginResponse.statusCode === 200 && !hasLoginForm); // No login form means we're logged in
      
      return {
        authenticated: isSuccessful,
        cookies: sessionCookies,
        headers: isSuccessful ? {
          'Referer': portalUrl
        } : undefined,
        method: 'generic_form_authentication',
        portalUrl,
        statusCode: loginResponse.statusCode
      };
      
    } catch (error) {
      console.error('Generic form authentication error:', error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'generic_form_authentication_error',
        portalUrl
      };
    }
  }

  /**
   * Handle browser-based authentication using Stagehand for OAuth/SSO/Complex forms
   */
  private async handleBrowserAuthentication(context: any): Promise<any> {
    const { loginUrl, targetUrl, username, password, portal } = context;
    
    try {
      console.log(`🌐 Starting browser authentication for ${loginUrl}`);
      
      // Generate a unique session ID for this portal
      const sessionId = `portal_${portal?.id || 'unknown'}_${Date.now()}`;
      
      // Perform browser authentication using Stagehand
      const authResult = await performBrowserAuthentication(
        loginUrl,
        username,
        password,
        targetUrl,
        sessionId
      );
      
      if (authResult.success) {
        console.log(`✅ Browser authentication successful for ${loginUrl}`);
        
        return {
          authenticated: true,
          method: 'browser_authentication',
          sessionData: authResult.sessionData,
          sessionId: sessionId,
          portalUrl: targetUrl,
          loginUrl: loginUrl,
          targetUrl: authResult.targetUrl
        };
      } else {
        console.log(`❌ Browser authentication failed for ${loginUrl}`);
        
        return {
          authenticated: false,
          error: 'Browser authentication failed',
          method: 'browser_authentication_failed',
          portalUrl: targetUrl
        };
      }
      
    } catch (error: any) {
      console.error(`Browser authentication error for ${loginUrl}:`, error);
      
      return {
        authenticated: false,
        error: error.message || 'Browser authentication failed',
        method: 'browser_authentication_error',
        portalUrl: targetUrl
      };
    }
  }

  private extractCookies(response: any): string | null {
    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return null;
    
    const cookies = Array.isArray(setCookieHeaders) 
      ? setCookieHeaders 
      : [setCookieHeaders];
    
    return cookies
      .map(cookie => cookie.split(';')[0]) // Take only the name=value part
      .join('; ');
  }

  private extractJsonBlocks(text: string): string[] {
    const jsonBlocks: string[] = [];
    
    // Look for JSON-like structures in the text
    const patterns = [
      /\{[^{}]*"opportunities"[^{}]*\[[\s\S]*?\][^{}]*\}/g,
      /\{[^{}]*"results"[^{}]*\[[\s\S]*?\][^{}]*\}/g,
      /\{[\s\S]*?\}/g
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        jsonBlocks.push(...matches);
      }
    }
    
    // Also try to find JSON code blocks
    const codeBlockPattern = /```(?:json)?([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockPattern.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.startsWith('{') && content.endsWith('}')) {
        jsonBlocks.push(content);
      }
    }
    
    return Array.from(new Set(jsonBlocks)); // Remove duplicates
  }
}