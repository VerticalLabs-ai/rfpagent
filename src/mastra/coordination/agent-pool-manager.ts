import { Agent } from '@mastra/core/agent';
import { agentRegistry } from '../registry/agent-registry';

/**
 * Represents an agent instance within a pool
 */
export interface PooledAgent {
  /** Unique identifier for this pooled instance */
  instanceId: string;

  /** The actual agent instance */
  agent: Agent;

  /** Current status of this agent instance */
  status: 'idle' | 'busy' | 'failed' | 'warming-up';

  /** ID of the current task being executed */
  currentTask?: string;

  /** Total number of tasks completed by this instance */
  taskCount: number;

  /** Number of failed tasks */
  errorCount: number;

  /** Timestamp of last task assignment */
  lastUsed: Date;

  /** Timestamp when this instance was created */
  createdAt: Date;

  /** Average task execution time in milliseconds */
  avgExecutionTime?: number;

  /** Agent metadata reference */
  agentId: string;
}

/**
 * Pool configuration options
 */
export interface PoolConfig {
  /** Pool name */
  name: string;

  /** Agent IDs that can be pooled */
  agentIds: string[];

  /** Minimum number of instances */
  minSize: number;

  /** Maximum number of instances */
  maxSize: number;

  /** Strategy for selecting agents from pool */
  strategy: 'round-robin' | 'least-busy' | 'random' | 'fastest';

  /** Auto-scaling configuration */
  autoScale?: {
    /** Enable auto-scaling */
    enabled: boolean;

    /** Scale up when utilization exceeds this % */
    scaleUpThreshold: number;

    /** Scale down when utilization below this % */
    scaleDownThreshold: number;

    /** Cooldown period between scaling operations (ms) */
    cooldownPeriod: number;
  };

  /** Health check configuration */
  healthCheck?: {
    /** Enable health checks */
    enabled: boolean;

    /** Interval between health checks (ms) */
    interval: number;

    /** Max failed health checks before marking failed */
    maxFailures: number;
  };
}

/**
 * Pool statistics
 */
export interface PoolStats {
  /** Pool name */
  poolName: string;

  /** Total instances in pool */
  totalInstances: number;

  /** Idle instances */
  idleInstances: number;

  /** Busy instances */
  busyInstances: number;

  /** Failed instances */
  failedInstances: number;

  /** Warming up instances */
  warmingUpInstances: number;

  /** Current utilization % */
  utilization: number;

  /** Total tasks completed */
  totalTasks: number;

  /** Total errors */
  totalErrors: number;

  /** Average task execution time */
  avgExecutionTime: number;

  /** Pool configuration */
  config: PoolConfig;

  /** Last scaling operation */
  lastScaling?: {
    action: 'scale-up' | 'scale-down';
    timestamp: Date;
    fromSize: number;
    toSize: number;
  };
}

/**
 * Agent Pool Manager
 *
 * Manages pools of agent instances for load balancing and auto-scaling.
 * Provides strategies for agent selection and automatic pool size management.
 *
 * @example
 * ```typescript
 * const poolManager = new AgentPoolManager();
 *
 * // Create a pool
 * poolManager.createPool({
 *   name: 'proposal-workers',
 *   agentIds: ['content-generator', 'compliance-checker'],
 *   minSize: 2,
 *   maxSize: 10,
 *   strategy: 'least-busy',
 *   autoScale: {
 *     enabled: true,
 *     scaleUpThreshold: 0.8,
 *     scaleDownThreshold: 0.3,
 *     cooldownPeriod: 60000
 *   }
 * });
 *
 * // Get an agent from pool
 * const agent = poolManager.getAgent('proposal-workers');
 *
 * // Execute task
 * await agent.execute(task);
 *
 * // Release agent back to pool
 * poolManager.releaseAgent('proposal-workers', agent);
 * ```
 */
export class AgentPoolManager {
  private pools = new Map<string, PooledAgent[]>();
  private configs = new Map<string, PoolConfig>();
  private scalingCooldowns = new Map<string, Date>();
  private nextInstanceId = 0;

