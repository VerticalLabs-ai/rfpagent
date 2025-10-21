/**
 * Pool Monitoring Utilities
 *
 * Provides real-time monitoring and metrics collection for agent pools
 * Supports dashboard display, logging, and alerting
 */

import { agentPoolManager } from '../coordination/agent-pool-manager';
import { featureFlags } from '../config/feature-flags';

/**
 * Pool health status
 */
export type PoolHealthStatus = 'healthy' | 'warning' | 'critical';

/**
 * Pool health metrics
 */
export interface PoolHealthMetrics {
  poolName: string;
  status: PoolHealthStatus;
  utilization: number;
  totalInstances: number;
  idleInstances: number;
  busyInstances: number;
  failedInstances: number;
  avgExecutionTime: number | null;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  successRate: number;
  warnings: string[];
  recommendations: string[];
}

/**
 * Pool performance summary
 */
export interface PoolPerformanceSummary {
  poolCounts: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
  };
  instanceCounts: {
    total: number;
    busy: number;
    idle: number;
    failed: number;
  };
  taskMetrics: {
    completed: number;
    failed: number;
    total: number;
    successRate: number;
  };
  overallUtilization: number;
  healthStatus: PoolHealthStatus;
}

/**
 * Calculate pool health status based on metrics
 */
function calculatePoolHealth(
  stats: ReturnType<typeof agentPoolManager.getPoolStats>
): PoolHealthStatus {
  if (!stats) return 'critical';

  const { utilization, failedInstances, totalInstances } = stats;
  const failureRate = totalInstances > 0 ? failedInstances / totalInstances : 0;

  // Critical conditions
  if (failureRate > 0.3) return 'critical'; // >30% agents failed
  if (utilization > 0.95) return 'critical'; // >95% utilization (pool exhaustion)
  if (totalInstances === 0) return 'critical'; // No instances available

  // Warning conditions
  if (failureRate > 0.1) return 'warning'; // >10% agents failed
  if (utilization > 0.85) return 'warning'; // >85% utilization (approaching capacity)
  if (failedInstances > 0) return 'warning'; // Any failed agents

  return 'healthy';
}

/**
 * Generate warnings and recommendations based on pool metrics
 */
function generateInsights(
  stats: ReturnType<typeof agentPoolManager.getPoolStats>
): {
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!stats) {
    warnings.push('Pool statistics unavailable');
    return { warnings, recommendations };
  }

  const { utilization, failedInstances, totalInstances, idleInstances } = stats;
  const failureRate = totalInstances > 0 ? failedInstances / totalInstances : 0;

  // High utilization warnings
  if (utilization > 0.95) {
    warnings.push('Pool is near capacity (>95% utilization)');
    recommendations.push(
      'Consider increasing maxSize or optimizing task execution time'
    );
  } else if (utilization > 0.85) {
    warnings.push('Pool utilization is high (>85%)');
    recommendations.push('Monitor closely for potential capacity issues');
  }

  // Failed instances
  if (failureRate > 0.3) {
    warnings.push(
      `High failure rate: ${(failureRate * 100).toFixed(1)}% of agents failed`
    );
    recommendations.push(
      'Investigate agent failures and consider restarting pool'
    );
  } else if (failedInstances > 0) {
    warnings.push(`${failedInstances} agent(s) in failed state`);
    recommendations.push('Check agent error logs for failure causes');
  }

  // Low utilization (potential waste)
  if (utilization < 0.2 && totalInstances > 1) {
    warnings.push(`Low utilization: ${(utilization * 100).toFixed(1)}%`);
    recommendations.push('Consider reducing minSize to save resources');
  }

  // All agents idle (pool not being used)
  if (idleInstances === totalInstances && totalInstances > 0) {
    warnings.push('All agents are idle');
    recommendations.push('Pool may be oversized or underutilized');
  }

  // No instances available
  if (totalInstances === 0) {
    warnings.push('No agent instances in pool');
    recommendations.push(
      'Pool initialization may have failed - check configuration'
    );
  }

  return { warnings, recommendations };
}

/**
 * Build PoolHealthMetrics from pool stats
 * @private
 */
