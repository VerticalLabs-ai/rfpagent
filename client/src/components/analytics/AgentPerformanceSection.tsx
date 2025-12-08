import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
} from 'lucide-react';
import type { AgentResourceAllocation } from '@shared/api/agentTracking';

interface AgentPerformanceMetrics {
  agentId: string;
  agentDisplayName: string;
  tier: string;
  tasksCompleted: number;
  tasksFailed: number;
  avgExecutionTimeMs: number;
  successRate: number;
}

export function AgentPerformanceSection() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  // Fetch performance metrics (may not exist yet)
  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
  } = useQuery<AgentPerformanceMetrics[]>({
    queryKey: ['/api/agent-performance', timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/agent-performance?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error('Performance data not available');
      }
      return response.json();
    },
    retry: false,
  });

  // Fetch resource allocation (exists)
  const { data: resourceData, isLoading: resourceLoading } = useQuery<
    AgentResourceAllocation[]
  >({
    queryKey: ['/api/agent-resources'],
  });

  const isLoading = performanceLoading || resourceLoading;
  const hasPerformanceData = !performanceError && performanceData;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
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

  return (
    <div className="space-y-6">
      {/* Header with Timeframe Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Agent Performance
          </h2>
        </div>
        <Select
          value={timeframe}
          onValueChange={value => setTimeframe(value as '24h' | '7d' | '30d')}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Performance Metrics Grid */}
      {hasPerformanceData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {performanceData.map(agent => {
            const resourceInfo = resourceData?.find(
              r => r.agentId === agent.agentId
            );
            const totalTasks = agent.tasksCompleted + agent.tasksFailed;

            return (
              <Card
                key={agent.agentId}
                data-testid={`agent-performance-${agent.agentId}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">
                        {agent.agentDisplayName}
                      </CardTitle>
                    </div>
                    <Badge
                      variant={
                        agent.tier === 'orchestrator'
                          ? 'default'
                          : agent.tier === 'manager'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      Tier {agent.tier === 'orchestrator' ? '1' : agent.tier === 'manager' ? '2' : '3'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Task Completion Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">
                        {agent.tasksCompleted} completed
                      </span>
                    </div>
                    {agent.tasksFailed > 0 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="font-medium">
                          {agent.tasksFailed} failed
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Average Execution Time */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Avg. execution time</span>
                    </div>
                    <span className="font-medium">
                      {(agent.avgExecutionTimeMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Success Rate Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        <span>Success rate</span>
                      </div>
                      <span className="font-medium">
                        {agent.successRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={agent.successRate}
                      className="h-2"
                      data-testid={`success-rate-${agent.agentId}`}
                    />
                  </div>

                  {/* Current Load (from resources) */}
                  {resourceInfo && (
                    <div className="pt-2 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-1">
                        Current load: {resourceInfo.activeTasks}/
                        {resourceInfo.maxConcurrentTasks} tasks
                      </div>
                      <Progress
                        value={resourceInfo.currentLoad}
                        className="h-1"
                        data-testid={`current-load-${agent.agentId}`}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Performance Data Collection in Progress
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agent performance metrics are being configured. Check back soon
              for detailed analytics.
            </p>
            {resourceData && resourceData.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Current load information is available below.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Load Section - Always show if resource data exists */}
      {resourceData && resourceData.length > 0 && (
        <Card data-testid="current-load-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Current Load Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {resourceData.map(resource => (
                <div key={resource.agentId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {resource.agentDisplayName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {resource.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>
                        {resource.activeTasks} active /{' '}
                        {resource.queuedTasks} queued
                      </span>
                      <span className="font-medium text-foreground">
                        {resource.currentLoad.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={resource.currentLoad}
                    className="h-2"
                    data-testid={`load-bar-${resource.agentId}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