  /**
   * Create a new agent pool
   *
   * @param config - Pool configuration
   * @throws Error if pool already exists or configuration is invalid
   */
  createPool(config: PoolConfig): void {
    // Validate configuration
    this.validatePoolConfig(config);

    if (this.pools.has(config.name)) {
      throw new Error(`Pool '${config.name}' already exists`);
    }

    // Validate agent IDs exist in registry
    for (const agentId of config.agentIds) {
      if (!agentRegistry.has(agentId)) {
        throw new Error(
          `Agent '${agentId}' not found in registry. Register agent before creating pool.`
        );
      }
    }

    // Store configuration
    this.configs.set(config.name, config);

    // Initialize pool with minimum size
    const pooledAgents: PooledAgent[] = [];
    for (let i = 0; i < config.minSize; i++) {
      const agent = this.createPooledAgent(config.agentIds);
      if (agent) {
        pooledAgents.push(agent);
      }
    }

    this.pools.set(config.name, pooledAgents);
  }

  /**
   * Get an agent from the pool using the configured strategy
   *
   * @param poolName - Name of the pool
   * @returns Agent instance or null if none available
   */
  getAgent(poolName: string): Agent | null {
    const pool = this.pools.get(poolName);
    const config = this.configs.get(poolName);

    if (!pool || !config) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    // Check if auto-scaling needed
    this.checkAutoScale(poolName);

    // Get idle agents
    const idleAgents = pool.filter(pa => pa.status === 'idle');

    if (idleAgents.length === 0) {
      return null;
    }

    // Select agent based on strategy
    const selectedAgent = this.selectAgent(idleAgents, config.strategy);

    if (!selectedAgent) {
      return null;
    }

    // Mark as busy
    selectedAgent.status = 'busy';
    selectedAgent.lastUsed = new Date();

    return selectedAgent.agent;
  }

  /**
   * Release an agent back to the pool
   *
   * @param poolName - Name of the pool
   * @param agent - Agent instance to release
   * @param taskInfo - Optional task execution info
   */
  releaseAgent(
    poolName: string,
    agent: Agent,
    taskInfo?: {
      success: boolean;
      executionTime?: number;
      error?: Error;
    }
  ): void {
    const pool = this.pools.get(poolName);

    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    const pooledAgent = pool.find(pa => pa.agent === agent);

    if (!pooledAgent) {
      throw new Error(`Agent not found in pool '${poolName}'`);
    }

    // Update agent state
    if (taskInfo) {
      if (taskInfo.success) {
        pooledAgent.taskCount++;

        // Update average execution time
        if (taskInfo.executionTime !== undefined) {
          if (pooledAgent.avgExecutionTime === undefined) {
            pooledAgent.avgExecutionTime = taskInfo.executionTime;
          } else {
            // Rolling average
            pooledAgent.avgExecutionTime =
              (pooledAgent.avgExecutionTime * pooledAgent.taskCount +
                taskInfo.executionTime) /
              (pooledAgent.taskCount + 1);
          }
        }
      } else {
        pooledAgent.errorCount++;

        // Mark as failed if too many errors
        if (pooledAgent.errorCount > 3) {
          pooledAgent.status = 'failed';
          return;
        }
      }
    }

    // Mark as idle
    pooledAgent.status = 'idle';
    pooledAgent.currentTask = undefined;
  }

  /**
   * Scale a pool to a specific size
   *
   * @param poolName - Name of the pool
   * @param targetSize - Target number of instances
   */
  scalePool(poolName: string, targetSize: number): void {
    const pool = this.pools.get(poolName);
    const config = this.configs.get(poolName);

    if (!pool || !config) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    // Validate target size
    if (targetSize < config.minSize || targetSize > config.maxSize) {
      throw new Error(
        `Target size ${targetSize} outside allowed range [${config.minSize}, ${config.maxSize}]`
      );
    }

    const currentSize = pool.length;

    if (currentSize === targetSize) {
      return; // Already at target size
    }

    const previousSize = currentSize;

    if (targetSize > currentSize) {
      // Scale up - add instances
      const instancesToAdd = targetSize - currentSize;
      for (let i = 0; i < instancesToAdd; i++) {
        const agent = this.createPooledAgent(config.agentIds);
        if (agent) {
          pool.push(agent);
        }
      }
    } else {
      // Scale down - remove idle instances
      const instancesToRemove = currentSize - targetSize;
      const idleAgents = pool.filter(pa => pa.status === 'idle');

      const removed = idleAgents.slice(0, instancesToRemove);
      for (const agent of removed) {
        const index = pool.indexOf(agent);
        if (index !== -1) {
          pool.splice(index, 1);
        }
      }
    }

    // Record scaling operation
    const stats = this.getPoolStats(poolName);
    if (stats) {
      stats.lastScaling = {
        action: targetSize > previousSize ? 'scale-up' : 'scale-down',
        timestamp: new Date(),
        fromSize: previousSize,
        toSize: pool.length,
      };
    }

    // Set cooldown
    this.scalingCooldowns.set(poolName, new Date());
  }

