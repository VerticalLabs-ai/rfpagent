import { AgentFactory } from '../AgentFactory';
import { AgentRegistry } from '../AgentRegistry';
import { PortalDetectionService } from '../../portal/PortalDetectionService';
import { ScrapingConfigurationService } from '../../core/ScrapingConfigurationService';
import type { Portal } from '@shared/schema';
import { Agent } from '@mastra/core/agent';

/**
 * Specialized manager for portal-specific agent operations
 */
export class PortalAgentManager {
  private agentFactory: AgentFactory;
  private agentRegistry: AgentRegistry;
  private portalDetectionService: PortalDetectionService;
  private configurationService: ScrapingConfigurationService;

  constructor(
    agentFactory: AgentFactory,
    agentRegistry: AgentRegistry,
    portalDetectionService: PortalDetectionService,
    configurationService: ScrapingConfigurationService
  ) {
    this.agentFactory = agentFactory;
    this.agentRegistry = agentRegistry;
    this.portalDetectionService = portalDetectionService;
    this.configurationService = configurationService;
  }

  /**
   * Get or create specialized agent for a portal
   */
  async getAgentForPortal(portal: Portal): Promise<{
    agent: Agent;
    agentKey: string;
    isSpecialized: boolean;
  }> {
    const agentKey = this.agentRegistry.getAgentIdForPortal(portal);

    // Check if we already have a specialized agent
    const existingAgent = this.agentRegistry.getAgent(agentKey);
    if (existingAgent) {
      return {
        agent: existingAgent,
        agentKey,
        isSpecialized: agentKey !== 'generic',
      };
    }

    // Create specialized agent if we don't have one
    const specializedAgent = await this.createSpecializedAgent(portal);
    if (specializedAgent) {
      this.agentRegistry.registerAgent(
        agentKey,
        specializedAgent.agent,
        specializedAgent.config
      );
      return {
        agent: specializedAgent.agent,
        agentKey,
        isSpecialized: true,
      };
    }

    // Fall back to generic agent
    const genericAgent = this.agentRegistry.getAgent('generic');
    if (!genericAgent) {
      throw new Error('No generic agent available');
    }

    return {
      agent: genericAgent,
      agentKey: 'generic',
      isSpecialized: false,
    };
  }

  /**
   * Create a specialized agent for a portal based on its characteristics
   */
  private async createSpecializedAgent(portal: Portal): Promise<{
    agent: Agent;
    config: any;
  } | null> {
    try {
      // Detect portal type
      const validationResult =
        this.portalDetectionService.validateAndDetectPortal(portal.url);
      if (!validationResult.isValid || !validationResult.portalType) {
        return null;
      }

      const portalType = validationResult.portalType;

      // Get portal configuration
      const portalConfig =
        this.portalDetectionService.getPortalConfiguration(portalType);
      if (!portalConfig) {
        return null;
      }

      // Create specialized instructions based on portal characteristics
      const instructions = this.generateSpecializedInstructions(
        portal,
        portalType,
        portalConfig
      );

      // Determine required tools
      const tools = this.determineRequiredTools(
        portal,
        portalType,
        portalConfig
      );

      // Create the specialized agent
      const agent = this.agentFactory.createCustomAgent(
        portalType,
        `${portal.name} Specialist`,
        instructions,
        tools
      );

      const config = {
        name: `${portal.name} Specialist`,
        instructions,
        portalType,
        tools,
      };

      console.log(
        `🎯 Created specialized agent for ${portal.name} (${portalType})`
      );

      return { agent, config };
    } catch (error) {
      console.error(
        `❌ Failed to create specialized agent for ${portal.name}:`,
        error
      );
      return null;
    }
  }

