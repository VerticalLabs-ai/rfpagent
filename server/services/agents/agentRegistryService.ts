import { storage } from '../../storage';
import type { AgentRegistry, InsertAgentRegistry } from '@shared/schema';

/**
 * AgentRegistryService - Core service for managing the 3-tier agentic system
 *
 * Responsibilities:
 * - Agent lifecycle management (registration, deregistration, status updates)
 * - Capability-based agent discovery and routing
 * - Health monitoring and heartbeat management
 * - Load balancing and availability tracking
 */
export class AgentRegistryService {
  /**
   * Register a new agent in the system
   */
  async registerAgent(agentData: {
    agentId: string;
    tier: string;
    role: string;
    displayName: string;
    description?: string;
    capabilities: string[];
    tools?: string[];
    maxConcurrency?: number;
    parentAgentId?: string;
    configuration?: any;
  }): Promise<AgentRegistry> {
    const agent: InsertAgentRegistry = {
      agentId: agentData.agentId,
      tier: agentData.tier,
      role: agentData.role,
      displayName: agentData.displayName,
      description: agentData.description,
      capabilities: agentData.capabilities,
      tools: agentData.tools || [],
      maxConcurrency: agentData.maxConcurrency || 1,
      status: 'active',
      version: '1.0.0',
      configuration: agentData.configuration,
      parentAgentId: agentData.parentAgentId,
    };

    // Validate tier hierarchy if parentAgentId is provided
    if (agent.parentAgentId) {
      const parentAgent = await storage.getAgent(agent.parentAgentId);
      if (!parentAgent) {
        throw new Error(`Parent agent ${agent.parentAgentId} not found`);
      }

      // Validate tier hierarchy (specialist -> manager -> orchestrator)
      if (agent.tier === 'manager' && parentAgent.tier !== 'orchestrator') {
        throw new Error('Manager agents must report to orchestrator agents');
      }
      if (agent.tier === 'specialist' && parentAgent.tier !== 'manager') {
        throw new Error('Specialist agents must report to manager agents');
      }
    }

    return await storage.registerAgent(agent);
  }

