// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface AgentPerformanceMetric {
  id: string;
  agentId?: string;
  metricType?: string;
  metricValue?: number;
  recordedAt?: string;
}

interface AgentActivity {
  id: string;
  agentId?: string;
  type?: string;
  activity?: string;
  timestamp?: string;
}

interface CoordinationActivity {
  id: string;
  initiatorAgentId?: string;
  targetAgentId?: string;
  coordinationType?: string;
  createdAt?: string;
}

interface AgentStatusSummary {
  active?: number;
  total?: number;
}

interface SystemHealthSnapshot {
  systemStatus?: string;
  agentStatus?: AgentStatusSummary;
  activeWorkflows?: number;
  suspendedWorkflows?: number;
  successRate?: number;
  avgExecutionTimeSeconds?: number;
  completedWorkflows?: number;
  failedWorkflows?: number;
}

interface AgentRegistryData {
  summary?: {
    byTier?: Record<string, number>;
  };
}

interface WorkItemSummary {
  summary?: Record<string, number>;
}

interface WorkflowSummary {
  workflowId?: string;
  currentPhase?: string;
  title?: string;
  agency?: string;
  status?: string;
  progress?: number;
}

interface WorkflowStateData {
  workflows?: WorkflowSummary[];
  summary?: {
    phaseDistribution?: Record<string, number>;
  };
}

interface TransitionMetrics {
  totalTransitions?: number;
  successfulTransitions?: number;
  failedTransitions?: number;
  averageTransitionTime?: number;
}

interface WorkflowPhaseStats {
  phaseStats?: Record<string, number>;
  transitionMetrics?: TransitionMetrics;
}

interface WorkflowStatusCounts {
  completedWorkflows: number;
  suspendedWorkflows: number;
  failedWorkflows: number;
}

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return response.json() as Promise<T>;
};

