import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { Memory } from "@mastra/memory"
import { z } from "zod"
import { AgentConfig } from "../types"

/**
 * Factory for creating specialized agents for different portal types
 */
export class AgentFactory {
  private memory: Memory
  private toolFactory: any

  constructor(memory: Memory, toolFactory: any) {
    this.memory = memory
    this.toolFactory = toolFactory
  }

  /**
   * Create agent based on configuration
   */
  createAgent(config: AgentConfig): Agent {
    const tools = this.createToolsForAgent(config.tools)

    return new Agent({
      name: config.name,
      instructions: config.instructions,
      model: openai("gpt-5"),
      memory: this.memory,
      tools,
    })
  }

  /**
   * Create generic RFP scraper agent
   */
  createGenericRFPAgent(): Agent {
    const config: AgentConfig = {
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
      portalType: "generic",
      tools: ["webScrape", "extractRFP", "authenticate"],
    }

    return this.createAgent(config)
  }

  /**
   * Create Bonfire Hub specialized agent
   */
  createBonfireAgent(): Agent {
    const config: AgentConfig = {
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
      portalType: "bonfire_hub",
      tools: ["webScrape", "extractRFP", "authenticate"],
    }

    return this.createAgent(config)
  }

  /**
   * Create SAM.gov specialized agent
   */
  createSAMGovAgent(): Agent {
    const config: AgentConfig = {
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
      portalType: "sam.gov",
      tools: ["webScrape", "extractRFP", "authenticate"],
    }

    return this.createAgent(config)
  }

  /**
   * Create FindRFP aggregator agent
   */
  createFindRFPAgent(): Agent {
    const config: AgentConfig = {
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
      portalType: "findrfp",
      tools: ["webScrape", "extractRFP", "authenticate"],
    }

    return this.createAgent(config)
  }

  /**
   * Create Philadelphia contracts agent
   */
  createPhiladelphiaAgent(): Agent {
    const config: AgentConfig = {
      name: "Philadelphia Contracts Specialist",
      instructions: `You are specialized in Philadelphia city contract portals. You understand:

      - Philadelphia city procurement procedures
      - Local business preferences and requirements
      - Department-specific contract patterns
      - Pre-bid meeting requirements
      - Local certification requirements

      Focus on:
      - City department contract structures
      - Local vendor preferences
      - Philadelphia-specific terminology
      - Contract value thresholds
      - Minority and women-owned business requirements`,
      portalType: "philadelphia",
      tools: ["webScrape", "extractRFP", "authenticate"],
    }

    return this.createAgent(config)
  }

  /**
   * Create Austin Finance agent
   */
  createAustinFinanceAgent(): Agent {
    const config: AgentConfig = {
      name: "Austin Finance Specialist",
      instructions: `You are specialized in Austin city finance procurement portals. You understand:

      - Austin Finance Online portal structure
      - Active solicitations table format
      - Solicitation ID patterns (IFQ, IFB, RFP, RFQS)
      - Austin city procurement procedures
      - Sustainability and local business criteria

      AUSTIN FINANCE SPECIFIC PATTERNS:
      - ACTIVE SOLICITATIONS table format
      - Solicitation codes: IFQ (Quote), IFB (Bid), RFP (Proposal), RFQS (Quotes)
      - Due date formats: "MM/DD/YYYY at XPM"
      - Detail URL patterns: solicitation_details.cfm?sid=XXXXX
      - Agency is always "City of Austin"

      Focus on:
      - Table/list extraction from Active Solicitations page
      - Proper date format conversion
      - Solicitation type classification
      - Document attachment handling`,
      portalType: "austin_finance",
      tools: ["webScrape", "extractRFP", "authenticate"],
    }

    return this.createAgent(config)
  }

  /**
   * Create custom agent for specific portal
   */
  createCustomAgent(
    portalType: string,
    name: string,
    instructions: string,
    tools: string[] = ["webScrape", "extractRFP"]
  ): Agent {
    const config: AgentConfig = {
      name,
      instructions,
      portalType,
      tools,
    }

    return this.createAgent(config)
  }

