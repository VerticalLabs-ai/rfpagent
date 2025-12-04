import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MetricsCard, LoadingCards } from '@/components/shared';

interface PortalMonitoringStatus {
  portalId: string;
  portalName: string;
  status: 'active' | 'error' | 'maintenance';
  scanFrequency: number;
  lastScanned?: Date | string;
  lastError?: string;
  errorCount: number;
}

interface MonitoringDashboardProps {
  monitoringStatus: PortalMonitoringStatus[];
  isLoading: boolean;
  onTriggerScan: (portalId: string) => void;
}

export function MonitoringDashboard({
  monitoringStatus,
  isLoading,
  onTriggerScan,
}: MonitoringDashboardProps) {
  if (isLoading || !monitoringStatus) {
    return <LoadingCards count={4} variant="grid" />;
  }

  const activePortals = monitoringStatus.filter(
    portal => portal.status === 'active'
  );
  const errorPortals = monitoringStatus.filter(
    portal => portal.status === 'error'
  );
  const totalScans = monitoringStatus.reduce(
    (sum, portal) =>
      sum + (portal.scanFrequency ? 24 / portal.scanFrequency : 1),
    0
  );

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricsCard
          title="Active Portals"
          value={activePortals.length}
          icon="fas fa-check-circle"
          iconColor="text-green-600"
          iconBgColor="bg-green-100 dark:bg-green-900/20"
          textColor="text-green-600"
          testId="active-portals-count"
        />

        <MetricsCard
          title="Error Portals"
          value={errorPortals.length}
          icon="fas fa-exclamation-triangle"
          iconColor="text-red-600"
          iconBgColor="bg-red-100 dark:bg-red-900/20"
          textColor="text-red-600"
          testId="error-portals-count"
        />

        <MetricsCard
          title="Daily Scans"
          value={totalScans}
          icon="fas fa-clock"
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100 dark:bg-blue-900/20"
          textColor="text-blue-600"
          testId="daily-scans-count"
        />

        <MetricsCard
          title="Total Portals"
          value={monitoringStatus.length}
          icon="fas fa-globe"
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100 dark:bg-purple-900/20"
          textColor="text-purple-600"
          testId="total-portals-count"
        />
      </div>

      {/* Portal Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-list mr-2"></i>
            Portal Monitoring Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monitoringStatus.map(portal => (
              <div
                key={portal.portalId}
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`monitoring-status-${portal.portalId}`}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      portal.status === 'active'
                        ? 'bg-green-500'
                        : portal.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-yellow-500'
                    }`}
                  ></div>
                  <div>
                    <h3
                      className="font-medium"
                      data-testid={`portal-name-${portal.portalId}`}
                    >
                      {portal.portalName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Scans every {portal.scanFrequency}h • Last:{' '}
                      {portal.lastScanned
                        ? new Date(portal.lastScanned).toLocaleDateString()
                        : 'Never'}
                    </p>
                    {portal.lastError && (
                      <p className="text-sm text-red-600">
                        Error: {portal.lastError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {portal.errorCount > 0 && (
                    <Badge
                      variant="destructive"
                      data-testid={`error-count-${portal.portalId}`}
                    >
                      {portal.errorCount} errors
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTriggerScan(portal.portalId)}
                    data-testid={`manual-scan-${portal.portalId}`}
                  >
                    <i className="fas fa-search mr-2"></i>
                    Scan Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
