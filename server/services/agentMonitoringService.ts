import type {
  AgentActivityEvent,
  AgentCoordinationEvent,
  AgentMetricsTimeframe,
  AgentPerformanceMetric,
  AgentRegistrySummary,
  SystemHealthSnapshot,
  WorkItemQueueSummary,
  WorkflowPhaseStats,
  WorkflowStateSummary,
} from '@shared/api/agentMonitoring';
import { storage } from '../storage';
import { workflowCoordinator } from './workflowCoordinator';

class AgentMonitoringService {
  async getPerformanceMetrics(
    timeframe: AgentMetricsTimeframe = '24h'
  ): Promise<AgentPerformanceMetric[]> {
    const rows = await storage.getAllAgentPerformanceMetrics(timeframe);

    return rows.map(row => ({
      id: row.id,
      agentId: row.agentId,
      metricType: row.metricType,
      metricValue: Number(row.metricValue ?? 0),
      context: (row.context as Record<string, unknown>) ?? null,
      referenceEntityType: row.referenceEntityType ?? null,
      referenceEntityId: row.referenceEntityId ?? null,
      aggregationPeriod: row.aggregationPeriod ?? null,
      recordedAt: (row.recordedAt ?? new Date()).toISOString(),
      createdAt: (row.createdAt ?? new Date()).toISOString(),
    }));
  }

  async getRecentActivity(limit: number = 25): Promise<AgentActivityEvent[]> {
    const rows = await storage.getRecentWorkItemActivity(limit);

    return rows.map(row => ({
      id: row.id,
      sessionId: row.sessionId,
      workflowId: row.workflowId,
      agentId: row.assignedAgentId,
      createdByAgentId: row.createdByAgentId,
      taskType: row.taskType,
      status: row.status,
      priority: row.priority ?? 0,
      updatedAt: row.updatedAt.toISOString(),
      description: row.taskType.replace(/_/g, ' '),
    }));
  }

  async getCoordinationEvents(
    limit: number = 25
  ): Promise<AgentCoordinationEvent[]> {
    const rows = await storage.getCoordinationLogs(limit);

    return rows.map(row => ({
      id: row.id,
      sessionId: row.sessionId,
      initiatorAgentId: row.initiatorAgentId,
      targetAgentId: row.targetAgentId,
      coordinationType: row.coordinationType,
      status: row.status,
      priority: row.priority ?? 0,
      startedAt: (row.startedAt ?? new Date()).toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    }));
  }

  async getRegistrySummary(): Promise<AgentRegistrySummary> {
    const [allAgents, activeAgents] = await Promise.all([
      storage.getAllAgents(),
      storage.getActiveAgents(),
    ]);

    const byTier: Record<string, number> = {};
    for (const agent of allAgents) {
      byTier[agent.tier] = (byTier[agent.tier] ?? 0) + 1;
    }

    return {
      totals: {
        totalAgents: allAgents.length,
        activeAgents: activeAgents.length,
        inactiveAgents: Math.max(allAgents.length - activeAgents.length, 0),
      },
      byTier,
      agents: allAgents.map(agent => ({
        agentId: agent.agentId,
        tier: agent.tier,
        role: agent.role,
        displayName: agent.displayName,
        status: agent.status,
        capabilities: agent.capabilities ?? [],
        lastHeartbeat: agent.lastHeartbeat
          ? agent.lastHeartbeat.toISOString()
          : null,
      })),
    };
  }

