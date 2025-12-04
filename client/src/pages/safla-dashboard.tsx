import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  BarChart,
  Brain,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

interface SAFLAStatus {
  isInitialized: boolean;
  components: {
    learningEngine: string;
    memoryEngine: string;
    adaptationEngine: string;
    performanceMonitor: string;
  };
  learningEnabled: boolean;
  metrics: {
    totalLearningEvents: number;
    successfulAdaptations: number;
    knowledgeBaseSize: number;
    avgPerformanceImprovement: number;
  };
}

interface SAFLADashboardData {
  timeframe: string;
  systemHealth: number;
  learningMetrics: {
    learningRate: number;
    knowledgeGrowth: number;
    adaptationSuccess: number;
  };
  performanceMetrics: {
    proposalWinRate: number;
    parsingAccuracy: number;
    portalNavigationSuccess: number;
    avgProcessingTime: number;
  };
  improvementOpportunities: Array<{
    area: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
    potentialImpact: number;
  }>;
  alerts: Array<{
    type: 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

// Runtime validation helpers
function validateSAFLAStatus(data: any): data is SAFLAStatus {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.isInitialized === 'boolean' &&
    typeof data.learningEnabled === 'boolean' &&
    data.components &&
    typeof data.components === 'object' &&
    typeof data.components.learningEngine === 'string' &&
    typeof data.components.memoryEngine === 'string' &&
    typeof data.components.adaptationEngine === 'string' &&
    typeof data.components.performanceMonitor === 'string' &&
    data.metrics &&
    typeof data.metrics === 'object' &&
    typeof data.metrics.totalLearningEvents === 'number' &&
    typeof data.metrics.successfulAdaptations === 'number' &&
    typeof data.metrics.knowledgeBaseSize === 'number' &&
    typeof data.metrics.avgPerformanceImprovement === 'number'
  );
}

function validateSAFLADashboard(data: any): data is SAFLADashboardData {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.timeframe === 'string' &&
    typeof data.systemHealth === 'number' &&
    data.learningMetrics &&
    typeof data.learningMetrics === 'object' &&
    typeof data.learningMetrics.learningRate === 'number' &&
    typeof data.learningMetrics.knowledgeGrowth === 'number' &&
    typeof data.learningMetrics.adaptationSuccess === 'number' &&
    data.performanceMetrics &&
    typeof data.performanceMetrics === 'object' &&
    typeof data.performanceMetrics.proposalWinRate === 'number' &&
    typeof data.performanceMetrics.parsingAccuracy === 'number' &&
    typeof data.performanceMetrics.portalNavigationSuccess === 'number' &&
    typeof data.performanceMetrics.avgProcessingTime === 'number' &&
    Array.isArray(data.improvementOpportunities) &&
    Array.isArray(data.alerts)
  );
}