  /**
   * Get pool statistics
   *
   * @param poolName - Name of the pool
   * @returns Pool statistics or null if pool not found
   */
  getPoolStats(poolName: string): PoolStats | null {
    const pool = this.pools.get(poolName);
    const config = this.configs.get(poolName);

    if (!pool || !config) {
      return null;
    }

    const idleCount = pool.filter(pa => pa.status === 'idle').length;
    const busyCount = pool.filter(pa => pa.status === 'busy').length;
    const failedCount = pool.filter(pa => pa.status === 'failed').length;
    const warmingUpCount = pool.filter(pa => pa.status === 'warming-up').length;

    const totalTasks = pool.reduce((sum, pa) => sum + pa.taskCount, 0);
    const totalErrors = pool.reduce((sum, pa) => sum + pa.errorCount, 0);

    const avgExecutionTimes = pool
      .filter(pa => pa.avgExecutionTime !== undefined)
      .map(pa => pa.avgExecutionTime!);

    const avgExecutionTime =
      avgExecutionTimes.length > 0
        ? avgExecutionTimes.reduce((sum, t) => sum + t, 0) / avgExecutionTimes.length
        : 0;

    const utilization =
      pool.length > 0 ? busyCount / pool.length : 0;

    return {
      poolName,
      totalInstances: pool.length,
      idleInstances: idleCount,
      busyInstances: busyCount,
      failedInstances: failedCount,
      warmingUpInstances: warmingUpCount,
      utilization,
      totalTasks,
      totalErrors,
      avgExecutionTime,
      config,
    };
  }

  /**
   * Get all pool names
   */
  getPoolNames(): string[] {
    return Array.from(this.pools.keys());
  }

  /**
   * Remove a pool
   *
   * @param poolName - Name of the pool to remove
   * @param force - Force removal even if agents are busy
   */
  removePool(poolName: string, force: boolean = false): void {
    const pool = this.pools.get(poolName);

    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    if (!force) {
      const busyAgents = pool.filter(pa => pa.status === 'busy');
      if (busyAgents.length > 0) {
        throw new Error(
          `Cannot remove pool '${poolName}': ${busyAgents.length} agents are busy. Use force=true to override.`
        );
      }
    }

    this.pools.delete(poolName);
    this.configs.delete(poolName);
    this.scalingCooldowns.delete(poolName);
  }

  /**
   * Replace a failed agent in the pool
   *
   * @param poolName - Name of the pool
   * @param agentInstanceId - Instance ID of failed agent
   */
  replaceFailedAgent(poolName: string, agentInstanceId: string): void {
    const pool = this.pools.get(poolName);
    const config = this.configs.get(poolName);

    if (!pool || !config) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    const failedIndex = pool.findIndex(pa => pa.instanceId === agentInstanceId);

    if (failedIndex === -1) {
      throw new Error(`Agent instance '${agentInstanceId}' not found in pool`);
    }

    // Remove failed agent
    pool.splice(failedIndex, 1);

    // Add new agent
    const newAgent = this.createPooledAgent(config.agentIds);
    if (newAgent) {
      pool.push(newAgent);
    }
  }

