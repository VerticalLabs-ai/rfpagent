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
// Removed Puppeteer - now using unified Browserbase through Mastra
import { stagehandActTool, stagehandObserveTool, stagehandExtractTool, stagehandAuthTool, sessionManager } from "../mastra/tools/browserbaseTools";
import { performBrowserAuthentication } from './stagehandTools';  // Add missing import
import { austinFinanceDocumentScraper } from './austinFinanceDocumentScraper';

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
  private activeCoordinationIds: Map<string, string> = new Map(); // portalId -> coordinationId

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
   * Unified content scraping using Browserbase through Mastra
   * Replaces both Puppeteer and direct Stagehand approaches
   */
  /**
   * Unified Browserbase web scraping method using official Mastra integration
   * Replaces the old hybrid approach with consistent Browserbase automation
   */
  private async unifiedBrowserbaseWebScrape(context: any): Promise<any> {
    const { url, loginRequired, credentials, portalType, searchFilter, sessionId = 'default' } = context;
    
    try {
      console.log(`🌐 Starting unified Browserbase scrape of ${url}`);
      
      // Handle authentication if required
      if (loginRequired && credentials?.username && credentials?.password) {
        console.log(`🔐 Authentication required for portal: ${portalType}`);
        
        const authResult = await stagehandAuthTool.execute({
          context: {
            loginUrl: url,
            username: credentials.username,
            password: credentials.password,
            targetUrl: url,
            sessionId,
            portalType
          }
        });
        
        if (!authResult.success) {
          throw new Error(`Authentication failed: ${authResult.message || 'Unknown error'}`);
        }
        
        console.log(`✅ Authentication successful for ${portalType}`);
      }
      
      // Extract RFP opportunities using Browserbase
      const extractionResult = await stagehandExtractTool.execute({
        context: {
          instruction: searchFilter 
            ? `find and extract RFP opportunities related to "${searchFilter}" including titles, deadlines, agencies, descriptions, and links`
            : 'extract all RFP opportunities, procurement notices, and solicitations with their complete details',
          sessionId,
          schema: {
            opportunities: z.array(z.object({
              title: z.string().describe('RFP title or opportunity name'),
              description: z.string().optional().describe('Description or summary'),
              agency: z.string().optional().describe('Issuing agency'),
              deadline: z.string().optional().describe('Submission deadline'),
              estimatedValue: z.string().optional().describe('Contract value'),
              url: z.string().optional().describe('Link to details'),
              category: z.string().optional().describe('Category or type'),
              confidence: z.number().min(0).max(1).default(0.8).describe('Extraction confidence')
            })).describe('Array of extracted RFP opportunities')
          }
        }
      });
      
      const opportunities = extractionResult.data?.opportunities || [];
      console.log(`🎯 Extracted ${opportunities.length} opportunities from ${url}`);
      
      return {
        opportunities,
        status: 'success',
        message: `Successfully extracted ${opportunities.length} opportunities using Browserbase`,
        portalType,
        scrapedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Unified Browserbase scrape failed for ${url}:`, error);
      return {
        opportunities: [],
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Handle portal authentication using unified Browserbase automation
   */
  private async handleBrowserbaseAuthentication(context: any): Promise<any> {
    const { portalUrl, username, password, authContext, sessionId, portalType } = context;
    
    try {
      console.log(`🔐 Starting Browserbase authentication for ${portalType || 'generic'} portal`);
      
      const authResult = await stagehandAuthTool.execute({
        context: {
          loginUrl: portalUrl,
          username,
          password,
          targetUrl: portalUrl,
          sessionId,
          portalType
        }
      });
      
      if (authResult.success) {
        console.log(`✅ Browserbase authentication successful`);
        return {
          success: true,
          sessionId,
          message: 'Portal authentication completed successfully',
          authenticatedAt: new Date().toISOString()
        };
      } else {
        throw new Error(authResult.message || 'Authentication failed');
      }
      
    } catch (error) {
      console.error(`❌ Browserbase authentication failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async scrapeBrowserbaseContent(url: string, sessionId: string, instruction?: string): Promise<string> {
    try {
      console.log(`🌐 Scraping content from ${url} using Browserbase`);
      
      // Navigate to the page using official Browserbase tools
      await stagehandActTool.execute({
        context: { 
          url, 
          action: 'navigate to the page and wait for all content including JavaScript to load completely', 
          sessionId 
        }
      });

      // Wait for dynamic content to load
      await stagehandActTool.execute({
        context: {
          action: 'wait for any dynamic content, tables, or RFP listings to finish loading',
          sessionId
        }
      });

      // Extract the page content using Browserbase with intelligent RFP detection
      const extractionResult = await stagehandExtractTool.execute({
        context: {
          instruction: instruction || 'extract all page content including RFP listings, procurement opportunities, and solicitation notices with their titles, deadlines, agencies, and descriptions',
          sessionId,
          schema: {
            fullContent: z.string().describe('Complete page HTML content'),
            pageTitle: z.string().describe('Page title'),
            opportunities: z.array(z.object({
              title: z.string().describe('Opportunity title or RFP name'),
              deadline: z.string().optional().describe('Submission deadline'),
              agency: z.string().optional().describe('Issuing agency or organization'),
              description: z.string().optional().describe('RFP description or summary'),
              estimatedValue: z.string().optional().describe('Contract value or budget amount'),
              url: z.string().optional().describe('Link to full RFP details'),
              category: z.string().optional().describe('RFP category or type')
            })).optional().describe('Extracted RFP opportunities if found on page')
          }
        }
      });

      const { data } = extractionResult;
      console.log(`✅ Successfully extracted content using Browserbase - Found ${data.opportunities?.length || 0} opportunities`);
      
      // Return the full content for further processing, but also log the structured data
      if (data.opportunities && data.opportunities.length > 0) {
        console.log(`🎯 Structured opportunities extracted:`, data.opportunities.map(opp => ({
          title: opp.title,
          deadline: opp.deadline,
          agency: opp.agency
        })));
      }
      
      return data.fullContent || JSON.stringify(data);
      
    } catch (error) {
      console.error(`❌ Browserbase scraping failed for ${url}:`, error instanceof Error ? error.message : String(error));
      throw new Error(`Browserbase content scraping failed: ${error instanceof Error ? error.message : String(error)}`);
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
      description: "Scrape a website for RFP opportunities using unified Browserbase automation",
      inputSchema: z.object({
        url: z.string().describe("URL to scrape"),
        loginRequired: z.boolean().describe("Whether login is required"),
        credentials: z.object({
          username: z.string().optional(),
          password: z.string().optional()
        }).optional().describe("Login credentials if required"),
        portalType: z.string().describe("Type of portal (bonfire, sam.gov, etc.)"),
        searchFilter: z.string().optional().describe("Search filter to apply during scraping - only return opportunities related to this term"),
        sessionId: z.string().optional().describe("Session ID for maintaining browser context")
      }),
      execute: async ({ context }) => {
        // Use unified Browserbase automation through official Mastra integration
        return await this.unifiedBrowserbaseWebScrape(context);
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
      description: "Handle portal authentication using unified Browserbase automation",
      inputSchema: z.object({
        portalUrl: z.string(),
        username: z.string(),
        password: z.string(),
        authContext: z.string().describe("Portal-specific authentication context"),
        sessionId: z.string().describe("Session ID for maintaining authenticated state"),
        portalType: z.string().optional().describe("Portal type for specialized authentication")
      }),
      execute: async ({ context }) => {
        return await this.handleBrowserbaseAuthentication(context);
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
      - Euna Supplier Network (ESN) authentication system used by Bonfire portals
      - How to navigate Bonfire's opportunity listings and filters
      - Bonfire's typical RFP presentation format
      - Agency-specific customizations within Bonfire portals

      COMPREHENSIVE ESN AUTHENTICATION EXPERTISE:
      
      INITIAL SETUP:
      - Bonfire portals redirect to "network.euna.com" for authentication
      - Look for cookie consent banners and dismiss them first ("Accept", "I agree", etc.)
      - Login pages show "Welcome Back!" and "Login to Euna Supplier Network" dialogs
      
      MULTI-STEP AUTHENTICATION FLOW:
      1. Email Entry: Enter email in username/email field (various selectors: input[type="email"], input[name*="email"], input[name*="username"])
      2. Continue Step: Click "Continue", "Next", or similar button to proceed
      3. Password Detection: Wait for password field to appear (may take several seconds with retry logic)
      4. Password Entry: Use multiple selector patterns for password fields
      5. Login Submission: Click final login/submit button
      
      ERROR DETECTION & HANDLING:
      - 2FA Detection: Watch for "verification code", "two-factor", "authenticator" indicators
      - SSO Detection: Monitor for redirects to "microsoft", "google", "okta", "azure" domains
      - Timeout Management: Authentication has 90-second timeout, post-login navigation is separate
      - Failure Indicators: Still on login page, title contains "login"/"sign in" after submission
      
      CLOUDFLARE PROTECTION:
      - May encounter "Just a moment" or "Please wait" pages after login
      - Wait for protection to clear before proceeding
      - Verify final page shows opportunities/dashboard content
      
      SUCCESS VERIFICATION:
      - URL no longer contains "login"
      - Page title doesn't contain "login" or "sign in"
      - Look for opportunity listings, vendor portal content, or dashboard elements
      - Session cookies are properly set for authenticated scraping
      
      SCRAPING PATTERNS:
      - Opportunity cards with standardized layouts and clear title/deadline structure
      - Deadline formats with timezone handling (watch for EST/PST variations)
      - Document attachment links (PDFs, Word docs, specifications)
      - Vendor registration requirements and eligibility criteria
      - Category and classification systems specific to each agency
      - Pre-bid conference information and contact details`,

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

  async scrapePortal(portal: Portal, searchFilter?: string): Promise<void> {
    const filterMessage = searchFilter ? ` with filter: "${searchFilter}"` : '';
    console.log(`Starting intelligent scrape of ${portal.name} using Mastra agents${filterMessage}`);
    
    try {
      // Update last scanned timestamp
      await storage.updatePortal(portal.id, { 
        lastScanned: new Date(),
        status: "active"
      });

      // Select appropriate agent based on portal type
      const agent = this.selectAgent(portal);
      
      // Create scraping context with portal-specific knowledge and search filter
      const context = await this.buildPortalContext(portal, searchFilter);
      
      // Create coordination record for tracking agent performance
      let opportunities: any[] = [];
      let coordinationId: string | null = null;
      
      try {
        // Create coordination request for this portal scraping session
        const sessionId = `portal-scrape-${portal.id}-${Date.now()}`;
        const agentId = this.getAgentIdForPortal(portal);
        
        console.log(`🤝 Creating coordination request for portal ${portal.name} with agent ${agentId}`);
        const coordinationRecord = await storage.createAgentCoordination({
          sessionId: sessionId,
          initiatorAgentId: 'mastra-scraping-service',
          targetAgentId: agentId,
          coordinationType: 'portal_scraping',
          context: context,
          request: {
            action: 'scrape_portal',
            portalId: portal.id,
            portalName: portal.name,
            searchFilter: searchFilter
          },
          priority: 5,
          status: 'pending',
          metadata: {
            portalUrl: portal.url,
            requiresAuth: portal.loginRequired,
            startTime: new Date().toISOString()
          }
        });
        
        coordinationId = coordinationRecord.id;
        if (coordinationId) {
          this.activeCoordinationIds.set(portal.id, coordinationId);
        }
        console.log(`✅ Coordination request created with ID: ${coordinationId}`);
      } catch (coordError) {
        console.error(`❌ Failed to create coordination request for ${portal.name}:`, coordError);
        // Continue without coordination tracking
      }
      
      if (portal.url.includes('austintexas.gov')) {
        console.log(`🎯 Austin Finance detected: Bypassing agent, using direct scraping only`);
        opportunities = []; // Force direct scraping path
      } else {
        // Execute intelligent scraping with enhanced coordination tracking 
        try {
          console.log(`🚀 Using specialized agent for ${portal.name}`);
          const scrapingPrompt = this.buildScrapingPrompt(portal, context, searchFilter);
          const response = await agent.generateVNext(scrapingPrompt, {
            resourceId: portal.id,
            threadId: `portal-${portal.id}-${Date.now()}`
          });

          // Parse agent response and extract opportunities
          console.log(`🤖 Raw agent response (first 500 chars):`, response.text.substring(0, 500));
          opportunities = this.parseAgentResponse(response.text);
          console.log(`🤖 parseAgentResponse returned ${opportunities.length} opportunities`);
          
          // Track successful agent execution
          console.log(`📊 Agent execution successful for ${portal.name}, ${opportunities.length} opportunities found`);
        } catch (agentError) {
          console.error(`🚨 Agent execution failed for ${portal.name}:`, agentError);
          console.log(`🔄 Falling back to direct scraping due to agent error`);
          
          // Update coordination with agent failure
          if (coordinationId) {
            try {
              await storage.updateAgentCoordination(coordinationId, {
                status: 'failed',
                response: JSON.stringify({
                  success: false,
                  error: agentError instanceof Error ? agentError.message : String(agentError),
                  fallbackUsed: true
                }),
                completedAt: new Date()
              });
            } catch (updateError) {
              console.error(`❌ Failed to update coordination with agent failure:`, updateError);
            }
          }
          
          opportunities = []; // Force fallback to unified Browserbase scrape
        }
      }
      
      // If agent didn't call tools or returned no opportunities, call intelligentWebScrape directly
      if (opportunities.length === 0) {
        console.log(`🔄 Agent returned no opportunities, calling unified Browserbase scrape directly for ${portal.name}`);
        try {
          console.log(`🔄 Calling unifiedBrowserbaseWebScrape for ${portal.name}...`);
          const directScrapeResult = await this.unifiedBrowserbaseWebScrape({
            url: portal.url,
            loginRequired: portal.loginRequired,
            credentials: portal.loginRequired ? {
              username: portal.username,
              password: portal.password
            } : null,
            portalType: portal.name.toLowerCase(),
            sessionId: `portal-${portal.id}-${Date.now()}`,
            searchFilter: searchFilter
          });
          
          console.log(`🔄 unifiedBrowserbaseWebScrape completed. Result type:`, typeof directScrapeResult);
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

      // Process discovered opportunities with coordination tracking
      console.log(`🔧 Processing ${opportunities.length} opportunities for ${portal.name}`);
      for (let i = 0; i < opportunities.length; i++) {
        const opportunity = opportunities[i];
        console.log(`🔧 Processing opportunity ${i + 1}/${opportunities.length}: ${opportunity.title || opportunity.solicitationId || 'Unknown'}`);
        try {
          await this.processOpportunity(opportunity, portal, coordinationId);
          console.log(`✅ Successfully processed opportunity: ${opportunity.title || opportunity.solicitationId}`);
        } catch (error) {
          console.error(`❌ Error processing opportunity ${opportunity.title || opportunity.solicitationId}:`, error);
        }
      }
      
      // Finalize coordination with overall results
      if (coordinationId) {
        try {
          // Update coordination with final scraping results
          await storage.updateAgentCoordination(coordinationId, {
            status: 'completed',
            response: JSON.stringify({
              success: true,
              totalOpportunities: opportunities.length,
              portalName: portal.name,
              portalId: portal.id,
              searchFilter: searchFilter,
              agentUsed: opportunities.length > 0 ? 'specialized_agent' : 'direct_scraping',
              scrapingMethod: portal.url.includes('austintexas.gov') ? 'direct_scraping' : 'agent_coordination',
              completedAt: new Date().toISOString()
            }),
            completedAt: new Date()
          });
          console.log(`🔗 Coordination ${coordinationId} completed with ${opportunities.length} opportunities`);
        } catch (finalizeError) {
          console.error(`❌ Failed to finalize coordination ${coordinationId}:`, finalizeError);
        } finally {
          this.activeCoordinationIds.delete(portal.id);
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

  /**
   * Get agent ID string for coordination tracking based on portal type
   */
  private getAgentIdForPortal(portal: Portal): string {
    const portalName = portal.name.toLowerCase().replace(/\s+/g, '_');
    
    // Map portal names to agent IDs for coordination tracking
    if (portalName.includes('bonfire')) return 'bonfire_hub';
    if (portalName.includes('sam.gov') || portalName.includes('sam_gov')) return 'sam.gov';
    if (portalName.includes('findrfp')) return 'findrfp';
    if (portalName.includes('austin')) return 'generic'; // Austin uses direct scraping
    
    return 'generic';
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

  private async buildPortalContext(portal: Portal, searchFilter?: string): Promise<string> {
    // Get historical context from memory and previous scrapes
    const recentRfps = await storage.getRFPsByPortal(portal.id);
    const recentCount = recentRfps.filter(rfp => {
      const daysSinceCreated = (Date.now() - new Date(rfp.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 30;
    }).length;

    const searchFilterInfo = searchFilter ? `
    - Search Filter: "${searchFilter}" - Focus only on opportunities related to this term` : '';

    return `Portal Context:
    - Name: ${portal.name}
    - URL: ${portal.url}
    - Requires Login: ${portal.loginRequired}
    - Recent RFPs Found: ${recentCount} in last 30 days
    - Portal Status: ${portal.status}
    - Last Successful Scan: ${portal.lastScanned || 'Never'}${searchFilterInfo}`;
  }

  private buildScrapingPrompt(portal: Portal, context: string, searchFilter?: string): string {
    // Build specialized prompt based on portal type
    const isAustinFinance = portal.name.toLowerCase().includes('austin finance');
    
    const austinFinanceFilterInstructions = searchFilter ? `

🔍 SEARCH FILTER ACTIVE: Only extract solicitations related to "${searchFilter}"
- Filter results to only include RFPs with titles/descriptions containing or related to "${searchFilter}"
- Ignore solicitations that are not related to this search term
- If no results match the filter, return an empty array` : '';

    if (isAustinFinance) {
      return `Please scrape the Austin Finance Online portal for procurement opportunities:

${context}

IMPORTANT: You are analyzing the ACTIVE SOLICITATIONS page which contains a table/list of current RFPs.${austinFinanceFilterInstructions}

Your task:
1. Look for the "ACTIVE SOLICITATIONS" table or list on the page
2. Each row contains solicitation information in this pattern:
   - Solicitation ID (e.g. "IFQ 1100 BAS1065", "RFP 8100 SAR3013")
   - Due Date (e.g. "09/12/2025 at 2PM") 
   - Title/Description (e.g. "Gearbox, Unit 6 & 7 Cooling Tower Fan")
   - Detailed description paragraph
3. Extract ALL solicitations from the table/list${searchFilter ? ` that match the search filter "${searchFilter}"` : ''}
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

    const generalFilterInstructions = searchFilter ? `

🔍 SEARCH FILTER ACTIVE: Only look for opportunities related to "${searchFilter}"
- If the portal has a search function, use it to search for "${searchFilter}"
- Filter results to only include RFPs that contain or are related to "${searchFilter}"
- Ignore opportunities that are not related to this search term
- If no results match the filter, return an empty array` : '';

    return `Please scrape the following RFP portal for procurement opportunities:

${context}${generalFilterInstructions}

Your task:
1. Navigate to the portal URL: ${portal.url}
${portal.loginRequired ? `2. Authenticate using provided credentials` : '2. Access public listings'}
3. Find all available RFP/procurement opportunities${searchFilter ? ` related to "${searchFilter}"` : ''}
4. Extract key information for each opportunity:
   - Title
   - Agency/Organization
   - Deadline/Due Date
   - Estimated Value (if available)
   - Description/Summary
   - Source URL/Link - **CRITICAL: Extract the SPECIFIC detail page URL for each RFP, not category/listing page URLs**
   - Category/Type

IMPORTANT URL EXTRACTION RULES:
- For FindRFP: Look for specific RFP detail URLs like "detail.aspx?rfpid=" or "service/detail.aspx?rfpid=" 
- For Bonfire: Extract direct solicitation URLs with specific IDs
- For SAM.gov: Get specific opportunity detail URLs with opportunity IDs
- NEVER use generic category URLs like "/construction-contracts/", "/services/", or listing page URLs
- If only a category URL is found, try to navigate to the specific opportunity detail page and get that URL
- Each RFP must have a unique, specific detail page URL that leads directly to that opportunity

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
        const { url, loginRequired, credentials, searchFilter } = context;
        
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
        const filterMessage = searchFilter ? ` with search filter: "${searchFilter}"` : '';
        console.log(`🔍 Starting intelligent scrape of ${url} (portal type: ${portalType})${filterMessage}`);
        
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

        // Step 2: Fetch main portal page with optimized session handling
        let html: string;
        let structuredData: any = null;
        
        if (portalType.toLowerCase().includes('austin') && portalType.toLowerCase().includes('finance')) {
          console.log(`🌐 Austin Finance detected: Using dynamic content scraping with Puppeteer`);
          html = await this.scrapeDynamicContent(url, sessionData);
        } else if (sessionData?.sessionId && sessionData?.method === 'browser_authentication') {
          // Use authenticated browser session for content extraction instead of falling back to HTTP
          console.log(`🌐 Using authenticated browser session for content extraction: ${sessionData.sessionId}`);
          const sessionResult = await this.scrapeWithAuthenticatedSession(url, sessionData.sessionId);
          
          if (sessionResult.isStructured && sessionResult.opportunities) {
            console.log(`🎯 Using structured data from Stagehand extraction: ${sessionResult.opportunities.length} opportunities`);
            structuredData = { opportunities: sessionResult.opportunities };
            html = ''; // No HTML needed for structured data
          } else {
            html = sessionResult.html || '';
          }
        } else {
          // Fall back to HTTP only for non-authenticated portals
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
        
        // Step 3: Parse HTML content with Cheerio (skip if we have structured data)
        let $: cheerio.CheerioAPI | null = null;
        let extractedContent: any = null;
        
        if (structuredData && structuredData.opportunities) {
          // Use structured data directly from Stagehand extraction
          console.log(`🎯 Using structured data directly: ${structuredData.opportunities.length} opportunities`);
          extractedContent = {
            title: '',
            headings: [],
            links: [],
            text: '',
            opportunities: structuredData.opportunities
          };
        } else if (html) {
          // Parse HTML content with Cheerio for traditional extraction
          $ = cheerio.load(html);
          console.log(`🔧 Parsed HTML with Cheerio, found ${$('*').length} elements`);
          
          // Step 4: Extract structured content based on portal type
          console.log(`🎯 Extracting content for portal type: ${portalType}`);
          extractedContent = this.extractContentByPortalType($, portalType, url);
        } else {
          // No data available
          console.log(`⚠️ No HTML content or structured data available`);
          extractedContent = {
            title: '',
            headings: [],
            links: [],
            text: '',
            opportunities: []
          };
        }
        
        console.log(`📊 Extracted ${extractedContent?.opportunities?.length || 0} opportunities from content`);
        
        // Step 5: Look for RFP/opportunity links to fetch additional details (skip if we have structured data)
        let opportunityLinks: any[] = [];
        if (structuredData && structuredData.opportunities) {
          // Extract links from structured opportunities if available
          console.log(`🔗 Extracting links from structured data...`);
          opportunityLinks = structuredData.opportunities
            .map((opp: any) => ({
              url: opp.link || opp.url,
              title: opp.title,
              type: 'opportunity'
            }))
            .filter((link: any) => link.url);
        } else if ($) {
          // Traditional HTML link extraction
          console.log(`🔗 Looking for opportunity links...`);
          // Legacy opportunity link finding replaced by enhanced Stagehand extraction
          opportunityLinks = [];
        }
        console.log(`🎯 Found ${opportunityLinks?.length || 0} potential opportunity links`);
        
        // Step 6: Fetch additional opportunity details (skip if we have structured data with sufficient detail)
        let detailedOpportunities: any[] = [];
        if (structuredData && structuredData.opportunities) {
          // Skip fetching additional details for structured data since Stagehand extraction is comprehensive
          console.log(`⏭️ Skipping detail fetching - structured data from Stagehand is comprehensive`);
          detailedOpportunities = [];
        } else {
          // Fetch additional opportunity details for traditional HTML extraction
          console.log(`📥 Fetching details for ${Math.min(opportunityLinks?.length || 0, 10)} opportunities...`);
          const detailFetches = await Promise.allSettled(
            (opportunityLinks || []).slice(0, 10).map(link => // Limit to 10 opportunities per scrape
              this.fetchOpportunityDetails(link, sessionData)
            )
          );
          detailedOpportunities = detailFetches
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<any>).value)
            .filter(opp => opp !== null);
        }

        console.log(`✅ Successfully fetched ${detailedOpportunities.length} detailed opportunities`);
        
        // Merge detailed opportunities with extracted opportunities - critical fix!
        const extractedOpportunities = extractedContent.opportunities || [];
        const allOpportunities = [...detailedOpportunities, ...extractedOpportunities];
        
        // Remove duplicates based on solicitationId or title first, then link/url
        // This prevents collapsing multiple opportunities due to shared generic list URLs
        const uniqueOpportunities = allOpportunities.filter((opportunity, index, arr) => {
          const identifier = opportunity.solicitationId || opportunity.title || opportunity.link || opportunity.url;
          return arr.findIndex(o => (o.solicitationId || o.title || o.link || o.url) === identifier) === index;
        });
        
        // Apply search filter if provided (post-processing filtering)
        let finalOpportunities = uniqueOpportunities;
        if (searchFilter && searchFilter.trim()) {
          const filterTerm = searchFilter.toLowerCase().trim();
          const beforeFilterCount = finalOpportunities.length;
          
          finalOpportunities = uniqueOpportunities.filter((opportunity: any) => {
            const title = (opportunity.title || '').toLowerCase();
            const description = (opportunity.description || '').toLowerCase();
            const agency = (opportunity.agency || '').toLowerCase();
            const category = (opportunity.category || '').toLowerCase();
            
            return title.includes(filterTerm) || 
                   description.includes(filterTerm) || 
                   agency.includes(filterTerm) || 
                   category.includes(filterTerm);
          });
          
          console.log(`🔍 Search filter "${searchFilter}" applied: ${beforeFilterCount} → ${finalOpportunities.length} opportunities`);
        }

        console.log(`🔄 intelligentWebScrape returning ${finalOpportunities.length} opportunities (${detailedOpportunities.length} detailed + ${extractedOpportunities.length} extracted, ${allOpportunities.length - uniqueOpportunities.length} duplicates removed${searchFilter ? `, filtered from ${uniqueOpportunities.length}` : ''})`);

        return {
          content: html,
          extractedContent,
          opportunities: finalOpportunities,
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

  private async processOpportunity(opportunity: any, portal: Portal, coordinationId?: string | null): Promise<void> {
    console.log(`🎯 Starting processOpportunity for: ${opportunity.title || opportunity.solicitationId} from ${portal.name}`);
    try {
      // Enhanced AI analysis with confidence scoring
      console.log(`🤖 Calling AI analysis for: ${opportunity.title || opportunity.solicitationId}`);
      const rfpDetails = await this.aiService.extractRFPDetails(
        opportunity.content || opportunity.description, 
        opportunity.link || opportunity.url
      );
      console.log(`🤖 AI analysis completed. Result:`, rfpDetails ? `Confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%` : 'NULL');
      
      // Lower confidence threshold for Austin Finance and FindRFP portals
      // FindRFP opportunities are already validated by Stagehand AI extraction
      const confidenceThreshold = 
        portal.name.toLowerCase().includes('austin') ? 0.4 :
        portal.url.includes('findrfp') ? 0.3 : // Lower threshold for FindRFP since Stagehand already validated
        0.7;
      
      if (!rfpDetails) {
        console.log(`🚫 Skipping opportunity - AI returned null: ${opportunity.title || opportunity.solicitationId}`);
        return;
      }
      
      if (rfpDetails.confidence < confidenceThreshold) {
        console.log(`🚫 Skipping low-confidence opportunity: ${opportunity.title || opportunity.solicitationId} (confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%, threshold: ${(confidenceThreshold * 100).toFixed(1)}%)`);
        return;
      }
      
      console.log(`✅ AI analysis passed: ${opportunity.title || opportunity.solicitationId} (confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%)`);

      // Validate and fix sourceUrl - ensure it points to specific RFP detail page
      const sourceUrl = this.validateAndFixSourceUrl(opportunity.link || opportunity.url, portal, opportunity);
      if (!sourceUrl) {
        console.log(`🚫 Skipping opportunity - invalid or generic URL: ${opportunity.link || opportunity.url}`);
        return;
      }

      // Check for duplicates
      const existingRfps = await storage.getRFPsByPortal(portal.id);
      const exists = existingRfps.some(rfp => 
        rfp.title === rfpDetails.title || 
        rfp.sourceUrl === sourceUrl
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
        sourceUrl: sourceUrl,
        deadline: rfpDetails.deadline ? new Date(rfpDetails.deadline) : null,
        estimatedValue: rfpDetails.estimatedValue?.toString(),
        status: "discovered",
        progress: 0
      });
      
      // Link RFP to coordination log if coordination ID was provided
      if (coordinationId) {
        try {
          await storage.updateAgentCoordination(coordinationId, {
            status: 'completed',
            response: JSON.stringify({
              success: true,
              rfpCreated: true,
              rfpId: rfp.id,
              rfpTitle: rfp.title,
              confidence: rfpDetails.confidence
            }),
            completedAt: new Date()
          });
          console.log(`🔗 Linked RFP ${rfp.id} to coordination log ${coordinationId}`);
        } catch (linkError) {
          console.error(`❌ Failed to link RFP to coordination log:`, linkError);
          // Continue with RFP creation even if linking fails
        }
      }
      
      // Download documents for Austin Finance RFPs
      if (portal.url.includes('austintexas.gov') && sourceUrl) {
        try {
          console.log(`📄 Downloading documents for Austin Finance RFP: ${rfp.title}`);
          const documents = await austinFinanceDocumentScraper.scrapeRFPDocuments(rfp.id, sourceUrl);
          console.log(`✅ Downloaded ${documents.length} documents for RFP ${rfp.id}`);
          
          // Analyze documents to identify what needs to be filled out
          const analysis = await austinFinanceDocumentScraper.analyzeDocumentsForFillOut(rfp.id);
          console.log(`📊 Document analysis complete:\n${analysis.summary}`);
        } catch (error) {
          console.error(`❌ Failed to download documents for RFP ${rfp.id}:`, error);
          // Continue with RFP creation even if document download fails
        }
      }

      // Create audit log
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: rfp.id,
        action: "discovered",
        details: { 
          portal: portal.name,
          sourceUrl: sourceUrl,
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

  /**
   * Validate and fix source URLs to ensure they point to specific RFP detail pages
   * instead of generic category or listing pages
   */
  private validateAndFixSourceUrl(url: string, portal: Portal, opportunity: any): string | null {
    if (!url) {
      console.log(`🚫 No URL provided for opportunity: ${opportunity.title}`);
      return null;
    }

    console.log(`🔍 Validating URL for ${portal.name}: ${url}`);

    // List of generic/category URL patterns that should be rejected
    const genericPatterns = [
      '/construction-contracts/',
      '/services/',
      '/bids/',
      '/rfps/',
      '/opportunities/',
      '/solicitations/',
      'bid.aspx$', // Generic bid page without specific ID
      'rfp.aspx$', // Generic RFP page without specific ID
      'search.aspx', // Search result pages
      'category.aspx', // Category pages
      'browse.aspx' // Browse pages
    ];

    // Check if URL is a generic category URL
    for (const pattern of genericPatterns) {
      if (url.match(new RegExp(pattern, 'i'))) {
        console.log(`🚫 Rejecting generic URL pattern "${pattern}": ${url}`);
        return null;
      }
    }

    // Portal-specific URL validation and fixing
    if (portal.url.includes('findrfp.com')) {
      return this.validateFindRFPUrl(url, opportunity);
    } else if (portal.url.includes('austintexas.gov')) {
      return this.validateAustinFinanceUrl(url, opportunity);
    } else if (portal.url.includes('bonfire')) {
      return this.validateBonfireUrl(url, opportunity);
    } else if (portal.url.includes('sam.gov')) {
      return this.validateSAMGovUrl(url, opportunity);
    }

    // For other portals, basic validation
    return this.validateGenericUrl(url, opportunity);
  }

  private validateFindRFPUrl(url: string, opportunity: any): string | null {
    // FindRFP specific URLs must contain detail pages with rfpid parameter
    if (url.includes('detail.aspx?rfpid=') || url.includes('service/detail.aspx?rfpid=')) {
      console.log(`✅ Valid FindRFP detail URL: ${url}`);
      return url;
    }

    // Try to construct a proper URL if we have an RFP ID
    const rfpId = this.extractRFPId(opportunity);
    if (rfpId && url.includes('findrfp.com')) {
      const baseUrl = 'https://findrfp.com/service/detail.aspx';
      const constructedUrl = `${baseUrl}?rfpid=${rfpId}&s=${encodeURIComponent(opportunity.title || 'RFP')}&t=CA&ID=${Date.now()}`;
      console.log(`🔧 Constructed FindRFP URL: ${constructedUrl}`);
      return constructedUrl;
    }

    console.log(`🚫 Invalid FindRFP URL (missing rfpid): ${url}`);
    return null;
  }

  private validateAustinFinanceUrl(url: string, opportunity: any): string | null {
    // Austin Finance URLs must contain solicitation_details.cfm with sid parameter
    if (url.includes('solicitation_details.cfm?sid=')) {
      console.log(`✅ Valid Austin Finance detail URL: ${url}`);
      return url;
    }

    // Try to construct a proper URL if we have a solicitation ID
    const solicitationId = this.extractSolicitationId(opportunity);
    if (solicitationId) {
      const baseUrl = 'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitation_details.cfm';
      const constructedUrl = `${baseUrl}?sid=${solicitationId}`;
      console.log(`🔧 Constructed Austin Finance URL: ${constructedUrl}`);
      return constructedUrl;
    }

    console.log(`🚫 Invalid Austin Finance URL (missing sid): ${url}`);
    return null;
  }

  private validateBonfireUrl(url: string, opportunity: any): string | null {
    // Bonfire URLs typically contain opportunity or bid IDs
    if (url.includes('/opportunities/') || url.includes('/bids/') || url.includes('opportunity_id=') || url.includes('bid_id=')) {
      console.log(`✅ Valid Bonfire detail URL: ${url}`);
      return url;
    }

    console.log(`🚫 Invalid Bonfire URL (missing specific ID): ${url}`);
    return null;
  }

  private validateSAMGovUrl(url: string, opportunity: any): string | null {
    // SAM.gov URLs typically contain opportunity IDs
    if (url.includes('/opportunities/') && (url.includes('opp-') || url.includes('opportunity-'))) {
      console.log(`✅ Valid SAM.gov detail URL: ${url}`);
      return url;
    }

    console.log(`🚫 Invalid SAM.gov URL (missing opportunity ID): ${url}`);
    return null;
  }

  private validateGenericUrl(url: string, opportunity: any): string | null {
    // For generic portals, ensure URL contains some form of ID or specific identifier
    const hasId = /[?&](id|rfp|bid|opp|solicitation)=/i.test(url) || 
                  /\/\d+\/?$/.test(url) || // Ends with numeric ID
                  /[?&]\w+id=\w+/i.test(url); // Contains some form of ID parameter

    if (hasId) {
      console.log(`✅ Valid generic detail URL: ${url}`);
      return url;
    }

    console.log(`🚫 Invalid generic URL (no specific ID found): ${url}`);
    return null;
  }

  private extractRFPId(opportunity: any): string | null {
    // Try to extract RFP ID from various fields
    const idSources = [
      opportunity.rfpId,
      opportunity.id,
      opportunity.solicitationId,
      opportunity.opportunityId
    ];

    for (const id of idSources) {
      if (id && typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }

    // Try to extract from title or description
    const text = `${opportunity.title || ''} ${opportunity.description || ''}`;
    const idMatch = text.match(/(?:RFP|ID|rfpid)[:\s]*([A-Z0-9-]+)/i);
    if (idMatch) {
      return idMatch[1];
    }

    return null;
  }

  private extractSolicitationId(opportunity: any): string | null {
    // Try to extract solicitation ID from various fields
    const idSources = [
      opportunity.solicitationId,
      opportunity.sid,
      opportunity.id,
      opportunity.rfpId
    ];

    for (const id of idSources) {
      if (id && typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }

    // Try to extract from title (Austin Finance format: IFQ 1100 BAS1065)
    const title = opportunity.title || '';
    const solicitationMatch = title.match(/(?:IFQ|IFB|RFP|RFQS)\s+\d+\s+\w+/i);
    if (solicitationMatch) {
      // Look for a numeric ID that might be the solicitation ID
      const numericMatch = title.match(/\b\d{5,}\b/);
      if (numericMatch) {
        return numericMatch[0];
      }
    }

    return null;
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
          // FindRFP now uses enhanced Stagehand extraction in authenticated browser sessions
          content.opportunities = [];
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
    console.log(`🔍 Analyzing Bonfire Hub HTML structure...`);
    
    // Debug: Log the page structure to understand what we're working with
    const pageTitle = $('title').text();
    console.log(`📄 Bonfire page title: ${pageTitle}`);
    
    // Debug: Check for common table/list structures
    const tables = $('table').length;
    const rows = $('tr').length;
    const lists = $('ul, ol').length;
    const listItems = $('li').length;
    const divs = $('div').length;
    console.log(`🔢 Bonfire structure: ${tables} tables, ${rows} rows, ${lists} lists, ${listItems} list items, ${divs} divs`);
    
    // Enhanced Bonfire selectors - try multiple approaches
    const selectors = [
      'table tr', // Common table structure for opportunity listings
      'tbody tr', // Table body rows
      '.opportunity, [class*="opportunity"]', // Opportunity classes
      '.bid, [class*="bid"]', // Bid classes
      '.rfp, [class*="rfp"]', // RFP classes
      '.listing, [class*="listing"]', // Listing classes
      '.row, [class*="row"]', // Row classes
      'li', // List items that might contain opportunities
      '[data-id]', // Elements with data IDs
      'a[href*="opportunity"]', // Links containing "opportunity"
      'a[href*="bid"]', // Links containing "bid"
      'a[href*="rfp"]' // Links containing "rfp"
    ];
    
    selectors.forEach(selector => {
      const elements = $(selector);
      console.log(`🎯 Bonfire selector "${selector}" found ${elements.length} elements`);
      
      elements.each((index, element) => {
        if (index >= 5) return; // Limit logging to first 5 elements per selector
        
        const $element = $(element);
        const text = $element.text().trim();
        const links = $element.find('a').length;
        const hasHref = $element.attr('href') ? 'has href' : 'no href';
        
        console.log(`  📋 Element ${index + 1}: ${text.substring(0, 100)}... (${links} links, ${hasHref})`);
      });
    });
    
    // Try table-based extraction first (common for government portals)
    $('table tr').each((index, element) => {
      if (index === 0) return; // Skip header row
      
      const $row = $(element);
      const cells = $row.find('td');
      
      if (cells.length >= 2) {
        const title = cells.eq(0).text().trim();
        const description = cells.eq(1).text().trim();
        const deadline = cells.length > 2 ? cells.eq(2).text().trim() : '';
        const agency = cells.length > 3 ? cells.eq(3).text().trim() : '';
        
        // Look for links in any cell
        const link = $row.find('a').first().attr('href');
        
        if (title && title.length > 5 && (link || title.toLowerCase().includes('rfp') || title.toLowerCase().includes('bid'))) {
          opportunities.push({
            title,
            description,
            deadline,
            agency,
            link: link ? new URL(link, baseUrl).toString() : null,
            source: 'bonfire_table'
          });
          console.log(`✅ Bonfire table opportunity found: ${title}`);
        }
      }
    });
    
    // Try list-based extraction
    $('li').each((_, element) => {
      const $item = $(element);
      const text = $item.text().trim();
      const link = $item.find('a').first().attr('href') || $item.closest('a').attr('href');
      
      if (text.length > 10 && (text.toLowerCase().includes('rfp') || text.toLowerCase().includes('bid') || text.toLowerCase().includes('opportunity'))) {
        const title = $item.find('h1, h2, h3, h4, h5, h6').first().text().trim() || text.substring(0, 100);
        
        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description: text,
            deadline: '',
            agency: '',
            link: link ? new URL(link, baseUrl).toString() : null,
            source: 'bonfire_list'
          });
          console.log(`✅ Bonfire list opportunity found: ${title}`);
        }
      }
    });
    
    // Try div-based extraction with RFP keywords
    $('div').each((_, element) => {
      const $div = $(element);
      const text = $div.text().trim();
      const link = $div.find('a').first().attr('href');
      
      if (text.length > 20 && text.length < 500 && 
          (text.toLowerCase().includes('rfp') || text.toLowerCase().includes('bid') || text.toLowerCase().includes('opportunity')) &&
          !text.toLowerCase().includes('footer') && !text.toLowerCase().includes('header')) {
        
        const title = $div.find('h1, h2, h3, h4, h5, h6').first().text().trim() || text.substring(0, 100);
        
        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description: text,
            deadline: '',
            agency: '',
            link: link ? new URL(link, baseUrl).toString() : null,
            source: 'bonfire_div'
          });
          console.log(`✅ Bonfire div opportunity found: ${title}`);
        }
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

  // Legacy extractFindRFPOpportunities function removed - replaced by enhanced Stagehand extraction

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

  // Legacy findOpportunityLinks function removed - replaced by enhanced Stagehand extraction

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
   * Extract content using an authenticated browser session with adaptive timeouts
   * Returns structured data when Stagehand extraction succeeds, HTML when falling back
   */
  private async scrapeWithAuthenticatedSession(url: string, sessionId: string): Promise<{ opportunities?: any[], html?: string, isStructured: boolean }> {
    try {
      console.log(`🌐 Extracting content from authenticated session ${sessionId} for ${url}`);
      
      // Import sessionManager from stagehandTools
      const { sessionManager } = await import('./stagehandTools');
      
      // Get the existing authenticated session
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`No authenticated session found for ID: ${sessionId}`);
      }
      
      const stagehand = session.stagehand;
      const page = stagehand.page;
      
      console.log(`🎯 Navigating authenticated session to: ${url}`);
      
      // Adaptive navigation strategy for heavy JavaScript pages
      let html: string | null = null;
      let navigationSuccess = false;
      
      // Strategy 1: Try domcontentloaded first (faster)
      try {
        console.log(`📄 Trying 'domcontentloaded' navigation...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000); // Wait for initial JS execution
        navigationSuccess = true;
        console.log(`✅ 'domcontentloaded' navigation successful`);
      } catch (error) {
        console.log(`⚠️ 'domcontentloaded' failed, trying 'load' fallback...`);
        
        // Strategy 2: Fall back to 'load' 
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 60000 });
          await page.waitForTimeout(3000);
          navigationSuccess = true;
          console.log(`✅ 'load' navigation successful`);
        } catch (error2) {
          console.log(`⚠️ 'load' failed, trying basic navigation...`);
          
          // Strategy 3: Basic navigation without wait conditions
          try {
            await page.goto(url, { timeout: 90000 });
            await page.waitForTimeout(5000); // Give more time for heavy JS
            navigationSuccess = true;
            console.log(`✅ Basic navigation successful`);
          } catch (error3) {
            console.log(`⚠️ All navigation strategies failed, attempting content extraction anyway...`);
            // Continue to try content extraction even if navigation partially failed
          }
        }
      }
      
      // Handle Cloudflare protection and wait for portal content
      try {
        console.log(`🔍 Waiting for portal content to load...`);
        
        // Check for Cloudflare protection first
        const pageTitle = await page.title();
        console.log(`📄 Page title: "${pageTitle}"`);
        
        if (pageTitle.includes("Just a moment") || pageTitle.includes("Please wait")) {
          console.log(`🛡️ Cloudflare protection detected, waiting for bypass...`);
          
          // Wait for Cloudflare to complete (can take 5-15 seconds)
          try {
            await page.waitForFunction(
              () => !document.title.includes("Just a moment") && !document.title.includes("Please wait"),
              { timeout: 30000 }
            );
            console.log(`✅ Cloudflare protection bypassed`);
            
            // Give additional time for the real page to load
            await page.waitForTimeout(3000);
          } catch (cloudflareError) {
            console.log(`⚠️ Cloudflare bypass timeout, proceeding anyway...`);
          }
        }
        
        // Now wait for portal-specific elements
        await Promise.race([
          page.waitForSelector('table, .opportunity, .listing, .rfp, .bid, .content, main, [data-testid]', { timeout: 15000 }),
          page.waitForTimeout(15000) // Maximum wait
        ]);
        console.log(`✅ Portal content elements detected`);
      } catch (waitError) {
        console.log(`⚠️ Portal content wait timeout, proceeding with extraction...`);
      }
      
      // Add deterministic post-auth navigation for Bonfire Hub to reach opportunities listing
      // Get current page URL for robust domain detection
      const currentUrl = await page.url();
      const targetDomain = (currentUrl || url);
      
      if (targetDomain.includes('bonfirehub')) {
        try {
          console.log(`🎯 Implementing deterministic post-auth navigation for Bonfire Hub...`);
          console.log(`🌐 Target URL: ${url}, Current URL: ${currentUrl}`);
          
          // Check if we're on a dashboard instead of opportunities listing
          const pageContent = await page.content();
          
          console.log(`🌐 Current URL: ${currentUrl}`);
          
          // Detect dashboard state via "Welcome Back!" or dashboard indicators
          const isDashboard = pageContent.includes('Welcome Back!') || 
                             pageContent.includes('Dashboard') || 
                             !currentUrl.includes('/opportunities') ||
                             currentUrl.includes('dashboard');
          
          if (isDashboard) {
            console.log(`🔄 Dashboard detected, forcing navigation to opportunities listing...`);
            
            // Build domain-agnostic opportunities URL
            const urlObj = new URL(currentUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            
            // Try multiple opportunities URL patterns
            const opportunityUrls = [
              `${baseUrl}/opportunities/all`,
              `${baseUrl}/opportunities`,
              `${baseUrl}/opportunities?open=1`,
              `${baseUrl}/open-opportunities`,
              `${baseUrl}/bids/open`
            ];
            
            let navigationSuccess = false;
            
            for (const oppUrl of opportunityUrls) {
              try {
                console.log(`🎯 Trying opportunities URL: ${oppUrl}`);
                
                await page.goto(oppUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(3000);
                
                // Check if we reached an opportunities page (look for opportunity-related content)
                const newContent = await page.content();
                const hasOpportunityContent = newContent.includes('opportunity') || 
                                            newContent.includes('bid') || 
                                            newContent.includes('rfp') ||
                                            await page.$('table tbody tr, .opportunity-item, .bid-item');
                
                if (hasOpportunityContent && !newContent.includes('Welcome Back!')) {
                  console.log(`✅ Successfully navigated to opportunities listing: ${oppUrl}`);
                  navigationSuccess = true;
                  break;
                }
              } catch (navError: any) {
                console.log(`⚠️ Failed to navigate to ${oppUrl}: ${navError.message}`);
                continue;
              }
            }
            
            // If URL navigation failed, try programmatic navigation via UI
            if (!navigationSuccess) {
              console.log(`🔄 URL navigation failed, trying programmatic UI navigation...`);
              
              try {
                // Go back to the authenticated dashboard and click opportunities link
                await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(2000);
                
                // Find and click opportunities navigation link
                const opportunitiesLinkClicked = await page.evaluate(() => {
                  const selectors = [
                    'a[href*="/opportunities"]',
                    'a[href*="/open-opportunities"]',
                    'a[href*="/bids"]',
                    'button:contains("Opportunities")',
                    'a:contains("Opportunities")',
                    'a:contains("Open Opportunities")',
                    'a:contains("Bids")',
                    '[data-testid*="opportunities"]',
                    'nav a:contains("Opportunities")',
                    '.nav a:contains("Opportunities")'
                  ];
                  
                  for (const selector of selectors) {
                    try {
                      const elements = document.querySelectorAll(selector);
                      for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        const text = element.textContent?.toLowerCase() || '';
                        if (text.includes('opportunit') || text.includes('bid') || text.includes('open')) {
                          (element as HTMLElement).click();
                          console.log(`🖱️ Clicked opportunities link: ${selector}`);
                          return true;
                        }
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                  return false;
                });
                
                if (opportunitiesLinkClicked) {
                  console.log(`🖱️ Opportunities link clicked, waiting for navigation...`);
                  await page.waitForTimeout(5000);
                  
                  // Wait for opportunities content to load
                  await Promise.race([
                    page.waitForSelector('table tbody tr, .opportunity-item, .bid-item, [data-testid*="opportunity"]', { timeout: 15000 }),
                    page.waitForTimeout(15000)
                  ]);
                  
                  console.log(`✅ UI navigation to opportunities completed`);
                  navigationSuccess = true;
                }
              } catch (uiNavError: any) {
                console.log(`⚠️ UI navigation failed: ${uiNavError.message}`);
              }
            }
            
            if (!navigationSuccess) {
              console.log(`⚠️ All navigation attempts failed, proceeding with current page content...`);
            }
          } else {
            console.log(`✅ Already on opportunities listing page, proceeding with extraction...`);
          }
          
        } catch (navError: any) {
          console.log(`⚠️ Post-auth navigation error: ${navError.message}, proceeding anyway...`);
        }
      }
      
      // Extract content regardless of navigation success
      try {
        // For Bonfire Hub, use clean Stagehand extraction with AI-powered parsing
        if (targetDomain.includes('bonfirehub')) {
          console.log(`🔧 Using clean Stagehand extraction for Bonfire Hub...`);
          
          // Wait for opportunities content to load
          try {
            console.log(`⏳ Waiting for opportunities to render...`);
            await Promise.race([
              page.waitForSelector('table, .opportunity, .bid, .rfp, .listing, [data-testid]', { timeout: 15000 }),
              page.waitForTimeout(15000)
            ]);
            console.log(`✅ Content detected, proceeding with AI extraction`);
          } catch (waitError) {
            console.log(`⚠️ Content wait timeout, proceeding with extraction anyway...`);
          }
          
          // Use clean Stagehand page.extract() with Zod schema
          try {
            console.log(`🤖 Extracting opportunities using AI-powered Stagehand extraction...`);
            
            const extractionResult = await page.extract({
              instruction: `Extract all RFP opportunities, bids, and procurement opportunities from this page. 
                           Look for opportunities in tables, cards, lists, or any other format. 
                           For each opportunity, extract:
                           - title: The opportunity or RFP title/name
                           - description: Brief description or summary (if available)
                           - agency: The agency or organization posting the opportunity
                           - deadline: Deadline or due date (if mentioned)
                           - estimatedValue: Contract value or budget (if mentioned)
                           - link: Direct link to the opportunity details
                           - category: Type of opportunity (construction, services, goods, etc.)
                           
                           Ignore welcome messages, navigation menus, or non-opportunity content.
                           Only extract actual procurement opportunities or RFPs.`,
              
              schema: z.object({
                opportunities: z.array(OpportunitySchema)
              })
            });
            
            console.log(`🎯 Stagehand extraction found ${extractionResult.opportunities?.length || 0} opportunities`);
            
            if (extractionResult.opportunities && extractionResult.opportunities.length > 0) {
              console.log(`✅ Using Stagehand-extracted opportunities`);
              return { 
                opportunities: extractionResult.opportunities, 
                isStructured: true 
              };
            } else {
              console.log(`⚠️ No opportunities found with Stagehand extraction, checking for dashboard content...`);
              
              // Check if we're on a dashboard page
              const pageContent = await page.content();
              if (pageContent.includes('Welcome Back') || pageContent.includes('Dashboard')) {
                console.log(`⚠️ Detected dashboard page - opportunities extraction should only run after successful navigation to opportunities listing`);
              }
            }
            
          } catch (extractionError) {
            console.log(`⚠️ Stagehand extraction error: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
            console.log(`🔄 Falling back to static HTML extraction...`);
          }
        }
        
        // For FindRFP, use clean Stagehand extraction with AI-powered parsing
        if (targetDomain.includes('findrfp')) {
          console.log(`🔧 Using clean Stagehand extraction for FindRFP...`);
          
          // Wait for search results and opportunities to load
          try {
            console.log(`⏳ Waiting for FindRFP opportunities to render...`);
            await Promise.race([
              page.waitForSelector('table, .result, .opportunity, .listing, [data-testid], .search-results', { timeout: 15000 }),
              page.waitForTimeout(15000)
            ]);
            console.log(`✅ FindRFP content detected, proceeding with AI extraction`);
          } catch (waitError) {
            console.log(`⚠️ FindRFP content wait timeout, proceeding with extraction anyway...`);
          }
          
          // Use clean Stagehand page.extract() with Zod schema  
          try {
            console.log(`🤖 Extracting FindRFP opportunities using AI-powered Stagehand extraction...`);
            
            const extractionResult = await page.extract({
              instruction: `Extract all RFP opportunities and procurement opportunities from this FindRFP.com page.
                           FindRFP.com is an aggregation platform that displays opportunities from multiple government sources.
                           Look for opportunities in search results, tables, listings, or any other format.
                           
                           For each opportunity, extract:
                           - title: The RFP or opportunity title/name
                           - description: Brief description or summary of the opportunity
                           - agency: The government agency or organization posting (e.g., "City of Austin", "Department of Defense")
                           - deadline: Application deadline or due date (if mentioned)
                           - estimatedValue: Contract value, budget, or project value (if mentioned)
                           - link: Direct link to the detailed opportunity page or application
                           - category: Type of opportunity (construction, services, goods, IT, consulting, etc.)
                           
                           Focus on actual procurement opportunities and RFPs.
                           Ignore promotional content, navigation menus, ads, or non-opportunity content.
                           Extract as many opportunities as possible from this page to exceed the previous count of 6.`,
              
              schema: z.object({
                opportunities: z.array(OpportunitySchema)
              })
            });
            
            console.log(`🎯 FindRFP Stagehand extraction found ${extractionResult.opportunities?.length || 0} opportunities`);
            
            if (extractionResult.opportunities && extractionResult.opportunities.length > 0) {
              console.log(`✅ Using FindRFP Stagehand-extracted opportunities (${extractionResult.opportunities.length} found)`);
              return { 
                opportunities: extractionResult.opportunities, 
                isStructured: true 
              };
            } else {
              console.log(`⚠️ No opportunities found with FindRFP Stagehand extraction`);
            }
            
          } catch (extractionError) {
            console.log(`⚠️ FindRFP Stagehand extraction error: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
            console.log(`🔄 Falling back to static HTML extraction for FindRFP...`);
          }
        }
        
        // Fallback to static HTML extraction
        html = await page.content();
        console.log(`✅ Successfully extracted ${html.length} characters using authenticated session`);
        
        if (html.length < 1000) {
          console.log(`⚠️ Warning: Extracted content is suspiciously small (${html.length} chars)`);
        }
        
        return { 
          html: html, 
          isStructured: false 
        };
      } catch (extractError) {
        console.error(`❌ Failed to extract content:`, extractError);
        throw new Error(`Content extraction failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
      }
      
    } catch (error) {
      console.error(`❌ Error extracting content with authenticated session:`, error);
      throw error;
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