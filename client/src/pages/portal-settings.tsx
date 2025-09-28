// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useScanStream } from '@/hooks/useScanStream';
import { ScanProgress } from '@/components/ScanProgress';
import { ScanHistory } from '@/components/ScanHistory';
import {
  AddPortalForm,
  PortalCard,
  MonitoringDashboard,
  RecentDiscoveries,
  type Portal,
  type PortalFormData,
} from '@/components/portal';

export default function PortalSettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('portals');
  const [activeScanPortalId, setActiveScanPortalId] = useState<string | null>(
    null
  );
  const { toast } = useToast();

  // Real-time scan monitoring
  const {
    scanState,
    isConnected,
    error: scanError,
    startScan,
    disconnect,
    reconnect,
  } = useScanStream(activeScanPortalId || undefined);

  const { data: portals, isLoading } = useQuery({
    queryKey: ['/api/portals'],
  });

  const { data: portalActivity } = useQuery({
    queryKey: ['/api/portals/activity'],
  });

  // New monitoring queries
  const { data: monitoringStatus } = useQuery({
    queryKey: ['/api/portals/monitoring/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentDiscoveries } = useQuery({
    queryKey: ['/api/portals/discoveries/recent'],
    refetchInterval: 60000, // Refresh every minute
  });

  const addPortalMutation = useMutation({
    mutationFn: async (data: PortalFormData) => {
      return apiRequest('POST', '/api/portals', data);
    },
    onSuccess: () => {
      toast({
        title: 'Portal Added',
        description: 'The new portal has been added successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portals'] });
      setIsAddDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Failed to Add Portal',
        description: 'There was an error adding the portal. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updatePortalMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<PortalFormData>;
    }) => {
      return apiRequest('PUT', `/api/portals/${id}`, updates);
    },
    onSuccess: () => {
      toast({
        title: 'Portal Updated',
        description: 'The portal settings have been updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portals'] });
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update portal settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateMonitoringMutation = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: any }) => {
      return apiRequest('PUT', `/api/portals/${id}/monitoring`, config);
    },
    onSuccess: () => {
      toast({
        title: 'Monitoring Updated',
        description: 'Portal monitoring configuration has been updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portals'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/portals/monitoring/status'],
      });
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update monitoring configuration.',
        variant: 'destructive',
      });
    },
  });

  const deletePortalMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/portals/${id}`);
    },
    onSuccess: () => {
      toast({
        title: 'Portal Deleted',
        description: 'The portal has been deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portals'] });
    },
    onError: () => {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete the portal. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const scanPortalMutation = useMutation({
    mutationFn: async (portalId: string) => {
      setActiveScanPortalId(portalId);
      return startScan(portalId);
    },
    onSuccess: () => {
      toast({
        title: 'Scan Started',
        description: 'Portal scan has been initiated.',
      });
    },
    onError: () => {
      toast({
        title: 'Scan Failed',
        description: 'Failed to start portal scan.',
        variant: 'destructive',
      });
      setActiveScanPortalId(null);
    },
  });

  const handleUpdatePortal =
    (portalId: string) => (data: Partial<PortalFormData>) => {
      updatePortalMutation.mutate({ id: portalId, updates: data });
    };

  const handleUpdateMonitoring = (portalId: string) => (config: any) => {
    updateMonitoringMutation.mutate({ id: portalId, config });
  };

  const handleScanPortal = (portalId: string) => () => {
    scanPortalMutation.mutate(portalId);
  };

  const handleDeletePortal = (portalId: string) => () => {
    deletePortalMutation.mutate(portalId);
  };

  const handleTriggerScan = (portalId: string) => {
    scanPortalMutation.mutate(portalId);
  };

  // Get RFP counts per portal
  const getRFPCount = (portalId: string) => {
    return (
      portalActivity?.filter((activity: any) => activity.portalId === portalId)
        .length || 0
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Portal Settings</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portal Settings</h1>
          <p className="text-muted-foreground">
            Manage RFP portal connections and monitoring
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-portal-button">
              <i className="fas fa-plus mr-2"></i>
              Add Portal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Portal</DialogTitle>
            </DialogHeader>
            <AddPortalForm onSubmit={data => addPortalMutation.mutate(data)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Scan Progress Component */}
      {activeScanPortalId && (
        <ScanProgress
          portalId={activeScanPortalId}
          scanState={scanState}
          isConnected={isConnected}
          error={scanError}
          onDisconnect={() => {
            disconnect();
            setActiveScanPortalId(null);
          }}
          onReconnect={reconnect}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="portals" data-testid="portals-tab">
            <i className="fas fa-globe mr-2"></i>
            Portals ({portals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="monitoring-tab">
            <i className="fas fa-chart-line mr-2"></i>
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="discoveries" data-testid="discoveries-tab">
            <i className="fas fa-search mr-2"></i>
            Recent Discoveries
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="history-tab">
            <i className="fas fa-history mr-2"></i>
            Scan History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portals" className="space-y-6">
          {portals?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <i className="fas fa-globe text-4xl text-muted-foreground mb-4"></i>
                <h3 className="text-lg font-semibold mb-2">
                  No Portals Configured
                </h3>
                <p className="text-muted-foreground mb-4">
                  Add your first RFP portal to start discovering opportunities
                </p>
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button data-testid="add-first-portal-button">
                      <i className="fas fa-plus mr-2"></i>
                      Add First Portal
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portals?.map((portal: Portal) => (
                <PortalCard
                  key={portal.id}
                  portal={portal}
                  rfpCount={getRFPCount(portal.id)}
                  onUpdate={handleUpdatePortal(portal.id)}
                  onScan={handleScanPortal(portal.id)}
                  onDelete={handleDeletePortal(portal.id)}
                  onUpdateMonitoring={handleUpdateMonitoring(portal.id)}
                  scanning={
                    scanPortalMutation.isPending &&
                    activeScanPortalId === portal.id
                  }
                  deleting={deletePortalMutation.isPending}
                  updatingMonitoring={updateMonitoringMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <MonitoringDashboard
            monitoringStatus={monitoringStatus || []}
            isLoading={!monitoringStatus}
            onTriggerScan={handleTriggerScan}
          />
        </TabsContent>

        <TabsContent value="discoveries" className="space-y-6">
          <RecentDiscoveries
            discoveries={recentDiscoveries || []}
            isLoading={!recentDiscoveries}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <ScanHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
