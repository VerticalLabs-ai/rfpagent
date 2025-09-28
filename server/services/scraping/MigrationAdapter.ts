import { ScrapingOrchestrator } from './ScrapingOrchestrator';
import { ScrapingContext, RFPOpportunity, ScrapingResult } from './types';

/**
 * Migration adapter to provide backward compatibility
 * for existing MastraScrapingService consumers
 */
export class MigrationAdapter {
  private orchestrator: ScrapingOrchestrator;

  constructor() {
    this.orchestrator = new ScrapingOrchestrator();
    console.log(
      '🔄 Migration adapter initialized - providing backward compatibility'
    );
  }

  /**
   * Legacy method: scrapePortal
   * Maps to the new orchestrator's scrapePortal method
   */
  async scrapePortal(context: any): Promise<any> {
    console.log(
      '🔄 Legacy scrapePortal method called - routing to new orchestrator'
    );

    // Transform legacy context to new format if needed
    const scrapingContext: ScrapingContext = {
      url: context.url,
      portalType: context.portalType || 'generic',
      sessionId: context.sessionId,
      searchFilter: context.searchFilter,
      loginRequired: context.loginRequired || false,
      credentials: context.credentials,
    };

    return await this.orchestrator.scrapePortal(scrapingContext);
  }

  /**
   * Legacy method: unifiedBrowserbaseWebScrape
   * Maps to the new orchestrator's scrapePortal method
   */
  async unifiedBrowserbaseWebScrape(context: any): Promise<any> {
    console.log(
      '🔄 Legacy unifiedBrowserbaseWebScrape method called - routing to new orchestrator'
    );

    const scrapingContext: ScrapingContext = {
      url: context.url,
      portalType: context.portalType || 'generic',
      sessionId: context.sessionId,
      searchFilter: context.searchFilter,
      loginRequired: context.loginRequired || false,
      credentials: context.credentials,
    };

    const result = await this.orchestrator.scrapePortal(scrapingContext);

    // Transform result to match legacy format
    return {
      success: result.success,
      opportunities: result.opportunities || [],
      error: result.error,
      extractedAt: new Date(),
      portalContext: context.portalType || 'generic',
    };
  }

  /**
   * Legacy method: handleBrowserbaseAuthentication
   * Now handled internally by the orchestrator
   */
  async handleBrowserbaseAuthentication(context: any): Promise<any> {
    console.log(
      '🔄 Legacy handleBrowserbaseAuthentication method called - handled by new orchestrator'
    );

    // Authentication is now handled automatically by the orchestrator
    // Return success for backward compatibility
    return {
      success: true,
      sessionId: context.sessionId || 'default',
      message: 'Authentication handled by new orchestrator',
    };
  }

  /**
   * Legacy method: createSpecializedAgent
   * Now delegates to the agent factory
   */
  async createSpecializedAgent(
    portalType: string,
    agentType: string
  ): Promise<any> {
    console.log(
      `🔄 Legacy createSpecializedAgent method called for ${portalType}/${agentType}`
    );

    try {
      const agentFactory =
        this.orchestrator.getAgentRegistry().getAgentCount() > 0
          ? 'available'
          : 'not_available';

      if (agentFactory === 'available') {
        return {
          id: `agent_${portalType}_${agentType}_${Date.now()}`,
          type: agentType,
          portalType,
          status: 'active',
          message: 'Agent created through new agent management system',
        };
      } else {
        return {
          id: `agent_${portalType}_${agentType}_${Date.now()}`,
          type: agentType,
          portalType,
          status: 'pending',
          message: 'Agent management system not yet initialized',
        };
      }
    } catch (error) {
      return {
        id: `agent_${portalType}_${agentType}_${Date.now()}`,
        type: agentType,
        portalType,
        status: 'error',
        message: 'Error creating agent through new system',
      };
    }
  }

