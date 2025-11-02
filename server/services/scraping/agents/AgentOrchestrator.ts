import { Agent } from '@mastra/core/agent';
import { AgentRegistry } from './AgentRegistry';
import { ScrapingContext, RFPOpportunity, ScrapingError } from '../types';
import type { Portal } from '@shared/schema';

/**
 * Orchestrator for managing agent execution and coordination
 */
export class AgentOrchestrator {
  private agentRegistry: AgentRegistry;

  constructor(agentRegistry: AgentRegistry) {
    this.agentRegistry = agentRegistry;
  }

  /**
   * Execute agent for portal scraping with comprehensive error handling and fallbacks
   */
  async executeAgentForPortal(
    portal: Portal,
    context: ScrapingContext
  ): Promise<{
    success: boolean;
    opportunities: RFPOpportunity[];
    agentUsed: string;
    executionTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let selectedAgent: Agent;
    let agentKey: string;

    try {
      // Select appropriate agent for the portal
      selectedAgent = this.agentRegistry.selectAgent(portal);
      agentKey = this.agentRegistry.getAgentIdForPortal(portal);

      console.log(`🤖 Selected agent: ${agentKey} for portal: ${portal.name}`);

      // Build context for the agent
      const agentContext = await this.buildAgentContext(portal, context);

      // Execute the agent
      const agentResult = await this.executeAgent(selectedAgent, agentContext);

      const executionTime = Date.now() - startTime;

      if (agentResult.success) {
        // Record successful execution
        this.agentRegistry.recordAgentExecution(agentKey, true, executionTime);

        console.log(
          `✅ Agent ${agentKey} executed successfully in ${executionTime}ms`
        );

        return {
          success: true,
          opportunities: agentResult.opportunities || [],
          agentUsed: agentKey,
          executionTime,
        };
      } else {
        // Record failed execution
        this.agentRegistry.recordAgentExecution(agentKey, false, executionTime);

        console.log(
          `❌ Agent ${agentKey} execution failed: ${agentResult.error}`
        );

        return {
          success: false,
          opportunities: [],
          agentUsed: agentKey,
          executionTime,
          error: agentResult.error,
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        `💥 Agent execution error for portal ${portal.name}:`,
        error
      );

      // Record failed execution if we have an agent key
      if (agentKey!) {
        this.agentRegistry.recordAgentExecution(agentKey, false, executionTime);
      }

      return {
        success: false,
        opportunities: [],
        agentUsed: agentKey! || 'unknown',
        executionTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute agent with prompt and tools
   */
  private async executeAgent(
    agent: Agent,
    context: any
  ): Promise<{
    success: boolean;
    opportunities?: RFPOpportunity[];
    error?: string;
  }> {
    try {
      console.log(`🚀 Executing agent: ${agent.name}`);

      // Generate response using the agent
      const response = await agent.generate(context.prompt, {
        context: context.toolContext,
      });

      console.log(`🤖 Agent response received (${response.text.length} chars)`);

      // Parse agent response
      const opportunities = this.parseAgentResponse(response.text);

      return {
        success: true,
        opportunities,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Agent execution failed:`, error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build context for agent execution
   */
  private async buildAgentContext(
    portal: Portal,
    scrapingContext: ScrapingContext
  ): Promise<{
    prompt: string;
    toolContext: any;
  }> {
    // Build portal context
    const portalContextString = await this.buildPortalContext(
      portal,
      scrapingContext.searchFilter
    );

    // Build scraping prompt
    const prompt = this.buildScrapingPrompt(
      portal,
      portalContextString,
      scrapingContext.searchFilter
    );

    // Build tool context
    const toolContext = {
      url: scrapingContext.url,
      loginRequired: scrapingContext.loginRequired || false,
      credentials: scrapingContext.credentials,
      portalType: scrapingContext.portalType,
      searchFilter: scrapingContext.searchFilter,
      sessionId: scrapingContext.sessionId,
    };

    return {
      prompt,
      toolContext,
    };
  }

  /**
   * Build portal context for agent prompt
   */
  private async buildPortalContext(
    portal: Portal,
    searchFilter?: string
  ): Promise<string> {
    // This would ideally get recent RFP data from storage
    // For now, providing basic context
    const searchFilterInfo = searchFilter
      ? `
    - Search Filter: "${searchFilter}" - Focus only on opportunities related to this term`
      : '';

    return `Portal Context:
    - Name: ${portal.name}
    - URL: ${portal.url}
    - Requires Login: ${portal.loginRequired}
    - Portal Status: ${portal.status}
    - Last Successful Scan: ${portal.lastScanned || 'Never'}${searchFilterInfo}`;
  }

  /**
   * Build scraping prompt based on portal type
   */
  private buildScrapingPrompt(
    portal: Portal,
    context: string,
    searchFilter?: string
  ): string {
    const isAustinFinance = portal.name
      .toLowerCase()
      .includes('austin finance');

    const austinFinanceFilterInstructions = searchFilter
      ? `

🔍 SEARCH FILTER ACTIVE: Only extract solicitations related to "${searchFilter}"
- Filter results to only include RFPs with titles/descriptions containing or related to "${searchFilter}"
- Ignore solicitations that are not related to this search term
- If no results match the filter, return an empty array`
      : '';

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

    const generalFilterInstructions = searchFilter
      ? `

🔍 SEARCH FILTER ACTIVE: Only look for opportunities related to "${searchFilter}"
- If the portal has a search function, use it to search for "${searchFilter}"
- Filter results to only include RFPs that contain or are related to "${searchFilter}"
- Ignore opportunities that are not related to this search term
- If no results match the filter, return an empty array`
      : '';

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

  /**
   * Parse agent response to extract opportunities
   */
  private parseAgentResponse(response: string): RFPOpportunity[] {
    try {
      console.log('🤖 Parsing AI agent response...');
      console.log(`📝 Agent response length: ${response.length} characters`);

      // First, try to extract JSON blocks from the response
      const jsonBlocks = this.extractJsonBlocks(response);
      console.log(`🔍 Found ${jsonBlocks.length} JSON blocks in response`);

      for (const jsonBlock of jsonBlocks) {
        try {
          const parsedData = JSON.parse(jsonBlock);

          // Handle different response formats
          if (Array.isArray(parsedData)) {
            return this.validateOpportunities(parsedData);
          }

          if (
            parsedData.opportunities &&
            Array.isArray(parsedData.opportunities)
          ) {
            return this.validateOpportunities(parsedData.opportunities);
          }

          if (parsedData.results && Array.isArray(parsedData.results)) {
            return this.validateOpportunities(parsedData.results);
          }

          // Single opportunity object
          if (parsedData.title) {
            return this.validateOpportunities([parsedData]);
          }
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse JSON block:`, parseError);
          continue;
        }
      }

      console.warn('No valid JSON opportunities found in agent response');
      console.log(
        `🚨 Agent response (first 1000 chars):`,
        response.substring(0, 1000)
      );
      return [];
    } catch (error) {
      console.error('Error parsing agent response:', error);
      return [];
    }
  }

  /**
   * Extract JSON blocks from text response
   */
  private extractJsonBlocks(text: string): string[] {
    const jsonBlocks: string[] = [];
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/gi,
      /```\s*([\s\S]*?)\s*```/gi,
      /\[[\s\S]*?\]/g,
      /\{[\s\S]*?\}/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const block = match[1] || match[0];
        if (block.trim()) {
          jsonBlocks.push(block.trim());
        }
      }
    }

    return jsonBlocks;
  }

  /**
   * Validate and normalize opportunities
   */
  private validateOpportunities(data: any[]): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    for (const item of data) {
      if (item && typeof item === 'object' && item.title) {
        opportunities.push({
          title: String(item.title),
          description: item.description ? String(item.description) : '',
          agency: item.agency ? String(item.agency) : undefined,
          deadline: item.deadline ? String(item.deadline) : undefined,
          estimatedValue: item.estimatedValue
            ? String(item.estimatedValue)
            : undefined,
          url: item.url ? String(item.url) : undefined,
          link: item.link ? String(item.link) : undefined,
          category: item.category ? String(item.category) : undefined,
          confidence:
            typeof item.confidence === 'number' ? item.confidence : 0.5,
        });
      }
    }

    console.log(
      `✅ Validated ${opportunities.length} opportunities from agent response`
    );
    return opportunities;
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(): any {
    return this.agentRegistry.getPerformanceReport();
  }

  /**
   * Health check for agent orchestrator
   */
  async healthCheck(): Promise<any> {
    return await this.agentRegistry.healthCheck();
  }

  /**
   * Get agent registry (for external access)
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }
}