  /**
   * Get all statistics for all pools
   */
  getAllPoolStats(): PoolStats[] {
    return this.getPoolNames()
      .map(name => this.getPoolStats(name))
      .filter((stats): stats is PoolStats => stats !== null);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Create a pooled agent instance
   */
  private createPooledAgent(agentIds: string[]): PooledAgent | null {
    // Round-robin selection of agent type
    const agentId = agentIds[this.nextInstanceId % agentIds.length];
    const agent = agentRegistry.getAgent(agentId);

    if (!agent) {
      return null;
    }

    return {
      instanceId: `instance-${this.nextInstanceId++}`,
      agent,
      agentId,
      status: 'idle',
      taskCount: 0,
      errorCount: 0,
      lastUsed: new Date(),
      createdAt: new Date(),
    };
  }

  /**
   * Select an agent from idle agents based on strategy
   */
  private selectAgent(
    idleAgents: PooledAgent[],
    strategy: PoolConfig['strategy']
  ): PooledAgent | null {
    if (idleAgents.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'least-busy':
        // Select agent with lowest task count
        return idleAgents.reduce((prev, curr) =>
          prev.taskCount < curr.taskCount ? prev : curr
        );

      case 'fastest':
        // Select agent with best average execution time
        const agentsWithTime = idleAgents.filter(
          pa => pa.avgExecutionTime !== undefined
        );
        if (agentsWithTime.length > 0) {
          return agentsWithTime.reduce((prev, curr) =>
            (prev.avgExecutionTime || Infinity) < (curr.avgExecutionTime || Infinity)
              ? prev
              : curr
          );
        }
        // Fall through to random if no timing data
        return idleAgents[Math.floor(Math.random() * idleAgents.length)];

      case 'random':
        return idleAgents[Math.floor(Math.random() * idleAgents.length)];

      case 'round-robin':
      default:
        // Select least recently used agent
        return idleAgents.reduce((prev, curr) =>
          prev.lastUsed < curr.lastUsed ? prev : curr
        );
    }
  }

  /**
   * Check if auto-scaling is needed and perform if necessary
   */
  private checkAutoScale(poolName: string): void {
    const pool = this.pools.get(poolName);
    const config = this.configs.get(poolName);

    if (!pool || !config || !config.autoScale?.enabled) {
      return;
    }

    // Check cooldown
    const lastScaling = this.scalingCooldowns.get(poolName);
    if (lastScaling) {
      const elapsed = Date.now() - lastScaling.getTime();
      if (elapsed < config.autoScale.cooldownPeriod) {
        return; // Still in cooldown
      }
    }

    const stats = this.getPoolStats(poolName);
    if (!stats) return;

    const { utilization } = stats;

    // Scale up if utilization too high
    if (utilization >= config.autoScale.scaleUpThreshold) {
      const currentSize = pool.length;
      const targetSize = Math.min(
        Math.ceil(currentSize * 1.5), // 50% increase
        config.maxSize
      );

      if (targetSize > currentSize) {
        this.scalePool(poolName, targetSize);
      }
    }
    // Scale down if utilization too low
    else if (utilization <= config.autoScale.scaleDownThreshold) {
      const currentSize = pool.length;
      const targetSize = Math.max(
        Math.ceil(currentSize * 0.7), // 30% decrease
        config.minSize
      );

      if (targetSize < currentSize) {
        this.scalePool(poolName, targetSize);
      }
    }
  }

  /**
   * Validate pool configuration
   */
  private validatePoolConfig(config: PoolConfig): void {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Pool name is required');
    }

    if (!config.agentIds || config.agentIds.length === 0) {
      throw new Error('At least one agent ID is required');
    }

    if (config.minSize < 0) {
      throw new Error('minSize must be >= 0');
    }

    if (config.maxSize < config.minSize) {
      throw new Error('maxSize must be >= minSize');
    }

    if (config.autoScale) {
      if (
        config.autoScale.scaleUpThreshold < 0 ||
        config.autoScale.scaleUpThreshold > 1
      ) {
        throw new Error('scaleUpThreshold must be between 0 and 1');
      }

      if (
        config.autoScale.scaleDownThreshold < 0 ||
        config.autoScale.scaleDownThreshold > 1
      ) {
        throw new Error('scaleDownThreshold must be between 0 and 1');
      }

      if (
        config.autoScale.scaleUpThreshold <=
        config.autoScale.scaleDownThreshold
      ) {
        throw new Error('scaleUpThreshold must be > scaleDownThreshold');
      }

      if (config.autoScale.cooldownPeriod < 0) {
        throw new Error('cooldownPeriod must be >= 0');
      }
    }
  }
}

/**
 * Singleton instance of the agent pool manager
 */
export const agentPoolManager = new AgentPoolManager();
