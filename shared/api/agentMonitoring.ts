export type AgentMetricsTimeframe = '24h' | '7d' | '30d';

export interface AgentPerformanceMetric {
  id: string;
  agentId: string;
  metricType: string;
  metricValue: number;
  context: Record<string, unknown> | null;
  referenceEntityType: string | null;
  referenceEntityId: string | null;
  aggregationPeriod: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface AgentActivityEvent {
  id: string;
  sessionId: string;
  workflowId: string | null;
  agentId: string | null;
  createdByAgentId: string;
  taskType: string;
  status: string;
  priority: number;
  updatedAt: string;
  description: string | null;
}

export interface AgentCoordinationEvent {
  id: string;
  sessionId: string;
  initiatorAgentId: string;
  targetAgentId: string;
  coordinationType: string;
  status: string;
  priority: number;
  startedAt: string;
  completedAt: string | null;
}

export interface AgentRegistrySummary {
  totals: {
    totalAgents: number;
    activeAgents: number;
    inactiveAgents: number;
  };
  byTier: Record<string, number>;
  agents: Array<{
    agentId: string;
    tier: string;
    role: string;
    displayName: string;
    status: string;
    capabilities: string[];
    lastHeartbeat: string | null;
  }>;
}

export interface WorkItemQueueSummary {
  counts: Record<string, number>;
  recent: Array<{
    id: string;
    sessionId: string;
    workflowId: string | null;
    taskType: string;
    status: string;
    priority: number;
    assignedAgentId: string | null;
    updatedAt: string;
  }>;
}

export interface SystemHealthSnapshot {
  systemStatus: 'healthy' | 'degraded' | 'unhealthy';
  agentStatus: {
    active: number;
    total: number;
  };
  activeWorkflows: number;
  suspendedWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  totalWorkflows: number;
  successRate: number;
  avgExecutionTimeSeconds: number;
  lastUpdated: string;
}

export interface WorkflowOverview {
  workflowId: string;
  currentPhase: string;
  status: string;
  progress: number;
  title: string | null;
  agency: string | null;
  updatedAt: string;
}

export interface WorkflowStateSummary {
  activeWorkflows: number;
  byPhase: Record<string, number>;
  byStatus: Record<string, number>;
  recentlyCompleted: Array<{
    workflowId: string;
    phase: string;
    completedAt: string;
  }>;
  workflows: WorkflowOverview[];
}

export interface WorkflowPhaseMetrics {
  active: number;
  completed: number;
  failed: number;
  avgDuration: number;
}

export interface WorkflowPhaseStats {
  phases: Record<string, WorkflowPhaseMetrics>;
  transitions: {
    totalTransitions: number;
    successfulTransitions: number;
    failedTransitions: number;
    averageTransitionTime: number;
  };
}
