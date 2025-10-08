import ActiveRFPsTable from '@/components/ActiveRFPsTable';
import ActivityFeed from '@/components/ActivityFeed';
import MetricsCards from '@/components/MetricsCards';
import PortalStatusGrid from '@/components/PortalStatusGrid';
import { LiveIndicator } from '@/components/providers/RealtimeProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerformanceMonitoring } from '@/hooks/usePerformance';
import { Activity, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { performanceScore } = usePerformanceMonitoring();

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      {/* Header with Live Indicator and Performance Score */}
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
          {performanceScore > 0 && (
            <Card className="border-none shadow-sm">
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
            onClick={() => window.location.reload()}
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

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
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

        <TabsContent
          value="overview"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {/* Active RFPs Table */}
          <ActiveRFPsTable />
        </TabsContent>

        <TabsContent
          value="portals"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {/* Portal Status Grid */}
          <PortalStatusGrid />
        </TabsContent>

        <TabsContent
          value="activity"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          {/* Recent Activity & Notifications */}
          <ActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