  /**
   * Generate specialized instructions based on portal characteristics
   */
  private generateSpecializedInstructions(
    portal: Portal,
    portalType: string,
    portalConfig: any
  ): string {
    const baseInstructions = `You are a specialized agent for ${portal.name} procurement portal.`;

    // Portal-specific instructions
    const portalSpecificInstructions =
      this.getPortalSpecificInstructions(portalType);

    // Authentication instructions
    const authInstructions = portalConfig.authRequired
      ? this.getAuthenticationInstructions(portalType)
      : 'This portal provides public access to opportunities.';

    // Extraction patterns
    const extractionInstructions = this.getExtractionInstructions(
      portalType,
      portalConfig
    );

    return `${baseInstructions}

Portal Details:
- URL: ${portal.url}
- Authentication Required: ${portalConfig.authRequired}
- Portal Type: ${portalType}

${portalSpecificInstructions}

${authInstructions}

${extractionInstructions}

Always focus on extracting accurate, complete information and return structured JSON data with confidence scores.`;
  }

  /**
   * Get portal-specific instructions
   */
  private getPortalSpecificInstructions(portalType: string): string {
    const instructions: Record<string, string> = {
      bonfire_hub: `BONFIRE HUB EXPERTISE:
- Understand Bonfire's specific layout patterns and data structures
- Handle Euna Supplier Network (ESN) authentication flows
- Navigate opportunity listings and category filters
- Extract Bonfire-specific metadata and document attachments
- Handle agency-specific customizations within Bonfire portals`,

      sam_gov: `SAM.GOV FEDERAL EXPERTISE:
- Navigate federal procurement terminology and structures
- Understand NAICS code classification systems
- Handle set-aside categories (Small Business, WOSB, etc.)
- Extract federal timeline and response requirements
- Identify contract vehicle types (GSA, SEWP, CIO-SP3, etc.)`,

      findrfp: `FINDRFP AGGREGATION EXPERTISE:
- Navigate multi-source aggregation patterns
- Handle standardized opportunity formats across different sources
- Follow link-through patterns to original portal sources
- Understand subscription and access tier differences
- Cross-reference with original portal data`,

      philadelphia: `PHILADELPHIA CITY EXPERTISE:
- Navigate Philadelphia city procurement procedures
- Understand local business preferences and requirements
- Extract department-specific contract patterns
- Handle pre-bid meeting requirements
- Identify local certification requirements`,

      austin_finance: `AUSTIN FINANCE EXPERTISE:
- Navigate Austin Finance Online portal structure
- Extract from Active Solicitations table format
- Handle solicitation ID patterns (IFQ, IFB, RFP, RFQS)
- Convert Austin-specific date formats
- Generate proper detail URLs (solicitation_details.cfm?sid=XXXXX)`,
    };

    return (
      instructions[portalType] ||
      'Navigate this portal using general procurement knowledge.'
    );
  }

  /**
   * Get authentication instructions for portal type
   */
  private getAuthenticationInstructions(portalType: string): string {
    const authInstructions: Record<string, string> = {
      bonfire_hub: `BONFIRE AUTHENTICATION:
- Handle redirects to "network.euna.com" for ESN authentication
- Navigate multi-step login flow (email → continue → password → submit)
- Wait for Cloudflare protection to clear
- Verify successful authentication by checking for opportunity listings`,

      sam_gov: `SAM.GOV AUTHENTICATION:
- Handle federal login procedures
- Navigate PIV card authentication if required
- Handle multi-factor authentication flows
- Verify access to restricted federal opportunities`,

      generic: `STANDARD AUTHENTICATION:
- Detect and handle various login form patterns
- Support multiple authentication methods
- Handle session management and cookies
- Verify successful authentication`,
    };

    return authInstructions[portalType] || authInstructions.generic;
  }

