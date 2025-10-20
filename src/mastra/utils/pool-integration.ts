/**
 * Pool Integration Utilities
 *
 * Helper functions for integrating agent pools into workflows
 * Provides pool-aware agent acquisition and release
 */

import { Agent } from '@mastra/core/agent';
import { agentPoolManager } from '../coordination/agent-pool-manager';
import { featureFlags } from '../config/feature-flags';
import { agentRegistry } from '../registry/agent-registry';

/**
 * Get an agent from a pool (if pools enabled) or registry (fallback)
 * @param poolName - Name of the pool to get agent from
 * @param agentId - Fallback agent ID if pools disabled
 * @returns Agent instance or null if unavailable
 */
export function getPooledAgent(poolName: string, agentId: string): Agent | null {
  if (featureFlags.useAgentPools) {
    // Try to get agent from pool
    const agent = agentPoolManager.getAgent(poolName);

    if (agent) {
      return agent;
    }

    // Pool exhausted - log warning and fall back to registry
    console.warn(
      `⚠️ Pool '${poolName}' exhausted, falling back to registry agent '${agentId}'`
    );
  }

  // Fall back to direct registry access
  return agentRegistry.getAgent(agentId) || null;
}

/**
 * Release an agent back to its pool
 * @param poolName - Name of the pool
 * @param agent - Agent instance to release
 * @param taskResult - Task execution result for metrics
 */
export function releasePooledAgent(
  poolName: string,
  agent: Agent,
  taskResult: {
    success: boolean;
    executionTime?: number;
    error?: string;
  }
): void {
  if (featureFlags.useAgentPools) {
    try {
      agentPoolManager.releaseAgent(poolName, agent, taskResult);
    } catch (error) {
      console.error(`❌ Error releasing agent to pool '${poolName}':`, error);
    }
  }
  // If pools disabled, no-op (agent wasn't acquired from pool)
}

/**
 * Execute a task using a pooled agent
 * Automatically acquires from pool and releases after completion
 *
 * @param poolName - Pool to get agent from
 * @param fallbackAgentId - Agent ID to use if pools disabled
 * @param task - Async task to execute
 * @returns Task result
 */
export async function executeWithPooledAgent<T>(
  poolName: string,
  fallbackAgentId: string,
  task: (agent: Agent) => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const agent = getPooledAgent(poolName, fallbackAgentId);

  if (!agent) {
    throw new Error(
      `No agent available from pool '${poolName}' or registry '${fallbackAgentId}'`
    );
  }

  try {
    const result = await task(agent);

    // Release agent with success metrics
    const executionTime = Date.now() - startTime;
    releasePooledAgent(poolName, agent, {
      success: true,
      executionTime,
    });

    return result;
  } catch (error) {
    // Release agent with failure metrics
    const executionTime = Date.now() - startTime;
    releasePooledAgent(poolName, agent, {
      success: false,
      executionTime,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Execute multiple tasks in parallel using pooled agents
 * Automatically manages agent acquisition and release
 *
 * @param poolName - Pool to get agents from
 * @param fallbackAgentId - Agent ID to use if pools disabled
 * @param tasks - Array of tasks to execute in parallel
 * @returns Array of task results
 */
export async function executeParallelWithPool<T>(
  poolName: string,
  fallbackAgentId: string,
  tasks: ((agent: Agent) => Promise<T>)[]
): Promise<T[]> {
  return Promise.all(
    tasks.map((task) => executeWithPooledAgent(poolName, fallbackAgentId, task))
  );
}

/**
 * Get pool statistics for monitoring
 * @param poolName - Pool to get stats for
 * @returns Pool statistics or null if pool doesn't exist
 */
export function getPoolStatistics(poolName: string) {
  if (!featureFlags.useAgentPools) {
    return null;
  }

  return agentPoolManager.getPoolStats(poolName);
}

/**
 * Scale a pool manually
 * @param poolName - Pool to scale
 * @param targetSize - Desired pool size
 */
export function scalePool(poolName: string, targetSize: number): void {
  if (!featureFlags.useAgentPools) {
    console.warn(`⚠️ Agent pools are disabled, cannot scale pool '${poolName}'`);
    return;
  }

  try {
    agentPoolManager.scalePool(poolName, targetSize);
    console.log(`✅ Scaled pool '${poolName}' to ${targetSize} instances`);
  } catch (error) {
    console.error(`❌ Error scaling pool '${poolName}':`, error);
  }
}
