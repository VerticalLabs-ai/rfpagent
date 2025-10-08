import { and, asc, count, desc, eq, gte, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  rfps,
  portals,
  submissions,
  workflowState,
  agentRegistry,
  agentPerformanceMetrics,
  phaseStateTransitions,
  type DashboardMetrics,
} from '@shared/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for analytics and reporting
 * Provides dashboard metrics, performance analytics, and activity summaries
 */
export class AnalyticsRepository extends BaseRepository<typeof rfps> {
  constructor() {
    super(rfps);
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      activeRfpsCount,
      submittedCount,
      totalValue,
      portalsCount,
      newRfpsToday,
      pendingReviewCount,
      submissionsToday,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(rfps)
        .where(
          or(
            eq(rfps.status, 'discovered'),
            eq(rfps.status, 'parsing'),
            eq(rfps.status, 'drafting'),
            eq(rfps.status, 'review'),
            eq(rfps.status, 'approved')
          )
        ),
      db
        .select({ count: count() })
        .from(rfps)
        .where(eq(rfps.status, 'submitted')),
      db
        .select({
          total: sql`COALESCE(SUM(CAST(estimated_value AS DECIMAL)), 0)`,
        })
        .from(rfps)
        .where(or(eq(rfps.status, 'approved'), eq(rfps.status, 'submitted'))),
      db.select({ count: count() }).from(portals),
      db
        .select({ count: count() })
        .from(rfps)
        .where(gte(rfps.discoveredAt, startOfToday)),
      db.select({ count: count() }).from(rfps).where(eq(rfps.status, 'review')),
      db
        .select({ count: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.status, 'submitted'),
            gte(submissions.submittedAt, startOfToday)
          )
        ),
    ]);

    const activeRfps = Number(activeRfpsCount[0]?.count ?? 0);
    const submittedRfps = Number(submittedCount[0]?.count ?? 0);
    const portalsTracked = Number(portalsCount[0]?.count ?? 0);
    const totalPipelineValue = Number(totalValue[0]?.total ?? 0);
    const discoveredToday = Number(newRfpsToday[0]?.count ?? 0);
    const pendingReview = Number(pendingReviewCount[0]?.count ?? 0);
    const submittedToday = Number(submissionsToday[0]?.count ?? 0);

    return {
      activeRfps,
      submittedRfps,
      totalValue: totalPipelineValue,
      portalsTracked,
      newRfpsToday: discoveredToday,
      pendingReview,
      submittedToday,
      winRate:
        submittedRfps === 0
          ? 0
          : Math.min(
              100,
              Math.round(
                (submittedRfps / Math.max(activeRfps + submittedRfps, 1)) * 100
              )
            ),
      avgResponseTime: 0,
    };
  }

  /**
   * Get portal activity statistics
   */
  async getPortalActivity(): Promise<any> {
    return await db
      .select({
        portal: portals,
        rfpCount: count(rfps.id),
      })
      .from(portals)
      .leftJoin(rfps, eq(portals.id, rfps.portalId))
      .groupBy(portals.id)
      .orderBy(asc(portals.name));
  }

  /**
   * Get agent performance metrics
   */
  async getAllAgentPerformanceMetrics(
    timeRange: string = '7d'
  ): Promise<any[]> {
    const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    return await db
      .select()
      .from(agentPerformanceMetrics)
      .where(gte(agentPerformanceMetrics.recordedAt, since))
      .orderBy(desc(agentPerformanceMetrics.recordedAt));
  }

  /**
   * Get workflow execution metrics
   */
  async getWorkflowExecutionMetrics(): Promise<any> {
    const totalWorkflows = await db
      .select({ count: count() })
      .from(workflowState);

    const suspendedWorkflows = await db
      .select({ count: count() })
      .from(workflowState)
      .where(eq(workflowState.status, 'suspended'));

    const completedWorkflows = await db
      .select({ count: count() })
      .from(workflowState)
      .where(eq(workflowState.status, 'completed'));

    const failedWorkflows = await db
      .select({ count: count() })
      .from(workflowState)
      .where(eq(workflowState.status, 'failed'));

    const avgExecutionTime = await db
      .select({
        avg: sql`AVG(EXTRACT(EPOCH FROM (${workflowState.updatedAt} - ${workflowState.createdAt})))`,
      })
      .from(workflowState)
      .where(eq(workflowState.status, 'completed'));

    return {
      totalWorkflows: totalWorkflows[0].count,
      suspendedWorkflows: suspendedWorkflows[0].count,
      completedWorkflows: completedWorkflows[0].count,
      failedWorkflows: failedWorkflows[0].count,
      successRate:
        totalWorkflows[0].count > 0
          ? (Number(completedWorkflows[0].count) /
              Number(totalWorkflows[0].count)) *
            100
          : 0,
      avgExecutionTimeSeconds: Number(avgExecutionTime[0].avg) || 0,
    };
  }

  /**
   * Get portal health summary
   */
  async getPortalHealthSummary(): Promise<any> {
    const totalPortals = await db.select({ count: count() }).from(portals);
    const activePortals = await db
      .select({ count: count() })
      .from(portals)
      .where(eq(portals.status, 'active'));
    const errorPortals = await db
      .select({ count: count() })
      .from(portals)
      .where(eq(portals.status, 'error'));

    return {
      total: totalPortals[0].count,
      active: activePortals[0].count,
      errors: errorPortals[0].count,
      healthPercentage:
        totalPortals[0].count > 0
          ? (Number(activePortals[0].count) / Number(totalPortals[0].count)) *
            100
          : 0,
    };
  }

  /**
   * Get agent health summary
   */
  async getAgentHealthSummary(): Promise<any> {
    const totalAgents = await db
      .select({ count: sql`COUNT(*)` })
      .from(agentRegistry);

    const activeAgents = await db
      .select({ count: sql`COUNT(*)` })
      .from(agentRegistry)
      .where(sql`${agentRegistry.status} IN ('active', 'busy')`);

    const total = Number(totalAgents[0].count);
    const active = Number(activeAgents[0].count);

    return {
      totalAgents: total,
      activeAgents: active,
      healthPercentage: total > 0 ? (active / total) * 100 : 0,
    };
  }

  /**
   * Get phase transition summary
   */
  async getPhaseTransitionSummary(days: number = 7): Promise<{
    totalTransitions: number;
    successfulTransitions: number;
    failedTransitions: number;
    averageTransitionTime: number;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        toStatus: phaseStateTransitions.toStatus,
        duration: phaseStateTransitions.duration,
      })
      .from(phaseStateTransitions)
      .where(gte(phaseStateTransitions.timestamp, since));

    let totalTransitions = 0;
    let successfulTransitions = 0;
    let failedTransitions = 0;
    let durationSum = 0;
    let durationCount = 0;

    for (const row of rows) {
      totalTransitions += 1;
      const status = row.toStatus ?? '';
      if (['failed', 'error', 'cancelled', 'suspended'].includes(status)) {
        failedTransitions += 1;
      } else if (status) {
        successfulTransitions += 1;
      }

      if (row.duration && row.duration > 0) {
        durationSum += row.duration;
        durationCount += 1;
      }
    }

    return {
      totalTransitions,
      successfulTransitions,
      failedTransitions,
      averageTransitionTime:
        durationCount > 0 ? durationSum / durationCount : 0,
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();