  /**
   * Get extraction instructions for portal type
   */
  private getExtractionInstructions(
    portalType: string,
    portalConfig: any
  ): string {
    const selectors = portalConfig.selectors || {};

    let selectorInfo = '';
    if (selectors.opportunityList) {
      selectorInfo += `- Opportunity listings: ${selectors.opportunityList}\n`;
    }
    if (selectors.opportunityItem) {
      selectorInfo += `- Individual opportunities: ${selectors.opportunityItem}\n`;
    }

    return `EXTRACTION PATTERNS:
${selectorInfo}
- Focus on active, open opportunities only
- Extract complete metadata including deadlines, values, and descriptions
- Generate specific detail page URLs for each opportunity
- Maintain high confidence scores for validated data`;
  }

  /**
   * Determine required tools based on portal characteristics
   */
  private determineRequiredTools(
    portal: Portal,
    portalType: string,
    portalConfig: any
  ): string[] {
    const tools = ['webScrape', 'extractRFP'];

    // Add authentication tool if required
    if (portalConfig.authRequired) {
      tools.push('authenticate');
    }

    // Add navigation tool for complex portals
    if (portalType === 'bonfire_hub' || portalType === 'sam_gov') {
      tools.push('navigation');
    }

    // Add document download tool for portals with attachments
    if (
      portalType === 'bonfire_hub' ||
      portalType === 'sam_gov' ||
      portalType === 'austin_finance'
    ) {
      tools.push('documentDownload');
    }

    // Always add content validation
    tools.push('contentValidation');

    return tools;
  }

  /**
   * Update agent for portal if configuration changes
   */
  async updateAgentForPortal(portal: Portal): Promise<boolean> {
    try {
      const agentKey = this.agentRegistry.getAgentIdForPortal(portal);

      // Remove existing agent
      this.agentRegistry.unregisterAgent(agentKey);

      // Create new specialized agent
      const newAgent = await this.createSpecializedAgent(portal);
      if (newAgent) {
        this.agentRegistry.registerAgent(
          agentKey,
          newAgent.agent,
          newAgent.config
        );
        console.log(`🔄 Updated agent for ${portal.name}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Failed to update agent for ${portal.name}:`, error);
      return false;
    }
  }

  /**
   * Get agent performance for a specific portal
   */
  getPortalAgentPerformance(portal: Portal): any {
    const agentKey = this.agentRegistry.getAgentIdForPortal(portal);
    const stats = this.agentRegistry.getAgentStats().get(agentKey);

    return {
      agentKey,
      portalName: portal.name,
      portalUrl: portal.url,
      stats: stats || {
        totalRuns: 0,
        successfulRuns: 0,
        lastUsed: new Date(),
        averageResponseTime: 0,
      },
    };
  }

  /**
   * Optimize agent selection based on performance
   */
  async optimizeAgentSelection(portals: Portal[]): Promise<{
    optimizations: Array<{
      portal: string;
      currentAgent: string;
      recommendedAgent: string;
      reason: string;
    }>;
    totalOptimizations: number;
  }> {
    const optimizations: Array<{
      portal: string;
      currentAgent: string;
      recommendedAgent: string;
      reason: string;
    }> = [];

    for (const portal of portals) {
      const currentAgentKey = this.agentRegistry.getAgentIdForPortal(portal);
      const stats = this.agentRegistry.getAgentStats().get(currentAgentKey);

      if (stats && stats.totalRuns > 10) {
        const successRate = stats.successfulRuns / stats.totalRuns;
        const avgResponseTime = stats.averageResponseTime;

        // Recommend optimization if success rate is low or response time is high
        if (successRate < 0.7 || avgResponseTime > 30000) {
          const recommendedAgent =
            successRate < 0.5 ? 'generic' : currentAgentKey;
          const reason =
            successRate < 0.7
              ? `Low success rate: ${(successRate * 100).toFixed(1)}%`
              : `High response time: ${(avgResponseTime / 1000).toFixed(1)}s`;

          optimizations.push({
            portal: portal.name,
            currentAgent: currentAgentKey,
            recommendedAgent,
            reason,
          });
        }
      }
    }

    return {
      optimizations,
      totalOptimizations: optimizations.length,
    };
  }
}
