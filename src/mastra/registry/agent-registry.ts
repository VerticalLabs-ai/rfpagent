import { Agent } from '@mastra/core/agent';

/**
 * Metadata describing an agent's role, capabilities, and relationships
 * within the multi-tier hierarchy
 */
export interface AgentMetadata {
  /** Unique identifier for the agent */
  id: string;

  /** Human-readable name */
  name: string;

  /** Hierarchical tier (1=Orchestrator, 2=Manager, 3=Specialist, 4+=Sub-Specialist) */
  tier: 1 | 2 | 3 | 4 | 5;

  /** Agent's role in the system */
  role: 'orchestrator' | 'manager' | 'specialist' | 'sub-specialist';

  /** List of capabilities this agent provides */
  capabilities: string[];

  /** IDs of workflows that require this agent */
  requiredBy?: string[];

  /** IDs of agents this agent manages (for managers) */
  manages?: string[];

  /** ID of parent agent in hierarchy */
  reportsTo?: string;

  /** Scaling configuration for agent pooling */
  scaling?: {
    /** Minimum number of instances */
    min: number;
    /** Maximum number of instances */
    max: number;
    /** Scaling strategy */
    strategy: 'fixed' | 'auto' | 'demand';
  };

  /** Runtime health status */
  health?: {
    status: 'active' | 'idle' | 'busy' | 'failed';
    lastSeen?: Date;
    taskCount?: number;
    errorCount?: number;
  };

  /** Custom metadata for extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * Registry entry combining an agent instance with its metadata
 */
interface AgentRegistryEntry {
  agent: Agent;
  metadata: AgentMetadata;
}

/**
 * Centralized registry for managing agents and their metadata
 * in a multi-tier hierarchical architecture
 *
 * @example
 * ```typescript
 * const registry = new AgentRegistry();
 *
 * // Register an agent
 * registry.register('portal-scanner', portalScannerAgent, {
 *   id: 'portal-scanner',
 *   name: 'Portal Scanner',
 *   tier: 3,
 *   role: 'specialist',
 *   capabilities: ['rfp-discovery', 'parallel-scanning'],
 *   reportsTo: 'portal-manager',
 *   scaling: { min: 2, max: 10, strategy: 'demand' }
 * });
 *
 * // Query agents
 * const specialists = registry.getAgentsByTier(3);
 * const workflowAgents = registry.getWorkflowAgents('rfpDiscovery');
 * ```
 */
export class AgentRegistry {
  private agents = new Map<string, AgentRegistryEntry>();

  /**
   * Register an agent with its metadata
   *
   * @param agentId - Unique identifier for the agent
   * @param agent - Agent instance
   * @param metadata - Agent metadata including tier, role, capabilities
   * @throws Error if agent ID already exists or validation fails
   */
  register(agentId: string, agent: Agent, metadata: AgentMetadata): void {
    if (this.agents.has(agentId)) {
      throw new Error(`Agent with ID '${agentId}' is already registered`);
    }

    // Validate metadata ID matches
    if (metadata.id !== agentId) {
      throw new Error(
        `Metadata ID '${metadata.id}' does not match agent ID '${agentId}'`
      );
    }

    // Validate tier
    if (metadata.tier < 1 || metadata.tier > 5) {
      throw new Error(
        `Invalid tier ${metadata.tier} for agent '${agentId}' (must be 1-5)`
      );
    }

    // Validate role matches tier
    const tierRoleMap: Record<number, string> = {
      1: 'orchestrator',
      2: 'manager',
      3: 'specialist',
      4: 'sub-specialist',
      5: 'sub-specialist',
    };

    if (metadata.role !== tierRoleMap[metadata.tier]) {
      throw new Error(
        `Role '${metadata.role}' doesn't match tier ${metadata.tier} for agent '${agentId}'`
      );
    }

    // Validate capabilities
    if (!metadata.capabilities || metadata.capabilities.length === 0) {
      throw new Error(`Agent '${agentId}' must have at least one capability`);
    }

    // Validate scaling config
    if (metadata.scaling) {
      if (metadata.scaling.min > metadata.scaling.max) {
        throw new Error(
          `Invalid scaling config for '${agentId}': min (${metadata.scaling.min}) > max (${metadata.scaling.max})`
        );
      }
      if (metadata.scaling.min < 0 || metadata.scaling.max < 1) {
        throw new Error(
          `Invalid scaling config for '${agentId}': min must be >= 0, max must be >= 1`
        );
      }
    }

    // Warn if reportsTo agent doesn't exist (skip for tier 1 orchestrators)
    if (
      metadata.tier > 1 &&
      metadata.reportsTo &&
      !this.agents.has(metadata.reportsTo)
    ) {
      console.warn(
        `Agent '${agentId}' reports to '${metadata.reportsTo}' which is not yet registered`
      );
    }

    this.agents.set(agentId, { agent, metadata });
  }

  /**
   * Unregister an agent from the registry
   *
   * @param agentId - ID of agent to unregister
   * @returns true if agent was found and removed, false otherwise
   */
  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get an agent instance by ID
   *
   * @param agentId - Agent ID to lookup
   * @returns Agent instance or undefined if not found
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  /**
   * Get agent metadata by ID
   *
   * @param agentId - Agent ID to lookup
   * @returns Agent metadata or undefined if not found
   */
  getMetadata(agentId: string): AgentMetadata | undefined {
    return this.agents.get(agentId)?.metadata;
  }