export default function SAFLADashboard() {
  const [timeframe, setTimeframe] = useState('24h');
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/safla/status'],
    queryFn: () =>
      apiRequest('GET', '/api/safla/status').then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/safla/dashboard', timeframe],
    queryFn: () =>
      apiRequest('GET', `/api/safla/dashboard?timeframe=${timeframe}`).then(
        res => res.json()
      ),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const demonstrateMutation = useMutation({
    mutationFn: async (scenario: string) => {
      const response = await apiRequest(
        'POST',
        `/api/safla/demonstrate/${scenario}`
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safla'] });
      toast({
        title: 'Learning Demonstration Complete',
        description: 'The system has recorded new learning patterns.',
      });
    },
  });

  const consolidateMemoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        '/api/safla/consolidate-memory'
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safla'] });
      toast({
        title: 'Memory Consolidation Complete',
        description: 'System memory has been consolidated and optimized.',
      });
    },
  });

  // Validate API responses with runtime checks
  const hasValidStatus = status?.data && validateSAFLAStatus(status.data);
  const hasValidDashboard =
    dashboard?.data && validateSAFLADashboard(dashboard.data);

  const safeStatus = hasValidStatus ? status.data : null;
  const safeDashboard = hasValidDashboard ? dashboard.data : null;

  const isLoading = statusLoading || dashboardLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-96 mb-2" />
          <Skeleton className="h-4 w-[600px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

  // Show error state if data is invalid
  if (!isLoading && (!hasValidStatus || !hasValidDashboard)) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invalid Data Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The SAFLA system returned invalid or incomplete data. Please try
              refreshing the page.
            </p>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['/api/safla'] })
              }
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 pb-0 shrink-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-500" />
              SAFLA Self-Improving AI System
            </h1>
            <p className="text-muted-foreground">
              Real-time insights into the self-aware feedback loop algorithm and
              continuous learning system
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              className="px-4 py-2 rounded-md border bg-background text-foreground"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['/api/safla'] })
              }
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Status Overview */}
        {hasValidDashboard && hasValidStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Health
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {safeDashboard.systemHealth}%
                </div>
                <Progress value={safeDashboard.systemHealth} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {safeStatus.isInitialized
                    ? 'System operational'
                    : 'Initializing...'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Learning Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {safeDashboard.learningMetrics.learningRate}
                </div>
                <p className="text-xs text-muted-foreground">events/day</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Knowledge Growth
                </CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {safeDashboard.learningMetrics.knowledgeGrowth}
                </div>
                <p className="text-xs text-muted-foreground">entries/day</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Adaptation Success
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {safeDashboard.learningMetrics.adaptationSuccess}%
                </div>
                <Progress
                  value={safeDashboard.learningMetrics.adaptationSuccess}
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Tabs
        defaultValue="performance"
        className="flex flex-col flex-1 overflow-hidden mt-6"
      >
        <div className="px-6 pb-4 shrink-0">
          <TabsList>
            <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
            <TabsTrigger value="opportunities">
              Improvement Opportunities
            </TabsTrigger>
            <TabsTrigger value="components">System Components</TabsTrigger>
            <TabsTrigger value="demonstrations">Learning Demos</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 pt-0 space-y-6">
            {/* Performance Metrics Tab */}
            <TabsContent value="performance" className="m-0 space-y-6">
              {hasValidDashboard ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Proposal Win Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-green-600 mb-2">
                          {safeDashboard.performanceMetrics.proposalWinRate}%
                        </div>
                        <Progress
                          value={
                            safeDashboard.performanceMetrics.proposalWinRate
                          }
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Percentage of proposals that win bids
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart className="h-5 w-5" />
                          Parsing Accuracy
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          {safeDashboard.performanceMetrics.parsingAccuracy}%
                        </div>
                        <Progress
                          value={
                            safeDashboard.performanceMetrics.parsingAccuracy
                          }
                          className="bg-blue-200"
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Document processing accuracy
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Portal Navigation Success
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-purple-600 mb-2">
                          {
                            safeDashboard.performanceMetrics
                              .portalNavigationSuccess
                          }
                          %
                        </div>
                        <Progress
                          value={
                            safeDashboard.performanceMetrics
                              .portalNavigationSuccess
                          }
                          className="bg-purple-200"
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Portal scanning success rate
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Avg Processing Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-orange-600 mb-2">
                          {safeDashboard.performanceMetrics.avgProcessingTime}s
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Average operation duration
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Alerts */}
                  {safeDashboard.alerts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Learning Events</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {safeDashboard.alerts.map(
                            (
                              alert: SAFLADashboardData['alerts'][number],
                              index: number
                            ) => (
                              <div
                                key={index}
                                className="flex items-start gap-3 p-3 rounded-lg border"
                              >
                                {alert.type === 'success' && (
                                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                )}
                                {alert.type === 'warning' && (
                                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                                )}
                                {alert.type === 'error' && (
                                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {alert.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(alert.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-muted-foreground">
                      Performance metrics unavailable
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Improvement Opportunities Tab */}
            <TabsContent value="opportunities" className="m-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Identified Improvement Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {hasValidDashboard &&
                    safeDashboard.improvementOpportunities.length > 0 ? (
                      safeDashboard.improvementOpportunities.map(
                        (
                          opportunity: SAFLADashboardData['improvementOpportunities'][number],
                          index: number
                        ) => (
                          <div
                            key={index}
                            className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Badge
                                    variant={
                                      opportunity.priority === 'high'
                                        ? 'destructive'
                                        : opportunity.priority === 'medium'
                                          ? 'default'
                                          : 'secondary'
                                    }
                                  >
                                    {opportunity.priority} priority
                                  </Badge>
                                  <h4 className="font-medium">
                                    {opportunity.area}
                                  </h4>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {opportunity.description}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-2xl font-bold text-green-600">
                                  +{opportunity.potentialImpact}%
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  potential impact
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      )
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        {hasValidDashboard
                          ? 'No improvement opportunities identified yet'
                          : 'Dashboard data unavailable'}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* System Components Tab */}
            <TabsContent value="components" className="m-0 space-y-6">
              {hasValidStatus ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>System Component Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {(
                          Object.entries(safeStatus.components) as [
                            string,
                            string,
                          ][]
                        ).map(([component, status]) => (
                          <div
                            key={component}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <h4 className="font-medium capitalize">
                                {component.replace(/([A-Z])/g, ' $1').trim()}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Core system component
                              </p>
                            </div>
                            <Badge
                              variant={
                                status === 'operational'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>System Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Total Learning Events
                          </p>
                          <p className="text-2xl font-bold">
                            {safeStatus.metrics.totalLearningEvents}
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Successful Adaptations
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {safeStatus.metrics.successfulAdaptations}
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Knowledge Base Size
                          </p>
                          <p className="text-2xl font-bold">
                            {safeStatus.metrics.knowledgeBaseSize}
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Avg Performance Improvement
                          </p>
                          <p className="text-2xl font-bold text-blue-600">
                            +{safeStatus.metrics.avgPerformanceImprovement}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-muted-foreground">
                      System status unavailable
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Learning Demonstrations Tab */}
            <TabsContent value="demonstrations" className="m-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Test Learning Workflows</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Trigger demonstration learning scenarios to see the system
                    adapt in real-time
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() =>
                        demonstrateMutation.mutate('portal_discovery')
                      }
                      disabled={demonstrateMutation.isPending}
                      className="h-auto flex-col items-start p-4"
                    >
                      <Activity className="h-6 w-6 mb-2" />
                      <h4 className="font-medium mb-1">Portal Discovery</h4>
                      <p className="text-xs opacity-80 text-left">
                        Simulate portal interaction learning
                      </p>
                    </Button>

                    <Button
                      onClick={() =>
                        demonstrateMutation.mutate('document_processing')
                      }
                      disabled={demonstrateMutation.isPending}
                      className="h-auto flex-col items-start p-4"
                    >
                      <BarChart className="h-6 w-6 mb-2" />
                      <h4 className="font-medium mb-1">Document Processing</h4>
                      <p className="text-xs opacity-80 text-left">
                        Simulate document parsing improvements
                      </p>
                    </Button>

                    <Button
                      onClick={() =>
                        demonstrateMutation.mutate('proposal_generation')
                      }
                      disabled={demonstrateMutation.isPending}
                      className="h-auto flex-col items-start p-4"
                    >
                      <Target className="h-6 w-6 mb-2" />
                      <h4 className="font-medium mb-1">Proposal Generation</h4>
                      <p className="text-xs opacity-80 text-left">
                        Simulate proposal outcome learning
                      </p>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Memory Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium mb-1">
                        Consolidate System Memory
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Optimize and consolidate learned patterns in memory
                      </p>
                    </div>
                    <Button
                      onClick={() => consolidateMemoryMutation.mutate()}
                      disabled={consolidateMemoryMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Consolidate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