function buildPoolHealthMetricsFromStats(
  stats: ReturnType<typeof agentPoolManager.getPoolStats>
): PoolHealthMetrics | null {
  if (!stats) return null;

  const status = calculatePoolHealth(stats);
  const { warnings, recommendations } = generateInsights(stats);

  const totalTasks = stats.totalTasks + stats.totalErrors;
  const successRate =
    totalTasks > 0 ? stats.totalTasks / totalTasks : 1.0;

  return {
    poolName: stats.poolName,
    status,
    utilization: stats.utilization,
    totalInstances: stats.totalInstances,
    idleInstances: stats.idleInstances,
    busyInstances: stats.busyInstances,
    failedInstances: stats.failedInstances,
    avgExecutionTime: stats.avgExecutionTime,
    totalTasksCompleted: stats.totalTasks,
    totalTasksFailed: stats.totalErrors,
    successRate,
    warnings,
    recommendations,
  };
}

/**
 * Get comprehensive health metrics for a pool
 * @param poolName - Pool to monitor
 * @returns Health metrics or null if pool doesn't exist
 */
export function getPoolHealth(poolName: string): PoolHealthMetrics | null {
  if (!featureFlags.useAgentPools) {
    return null;
  }

  const stats = agentPoolManager.getPoolStats(poolName);
  return buildPoolHealthMetricsFromStats(stats);
}

/**
 * Get health metrics for all pools
 * @returns Array of pool health metrics
 */
