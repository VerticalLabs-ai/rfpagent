import ActiveRFPsTable from '@/components/ActiveRFPsTable';
import ActivityFeed from '@/components/ActivityFeed';
import MetricsCards from '@/components/MetricsCards';
import PortalStatusGrid from '@/components/PortalStatusGrid';
import { LiveIndicator } from '@/components/providers/RealtimeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerformanceMonitoring } from '@/hooks/usePerformance';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { performanceScore } = usePerformanceMonitoring();
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      {/* Header with Live Indicator and Performance Score */}
      <div className="p-6 pb-0 shrink-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              RFP Dashboard
              <LiveIndicator />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage your automated RFP workflow in real-time
            </p>
          </div>

          <div className="flex items-center gap-3">
            {performanceScore !== undefined && performanceScore !== null && (
              <Card className="border-none shadow-xs">
                <CardContent className="p-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <div className="text-sm">
                    <div className="font-semibold text-foreground">
                      {performanceScore}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Performance
                    </div>
                  </div>
                  <Badge
                    variant={
                      performanceScore >= 90
                        ? 'default'
                        : performanceScore >= 50
                          ? 'secondary'
                          : 'destructive'
                    }
                    className="ml-2"
                  >
                    {performanceScore >= 90
                      ? 'Excellent'
                      : performanceScore >= 50
                        ? 'Good'
                        : 'Poor'}
                  </Badge>
                </CardContent>
              </Card>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Refetch data without page reload
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['metrics'] }),
                  queryClient.invalidateQueries({ queryKey: ['rfps'] }),
                  queryClient.invalidateQueries({ queryKey: ['portals'] }),
                  queryClient.invalidateQueries({ queryKey: ['activity'] }),
                ]);
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards with animation */}
        <div className="animate-in slide-in-from-top-2 duration-500">
          <MetricsCards />
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden mt-6"
      >
        <div className="px-6 pb-4 shrink-0">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="overview" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="portals" className="gap-2">
              <Activity className="h-4 w-4" />
              Portal Monitoring
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Activity Feed
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 pt-0 space-y-6">
            <TabsContent
              value="overview"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 m-0"
            >
              {/* Active RFPs Table */}
              <ActiveRFPsTable />
            </TabsContent>

            <TabsContent
              value="portals"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 m-0"
            >
              {/* Portal Status Grid */}
              <PortalStatusGrid />
            </TabsContent>

            <TabsContent
              value="activity"
              className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 m-0"
            >
              {/* Recent Activity & Notifications */}
              <ActivityFeed />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
