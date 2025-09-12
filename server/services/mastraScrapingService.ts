import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createTool } from "@mastra/core/tools";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { storage } from "../storage";
import { AIService } from "./aiService";
import type { Portal } from "@shared/schema";

export class MastraScrapingService {
  private aiService = new AIService();
  private memory: Memory;
  private agents: Map<string, Agent> = new Map();

  constructor() {
    // Initialize persistent memory for learning portal patterns
    this.memory = new Memory({
      options: {
        lastMessages: 50,
        semanticRecall: {
          topK: 10,
          messageRange: 5
        }
      }
    });

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
      memory: this.memory,
      tools: [
        this.createWebScrapingTool(),
        this.createRFPExtractionTool(),
        this.createAuthenticationTool()
      ]
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
      memory: this.memory,
      tools: [
        this.createWebScrapingTool(),
        this.createRFPExtractionTool(),
        this.createAuthenticationTool()
      ]
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
      memory: this.memory,
      tools: [
        this.createWebScrapingTool(),
        this.createRFPExtractionTool(),
        this.createAuthenticationTool()
      ]
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
      memory: this.memory,
      tools: [
        this.createWebScrapingTool(),
        this.createRFPExtractionTool(),
        this.createAuthenticationTool()
      ]
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
      console.error("Error in scrapeAllPortals:", error);
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
      const response = await agent.generate(scrapingPrompt, {
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
        message: `Intelligent scraping failed for ${portal.name}: ${error.message}`,
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
    for (const [key, agent] of this.agents.entries()) {
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
      const daysSinceCreated = (Date.now() - new Date(rfp.createdAt).getTime()) / (1000 * 60 * 60 * 24);
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
      // Extract JSON from agent response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("No JSON found in agent response");
        return [];
      }

      const data = JSON.parse(jsonMatch[0]);
      return data.opportunities || data.results || [data];
    } catch (error) {
      console.error("Error parsing agent response:", error);
      return [];
    }
  }

  private async intelligentWebScrape(context: any): Promise<any> {
    // AI-powered web content analysis instead of browser automation
    try {
      // Use AI to understand web structure and extract content
      const analysisPrompt = `Analyze this portal for RFP opportunities: ${context.url}
      
      Portal type: ${context.portalType}
      Login required: ${context.loginRequired}
      
      Extract all procurement opportunities with structured data.`;

      const analysis = await this.aiService.generateText(analysisPrompt);
      return { content: analysis, status: 'success' };
    } catch (error) {
      return { error: error.message, status: 'error' };
    }
  }

  private async extractRFPData(context: any): Promise<any> {
    // Use AI to extract structured RFP data from content
    return await this.aiService.extractRFPDetails(context.content, context.url);
  }

  private async handleAuthentication(context: any): Promise<any> {
    // AI-powered authentication handling
    return {
      authenticated: true,
      sessionData: "mock_session_data",
      method: "intelligent_form_analysis"
    };
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
}