export function getAllPoolsHealth(): PoolHealthMetrics[] {
  if (!featureFlags.useAgentPools) {
    return [];
  }

  const allStats = agentPoolManager.getAllPoolStats();

  return allStats
    .map(stats => buildPoolHealthMetricsFromStats(stats))
    .filter((metrics): metrics is PoolHealthMetrics => metrics !== null)
    .sort((a, b) => {
      // Sort by health status (critical first, then warning, then healthy)
      const statusOrder = { critical: 0, warning: 1, healthy: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
}

/**
 * Log pool health metrics to console
 * @param poolName - Pool to log (or undefined for all pools)
 */
export function logPoolHealth(poolName?: string): void {
  if (!featureFlags.useAgentPools) {
    console.log('📊 Agent Pools are disabled');
    return;
  }

  const healthMetrics = poolName
    ? [getPoolHealth(poolName)].filter((m): m is PoolHealthMetrics => m !== null)
    : getAllPoolsHealth();

  if (healthMetrics.length === 0) {
    console.log('📊 No pool health data available');
    return;
  }

  console.log('\n📊 === Agent Pool Health Report ===\n');

  for (const metrics of healthMetrics) {
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨',
    };

    console.log(
      `${statusEmoji[metrics.status]} ${metrics.poolName.toUpperCase()} - ${metrics.status.toUpperCase()}`
    );
    console.log(`   Utilization: ${(metrics.utilization * 100).toFixed(1)}%`);
    console.log(
      `   Instances: ${metrics.totalInstances} total (${metrics.idleInstances} idle, ${metrics.busyInstances} busy, ${metrics.failedInstances} failed)`
    );
    console.log(
      `   Tasks: ${metrics.totalTasksCompleted} completed, ${metrics.totalTasksFailed} failed (${(metrics.successRate * 100).toFixed(1)}% success rate)`
    );

    if (metrics.avgExecutionTime !== null) {
      console.log(
        `   Avg Execution Time: ${metrics.avgExecutionTime.toFixed(0)}ms`
      );
    }

    if (metrics.warnings.length > 0) {
      console.log('   ⚠️  Warnings:');
      metrics.warnings.forEach(w => console.log(`      - ${w}`));
    }

    if (metrics.recommendations.length > 0) {
      console.log('   💡 Recommendations:');
      metrics.recommendations.forEach(r => console.log(`      - ${r}`));
    }

    console.log('');
  }

  console.log('='.repeat(40) + '\n');
}

/**
 * Start periodic pool health monitoring
 * @param intervalMs - Monitoring interval in milliseconds (default: 60000 = 1 minute)
 * @param poolName - Specific pool to monitor (or undefined for all pools)
 * @returns Cleanup function to stop monitoring
 */
export function startPoolMonitoring(
  intervalMs: number = 60000,
  poolName?: string
): () => void {
  if (!featureFlags.useAgentPools) {
    console.log('⚠️  Cannot start pool monitoring: Agent Pools are disabled');
    return () => {};
  }

  console.log(`🔍 Starting pool health monitoring (interval: ${intervalMs}ms)`);

  // Initial log
  logPoolHealth(poolName);

  // Periodic monitoring
  const intervalId = setInterval(() => {
    logPoolHealth(poolName);
  }, intervalMs);

  // Return cleanup function
  return () => {
    console.log('🛑 Stopping pool health monitoring');
    clearInterval(intervalId);
  };
}

/**
 * Get pool performance summary for all pools
 * @returns Performance summary
 */
export function getPoolPerformanceSummary(): PoolPerformanceSummary | null {
  if (!featureFlags.useAgentPools) {
    return null;
  }

  const allHealth = getAllPoolsHealth();

  const totalPools = allHealth.length;
  const healthyPools = allHealth.filter(h => h.status === 'healthy').length;
  const warningPools = allHealth.filter(h => h.status === 'warning').length;
  const criticalPools = allHealth.filter(h => h.status === 'critical').length;

  const totalInstances = allHealth.reduce(
    (sum, h) => sum + h.totalInstances,
    0
  );
  const totalBusy = allHealth.reduce((sum, h) => sum + h.busyInstances, 0);
  const totalIdle = allHealth.reduce((sum, h) => sum + h.idleInstances, 0);
  const totalFailed = allHealth.reduce((sum, h) => sum + h.failedInstances, 0);

  const totalTasksCompleted = allHealth.reduce(
    (sum, h) => sum + h.totalTasksCompleted,
    0
  );
  const totalTasksFailed = allHealth.reduce(
    (sum, h) => sum + h.totalTasksFailed,
    0
  );

  const totalTasks = totalTasksCompleted + totalTasksFailed;
  const overallSuccessRate =
    totalTasks > 0 ? totalTasksCompleted / totalTasks : 1.0;
  const overallUtilization =
    totalInstances > 0 ? totalBusy / totalInstances : 0;

  return {
    poolCounts: {
      total: totalPools,
      healthy: healthyPools,
      warning: warningPools,
      critical: criticalPools,
    },
    instanceCounts: {
      total: totalInstances,
      busy: totalBusy,
      idle: totalIdle,
      failed: totalFailed,
    },
    taskMetrics: {
      completed: totalTasksCompleted,
      failed: totalTasksFailed,
      total: totalTasks,
      successRate: overallSuccessRate,
    },
    overallUtilization,
    healthStatus:
      criticalPools > 0 ? 'critical' : warningPools > 0 ? 'warning' : 'healthy',
  };
}

/**
 * Log performance summary to console
 */
export function logPerformanceSummary(): void {
  const summary = getPoolPerformanceSummary();

  if (!summary) {
    console.log('📊 Agent Pools are disabled');
    return;
  }

  console.log('\n📊 === Agent Pool Performance Summary ===\n');

  console.log(`Overall Status: ${summary.healthStatus.toUpperCase()}`);
  console.log(
    `Pools: ${summary.poolCounts.total} total (${summary.poolCounts.healthy} healthy, ${summary.poolCounts.warning} warning, ${summary.poolCounts.critical} critical)`
  );
  console.log(
    `Instances: ${summary.instanceCounts.total} total (${summary.instanceCounts.busy} busy, ${summary.instanceCounts.idle} idle, ${summary.instanceCounts.failed} failed)`
  );
  console.log(
    `Overall Utilization: ${(summary.overallUtilization * 100).toFixed(1)}%`
  );
  console.log(
    `Tasks: ${summary.taskMetrics.completed} completed, ${summary.taskMetrics.failed} failed (${(summary.taskMetrics.successRate * 100).toFixed(1)}% success rate)`
  );

  console.log('\n' + '='.repeat(40) + '\n');
}