  /**
   * Create tools for an agent based on tool names
   */
  private createToolsForAgent(toolNames: string[]): Record<string, any> {
    const tools: Record<string, any> = {}

    toolNames.forEach((toolName) => {
      switch (toolName) {
        case "webScrape":
          tools.webScrape = this.createWebScrapingTool()
          break
        case "extractRFP":
          tools.extractRFP = this.createRFPExtractionTool()
          break
        case "authenticate":
          tools.authenticate = this.createAuthenticationTool()
          break
        case "navigation":
          tools.navigation = this.toolFactory?.createNavigationTool()
          break
        case "documentDownload":
          tools.documentDownload =
            this.toolFactory?.createDocumentDownloadTool()
          break
        case "contentValidation":
          tools.contentValidation =
            this.toolFactory?.createContentValidationTool()
          break
        default:
          console.warn(`⚠️ Unknown tool requested: ${toolName}`)
      }
    })

    return tools
  }

  /**
   * Create web scraping tool
   */
  private createWebScrapingTool() {
    return createTool({
      id: "web-scrape",
      description:
        "Scrape a website for RFP opportunities using unified Browserbase automation",
      inputSchema: z.object({
        url: z.string().describe("URL to scrape"),
        loginRequired: z.boolean().describe("Whether login is required"),
        credentials: z
          .object({
            username: z.string().optional(),
            password: z.string().optional(),
          })
          .optional()
          .describe("Login credentials if required"),
        portalType: z
          .string()
          .describe("Type of portal (bonfire, sam.gov, etc.)"),
        searchFilter: z
          .string()
          .optional()
          .describe(
            "Search filter to apply during scraping - only return opportunities related to this term"
          ),
        sessionId: z
          .string()
          .optional()
          .describe("Session ID for maintaining browser context"),
      }),
      execute: async ({ context }) => {
        // This would delegate to the unified scraping orchestrator
        // For now, return a placeholder
        console.log(`🌐 Web scraping tool called for: ${context.url}`)
        return {
          success: true,
          opportunities: [],
          message: "Web scraping tool executed",
        }
      },
    })
  }

  /**
   * Create RFP extraction tool
   */
  private createRFPExtractionTool() {
    return createTool({
      id: "extract-rfp-data",
      description: "Extract structured RFP data from web content using AI",
      inputSchema: z.object({
        content: z.string().describe("Raw web content to analyze"),
        url: z.string().describe("Source URL"),
        portalContext: z
          .string()
          .describe("Portal-specific context and patterns"),
      }),
      execute: async ({ context }) => {
        // This would delegate to content extraction services
        console.log(`📊 RFP extraction tool called for: ${context.url}`)
        return {
          success: true,
          opportunities: [],
          message: "RFP extraction tool executed",
        }
      },
    })
  }

  /**
   * Create authentication tool
   */
  private createAuthenticationTool() {
    return createTool({
      id: "authenticate-portal",
      description:
        "Handle portal authentication using unified Browserbase automation",
      inputSchema: z.object({
        portalUrl: z.string(),
        username: z.string(),
        password: z.string(),
        authContext: z
          .string()
          .describe("Portal-specific authentication context"),
        sessionId: z
          .string()
          .describe("Session ID for maintaining authenticated state"),
        portalType: z
          .string()
          .optional()
          .describe("Portal type for specialized authentication"),
      }),
      execute: async ({ context }) => {
        // This would delegate to the authentication manager
        console.log(`🔐 Authentication tool called for: ${context.portalUrl}`)
        return {
          success: true,
          sessionId: context.sessionId,
          message: "Authentication tool executed",
        }
      },
    })
  }

  /**
   * Get all supported portal types
   */
  getSupportedPortalTypes(): string[] {
    return [
      "generic",
      "bonfire_hub",
      "sam.gov",
      "findrfp",
      "philadelphia",
      "austin_finance",
    ]
  }

  /**
   * Check if portal type is supported
   */
  isPortalTypeSupported(portalType: string): boolean {
    return this.getSupportedPortalTypes().includes(portalType)
  }
}
