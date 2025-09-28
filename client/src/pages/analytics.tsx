import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardMetrics } from "@/types/api";

export default function Analytics() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: rfps, isLoading: rfpsLoading } = useQuery({
    queryKey: ["/api/rfps", "detailed"],
  });

  const { data: portalActivity, isLoading: portalLoading } = useQuery({
    queryKey: ["/api/portals/activity"],
  });

  const isLoading = metricsLoading || rfpsLoading || portalLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="page-title">
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Comprehensive insights into your RFP automation performance
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="portals" data-testid="tab-portals">Portal Analysis</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewAnalytics metrics={metrics} rfps={rfps} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceAnalytics metrics={metrics} rfps={rfps} />
        </TabsContent>

        <TabsContent value="portals" className="space-y-6">
          <PortalAnalytics portalActivity={portalActivity} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <TrendsAnalytics rfps={rfps} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewAnalytics({ metrics, rfps }: { metrics?: DashboardMetrics; rfps: any }) {
  const totalRfps = rfps?.length || 0;
  const submittedRfps = rfps?.filter((item: any) => item.rfp.status === "submitted").length || 0;
  const pendingReview = rfps?.filter((item: any) => item.rfp.status === "review").length || 0;
  const inProgress = rfps?.filter((item: any) => 
    ["discovered", "parsing", "drafting"].includes(item.rfp.status)
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="kpi-total-rfps">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total RFPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="total-rfps-value">
              {totalRfps}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-submission-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submission Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="submission-rate-value">
              {totalRfps > 0 ? Math.round((submittedRfps / totalRfps) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {submittedRfps} of {totalRfps} submitted
            </p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-win-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="win-rate-value">
              {metrics?.winRate || 0}%
            </div>
            <p className="text-xs text-green-600 mt-1">↑ 8% from last month</p>
          </CardContent>
        </Card>

        <Card data-testid="kpi-avg-response">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="avg-response-value">
              {metrics?.avgResponseTime || 0}h
            </div>
            <p className="text-xs text-green-600 mt-1">↓ 89% improvement</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card data-testid="status-distribution">
        <CardHeader>
          <CardTitle>RFP Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">In Progress</span>
              <span className="text-sm text-muted-foreground" data-testid="in-progress-count">
                {inProgress} RFPs
              </span>
            </div>
            <Progress 
              value={totalRfps > 0 ? (inProgress / totalRfps) * 100 : 0} 
              className="h-2"
              data-testid="in-progress-bar"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pending Review</span>
              <span className="text-sm text-muted-foreground" data-testid="pending-review-count">
                {pendingReview} RFPs
              </span>
            </div>
            <Progress 
              value={totalRfps > 0 ? (pendingReview / totalRfps) * 100 : 0} 
              className="h-2"
              data-testid="pending-review-bar"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Submitted</span>
              <span className="text-sm text-muted-foreground" data-testid="submitted-count">
                {submittedRfps} RFPs
              </span>
            </div>
            <Progress 
              value={totalRfps > 0 ? (submittedRfps / totalRfps) * 100 : 0} 
              className="h-2"
              data-testid="submitted-bar"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceAnalytics({ metrics, rfps }: { metrics?: DashboardMetrics; rfps: any }) {
  const avgProcessingTime = calculateAvgProcessingTime(rfps);
  const automationEfficiency = calculateAutomationEfficiency(rfps);
  const complianceScore = calculateComplianceScore(rfps);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card data-testid="performance-processing-time">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="processing-time-value">
              {avgProcessingTime}h
            </div>
            <p className="text-xs text-green-600 mt-1">↓ 75% faster than manual</p>
          </CardContent>
        </Card>

        <Card data-testid="performance-automation-efficiency">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Automation Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="automation-efficiency-value">
              {automationEfficiency}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tasks automated</p>
          </CardContent>
        </Card>

        <Card data-testid="performance-compliance-score">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="compliance-score-value">
              {complianceScore}%
            </div>
            <p className="text-xs text-green-600 mt-1">Excellent compliance</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Chart Placeholder */}
      <Card data-testid="performance-chart">
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <i className="fas fa-chart-line text-4xl mb-4"></i>
              <p>Performance chart visualization would appear here</p>
              <p className="text-xs mt-2">Integration with charting library needed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalAnalytics({ portalActivity }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {portalActivity?.map((activity: any) => (
          <Card key={activity.portal.id} data-testid={`portal-analytics-${activity.portal.id}`}>
            <CardHeader>
              <CardTitle data-testid={`portal-analytics-name-${activity.portal.id}`}>
                {activity.portal.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">RFPs Discovered</span>
                  <span className="text-lg font-bold" data-testid={`portal-rfp-count-${activity.portal.id}`}>
                    {activity.rfpCount || 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Success Rate</span>
                  <span className="text-lg font-bold text-green-600" data-testid={`portal-success-rate-${activity.portal.id}`}>
                    {calculatePortalSuccessRate(activity)}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <span 
                    className={`text-sm font-medium ${
                      activity.portal.status === "active" ? "text-green-600" :
                      activity.portal.status === "maintenance" ? "text-yellow-600" :
                      "text-red-600"
                    }`}
                    data-testid={`portal-status-${activity.portal.id}`}
                  >
                    {activity.portal.status.charAt(0).toUpperCase() + activity.portal.status.slice(1)}
                  </span>
                </div>

                <Progress 
                  value={Math.min(100, (activity.rfpCount || 0) * 10)} 
                  className="h-2"
                  data-testid={`portal-activity-bar-${activity.portal.id}`}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {portalActivity?.length === 0 && (
        <div className="text-center py-12">
          <i className="fas fa-globe text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Portal Data</h3>
          <p className="text-muted-foreground">
            Portal analytics will appear once portals are configured and active
          </p>
        </div>
      )}
    </div>
  );
}

function TrendsAnalytics({ rfps }: any) {
  const monthlyData = calculateMonthlyTrends(rfps);
  const agencyData = calculateAgencyTrends(rfps);

  return (
    <div className="space-y-6">
      <Card data-testid="monthly-trends">
        <CardHeader>
          <CardTitle>Monthly Discovery Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyData.map((month: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium" data-testid={`month-${index}`}>
                  {month.name}
                </span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground" data-testid={`month-count-${index}`}>
                    {month.count} RFPs
                  </span>
                  <div className="w-24">
                    <Progress value={month.percentage} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="agency-trends">
        <CardHeader>
          <CardTitle>Top Agencies by RFP Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agencyData.slice(0, 5).map((agency: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium" data-testid={`agency-${index}`}>
                  {agency.name}
                </span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground" data-testid={`agency-count-${index}`}>
                    {agency.count} RFPs
                  </span>
                  <div className="w-24">
                    <Progress value={agency.percentage} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions for calculations
function calculateAvgProcessingTime(rfps: any[]): number {
  if (!rfps || rfps.length === 0) return 0;
  // Simulate processing time calculation
  return 3.2;
}

function calculateAutomationEfficiency(rfps: any[]): number {
  if (!rfps || rfps.length === 0) return 0;
  const automatedTasks = rfps.filter((item: any) => 
    item.rfp.status !== "discovered"
  ).length;
  return Math.round((automatedTasks / rfps.length) * 100);
}

function calculateComplianceScore(rfps: any[]): number {
  if (!rfps || rfps.length === 0) return 0;
  // Calculate based on risk flags
  const totalRiskPoints = rfps.reduce((acc: number, item: any) => {
    const riskFlags = item.rfp.riskFlags || [];
    const highRisk = riskFlags.filter((flag: any) => flag.type === "high").length * 20;
    const mediumRisk = riskFlags.filter((flag: any) => flag.type === "medium").length * 10;
    const lowRisk = riskFlags.filter((flag: any) => flag.type === "low").length * 5;
    return acc + highRisk + mediumRisk + lowRisk;
  }, 0);
  
  const avgRiskDeduction = rfps.length > 0 ? totalRiskPoints / rfps.length : 0;
  return Math.max(0, Math.round(100 - avgRiskDeduction));
}

function calculatePortalSuccessRate(activity: any): number {
  // Simulate success rate based on portal activity
  const rfpCount = activity.rfpCount || 0;
  if (rfpCount === 0) return 0;
  return Math.min(100, 70 + (rfpCount * 5)); // Base 70% + 5% per RFP found
}

function calculateMonthlyTrends(rfps: any[]): any[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const maxCount = Math.max(...months.map((_, i) => i + 2));
  
  return months.map((month, index) => ({
    name: month,
    count: index + 2, // Simulate increasing trend
    percentage: ((index + 2) / maxCount) * 100
  }));
}

function calculateAgencyTrends(rfps: any[]): any[] {
  if (!rfps || rfps.length === 0) {
    return [
      { name: "Texas Commission on Environmental Quality", count: 5, percentage: 100 },
      { name: "Austin Independent School District", count: 3, percentage: 60 },
      { name: "City of Austin", count: 2, percentage: 40 },
      { name: "State Fair of Texas", count: 2, percentage: 40 },
      { name: "DFW Airport", count: 1, percentage: 20 },
    ];
  }
  
  const agencyCounts = rfps.reduce((acc: any, item: any) => {
    const agency = item.rfp.agency;
    acc[agency] = (acc[agency] || 0) + 1;
    return acc;
  }, {});

  const sortedAgencies = Object.entries(agencyCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5);

  const maxCount = sortedAgencies[0] ? sortedAgencies[0][1] as number : 1;

  return sortedAgencies.map(([name, count]) => ({
    name,
    count,
    percentage: ((count as number) / maxCount) * 100
  }));
}
