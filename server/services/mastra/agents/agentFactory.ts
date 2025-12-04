/**
 * Agent Factory for Mastra Scraping Service
 *
 * Creates specialized Mastra agents for different portal types
 */

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';
import type { ToolAction } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';

/**
 * Tool interface matching Mastra tool structure
 * These are Mastra tool objects, not raw functions
 */
interface AgentTools {
  webScrape: ToolAction<
    any,
    any,
    any,
    any,
    ToolExecutionContext<any, any, any>
  >;
  extractRFP: ToolAction<
    any,
    any,
    any,
    any,
    ToolExecutionContext<any, any, any>
  >;
  authenticate: ToolAction<
    any,
    any,
    any,
    any,
    ToolExecutionContext<any, any, any>
  >;
}

/**
 * Create a generic RFP scraping agent
 * Handles various government and corporate procurement portals
 */
export function createGenericRFPAgent(
  memory: Memory | undefined,
  tools: AgentTools
): Agent {
  return new Agent({
    name: 'Generic RFP Scraper',
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

    model: openai('gpt-5'),
    memory,
    tools: {
      webScrape: tools.webScrape,
      extractRFP: tools.extractRFP,
      authenticate: tools.authenticate,
    },
  });
}

/**
 * Create a Bonfire Hub specialist agent
 * Specialized for Bonfire procurement portals with ESN authentication
 */
export function createBonfireAgent(memory: Memory | undefined, tools: AgentTools): Agent {
  return new Agent({
    name: 'Bonfire Hub Specialist',
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

    model: openai('gpt-5'),
    memory,
    tools: {
      webScrape: tools.webScrape,
      extractRFP: tools.extractRFP,
      authenticate: tools.authenticate,
    },
  });
}

/**
 * Create a SAM.gov federal specialist agent
 * Specialized for federal procurement opportunities
 */
export function createSAMGovAgent(memory: Memory | undefined, tools: AgentTools): Agent {
  return new Agent({
    name: 'SAM.gov Federal Specialist',
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

    model: openai('gpt-5'),
    memory,
    tools: {
      webScrape: tools.webScrape,
      extractRFP: tools.extractRFP,
      authenticate: tools.authenticate,
    },
  });
}

/**
 * Create a FindRFP aggregator specialist agent
 * Specialized for RFP aggregation platforms
 */
export function createFindRFPAgent(memory: Memory | undefined, tools: AgentTools): Agent {
  return new Agent({
    name: 'FindRFP Aggregator Specialist',
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

    model: openai('gpt-5'),
    memory,
    tools: {
      webScrape: tools.webScrape,
      extractRFP: tools.extractRFP,
      authenticate: tools.authenticate,
    },
  });
}
