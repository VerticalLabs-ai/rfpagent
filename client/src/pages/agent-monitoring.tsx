import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Bot, Zap, Clock, AlertCircle, CheckCircle, TrendingUp, Users } from "lucide-react";

export default function AgentMonitoring() {
  const { data: agentPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ["/api/agent-performance"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time monitoring
  });

  const { data: workflowMetrics, isLoading: workflowLoading } = useQuery({
    queryKey: ["/api/workflow-metrics"],
    refetchInterval: 5000,
  });

  const { data: agentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/agent-activity"],
    refetchInterval: 3000, // More frequent updates for activities
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/system-health"],
    refetchInterval: 10000,
  });

  const { data: coordination, isLoading: coordLoading } = useQuery({
    queryKey: ["/api/agent-coordination"],
    refetchInterval: 5000,
  });

  const isLoading = perfLoading || workflowLoading || activitiesLoading || healthLoading || coordLoading;
  const hasError = !isLoading && (!agentPerformance && !workflowMetrics && !agentActivities && !systemHealth && !coordination);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[1, 2, 3, 4].map((i) => (
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
            Unable to load monitoring data. Please check your connection and try again.
          </p>
        </div>
        <Card className="border-red-200">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-700 mb-2">Monitoring System Error</h3>
              <p className="text-sm text-muted-foreground">Failed to fetch agent performance data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="page-title">
          Agent Performance Monitoring
        </h1>
        <p className="text-muted-foreground">
          Real-time insights into AI agent performance, coordination, and system health
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
            <div className="text-2xl font-bold text-green-600" data-testid="text-system-status">
              {systemHealth?.systemStatus || 'Unknown'}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="text-sm text-muted-foreground">
                Agents: {systemHealth?.agentStatus?.activeAgents || 0}/{systemHealth?.agentStatus?.totalAgents || 0}
              </div>
              <Progress 
                value={systemHealth?.agentStatus?.healthPercentage || 0} 
                className="flex-1 h-2"
                data-testid="progress-agent-health" 
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-workflows">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-workflows">
              {systemHealth?.activeWorkflows || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemHealth?.suspendedWorkflows || 0} suspended
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
              {workflowMetrics?.successRate?.toFixed(1) || 0}%
            </div>
            <Progress 
              value={workflowMetrics?.successRate || 0} 
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
            <div className="text-2xl font-bold" data-testid="text-avg-execution">
              {Math.round(workflowMetrics?.avgExecutionTimeSeconds || 0)}s
            </div>
            <p className="text-xs text-muted-foreground">
              per workflow
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activities" className="w-full">
        <TabsList>
          <TabsTrigger value="activities" data-testid="tab-activities">Live Activities</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Agent Performance</TabsTrigger>
          <TabsTrigger value="coordination" data-testid="tab-coordination">Agent Coordination</TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">Workflow Analytics</TabsTrigger>
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
                {agentActivities?.slice(0, 10).map((activity: any, index: number) => (
                  <div 
                    key={activity.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`activity-item-${index}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        activity.type === 'performance_metric' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {activity.type === 'performance_metric' ? <TrendingUp className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-medium" data-testid={`activity-content-${index}`}>
                          Agent {activity.agentId}: {activity.activity}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant={activity.type === 'performance_metric' ? 'default' : 'secondary'}>
                      {activity.type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
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
                  {agentPerformance?.slice(0, 5).map((metric: any, index: number) => (
                    <div key={metric.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{metric.agentId}</div>
                        <div className="text-sm text-muted-foreground">{metric.metricType}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{metric.metricValue}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(metric.recordedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
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
                    <span className="font-bold" data-testid="text-completed-workflows">
                      {workflowMetrics?.completedWorkflows || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span>Suspended</span>
                    </div>
                    <span className="font-bold" data-testid="text-suspended-workflows">
                      {workflowMetrics?.suspendedWorkflows || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span>Failed</span>
                    </div>
                    <span className="font-bold" data-testid="text-failed-workflows">
                      {workflowMetrics?.failedWorkflows || 0}
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
                {coordination?.slice(0, 8).map((coord: any, index: number) => (
                  <div 
                    key={coord.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`coordination-item-${index}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Bot className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">
                          {coord.initiatorAgentId} → {coord.targetAgentId}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {coord.coordinationType} • {new Date(coord.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">{coord.coordinationType}</Badge>
                  </div>
                ))}
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
                <div className="text-3xl font-bold" data-testid="text-total-workflows">
                  {workflowMetrics?.totalWorkflows || 0}
                </div>
                <p className="text-sm text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card data-testid="card-success-percentage">
              <CardHeader>
                <CardTitle>Success Percentage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600" data-testid="text-success-percentage">
                  {workflowMetrics?.successRate?.toFixed(1) || 0}%
                </div>
                <Progress 
                  value={workflowMetrics?.successRate || 0} 
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
                <div className="text-3xl font-bold" data-testid="text-execution-time">
                  {Math.round(workflowMetrics?.avgExecutionTimeSeconds || 0)}s
                </div>
                <p className="text-sm text-muted-foreground">per workflow</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}