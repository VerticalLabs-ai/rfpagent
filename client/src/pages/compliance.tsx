import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Compliance() {
  const { data: rfps, isLoading } = useQuery({
    queryKey: ["/api/rfps", "detailed"],
  });

  const rfpsWithCompliance = (Array.isArray(rfps) ? rfps : []).filter((item: any) => 
    item?.rfp && (item.rfp.riskFlags || item.rfp.complianceItems)
  ) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32" />
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
          Compliance Management
        </h1>
        <p className="text-muted-foreground">
          Monitor compliance requirements and risk factors across all RFPs
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="high-risk" data-testid="tab-high-risk">High Risk Items</TabsTrigger>
          <TabsTrigger value="requirements" data-testid="tab-requirements">Requirements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ComplianceMetricsCard rfps={rfpsWithCompliance} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rfpsWithCompliance.map((item: any) => (
              <ComplianceOverviewCard key={item.rfp.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="high-risk" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rfpsWithCompliance
              .filter((item: any) => hasHighRiskFlags(item.rfp.riskFlags))
              .map((item: any) => (
                <HighRiskCard key={item.rfp.id} item={item} />
              ))
            }
          </div>
          
          {rfpsWithCompliance.filter((item: any) => hasHighRiskFlags(item.rfp.riskFlags)).length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-shield-alt text-4xl text-green-500 mb-4"></i>
              <h3 className="text-lg font-semibold text-foreground mb-2">No High Risk Items</h3>
              <p className="text-muted-foreground">
                All RFPs are currently compliant with low or manageable risk levels
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requirements" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {rfpsWithCompliance.map((item: any) => (
              <RequirementsCard key={item.rfp.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComplianceMetricsCard({ rfps }: { rfps: any[] }) {
  const totalRfps = rfps.length;
  const highRiskCount = rfps.filter(item => hasHighRiskFlags(item.rfp.riskFlags)).length;
  const mediumRiskCount = rfps.filter(item => hasMediumRiskFlags(item.rfp.riskFlags)).length;
  const lowRiskCount = totalRfps - highRiskCount - mediumRiskCount;

  return (
    <>
      <Card data-testid="metric-high-risk">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600" data-testid="high-risk-count">
            {highRiskCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Require immediate attention
          </p>
        </CardContent>
      </Card>

      <Card data-testid="metric-medium-risk">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600" data-testid="medium-risk-count">
            {mediumRiskCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Monitor closely
          </p>
        </CardContent>
      </Card>

      <Card data-testid="metric-low-risk">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600" data-testid="low-risk-count">
            {lowRiskCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Standard compliance
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function ComplianceOverviewCard({ item }: { item: any }) {
  const riskFlags = item.rfp.riskFlags || [];
  const highRiskCount = riskFlags.filter((flag: any) => flag.type === "high").length;
  const mediumRiskCount = riskFlags.filter((flag: any) => flag.type === "medium").length;
  
  const overallRisk = highRiskCount > 0 ? "high" : mediumRiskCount > 0 ? "medium" : "low";
  const riskColor = overallRisk === "high" ? "text-red-600" : overallRisk === "medium" ? "text-orange-600" : "text-green-600";
  
  return (
    <Card data-testid={`compliance-overview-${item.rfp.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight" data-testid={`compliance-title-${item.rfp.id}`}>
              {item.rfp.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1" data-testid={`compliance-agency-${item.rfp.id}`}>
              {item.rfp.agency}
            </p>
          </div>
          <Badge className={`${riskColor} border-current`} variant="outline" data-testid={`compliance-risk-${item.rfp.id}`}>
            {overallRisk.toUpperCase()} RISK
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-red-600" data-testid={`compliance-high-${item.rfp.id}`}>
                {highRiskCount}
              </div>
              <div className="text-xs text-muted-foreground">High</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-orange-600" data-testid={`compliance-medium-${item.rfp.id}`}>
                {mediumRiskCount}
              </div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600" data-testid={`compliance-low-${item.rfp.id}`}>
                {riskFlags.length - highRiskCount - mediumRiskCount}
              </div>
              <div className="text-xs text-muted-foreground">Low</div>
            </div>
          </div>
          
          <Progress 
            value={calculateComplianceScore(riskFlags)} 
            className="h-2"
            data-testid={`compliance-progress-${item.rfp.id}`}
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Compliance Score</span>
            <span data-testid={`compliance-score-${item.rfp.id}`}>
              {calculateComplianceScore(riskFlags)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HighRiskCard({ item }: { item: any }) {
  const highRiskFlags = (item.rfp.riskFlags || []).filter((flag: any) => flag.type === "high");
  
  return (
    <Card className="border-red-200 dark:border-red-900" data-testid={`high-risk-card-${item.rfp.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg leading-tight text-red-700 dark:text-red-300" data-testid={`high-risk-title-${item.rfp.id}`}>
            {item.rfp.title}
          </CardTitle>
          <Badge variant="destructive" data-testid={`high-risk-badge-${item.rfp.id}`}>
            {highRiskFlags.length} HIGH RISK
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground" data-testid={`high-risk-agency-${item.rfp.id}`}>
          {item.rfp.agency}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {highRiskFlags.map((flag: any, index: number) => (
            <div 
              key={index} 
              className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-900"
              data-testid={`high-risk-item-${item.rfp.id}-${index}`}
            >
              <div className="flex items-start space-x-3">
                <i className="fas fa-exclamation-triangle text-red-500 mt-1"></i>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200" data-testid={`high-risk-category-${item.rfp.id}-${index}`}>
                    {flag.category}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300" data-testid={`high-risk-description-${item.rfp.id}-${index}`}>
                    {flag.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RequirementsCard({ item }: { item: any }) {
  const requirements = item.rfp.requirements || [];
  const complianceItems = item.rfp.complianceItems || [];
  
  return (
    <Card data-testid={`requirements-card-${item.rfp.id}`}>
      <CardHeader>
        <CardTitle data-testid={`requirements-title-${item.rfp.id}`}>
          {item.rfp.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground" data-testid={`requirements-agency-${item.rfp.id}`}>
          {item.rfp.agency}
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="requirements" className="w-full">
          <TabsList>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            <TabsTrigger value="mandatory">Mandatory Items</TabsTrigger>
          </TabsList>
          
          <TabsContent value="requirements" className="space-y-3">
            {requirements.length > 0 ? (
              requirements.map((req: any, index: number) => (
                <div 
                  key={index} 
                  className="flex items-start space-x-3 p-3 border rounded-lg"
                  data-testid={`requirement-${item?.rfp?.id || 'unknown'}-${index}`}
                >
                  <i className={`fas ${req.mandatory ? 'fa-exclamation-circle text-red-500' : 'fa-info-circle text-blue-500'} mt-1`}></i>
                  <div>
                    <p className="text-sm font-medium" data-testid={`requirement-type-${item?.rfp?.id || 'unknown'}-${index}`}>
                      {req.type}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`requirement-description-${item?.rfp?.id || 'unknown'}-${index}`}>
                      {req.description}
                    </p>
                    {req.mandatory && (
                      <Badge variant="destructive" className="mt-1">Mandatory</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No specific requirements identified
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="mandatory" className="space-y-3">
            {complianceItems.length > 0 ? (
              complianceItems.map((item: any, index: number) => (
                <div 
                  key={index} 
                  className="flex items-start space-x-3 p-3 border rounded-lg"
                  data-testid={`mandatory-item-${item?.rfp?.id || 'unknown'}-${index}`}
                >
                  <i className="fas fa-clipboard-check text-green-500 mt-1"></i>
                  <div>
                    <p className="text-sm font-medium" data-testid={`mandatory-field-${item?.rfp?.id || 'unknown'}-${index}`}>
                      {item.field}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`mandatory-description-${item?.rfp?.id || 'unknown'}-${index}`}>
                      {item.description}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Format: {item.format}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No mandatory items identified
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function hasHighRiskFlags(riskFlags: any[]): boolean {
  return (riskFlags || []).some((flag: any) => flag.type === "high");
}

function hasMediumRiskFlags(riskFlags: any[]): boolean {
  return (riskFlags || []).some((flag: any) => flag.type === "medium");
}

function calculateComplianceScore(riskFlags: any[]): number {
  if (!riskFlags || riskFlags.length === 0) return 100;
  
  const highRiskCount = riskFlags.filter(flag => flag.type === "high").length;
  const mediumRiskCount = riskFlags.filter(flag => flag.type === "medium").length;
  const lowRiskCount = riskFlags.length - highRiskCount - mediumRiskCount;
  
  // High risk: -20 points each, Medium: -10 points each, Low: -5 points each
  const deduction = (highRiskCount * 20) + (mediumRiskCount * 10) + (lowRiskCount * 5);
  
  return Math.max(0, 100 - deduction);
}
