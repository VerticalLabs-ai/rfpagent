import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  AgentActivityEvent,
  AgentCoordinationEvent,
  AgentPerformanceMetric,
  AgentRegistrySummary,
  SystemHealthSnapshot,
  WorkItemQueueSummary,
  WorkflowPhaseStats,
  WorkflowStateSummary,
} from '@/types/api';
import {
  Activity,
  Bot,
  Zap,
  Clock,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Workflow,
  PlayCircle,
  PauseCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.json() as Promise<T>;
};

export default function AgentMonitoring() {
  // Reduced polling intervals to minimize console noise
  const { data: agentPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ['/api/agent-performance'],
    queryFn: () =>
      fetchJson<AgentPerformanceMetric[]>('/api/agent-performance'),
    refetchInterval: 60000, // 1 min
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/system-health'],
    queryFn: () => fetchJson<SystemHealthSnapshot>('/api/system-health'),
    refetchInterval: 30000, // 30 sec
  });

  const { data: agentRegistry, isLoading: registryLoading } = useQuery({
    queryKey: ['/api/agent-registry'],
    queryFn: () => fetchJson<AgentRegistrySummary>('/api/agent-registry'),
    refetchInterval: 60000, // 1 min
  });

  const { data: workItems, isLoading: workItemsLoading } = useQuery({
    queryKey: ['/api/work-items'],
    queryFn: () => fetchJson<WorkItemQueueSummary>('/api/work-items'),
    refetchInterval: 45000, // 45 sec
  });

  const { data: agentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/agent-activity'],
    queryFn: () => fetchJson<AgentActivityEvent[]>('/api/agent-activity'),
    refetchInterval: 30000, // 30 sec
  });

  const { data: coordination, isLoading: coordLoading } = useQuery({
    queryKey: ['/api/agent-coordination'],
    queryFn: () =>
      fetchJson<AgentCoordinationEvent[]>('/api/agent-coordination'),
    refetchInterval: 45000, // 45 sec
  });

  const { data: workflowStates, isLoading: workflowLoading } = useQuery({
    queryKey: ['/api/workflows/state'],
    queryFn: () => fetchJson<WorkflowStateSummary>('/api/workflows/state'),
    refetchInterval: 30000, // 30 sec
  });

  const { data: phaseStats, isLoading: phaseStatsLoading } = useQuery({
    queryKey: ['/api/workflows/phase-stats'],
    queryFn: () => fetchJson<WorkflowPhaseStats>('/api/workflows/phase-stats'),
    refetchInterval: 60000, // 1 min
  });

  const isLoading =
    perfLoading ||
    healthLoading ||
    registryLoading ||
    workItemsLoading ||
    activitiesLoading ||
    coordLoading ||
    workflowLoading ||
    phaseStatsLoading;
  const hasError =
    !isLoading &&
    !agentPerformance &&
    !systemHealth &&
    !agentRegistry &&
    !workItems &&
    !agentActivities &&
    !coordination &&
    !workflowStates &&
    !phaseStats;

  // Provide default values for missing data
  const safeSystemHealth: SystemHealthSnapshot = systemHealth ?? {
    systemStatus: 'unhealthy',
    agentStatus: { active: 0, total: 0 },
    activeWorkflows: 0,
    suspendedWorkflows: 0,
    completedWorkflows: 0,
    failedWorkflows: 0,
    totalWorkflows: 0,
    successRate: 0,
    avgExecutionTimeSeconds: 0,
    lastUpdated: '',
  };
  const safeAgentRegistry: AgentRegistrySummary = agentRegistry ?? {
    totals: { totalAgents: 0, activeAgents: 0, inactiveAgents: 0 },
    byTier: {},
    agents: [],
  };
  const safeWorkItems: WorkItemQueueSummary = workItems ?? {
    counts: {},
    recent: [],
  };
  const safeAgentActivities: AgentActivityEvent[] = agentActivities ?? [];
  const safeCoordination: AgentCoordinationEvent[] = coordination ?? [];
  const safeWorkflowStates: WorkflowStateSummary = workflowStates ?? {
    activeWorkflows: 0,
    byPhase: {},
    byStatus: {},
    recentlyCompleted: [],
    workflows: [],
  };
  const safePhaseStats: WorkflowPhaseStats = phaseStats ?? {
    phases: {},
    transitions: {
      totalTransitions: 0,
      successfulTransitions: 0,
      failedTransitions: 0,
      averageTransitionTime: 0,
    },
  };
  const transitionMetrics = safePhaseStats.transitions;

  // Derive workflow metrics from available data
  const agentStatus = safeSystemHealth.agentStatus;

  const workflowMetrics = {
    completedWorkflows: safeSystemHealth.completedWorkflows,
    suspendedWorkflows: safeSystemHealth.suspendedWorkflows,
    failedWorkflows: safeSystemHealth.failedWorkflows,
  };

  const extendedWorkflowMetrics = {
    ...workflowMetrics,
    totalWorkflows: safeSystemHealth.totalWorkflows,
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Agent Performance Monitoring
          </h1>
          <p className="text-muted-foreground">
            Unable to load monitoring data. Please check your connection and try
            again.
          </p>
        </div>
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-700 mb-2">
                Monitoring System Error
              </h3>
              <p className="text-sm text-muted-foreground">
                Failed to fetch agent performance data
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1
          className="text-3xl font-bold text-foreground mb-2"
          data-testid="page-title"
        >
          Agent Performance Monitoring
        </h1>
        <p className="text-muted-foreground">
          Real-time insights into AI agent performance, coordination, and system
          health
        </p>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card data-testid="card-system-health">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold capitalize ${
                safeSystemHealth.systemStatus === 'healthy'
                  ? 'text-green-600'
                  : safeSystemHealth.systemStatus === 'degraded'
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
              data-testid="text-system-status"
            >
              {safeSystemHealth.systemStatus}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="text-sm text-muted-foreground">
                Agents: {agentStatus.active}/{agentStatus.total}
              </div>
              <Progress
                value={
                  agentStatus.total && agentStatus.total > 0
                    ? ((agentStatus.active ?? 0) / agentStatus.total) * 100
                    : 0
                }
                className="flex-1 h-2"
                data-testid="progress-agent-health"
              />
            </div>
            {safeSystemHealth.totalWorkflows === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                No workflows executed yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-active-workflows">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Workflows
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="text-active-workflows"
            >
              {safeSystemHealth.activeWorkflows}
            </div>
            <p className="text-xs text-muted-foreground">
              {safeSystemHealth.suspendedWorkflows} suspended
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-workflow-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {safeSystemHealth.successRate.toFixed(1)}%
            </div>
            <Progress
              value={safeSystemHealth.successRate}
              className="mt-2 h-2"
              data-testid="progress-success-rate"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-avg-execution">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="text-avg-execution"
            >
              {Math.round(safeSystemHealth.avgExecutionTimeSeconds)}s
            </div>
            <p className="text-xs text-muted-foreground">per workflow</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList>
          <TabsTrigger value="configuration" data-testid="tab-configuration">
            Agent Configuration
          </TabsTrigger>
          <TabsTrigger value="activities" data-testid="tab-activities">
            Live Activities
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            Agent Performance
          </TabsTrigger>
          <TabsTrigger value="coordination" data-testid="tab-coordination">
            Agent Coordination
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            Workflow Analytics
          </TabsTrigger>
          <TabsTrigger
            value="workflow-phases"
            data-testid="tab-workflow-phases"
          >
            Workflow Phases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          {/* Agent Registry with Configuration */}
          <Card data-testid="card-agent-registry">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Mastra Agent Registry
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                View and configure the 3-tier agent system: 1 Orchestrator, 3
                Managers, 7 Specialists
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Tier 1: Orchestrator */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="bg-purple-900/50 text-purple-300 border border-purple-700 px-2 py-0.5 rounded text-xs">
                      Tier 1
                    </span>
                    Orchestrator
                  </h3>
                  <div className="space-y-2">
                    {safeAgentRegistry.agents
                      .filter(agent => agent.tier === 'orchestrator')
                      .map(agent => (
                        <div
                          key={agent.agentId}
                          className="flex items-center justify-between p-3 border border-purple-700/30 rounded-lg bg-purple-950/20 hover:bg-purple-950/30 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
                            <div>
                              <div className="font-medium text-foreground">
                                {agent.displayName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {agent.role} • {agent.agentId}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={
                              agent.status === 'active'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {agent.status}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Tier 2: Managers */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="bg-blue-900/50 text-blue-300 border border-blue-700 px-2 py-0.5 rounded text-xs">
                      Tier 2
                    </span>
                    Managers
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {safeAgentRegistry.agents
                      .filter(agent => agent.tier === 'manager')
                      .map(agent => (
                        <div
                          key={agent.agentId}
                          className="flex flex-col p-3 border border-blue-700/30 rounded-lg bg-blue-950/20 hover:bg-blue-950/30 transition-colors"
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                            <div className="font-medium text-sm text-foreground">
                              {agent.displayName}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {agent.role}
                          </div>
                          <Badge
                            variant={
                              agent.status === 'active'
                                ? 'default'
                                : 'secondary'
                            }
                            className="self-start"
                          >
                            {agent.status}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Tier 3: Specialists */}
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="bg-emerald-900/50 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded text-xs">
                      Tier 3
                    </span>
                    Specialists
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {safeAgentRegistry.agents
                      .filter(agent => agent.tier === 'specialist')
                      .map(agent => (
                        <div
                          key={agent.agentId}
                          className="flex flex-col p-3 border border-emerald-700/30 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/30 transition-colors"
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                            <div className="font-medium text-sm text-foreground">
                              {agent.displayName}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {agent.role}
                          </div>
                          {agent.capabilities &&
                            agent.capabilities.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {agent.capabilities
                                  .slice(0, 3)
                                  .map((cap, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded"
                                    >
                                      {cap}
                                    </span>
                                  ))}
                                {agent.capabilities.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{agent.capabilities.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          <Badge
                            variant={
                              agent.status === 'active'
                                ? 'default'
                                : 'secondary'
                            }
                            className="self-start"
                          >
                            {agent.status}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                {/* No agents registered yet */}
                {safeAgentRegistry.agents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No agents registered yet</p>
                    <p className="text-sm">
                      Agents will appear here once workflows are executed
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workflow Configuration */}
          <Card data-testid="card-workflow-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Workflow Configuration
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Available Mastra workflows and their coordination patterns
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Master Orchestration</div>
                    <div className="text-sm text-muted-foreground">
                      End-to-end RFP lifecycle coordination
                    </div>
                  </div>
                  <Badge>Available</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">RFP Discovery</div>
                    <div className="text-sm text-muted-foreground">
                      Portal scanning and opportunity detection
                    </div>
                  </div>
                  <Badge>Available</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Document Processing</div>
                    <div className="text-sm text-muted-foreground">
                      Parse and analyze RFP documents
                    </div>
                  </div>
                  <Badge>Available</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Proposal Generation</div>
                    <div className="text-sm text-muted-foreground">
                      AI-powered proposal creation
                    </div>
                  </div>
                  <Badge>Available</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Bonfire Authentication</div>
                    <div className="text-sm text-muted-foreground">
                      Handle 2FA for Bonfire portals
                    </div>
                  </div>
                  <Badge>Available</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="space-y-6">
          <Card data-testid="card-live-activities">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Agent Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safeAgentActivities.slice(0, 10).map((activity, index) => {
                  const status = activity.status ?? 'pending';
                  const timestamp = activity.updatedAt
                    ? new Date(activity.updatedAt).toLocaleTimeString()
                    : 'N/A';
                  const statusStyles =
                    status === 'completed'
                      ? 'bg-green-100 text-green-600'
                      : status === 'failed'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-blue-100 text-blue-600';
                  const statusIcon =
                    status === 'completed' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : status === 'failed' ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    );

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`activity-item-${index}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${statusStyles}`}>
                          {statusIcon}
                        </div>
                        <div>
                          <div
                            className="font-medium"
                            data-testid={`activity-content-${index}`}
                          >
                            {activity.agentId ?? 'Unassigned'} •{' '}
                            {activity.taskType.replace(/_/g, ' ')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {timestamp} • Priority {activity.priority ?? 0}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          status === 'failed'
                            ? 'outline'
                            : status === 'completed'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-agent-metrics">
              <CardHeader>
                <CardTitle>Agent Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agentPerformance
                    ?.slice(0, 5)
                    .map((metric: AgentPerformanceMetric, index: number) => {
                      const metricLabel = metric.metricType ?? 'metric';
                      const metricValue = metric.metricValue ?? 0;
                      const recordedDate = metric.recordedAt
                        ? new Date(metric.recordedAt).toLocaleDateString()
                        : 'N/A';

                      return (
                        <div
                          key={metric.id ?? index}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">
                              {metric.agentId ?? 'Unknown Agent'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {metricLabel}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{metricValue}</div>
                            <div className="text-xs text-muted-foreground">
                              {recordedDate}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-workflow-breakdown">
              <CardHeader>
                <CardTitle>Workflow Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Completed</span>
                    </div>
                    <span
                      className="font-bold"
                      data-testid="text-completed-workflows"
                    >
                      {extendedWorkflowMetrics.completedWorkflows}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span>Suspended</span>
                    </div>
                    <span
                      className="font-bold"
                      data-testid="text-suspended-workflows"
                    >
                      {extendedWorkflowMetrics.suspendedWorkflows}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span>Failed</span>
                    </div>
                    <span
                      className="font-bold"
                      data-testid="text-failed-workflows"
                    >
                      {extendedWorkflowMetrics.failedWorkflows}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-agent-tiers">
            <CardHeader>
              <CardTitle>Agent Tier Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Total Agents</span>
                <span className="font-semibold">
                  {safeAgentRegistry.totals.totalAgents}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active Agents</span>
                <span className="font-semibold text-green-600">
                  {safeAgentRegistry.totals.activeAgents}
                </span>
              </div>
              <div className="border-t pt-3 space-y-2">
                {Object.keys(safeAgentRegistry.byTier).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No agents registered yet.
                  </p>
                )}
                {Object.entries(safeAgentRegistry.byTier).map(
                  ([tier, count]) => (
                    <div
                      key={tier}
                      className="flex items-center justify-between text-sm capitalize"
                    >
                      <span>{tier.replace('_', ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coordination" className="space-y-6">
          <Card data-testid="card-agent-coordination">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Agent Coordination Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safeCoordination.slice(0, 8).map((coord, index) => {
                  const startedAt = coord.startedAt
                    ? new Date(coord.startedAt).toLocaleTimeString()
                    : 'N/A';
                  const status = coord.status ?? 'pending';

                  return (
                    <div
                      key={coord.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`coordination-item-${index}`}
                    >
                      <div className="flex items-center space-x-3">
                        <Bot className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">
                            {coord.initiatorAgentId ?? 'Unknown'} →{' '}
                            {coord.targetAgentId ?? 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {coord.coordinationType.replace('_', ' ')} •{' '}
                            {startedAt}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          status === 'failed'
                            ? 'outline'
                            : status === 'completed'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="card-total-workflows">
              <CardHeader>
                <CardTitle>Total Workflows</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold"
                  data-testid="text-total-workflows"
                >
                  {extendedWorkflowMetrics.totalWorkflows}
                </div>
                <p className="text-sm text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card data-testid="card-success-percentage">
              <CardHeader>
                <CardTitle>Success Percentage</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold text-green-600"
                  data-testid="text-success-percentage"
                >
                  {safeSystemHealth.successRate.toFixed(1)}%
                </div>
                <Progress
                  value={safeSystemHealth.successRate}
                  className="mt-2"
                  data-testid="progress-success-percentage"
                />
              </CardContent>
            </Card>

            <Card data-testid="card-execution-time">
              <CardHeader>
                <CardTitle>Avg Execution Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold"
                  data-testid="text-execution-time"
                >
                  {Math.round(safeSystemHealth.avgExecutionTimeSeconds)}s
                </div>
                <p className="text-sm text-muted-foreground">per workflow</p>
              </CardContent>
            </Card>

            <Card data-testid="card-work-item-queue">
              <CardHeader>
                <CardTitle>Queue Backlog</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-semibold">
                    {safeWorkItems.counts.pending ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>In Progress</span>
                  <span className="font-semibold">
                    {safeWorkItems.counts.in_progress ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Failed</span>
                  <span className="font-semibold text-red-600">
                    {safeWorkItems.counts.failed ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflow-phases" className="space-y-6">
          {/* Phase Distribution Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card data-testid="card-discovery-phase">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Discovery</CardTitle>
                <PlayCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold text-blue-600"
                  data-testid="text-discovery-count"
                >
                  {safePhaseStats.phases.discovery?.active ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Active workflows
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-analysis-phase">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Analysis</CardTitle>
                <Bot className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold text-amber-600"
                  data-testid="text-analysis-count"
                >
                  {safePhaseStats.phases.analysis?.active ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Being analyzed
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-generation-phase">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Generation
                </CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold text-purple-600"
                  data-testid="text-generation-count"
                >
                  {safePhaseStats.phases.generation?.active ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Generating proposals
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-submission-phase">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Submission
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold text-orange-600"
                  data-testid="text-submission-count"
                >
                  {safePhaseStats.phases.submission?.active ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Being submitted
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-completed-phase">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-bold text-green-600"
                  data-testid="text-completed-count"
                >
                  {safeWorkflowStates.byStatus.completed ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Successfully completed
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Phase Transition Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card data-testid="card-transition-rate">
              <CardHeader>
                <CardTitle>Transition Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold text-green-600"
                  data-testid="text-transition-success-rate"
                >
                  {transitionMetrics.totalTransitions > 0
                    ? Math.round(
                        (transitionMetrics.successfulTransitions /
                          transitionMetrics.totalTransitions) *
                          100
                      )
                    : 0}
                  %
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {transitionMetrics.successfulTransitions} /{' '}
                  {transitionMetrics.totalTransitions} transitions transitions
                </div>
                <Progress
                  value={
                    transitionMetrics.totalTransitions > 0
                      ? (transitionMetrics.successfulTransitions /
                          transitionMetrics.totalTransitions) *
                        100
                      : 0
                  }
                  className="mt-2"
                  data-testid="progress-transition-success"
                />
              </CardContent>
            </Card>

            <Card data-testid="card-average-transition-time">
              <CardHeader>
                <CardTitle>Avg Transition Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold"
                  data-testid="text-avg-transition-time"
                >
                  {Math.round(transitionMetrics.averageTransitionTime)}s
                </div>
                <p className="text-sm text-muted-foreground">
                  per phase transition
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-failed-transitions">
              <CardHeader>
                <CardTitle>Failed Transitions</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-3xl font-bold text-red-600"
                  data-testid="text-failed-transitions"
                >
                  {transitionMetrics.failedTransitions}
                </div>
                <p className="text-sm text-muted-foreground">
                  requiring intervention
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Active Workflow Status Table */}
          <Card data-testid="card-active-workflows">
            <CardHeader>
              <CardTitle>Active Workflows Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safeWorkflowStates.workflows
                  .filter(workflow => workflow.title && workflow.progress > 0)
                  .slice(0, 10)
                  .map((workflow, index) => {
                    const status = workflow.status ?? 'pending';
                    const updatedAt = workflow.updatedAt
                      ? new Date(workflow.updatedAt).toLocaleString()
                      : 'N/A';

                    return (
                      <div
                        key={workflow.workflowId ?? index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {workflow.currentPhase === 'discovery' && (
                              <PlayCircle className="h-4 w-4 text-blue-500" />
                            )}
                            {workflow.currentPhase === 'analysis' && (
                              <Bot className="h-4 w-4 text-amber-500" />
                            )}
                            {workflow.currentPhase === 'generation' && (
                              <Zap className="h-4 w-4 text-purple-500" />
                            )}
                            {workflow.currentPhase === 'submission' && (
                              <TrendingUp className="h-4 w-4 text-orange-500" />
                            )}
                            {workflow.currentPhase === 'monitoring' && (
                              <Workflow className="h-4 w-4 text-sky-500" />
                            )}
                            {status === 'completed' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            <span className="font-medium capitalize text-foreground">
                              {workflow.currentPhase}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">
                              {workflow.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(workflow.agency || 'Unknown agency') +
                                ` • Updated ${updatedAt}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge
                            variant={
                              status === 'failed'
                                ? 'destructive'
                                : status === 'completed'
                                  ? 'default'
                                  : 'secondary'
                            }
                            data-testid={`badge-workflow-status-${index}`}
                          >
                            {status === 'in_progress' && (
                              <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                            )}
                            {status === 'completed' && (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {status === 'failed' && (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {status === 'pending' && (
                              <PauseCircle className="h-3 w-3 mr-1" />
                            )}
                            {status.replace('_', ' ')}
                          </Badge>
                          <div className="text-right">
                            <div className="text-sm font-medium text-foreground">
                              {Math.round(workflow.progress)}%
                            </div>
                            <Progress
                              value={workflow.progress}
                              className="w-20"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {(safeWorkflowStates.workflows.length === 0 ||
                  safeWorkflowStates.workflows.filter(
                    w => w.title && w.progress > 0
                  ).length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Workflow className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">
                      No Active Workflows
                    </p>
                    <p className="text-sm">
                      Workflows will appear here once you start scanning portals
                      or generating proposals
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