  /**
   * Get all registered agent IDs
   *
   * @returns Array of agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all agents at a specific tier
   *
   * @param tier - Tier number (1-5)
   * @returns Array of agents at the specified tier
   */
  getAgentsByTier(tier: 1 | 2 | 3 | 4 | 5): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.tier === tier)
      .map(({ agent }) => agent);
  }

  /**
   * Get all agents with a specific role
   *
   * @param role - Agent role to filter by
   * @returns Array of agents with the specified role
   */
  getAgentsByRole(
    role: 'orchestrator' | 'manager' | 'specialist' | 'sub-specialist'
  ): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.role === role)
      .map(({ agent }) => agent);
  }

  /**
   * Get all agents with a specific capability
   *
   * @param capability - Capability to search for
   * @returns Array of agents that have the specified capability
   */
  getAgentsByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.capabilities.includes(capability))
      .map(({ agent }) => agent);
  }

  /**
   * Get all agents managed by a specific manager agent
   *
   * @param managerId - ID of the manager agent
   * @returns Array of agents managed by the specified manager
   */
  getManagedAgents(managerId: string): Agent[] {
    const manager = this.agents.get(managerId);
    if (!manager?.metadata.manages) return [];

    return manager.metadata.manages
      .map(id => this.agents.get(id)?.agent)
      .filter((agent): agent is Agent => agent !== undefined);
  }

  /**
   * Get all agents required by a specific workflow
   *
   * @param workflowId - Workflow ID to search for
   * @returns Array of agents required by the workflow
   */
  getWorkflowAgents(workflowId: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.requiredBy?.includes(workflowId))
      .map(({ agent }) => agent);
  }

  /**
   * Get the parent (manager) agent for a given agent
   *
   * @param agentId - ID of the agent to find parent for
   * @returns Parent agent or undefined if no parent exists
   */
  getParentAgent(agentId: string): Agent | undefined {
    const entry = this.agents.get(agentId);
    if (!entry?.metadata.reportsTo) return undefined;

    return this.agents.get(entry.metadata.reportsTo)?.agent;
  }

  /**
   * Get the complete hierarchy path from an agent to the top orchestrator
   *
   * @param agentId - Starting agent ID
   * @returns Array of agent IDs from the agent up to the orchestrator
   */
  getHierarchyPath(agentId: string): string[] {
    const path: string[] = [agentId];
    let currentId = agentId;
    const visited = new Set<string>([agentId]);
    const maxDepth = 10; // Safety limit to prevent infinite loops

    while (currentId && path.length < maxDepth) {
      const metadata = this.getMetadata(currentId);
      if (!metadata?.reportsTo) break;
      const parentId = metadata.reportsTo;

      // Check for cycles before adding
      if (visited.has(parentId)) {
        console.warn(`Cycle detected in hierarchy: ${agentId} -> ${parentId}`);
        break;
      }

      visited.add(parentId); // Add to visited BEFORE pushing to path
      path.push(parentId);
      currentId = parentId;
    }

    if (path.length >= maxDepth) {
      console.warn(
        `Maximum hierarchy depth (${maxDepth}) reached for agent: ${agentId}`
      );
    }

    return path;
  }

  /**
   * Validate that all required agents for a workflow are registered
   *
   * @param workflowId - Workflow ID to validate
   * @param requiredAgents - Array of required agent IDs
   * @returns Validation result with missing agents
   */
  validateWorkflowAgents(
    workflowId: string,
    requiredAgents: string[]
  ): {
    valid: boolean;
    missing: string[];
    available: string[];
  } {
    const missing = requiredAgents.filter(id => !this.agents.has(id));
    const available = requiredAgents.filter(id => this.agents.has(id));

    return {
      valid: missing.length === 0,
      missing,
      available,
    };
  }

  /**
   * Update agent health status
   *
   * @param agentId - Agent ID to update
   * @param health - New health status
   */
  updateHealth(
    agentId: string,
    health: {
      status: 'active' | 'idle' | 'busy' | 'failed';
      taskCount?: number;
      errorCount?: number;
    }
  ): void {
    const entry = this.agents.get(agentId);
    if (!entry) {
      throw new Error(`Agent '${agentId}' not found in registry`);
    }

    entry.metadata.health = {
      status: health.status,
      taskCount: health.taskCount ?? entry.metadata.health?.taskCount ?? 0,
      errorCount: health.errorCount ?? entry.metadata.health?.errorCount ?? 0,
      lastSeen: new Date(),
    };
  }

  /**
   * Get all agents with a specific health status
   *
   * @param status - Health status to filter by
   * @returns Array of agents with the specified status
   */
  getAgentsByHealthStatus(
    status: 'active' | 'idle' | 'busy' | 'failed'
  ): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.health?.status === status)
      .map(({ agent }) => agent);
  }

  /**
   * Get registry statistics
   *
   * @returns Object containing registry statistics
   */
  getStats(): {
    totalAgents: number;
    byTier: Record<number, number>;
    byRole: Record<string, number>;
    byHealthStatus: Record<string, number>;
  } {
    const entries = Array.from(this.agents.values());

    const byTier = entries.reduce(
      (acc, { metadata }) => {
        acc[metadata.tier] = (acc[metadata.tier] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const byRole = entries.reduce(
      (acc, { metadata }) => {
        acc[metadata.role] = (acc[metadata.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byHealthStatus = entries.reduce(
      (acc, { metadata }) => {
        const status = metadata.health?.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalAgents: entries.length,
      byTier,
      byRole,
      byHealthStatus,
    };
  }

  /**
   * Clear all registered agents
   * WARNING: This is mainly for testing purposes
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Check if an agent is registered
   *
   * @param agentId - Agent ID to check
   * @returns true if agent exists, false otherwise
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get the total number of registered agents
   *
   * @returns Count of registered agents
   */
  get size(): number {
    return this.agents.size;
  }
}

/**
 * Singleton instance of the agent registry
 * Use this for application-wide agent management
 */
export const agentRegistry = new AgentRegistry();
