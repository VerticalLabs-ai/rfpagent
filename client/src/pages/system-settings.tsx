import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Activity,
  Pause,
  Play,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SystemConfig {
  backgroundServices: {
    workDistribution: boolean;
    retryScheduler: boolean;
    dlqMonitor: boolean;
    portalScheduler: boolean;
  };
  manualOperationMode: boolean;
}

interface ServiceControlResponse {
  service: string;
  action: string;
  success: boolean;
  message: string;
}

const serviceInfo = {
  'portal-scheduler': {
    name: 'Portal Scheduler',
    description:
      'Automatically scans government portals for new RFPs on a schedule',
    icon: Activity,
  },
  'work-distribution': {
    name: 'Work Distribution',
    description:
      'Distributes background tasks to available agents for processing',
    icon: Settings,
  },
  'retry-scheduler': {
    name: 'Retry Scheduler',
    description:
      'Retries failed tasks according to configured backoff policies',
    icon: Activity,
  },
  'dlq-monitor': {
    name: 'Dead Letter Queue Monitor',
    description: 'Monitors and manages tasks that have permanently failed',
    icon: AlertTriangle,
  },
};

export default function SystemSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Fetch current system configuration
  const {
    data: config,
    isLoading: configLoading,
    error,
  } = useQuery<SystemConfig>({
    queryKey: ['/api/system/config'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Service control mutation
  const controlService = useMutation({
    mutationFn: async ({
      service,
      action,
    }: {
      service: string;
      action: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/system/services/${service}/${action}`,
        undefined,
        {
          Authorization: 'Bearer admin-token-change-in-production',
        }
      );
      return response.json() as Promise<ServiceControlResponse>;
    },
    onSuccess: data => {
      toast({
        title: 'Service Control',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
      // Invalidate config to refresh status
      queryClient.invalidateQueries({ queryKey: ['/api/system/config'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Service Control Failed',
        description: error.message || 'Failed to control service',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsLoading(null);
    },
  });

  const handleServiceToggle = async (service: string, enabled: boolean) => {
    const action = enabled ? 'enable' : 'disable';
    setIsLoading(service);
    controlService.mutate({ service, action });
  };

  if (configLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">System Settings</h1>
        </div>
        <div className="text-center py-8">Loading system configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">System Settings</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load system configuration. Please check server connection.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="system-settings-page">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">System Settings</h1>
      </div>

      <div className="grid gap-6">
        {/* System Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="h-5 w-5" />
              <span>System Status</span>
            </CardTitle>
            <CardDescription>
              Current operating mode and background service status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Operating Mode</p>
                <p className="text-sm text-muted-foreground">
                  System defaults to manual operation for control and stability
                </p>
              </div>
              <Badge
                variant={config?.manualOperationMode ? 'default' : 'secondary'}
              >
                {config?.manualOperationMode ? 'Manual Mode' : 'Automated Mode'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Background Services */}
        <Card>
          <CardHeader>
            <CardTitle>Background Services</CardTitle>
            <CardDescription>
              Control automatic background processes. Services can be enabled
              manually for specific use cases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Portal Scheduler */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <p className="text-sm font-medium">Portal Scheduler</p>
                  <Badge
                    variant={
                      config?.backgroundServices.portalScheduler
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {config?.backgroundServices.portalScheduler
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically scans government portals for new RFPs on a
                  schedule
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleServiceToggle(
                      'portal-scheduler',
                      !config?.backgroundServices.portalScheduler
                    )
                  }
                  disabled={isLoading === 'portal-scheduler'}
                  data-testid="toggle-portal-scheduler"
                >
                  {isLoading === 'portal-scheduler' ? (
                    'Processing...'
                  ) : config?.backgroundServices.portalScheduler ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Enable
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Work Distribution */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <p className="text-sm font-medium">Work Distribution</p>
                  <Badge
                    variant={
                      config?.backgroundServices.workDistribution
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {config?.backgroundServices.workDistribution
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Distributes background tasks to available agents for
                  processing
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleServiceToggle(
                      'work-distribution',
                      !config?.backgroundServices.workDistribution
                    )
                  }
                  disabled={isLoading === 'work-distribution'}
                  data-testid="toggle-work-distribution"
                >
                  {isLoading === 'work-distribution' ? (
                    'Processing...'
                  ) : config?.backgroundServices.workDistribution ? (
                    <>
                      <Pause className="h-4 w-4 mr-1" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Enable
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Retry Scheduler */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <p className="text-sm font-medium">Retry Scheduler</p>
                  <Badge
                    variant={
                      config?.backgroundServices.retryScheduler
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {config?.backgroundServices.retryScheduler
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retries failed tasks according to configured backoff policies
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Environment Variable Only</Badge>
              </div>
            </div>

            <Separator />

            {/* DLQ Monitor */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    Dead Letter Queue Monitor
                  </p>
                  <Badge
                    variant={
                      config?.backgroundServices.dlqMonitor
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {config?.backgroundServices.dlqMonitor
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Monitors and manages tasks that have permanently failed
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Environment Variable Only</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Help */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Manual Operation:</strong> The system defaults to manual
            mode for stability and control. Most services require environment
            variables for automatic startup. Only Portal Scheduler can be
            controlled via this UI for immediate testing and operation.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