  /**
   * Update agent heartbeat to indicate it's alive
   */
  async updateHeartbeat(agentId: string): Promise<void> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await storage.updateAgentHeartbeat(agentId);
  }

  /**
   * Update agent status (active, busy, offline, error)
   */
  async updateAgentStatus(
    agentId: string,
    status: string
  ): Promise<AgentRegistry> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return await storage.updateAgentStatus(agentId, status);
  }

  /**
   * Find agents by capability for task routing
   */
  async findAgentsByCapability(
    capabilities: string[],
    tier?: string
  ): Promise<AgentRegistry[]> {
    return await storage.findAvailableAgents(capabilities, tier);
  }

  /**
   * Get agents by tier (orchestrator, manager, specialist)
   */
  async getAgentsByTier(tier: string): Promise<AgentRegistry[]> {
    return await storage.getAgentsByTier(tier);
  }

  /**
   * Get all active agents
   */
  async getActiveAgents(): Promise<AgentRegistry[]> {
    return await storage.getActiveAgents();
  }

  /**
   * Get agent details
   */
  async getAgent(agentId: string): Promise<AgentRegistry | undefined> {
    return await storage.getAgent(agentId);
  }

  /**
   * Deregister an agent from the system
   */
  async deregisterAgent(agentId: string): Promise<void> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if agent has any active work items (pending, assigned, or in_progress)
    const [pendingWork, assignedWork, inProgressWork] = await Promise.all([
      storage.getWorkItemsByAgent(agentId, 'pending'),
      storage.getWorkItemsByAgent(agentId, 'assigned'),
      storage.getWorkItemsByAgent(agentId, 'in_progress'),
    ]);

    const activeWorkCount =
      pendingWork.length + assignedWork.length + inProgressWork.length;
    if (activeWorkCount > 0) {
      throw new Error(
        `Cannot deregister agent ${agentId}: has ${activeWorkCount} active work items`
      );
    }

    await storage.deregisterAgent(agentId);
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfiguration(
    agentId: string,
    configuration: any
  ): Promise<AgentRegistry> {
    return await storage.updateAgent(agentId, { configuration });
  }

  /**
   * Find the best available agent for a given capability
   * Considers agent load, response time, and availability
   */
  async findBestAgentForCapability(
    capability: string,
    tier?: string
  ): Promise<AgentRegistry | null> {
    const availableAgents = await this.findAgentsByCapability(
      [capability],
      tier
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // Simple load balancing - pick agent with least recent heartbeat (least busy)
    // In a production system, this would consider actual load metrics
    return availableAgents.sort((a, b) => {
      const aTime = a.lastHeartbeat?.getTime() || 0;
      const bTime = b.lastHeartbeat?.getTime() || 0;
      return aTime - bTime;
    })[0];
  }

  /**
   * Get agent health status including work load and performance
   */
  async getAgentHealth(agentId: string): Promise<{
    agent: AgentRegistry;
    activeWorkItems: number;
    pendingWorkItems: number;
    completedWorkItems: number;
    isHealthy: boolean;
  }> {
    const agent = await storage.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const [activeWork, pendingWork, completedWork] = await Promise.all([
      storage.getWorkItemsByAgent(agentId, 'in_progress'),
      storage.getWorkItemsByAgent(agentId, 'pending'),
      storage.getWorkItemsByAgent(agentId, 'completed'),
    ]);

    // Determine if agent is healthy based on last heartbeat
    const now = new Date();
    const lastHeartbeat = agent.lastHeartbeat || new Date(0);
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
    const isHealthy = timeSinceHeartbeat < 5 * 60 * 1000; // 5 minutes threshold

    return {
      agent,
      activeWorkItems: activeWork.length,
      pendingWorkItems: pendingWork.length,
      completedWorkItems: completedWork.length,
      isHealthy,
    };
  }

  /**
   * Get agent hierarchy - children agents for a given parent
   */
  async getAgentChildren(parentAgentId: string): Promise<AgentRegistry[]> {
    const allAgents = await storage.getActiveAgents();
    return allAgents.filter(agent => agent.parentAgentId === parentAgentId);
  }

  /**
   * Get comprehensive agent registry status for monitoring
   */
  async getRegistryStatus(): Promise<{
    totalAgents: number;
    activeAgents: number;
    agentsByTier: Record<string, number>;
    healthyAgents: number;
    unhealthyAgents: number;
  }> {
    const allAgents = await storage.getActiveAgents();
    const now = new Date();

    let healthyCount = 0;
    let unhealthyCount = 0;
    const tierCounts: Record<string, number> = {};

    for (const agent of allAgents) {
      // Count by tier
      tierCounts[agent.tier] = (tierCounts[agent.tier] || 0) + 1;

      // Check health
      const lastHeartbeat = agent.lastHeartbeat || new Date(0);
      const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
      const isHealthy = timeSinceHeartbeat < 5 * 60 * 1000; // 5 minutes threshold

      if (isHealthy) {
        healthyCount++;
      } else {
        unhealthyCount++;
      }
    }

    return {
      totalAgents: allAgents.length,
      activeAgents: allAgents.filter(a => a.status === 'active').length,
      agentsByTier: tierCounts,
      healthyAgents: healthyCount,
      unhealthyAgents: unhealthyCount,
    };
  }

  /**
   * Bootstrap the agent registry with default agents
   */
  async bootstrapDefaultAgents(): Promise<void> {
    // Register Primary Orchestrator
    const orchestratorId = 'primary-orchestrator';
    const existingOrchestrator = await storage.getAgent(orchestratorId);

    if (!existingOrchestrator) {
      await this.registerAgent({
        agentId: orchestratorId,
        tier: 'orchestrator',
        role: 'primary-orchestrator',
        displayName: 'Primary Orchestrator',
        description:
          'Main coordination agent for user interactions and workflow management',
        capabilities: [
          'session_management',
          'intent_analysis',
          'workflow_coordination',
          'task_delegation',
          'user_interface',
        ],
        tools: ['openai', 'database', 'notification'],
        maxConcurrency: 5,
        configuration: {
          maxSessionDuration: 3600, // 1 hour
          maxConcurrentSessions: 10,
        },
      });
    }

    // Register Manager Agents
    const managers = [
      {
        agentId: 'portal-manager',
        role: 'portal-manager',
        displayName: 'Portal Manager',
        description:
          'Coordinates portal-specific operations and scraping activities',
        capabilities: [
          'portal_management',
          'scraping_coordination',
          'data_extraction',
        ],
        tools: ['browser', 'puppeteer', 'database'],
      },
      {
        agentId: 'proposal-manager',
        role: 'proposal-manager',
        displayName: 'Proposal Manager',
        description:
          'Manages proposal generation, compliance checking, and quality assurance',
        capabilities: [
          'proposal_generation',
          'compliance_checking',
          'quality_assurance',
        ],
        tools: ['openai', 'document_parser', 'database'],
      },
      {
        agentId: 'research-manager',
        role: 'research-manager',
        displayName: 'Research Manager',
        description:
          'Coordinates market research and competitive analysis activities',
        capabilities: [
          'market_research',
          'competitive_analysis',
          'data_analysis',
        ],
        tools: ['openai', 'web_search', 'database'],
      },
    ];

    for (const manager of managers) {
      const existing = await storage.getAgent(manager.agentId);
      if (!existing) {
        await this.registerAgent({
          ...manager,
          tier: 'manager',
          parentAgentId: orchestratorId,
          maxConcurrency: 3,
        });
      }
    }

    // Register Specialist Agents
    const specialists = [
      // Portal Management Specialists
      {
        agentId: 'portal-scanner',
        parentAgentId: 'portal-manager',
        role: 'portal-scanner',
        displayName: 'Portal Scanner',
        description:
          'Specialized in automated portal scanning and RFP discovery',
        capabilities: [
          'portal_scanning',
          'rfp_discovery',
          'data_extraction',
          'authentication',
        ],
        tools: ['puppeteer', 'stagehand', 'database'],
      },
      {
        agentId: 'portal-monitor',
        parentAgentId: 'portal-manager',
        role: 'portal-monitor',
        displayName: 'Portal Monitor',
        description:
          'Monitors portal health, schedules scans, and tracks portal status',
        capabilities: [
          'portal_monitoring',
          'scheduling',
          'health_checking',
          'alerts',
        ],
        tools: ['cron', 'database', 'notification'],
      },
      // Proposal Generation Specialists
      {
        agentId: 'content-generator',
        parentAgentId: 'proposal-manager',
        role: 'content-generator',
        displayName: 'Content Generator',
        description:
          'Generates proposal content, narratives, and technical sections',
        capabilities: [
          'content_generation',
          'narrative_writing',
          'technical_writing',
          'template_processing',
        ],
        tools: ['openai', 'document_templates', 'database'],
      },
      {
        agentId: 'compliance-checker',
        parentAgentId: 'proposal-manager',
        role: 'compliance-checker',
        displayName: 'Compliance Checker',
        description:
          'Validates proposal compliance and identifies risk factors',
        capabilities: [
          'compliance_checking',
          'risk_assessment',
          'requirement_validation',
          'quality_assurance',
        ],
        tools: ['openai', 'compliance_rules', 'database'],
      },
      {
        agentId: 'document-processor',
        parentAgentId: 'proposal-manager',
        role: 'document-processor',
        displayName: 'Document Processor',
        description:
          'Processes, parses, and analyzes RFP documents and attachments',
        capabilities: [
          'document_processing',
          'text_extraction',
          'structure_analysis',
          'data_parsing',
        ],
        tools: ['pdf_parser', 'mammoth', 'openai', 'database'],
      },
      // Research Specialists
      {
        agentId: 'market-analyst',
        parentAgentId: 'research-manager',
        role: 'market-analyst',
        displayName: 'Market Analyst',
        description: 'Performs market research and competitive analysis',
        capabilities: [
          'market_research',
          'competitive_analysis',
          'pricing_analysis',
          'trend_analysis',
        ],
        tools: ['web_search', 'openai', 'database'],
      },
      {
        agentId: 'historical-analyzer',
        parentAgentId: 'research-manager',
        role: 'historical-analyzer',
        displayName: 'Historical Analyzer',
        description: 'Analyzes historical bid data and performance metrics',
        capabilities: [
          'historical_analysis',
          'performance_tracking',
          'success_prediction',
          'pattern_recognition',
        ],
        tools: ['database', 'analytics', 'openai'],
      },
    ];

    for (const specialist of specialists) {
      const existing = await storage.getAgent(specialist.agentId);
      if (!existing) {
        await this.registerAgent({
          ...specialist,
          tier: 'specialist',
          maxConcurrency: 2,
        });
      }
    }

    console.log('🤖 Bootstrap completed: 3-tier agentic system initialized');
    console.log('   - 1 Orchestrator Agent');
    console.log('   - 3 Manager Agents');
    console.log('   - 7 Specialist Agents');
  }
}

export const agentRegistryService = new AgentRegistryService();