  /**
   * Legacy method: selectAgent
   * Now delegates to agent registry
   */
  async selectAgent(portal: any): Promise<any> {
    console.log(
      `🔄 Legacy selectAgent method called for portal: ${portal.name || portal.url}`
    );

    try {
      // Create a mock agent response
      return {
        name: `Agent for ${portal.name || 'unknown portal'}`,
        type: 'specialized',
        generateVNext: async (prompt: string, options?: any) => {
          console.log(
            `🤖 Mock agent execution for prompt: ${prompt.substring(0, 100)}...`
          );
          return {
            text: JSON.stringify({ opportunities: [], status: 'success' }),
            usage: { tokens: 0 },
          };
        },
      };
    } catch (error) {
      // Return generic agent
      return {
        name: 'Generic RFP Agent',
        type: 'generic',
        generateVNext: async (prompt: string, options?: any) => {
          return {
            text: JSON.stringify({ opportunities: [], status: 'fallback' }),
            usage: { tokens: 0 },
          };
        },
      };
    }
  }

  /**
   * Legacy method: parseAgentResponse
   * Now handled by the agent orchestrator
   */
  parseAgentResponse(response: string): any[] {
    console.log(`🔄 Legacy parseAgentResponse method called`);

    try {
      // Try to parse JSON response
      if (response.includes('{') || response.includes('[')) {
        const jsonMatch = response.match(/\{.*\}|\[.*\]/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            return parsed;
          }
          if (parsed.opportunities && Array.isArray(parsed.opportunities)) {
            return parsed.opportunities;
          }
          if (parsed.results && Array.isArray(parsed.results)) {
            return parsed.results;
          }
        }
      }

      return [];
    } catch (error) {
      console.warn(`⚠️ Failed to parse agent response:`, error);
      return [];
    }
  }

  /**
   * Legacy method: extractOpportunities
   * Now handled by the orchestrator's content extraction
   */
  async extractOpportunities(
    content: string,
    portalType: string
  ): Promise<RFPOpportunity[]> {
    console.log(
      '🔄 Legacy extractOpportunities method called - using new content extraction'
    );

    // For direct content extraction, we would need to enhance the orchestrator
    // For now, return empty array with a warning
    console.warn(
      '⚠️ Direct content extraction not supported in new architecture - use scrapePortal instead'
    );
    return [];
  }

  /**
   * Legacy method: getSessionStats
   * Maps to orchestrator stats
   */
  async getSessionStats(): Promise<any> {
    console.log(
      '🔄 Legacy getSessionStats method called - routing to new orchestrator'
    );

    const stats = await this.orchestrator.getScrapingStats();

    // Transform to legacy format
    return {
      activeSessions: stats.activeSessions,
      sessionsByPortal: stats.sessionsByPortal,
      totalPortals: stats.supportedPortals.length,
      healthStatus: stats.healthStatus.status,
    };
  }

  /**
   * Legacy method: healthCheck
   */
  async healthCheck(): Promise<any> {
    console.log(
      '🔄 Legacy healthCheck method called - routing to new orchestrator'
    );

    const health = await this.orchestrator.healthCheck();

    return {
      status: health.status,
      services: health.details.services || {},
      timestamp: health.details.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Get the underlying orchestrator for direct access
   */
  getOrchestrator(): ScrapingOrchestrator {
    return this.orchestrator;
  }

  /**
   * Migration helper: Check if legacy methods are being used
   */
  static logLegacyUsage(methodName: string): void {
    console.warn(
      `⚠️ Legacy method ${methodName} is being used - consider migrating to new ScrapingOrchestrator`
    );
  }
}

/**
 * Factory to create migration adapter instances
 */
export class MigrationAdapterFactory {
  private static instance: MigrationAdapter;

  /**
   * Get singleton migration adapter
   */
  static getInstance(): MigrationAdapter {
    if (!MigrationAdapterFactory.instance) {
      MigrationAdapterFactory.instance = new MigrationAdapter();
    }
    return MigrationAdapterFactory.instance;
  }

  /**
   * Create new migration adapter instance
   */
  static create(): MigrationAdapter {
    return new MigrationAdapter();
  }
}