  async getWorkItemSummary(): Promise<WorkItemQueueSummary> {
    const [counts, recent] = await Promise.all([
      storage.getWorkItemStatusSummary(),
      storage.getRecentWorkItemActivity(15),
    ]);

    return {
      counts,
      recent: recent.map(item => ({
        id: item.id,
        sessionId: item.sessionId,
        workflowId: item.workflowId,
        taskType: item.taskType,
        status: item.status,
        priority: item.priority ?? 0,
        assignedAgentId: item.assignedAgentId,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
    const [workflowMetrics, agentHealth, globalState] = await Promise.all([
      storage.getWorkflowExecutionMetrics(),
      storage.getAgentHealthSummary(),
      workflowCoordinator
        .getGlobalWorkflowState()
        .catch(() => ({
          activeWorkflows: 0,
          byPhase: {},
          byStatus: {},
          recentlyCompleted: [],
        })),
    ]);

    const totalWorkflows = Number(workflowMetrics.totalWorkflows ?? 0);
    const completedWorkflows = Number(workflowMetrics.completedWorkflows ?? 0);
    const failedWorkflows = Number(workflowMetrics.failedWorkflows ?? 0);
    const suspendedWorkflows = Number(workflowMetrics.suspendedWorkflows ?? 0);
    const successRate = Number(workflowMetrics.successRate ?? 0);
    const avgExecutionTimeSeconds = Number(
      workflowMetrics.avgExecutionTimeSeconds ?? 0
    );
    const agentHealthPercentage = Number(agentHealth.healthPercentage ?? 0);

    return {
      systemStatus: this.deriveSystemStatus(successRate, agentHealthPercentage),
      agentStatus: {
        active: Number(agentHealth.activeAgents ?? 0),
        total: Number(agentHealth.totalAgents ?? 0),
      },
      activeWorkflows: Number(globalState?.activeWorkflows ?? 0),
      suspendedWorkflows,
      completedWorkflows,
      failedWorkflows,
      totalWorkflows,
      successRate,
      avgExecutionTimeSeconds,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getWorkflowOverview(): Promise<WorkflowStateSummary> {
    const [globalState, recentWorkflows] = await Promise.all([
      workflowCoordinator
        .getGlobalWorkflowState()
        .catch(() => ({
          activeWorkflows: 0,
          byPhase: {},
          byStatus: {},
          recentlyCompleted: [],
        })),
      storage.getRecentWorkflowStates(20),
    ]);

    const workflows = recentWorkflows.map(workflow => {
      const context =
        (workflow.context as Record<string, any> | null | undefined) ?? {};
      const metadata =
        typeof context === 'object' && context !== null ? context : {};
      const title =
        metadata?.rfp?.title ?? metadata?.title ?? metadata?.name ?? null;
      const agency =
        metadata?.rfp?.agency ?? metadata?.agency ?? metadata?.customer ?? null;

      return {
        workflowId: workflow.workflowId,
        currentPhase: workflow.currentPhase,
        status: workflow.status,
        progress: Number(workflow.progress ?? 0),
        title,
        agency,
        updatedAt: (workflow.updatedAt ?? new Date()).toISOString(),
      };
    });

    const recentlyCompleted = (globalState.recentlyCompleted ?? []).map(
      entry => ({
        workflowId: entry.workflowId,
        phase: entry.phase,
        completedAt:
          entry.completedAt instanceof Date
            ? entry.completedAt.toISOString()
            : new Date(entry.completedAt).toISOString(),
      })
    );

    return {
      activeWorkflows: Number(globalState.activeWorkflows ?? 0),
      byPhase: globalState.byPhase ?? {},
      byStatus: globalState.byStatus ?? {},
      recentlyCompleted,
      workflows,
    };
  }

  async getPhaseStatistics(): Promise<WorkflowPhaseStats> {
    const [phaseMetrics, transitions] = await Promise.all([
      workflowCoordinator.getPhaseStatistics(),
      storage.getPhaseTransitionSummary(),
    ]);

    const phases: WorkflowPhaseStats['phases'] = {};
    for (const [phase, metrics] of Object.entries(phaseMetrics)) {
      phases[phase] = {
        active: Number((metrics as any)?.active ?? 0),
        completed: Number((metrics as any)?.completed ?? 0),
        failed: Number((metrics as any)?.failed ?? 0),
        avgDuration: Number((metrics as any)?.avgDuration ?? 0),
      };
    }

    return {
      phases,
      transitions: {
        totalTransitions: transitions.totalTransitions,
        successfulTransitions: transitions.successfulTransitions,
        failedTransitions: transitions.failedTransitions,
        averageTransitionTime: transitions.averageTransitionTime,
      },
    };
  }

  private deriveSystemStatus(
    successRate: number,
    agentHealthPercentage: number
  ): SystemHealthSnapshot['systemStatus'] {
    if (successRate >= 80 && agentHealthPercentage >= 70) {
      return 'healthy';
    }

    if (successRate >= 50 && agentHealthPercentage >= 40) {
      return 'degraded';
    }

    return 'unhealthy';
  }
}

export const agentMonitoringService = new AgentMonitoringService();