export default function AgentMonitoring() {
  const { data: agentPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ['/api/agent-performance'],
    queryFn: () =>
      fetchJson<AgentPerformanceMetric[]>('/api/agent-performance'),
    refetchInterval: 5000,
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/system-health'],
    queryFn: () => fetchJson<SystemHealthSnapshot>('/api/system-health'),
    refetchInterval: 5000,
  });

  const { data: agentRegistry, isLoading: registryLoading } = useQuery({
    queryKey: ['/api/agent-registry'],
    queryFn: () => fetchJson<AgentRegistryData>('/api/agent-registry'),
    refetchInterval: 3000,
  });

  const { data: workItems, isLoading: workItemsLoading } = useQuery({
    queryKey: ['/api/work-items'],
    queryFn: () => fetchJson<WorkItemSummary>('/api/work-items'),
    refetchInterval: 3000,
  });

  const { data: agentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/agent-activity'],
    queryFn: () => fetchJson<AgentActivity[]>('/api/agent-activity'),
    refetchInterval: 3000,
  });

  const { data: coordination, isLoading: coordLoading } = useQuery({
    queryKey: ['/api/agent-coordination'],
    queryFn: () => fetchJson<CoordinationActivity[]>('/api/agent-coordination'),
    refetchInterval: 5000,
  });

  const { data: workflowStates, isLoading: workflowLoading } = useQuery({
    queryKey: ['/api/workflows/state'],
    queryFn: () => fetchJson<WorkflowStateData>('/api/workflows/state'),
    refetchInterval: 3000,
  });

  const { data: phaseStats, isLoading: phaseStatsLoading } = useQuery({
    queryKey: ['/api/workflows/phase-stats'],
    queryFn: () => fetchJson<WorkflowPhaseStats>('/api/workflows/phase-stats'),
    refetchInterval: 5000,
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
  const safeSystemHealth: SystemHealthSnapshot = systemHealth || {};
  const safeAgentRegistry: AgentRegistryData = agentRegistry || {
    summary: { byTier: {} },
  };
  const safeWorkItems: WorkItemSummary = workItems || { summary: {} };
  const safeAgentActivities: AgentActivity[] = agentActivities || [];
  const safeCoordination: CoordinationActivity[] = coordination || [];
  const safeWorkflowStates: WorkflowStateData = workflowStates || {
    workflows: [],
    summary: { phaseDistribution: {} },
  };
  const safePhaseStats: WorkflowPhaseStats = phaseStats || {
    phaseStats: {},
    transitionMetrics: {},
  };
  const transitionMetrics: TransitionMetrics =
    safePhaseStats.transitionMetrics || {
      totalTransitions: 0,
      successfulTransitions: 0,
      failedTransitions: 0,
      averageTransitionTime: 0,
    };

  // Derive workflow metrics from available data
  const agentStatus = safeSystemHealth.agentStatus ?? { active: 0, total: 0 };

  const workflowMetrics: WorkflowStatusCounts = {
    completedWorkflows: safeSystemHealth?.completedWorkflows || 0,
    suspendedWorkflows: safeSystemHealth?.suspendedWorkflows || 0,
    failedWorkflows: safeSystemHealth?.failedWorkflows || 0,
  };
  const totalWorkflows =
    workflowMetrics.completedWorkflows +
    workflowMetrics.suspendedWorkflows +
    workflowMetrics.failedWorkflows;

  const extendedWorkflowMetrics: WorkflowStatusCounts & {
    totalWorkflows: number;
  } = {
    ...workflowMetrics,
    totalWorkflows,
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
              className="text-2xl font-bold text-green-600"
              data-testid="text-system-status"
            >
              {safeSystemHealth?.systemStatus || 'Unknown'}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="text-sm text-muted-foreground">
                Agents: {agentStatus.active || 0}/{agentStatus.total || 0}
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
              {safeSystemHealth?.activeWorkflows || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {safeSystemHealth?.suspendedWorkflows || 0} suspended
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
              {safeSystemHealth?.successRate?.toFixed(1) || 0}%
            </div>
            <Progress
              value={safeSystemHealth?.successRate || 0}
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
              {Math.round(safeSystemHealth?.avgExecutionTimeSeconds || 0)}s
            </div>
            <p className="text-xs text-muted-foreground">per workflow</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activities" className="w-full">
        <TabsList>
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
                {safeAgentActivities
                  ?.slice(0, 10)
                  .map((activity: AgentActivity, index: number) => {
                    const activityType = activity.type ?? 'activity';
                    const timestamp = activity.timestamp
                      ? new Date(activity.timestamp).toLocaleTimeString()
                      : 'N/A';

                    return (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`activity-item-${index}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`p-2 rounded-full ${
                              activityType === 'performance_metric'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-green-100 text-green-600'
                            }`}
                          >
                            {activityType === 'performance_metric' ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div
                              className="font-medium"
                              data-testid={`activity-content-${index}`}
                            >
                              Agent {activity.agentId ?? 'unknown'}:{' '}
                              {activity.activity ?? 'Activity recorded'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {timestamp}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            activityType === 'performance_metric'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {activityType.replace('_', ' ')}
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
                {safeCoordination
                  ?.slice(0, 8)
                  .map((coord: CoordinationActivity, index: number) => {
                    const createdAt = coord.createdAt
                      ? new Date(coord.createdAt).toLocaleTimeString()
                      : 'N/A';
                    const type = coord.coordinationType ?? 'coordination';

                    return (
                      <div
                        key={coord.id ?? index}
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
                              {type} • {createdAt}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">{type}</Badge>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  {safeSystemHealth?.successRate?.toFixed(1) || 0}%
                </div>
                <Progress
                  value={safeSystemHealth?.successRate || 0}
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
                  {Math.round(safeSystemHealth?.avgExecutionTimeSeconds || 0)}s
                </div>
                <p className="text-sm text-muted-foreground">per workflow</p>
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
                  {safeWorkflowStates?.summary?.phaseDistribution?.discovery ||
                    0}
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
                  {safeWorkflowStates?.summary?.phaseDistribution?.analysis ||
                    0}
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
                  {safeWorkflowStates?.summary?.phaseDistribution?.generation ||
                    0}
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
                  {safeWorkflowStates?.summary?.phaseDistribution?.submission ||
                    0}
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
                  {safeWorkflowStates?.summary?.phaseDistribution?.completed ||
                    0}
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
                  {safePhaseStats?.transitionMetrics?.totalTransitions > 0
                    ? Math.round(
                        (safePhaseStats?.transitionMetrics
                          ?.successfulTransitions /
                          safePhaseStats?.transitionMetrics?.totalTransitions) *
                          100
                      )
                    : 0}
                  %
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {safePhaseStats?.transitionMetrics?.successfulTransitions ||
                    0}{' '}
                  / {safePhaseStats?.transitionMetrics?.totalTransitions || 0}{' '}
                  transitions
                </div>
                <Progress
                  value={
                    safePhaseStats?.transitionMetrics?.totalTransitions > 0
                      ? (safePhaseStats?.transitionMetrics
                          ?.successfulTransitions /
                          safePhaseStats?.transitionMetrics?.totalTransitions) *
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
                  {Math.round(
                    safePhaseStats?.transitionMetrics?.averageTransitionTime ||
                      0
                  )}
                  s
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
                  {safePhaseStats?.transitionMetrics?.failedTransitions || 0}
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
                {safeWorkflowStates?.workflows
                  ?.slice(0, 10)
                  .map((workflow: WorkflowSummary, index: number) => (
                    <div
                      key={workflow.workflowId || index}
                      className="flex items-center justify-between p-3 border rounded-lg"
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
                          {workflow.currentPhase === 'completed' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium capitalize">
                            {workflow.currentPhase}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-sm">
                            {workflow.title || 'Untitled RFP'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {workflow.agency || 'Unknown Agency'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              workflow.status === 'completed'
                                ? 'default'
                                : workflow.status === 'failed'
                                  ? 'destructive'
                                  : workflow.status === 'in_progress'
                                    ? 'secondary'
                                    : 'outline'
                            }
                            data-testid={`badge-workflow-status-${index}`}
                          >
                            {workflow.status === 'in_progress' && (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            {workflow.status === 'completed' && (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {workflow.status === 'failed' && (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {workflow.status === 'pending' && (
                              <PauseCircle className="h-3 w-3 mr-1" />
                            )}
                            {workflow.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {workflow.progress}%
                          </div>
                          <Progress
                            value={workflow.progress}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                {(!safeWorkflowStates?.workflows ||
                  safeWorkflowStates.workflows.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active workflows found</p>
                    <p className="text-sm">
                      Start scanning portals to discover RFPs
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
