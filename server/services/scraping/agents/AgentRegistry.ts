import { Agent } from '@mastra/core/agent';
import { AgentFactory } from './AgentFactory';
import { AgentConfig } from '../types';
import type { Portal } from '@shared/schema';

/**
 * Registry for managing and tracking all scraping agents
 */
export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private agentFactory: AgentFactory;
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private agentUsageStats: Map<
    string,
    {
      totalRuns: number;
      successfulRuns: number;
      lastUsed: Date;
      averageResponseTime: number;
    }
  > = new Map();

  constructor(agentFactory: AgentFactory) {
    this.agentFactory = agentFactory;
    this.initializeDefaultAgents();
  }

  /**
   * Initialize all default agents
   */
  private initializeDefaultAgents(): void {
    console.log('🤖 Initializing default scraping agents...');

    // Create and register all default agents
    const agents = [
      {
        key: 'generic',
        creator: () => this.agentFactory.createGenericRFPAgent(),
      },
      {
        key: 'bonfire_hub',
        creator: () => this.agentFactory.createBonfireAgent(),
      },
      { key: 'sam.gov', creator: () => this.agentFactory.createSAMGovAgent() },
      { key: 'findrfp', creator: () => this.agentFactory.createFindRFPAgent() },
      {
        key: 'philadelphia',
        creator: () => this.agentFactory.createPhiladelphiaAgent(),
      },
      {
        key: 'austin_finance',
        creator: () => this.agentFactory.createAustinFinanceAgent(),
      },
    ];

    agents.forEach(({ key, creator }) => {
      try {
        const agent = creator();
        this.registerAgent(key, agent);
        this.initializeAgentStats(key);
        console.log(`✅ Registered agent: ${key}`);
      } catch (error) {
        console.error(`❌ Failed to create agent ${key}:`, error);
      }
    });

    console.log(
      `🎯 Agent registry initialized with ${this.agents.size} agents`
    );
  }

  /**
   * Register a new agent
   */
  registerAgent(key: string, agent: Agent, config?: AgentConfig): void {
    this.agents.set(key, agent);

    if (config) {
      this.agentConfigs.set(key, config);
    }

    if (!this.agentUsageStats.has(key)) {
      this.initializeAgentStats(key);
    }

    console.log(`🤖 Agent registered: ${key}`);
  }

  /**
   * Get agent by key
   */
  getAgent(key: string): Agent | undefined {
    return this.agents.get(key);
  }

  /**
   * Select best agent for a portal
   */
  selectAgent(portal: Portal): Agent {
    const portalName = portal.name.toLowerCase().replace(/\s+/g, '_');

    // 1. Try exact match first
    if (this.agents.has(portalName)) {
      const agent = this.agents.get(portalName)!;
      this.updateAgentUsage(portalName);
      return agent;
    }

    // 2. Try portal type mapping
    const agentKey = this.getAgentKeyForPortal(portal);
    if (this.agents.has(agentKey)) {
      const agent = this.agents.get(agentKey)!;
      this.updateAgentUsage(agentKey);
      return agent;
    }

    // 3. Check for partial matches
    for (const [key, agent] of Array.from(this.agents.entries())) {
      if (key !== 'generic' && portalName.includes(key.split('_')[0])) {
        this.updateAgentUsage(key);
        return agent;
      }
    }

    // 4. Use performance-based selection for generic cases
    const bestAgent = this.selectBestPerformingAgent();
    if (bestAgent) {
      return bestAgent.agent;
    }

    // 5. Fall back to generic agent
    const genericAgent = this.agents.get('generic')!;
    this.updateAgentUsage('generic');
    return genericAgent;
  }

  /**
   * Get agent key for coordination tracking based on portal type
   */
  getAgentIdForPortal(portal: Portal): string {
    return this.getAgentKeyForPortal(portal);
  }

  /**
   * Map portal to agent key
   */
  private getAgentKeyForPortal(portal: Portal): string {
    const portalName = portal.name.toLowerCase();
    const portalUrl = portal.url.toLowerCase();

    // URL-based detection (more reliable)
    if (
      portalUrl.includes('bonfirehub.com') ||
      portalUrl.includes('vendor.bonfirehub.com')
    ) {
      return 'bonfire_hub';
    }
    if (portalUrl.includes('sam.gov')) {
      return 'sam.gov';
    }
    if (
      portalUrl.includes('findrfp.com') ||
      portalUrl.includes('find-rfp.com')
    ) {
      return 'findrfp';
    }
    if (portalUrl.includes('phlcontracts.phila.gov')) {
      return 'philadelphia';
    }
    if (
      portalUrl.includes('financeonline.austintexas.gov') ||
      (portalUrl.includes('austin') && portalUrl.includes('finance'))
    ) {
      return 'austin_finance';
    }

    // Name-based detection (fallback)
    if (portalName.includes('bonfire')) return 'bonfire_hub';
    if (portalName.includes('sam.gov') || portalName.includes('sam_gov'))
      return 'sam.gov';
    if (portalName.includes('findrfp')) return 'findrfp';
    if (portalName.includes('philadelphia') || portalName.includes('phila'))
      return 'philadelphia';
    if (portalName.includes('austin')) return 'austin_finance';

    return 'generic';
  }

  /**
   * Select best performing agent based on success rate and response time
   */
  private selectBestPerformingAgent(): { key: string; agent: Agent } | null {
    let bestAgent: { key: string; agent: Agent; score: number } | null = null;

    for (const [key, agent] of this.agents.entries()) {
      const stats = this.agentUsageStats.get(key);
      if (!stats || stats.totalRuns === 0) continue;

      // Calculate performance score (success rate weighted by response time)
      const successRate = stats.successfulRuns / stats.totalRuns;
      const responseTimeFactor = Math.max(
        0.1,
        1 / (stats.averageResponseTime / 1000)
      ); // Faster is better
      const score = successRate * responseTimeFactor;

      if (!bestAgent || score > bestAgent.score) {
        bestAgent = { key, agent, score };
      }
    }

    if (bestAgent) {
      this.updateAgentUsage(bestAgent.key);
      return { key: bestAgent.key, agent: bestAgent.agent };
    }

    return null;
  }

  /**
   * Update agent usage statistics
   */
  private updateAgentUsage(agentKey: string): void {
    const stats = this.agentUsageStats.get(agentKey);
    if (stats) {
      stats.lastUsed = new Date();
    }
  }

  /**
   * Record agent execution result
   */
  recordAgentExecution(
    agentKey: string,
    success: boolean,
    responseTime: number
  ): void {
    const stats = this.agentUsageStats.get(agentKey);
    if (!stats) {
      this.initializeAgentStats(agentKey);
      return this.recordAgentExecution(agentKey, success, responseTime);
    }

    stats.totalRuns++;
    if (success) {
      stats.successfulRuns++;
    }

    // Update running average of response time
    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.totalRuns - 1) + responseTime) /
      stats.totalRuns;
    stats.lastUsed = new Date();

    console.log(
      `📊 Agent ${agentKey} execution recorded: ${success ? 'success' : 'failure'}, ${responseTime}ms`
    );
  }

  /**
   * Initialize stats for an agent
   */
  private initializeAgentStats(agentKey: string): void {
    this.agentUsageStats.set(agentKey, {
      totalRuns: 0,
      successfulRuns: 0,
      lastUsed: new Date(),
      averageResponseTime: 0,
    });
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Map<string, Agent> {
    return new Map(this.agents);
  }

  /**
   * Get agent configurations
   */
  getAgentConfigs(): Map<string, AgentConfig> {
    return new Map(this.agentConfigs);
  }

  /**
   * Get agent usage statistics
   */
  getAgentStats(): Map<string, any> {
    return new Map(this.agentUsageStats);
  }

  /**
   * Remove agent from registry
   */
  unregisterAgent(key: string): boolean {
    const removed = this.agents.delete(key);
    if (removed) {
      this.agentConfigs.delete(key);
      this.agentUsageStats.delete(key);
      console.log(`🗑️ Agent unregistered: ${key}`);
    }
    return removed;
  }

  /**
   * Check if agent exists
   */
  hasAgent(key: string): boolean {
    return this.agents.has(key);
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Create and register a new custom agent
   */
  createAndRegisterCustomAgent(
    key: string,
    name: string,
    instructions: string,
    portalType: string,
    tools: string[] = ['webScrape', 'extractRFP']
  ): Agent {
    const agent = this.agentFactory.createCustomAgent(
      portalType,
      name,
      instructions,
      tools
    );

    const config: AgentConfig = {
      name,
      instructions,
      portalType,
      tools,
    };

    this.registerAgent(key, agent, config);
    return agent;
  }

  /**
   * Get performance report for all agents
   */
  getPerformanceReport(): {
    totalAgents: number;
    totalExecutions: number;
    overallSuccessRate: number;
    agentBreakdown: Array<{
      key: string;
      name: string;
      totalRuns: number;
      successRate: number;
      averageResponseTime: number;
      lastUsed: string;
    }>;
  } {
    let totalExecutions = 0;
    let totalSuccesses = 0;

    const agentBreakdown = Array.from(this.agents.entries()).map(
      ([key, agent]) => {
        const stats = this.agentUsageStats.get(key) || {
          totalRuns: 0,
          successfulRuns: 0,
          lastUsed: new Date(),
          averageResponseTime: 0,
        };

        totalExecutions += stats.totalRuns;
        totalSuccesses += stats.successfulRuns;

        return {
          key,
          name: agent.name || key,
          totalRuns: stats.totalRuns,
          successRate:
            stats.totalRuns > 0 ? stats.successfulRuns / stats.totalRuns : 0,
          averageResponseTime: stats.averageResponseTime,
          lastUsed: stats.lastUsed.toISOString(),
        };
      }
    );

    return {
      totalAgents: this.agents.size,
      totalExecutions,
      overallSuccessRate:
        totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
      agentBreakdown,
    };
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalAgents: number;
      activeAgents: number;
      recentFailures: number;
    };
  }> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let activeAgents = 0;
    let recentFailures = 0;

    for (const [key, stats] of this.agentUsageStats.entries()) {
      if (stats.lastUsed.getTime() > oneHourAgo) {
        activeAgents++;
      }

      const recentSuccessRate =
        stats.totalRuns > 0 ? stats.successfulRuns / stats.totalRuns : 1;
      if (recentSuccessRate < 0.5) {
        recentFailures++;
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (recentFailures === 0 && activeAgents > 0) {
      status = 'healthy';
    } else if (recentFailures < this.agents.size / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        totalAgents: this.agents.size,
        activeAgents,
        recentFailures,
      },
    };
  }
}
