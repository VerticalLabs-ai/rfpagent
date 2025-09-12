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
      
      // Execute intelligent scraping
      const scrapingPrompt = this.buildScrapingPrompt(portal, context);
      const response = await agent.generateVNext(scrapingPrompt, {
        resourceId: portal.id,
        threadId: `portal-${portal.id}-${Date.now()}`
      });

      // Parse agent response and extract opportunities
      const opportunities = this.parseAgentResponse(response.text);

      // Process discovered opportunities
      for (const opportunity of opportunities) {
        await this.processOpportunity(opportunity, portal);
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
      return [];
      
    } catch (error) {
      console.error("Error parsing agent response:", error);
      return [];
    }
  }

  private async intelligentWebScrape(context: any): Promise<any> {
    return await this.requestLimiter(async () => {
      try {
        const { url, loginRequired, credentials, portalType } = context;
        
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

        // Step 2: Fetch main portal page
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

        const html = await response.body.text();
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

        return {
          content: html,
          extractedContent,
          opportunities: successfulOpportunities,
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

  private async handleAuthentication(context: any): Promise<any> {
    return await this.requestLimiter(async () => {
      try {
        const { portalUrl, username, password, authContext } = context;
        
        console.log(`Attempting authentication for ${portalUrl}`);
        
        // Step 1: Fetch login page to analyze form structure
        const loginPageResponse = await request(portalUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          bodyTimeout: 30000,
          headersTimeout: 10000
        });

        if (loginPageResponse.statusCode !== 200) {
          throw new Error(`Failed to fetch login page: HTTP ${loginPageResponse.statusCode}`);
        }

        const loginPageHtml = await loginPageResponse.body.text();
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
            portalUrl, 
            username, 
            password, 
            formData: authMethod.formData,
            loginPageResponse
          });
        }

        // Step 4: Handle other authentication types
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
    try {
      // Enhanced AI analysis with confidence scoring
      const rfpDetails = await this.aiService.extractRFPDetails(
        opportunity.content || opportunity.description, 
        opportunity.link || opportunity.url
      );
      
      if (!rfpDetails || rfpDetails.confidence < 0.7) {
        console.log(`Skipping low-confidence opportunity: ${opportunity.title}`);
        return;
      }

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

      console.log(`AI agent created new RFP: ${rfp.title}`);

    } catch (error) {
      console.error("Error processing opportunity:", error);
    }
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
    
    // Look for links that likely contain RFP details
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
    
    // Check for OAuth or other authentication methods
    if ($('a[href*="oauth"], a[href*="sso"], a[href*="saml"]').length > 0) {
      return { type: 'unsupported', details: 'OAuth/SSO authentication detected' };
    }
    
    return { type: 'unknown', details: 'Authentication method could not be determined' };
  }

  private async handleFormAuthentication(context: any): Promise<any> {
    const { $, portalUrl, username, password, formData, loginPageResponse } = context;
    
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
      
      // Extract cookies from login page response
      const cookies = this.extractCookies(loginPageResponse);
      
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
        method: 'form_authentication',
        portalUrl,
        statusCode: loginResponse.statusCode
      };
      
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