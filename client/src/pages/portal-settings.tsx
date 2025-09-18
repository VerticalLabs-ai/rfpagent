import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertPortalSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useScanStream } from "@/hooks/useScanStream";
import { ScanProgress } from "@/components/ScanProgress";
import { ScanHistory } from "@/components/ScanHistory";
import type { z } from "zod";

type PortalFormData = z.infer<typeof insertPortalSchema>;

export default function PortalSettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("portals");
  const [activeScanPortalId, setActiveScanPortalId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Real-time scan monitoring
  const { 
    scanState, 
    isConnected, 
    error: scanError, 
    startScan, 
    disconnect, 
    reconnect 
  } = useScanStream(activeScanPortalId || undefined);

  const { data: portals, isLoading } = useQuery({
    queryKey: ["/api/portals"],
  });

  const { data: portalActivity } = useQuery({
    queryKey: ["/api/portals/activity"],
  });

  // New monitoring queries
  const { data: monitoringStatus } = useQuery({
    queryKey: ["/api/portals/monitoring/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentDiscoveries } = useQuery({
    queryKey: ["/api/portals/discoveries/recent"],
    refetchInterval: 60000, // Refresh every minute
  });

  const addPortalMutation = useMutation({
    mutationFn: async (data: PortalFormData) => {
      return apiRequest("POST", "/api/portals", data);
    },
    onSuccess: () => {
      toast({
        title: "Portal Added",
        description: "The new portal has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      setIsAddDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to Add Portal",
        description: "There was an error adding the portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePortalMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PortalFormData> }) => {
      return apiRequest("PUT", `/api/portals/${id}`, updates);
    },
    onSuccess: () => {
      toast({
        title: "Portal Updated",
        description: "The portal settings have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update portal settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Real-time scan handler
  const handleStartScan = async (portalId: string) => {
    try {
      setActiveScanPortalId(portalId);
      const scanId = await startScan(portalId);
      
      if (scanId) {
        toast({
          title: "Scan Started",
          description: "Real-time portal scan has been initiated.",
        });
        // Refresh monitoring status after scan starts
        queryClient.invalidateQueries({ queryKey: ["/api/portals/monitoring/status"] });
      } else {
        setActiveScanPortalId(null);
        toast({
          title: "Scan Failed",
          description: "Failed to start portal scan.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setActiveScanPortalId(null);
      toast({
        title: "Scan Failed",
        description: "Failed to start portal scan.",
        variant: "destructive",
      });
    }
  };

  const handleScanComplete = () => {
    setActiveScanPortalId(null);
    // Refresh data after scan completion
    queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portals/monitoring/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/portals/discoveries/recent"] });
  };

  // Auto-handle scan completion
  useEffect(() => {
    if (scanState && (scanState.status === 'completed' || scanState.status === 'failed')) {
      const timer = setTimeout(() => {
        handleScanComplete();
        if (scanState.status === 'completed') {
          toast({
            title: "Scan Completed",
            description: `Portal scan finished successfully. Found ${scanState.rfpsDiscovered.length} RFPs.`,
          });
        } else {
          toast({
            title: "Scan Failed",
            description: scanState.error || "Portal scan encountered an error.",
            variant: "destructive",
          });
        }
      }, 2000); // Allow user to see final results for 2 seconds

      return () => clearTimeout(timer);
    }
  }, [scanState?.status, scanState?.rfpsDiscovered.length, scanState?.error, toast]);

  const updateMonitoringMutation = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: any }) => {
      return apiRequest("PUT", `/api/portals/${id}/monitoring`, config);
    },
    onSuccess: () => {
      toast({
        title: "Monitoring Updated",
        description: "Portal monitoring configuration has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portals/monitoring/status"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update monitoring configuration.",
        variant: "destructive",
      });
    },
  });

  const deletePortalMutation = useMutation({
    mutationFn: async (portalId: string) => {
      return apiRequest("DELETE", `/api/portals/${portalId}`);
    },
    onSuccess: () => {
      toast({
        title: "Portal Deleted",
        description: "The portal has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portals/activity"] });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete portal. Please try again.",
        variant: "destructive",
      });
    },
  });

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="page-title">
              Portal Management
            </h1>
            <p className="text-muted-foreground">
              Configure, monitor, and manage procurement portal automation
            </p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-portal-button">
                <i className="fas fa-plus mr-2"></i>
                Add Portal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Portal</DialogTitle>
              </DialogHeader>
              <AddPortalForm onSubmit={(data) => addPortalMutation.mutate(data)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="portals" data-testid="portals-tab">
            <i className="fas fa-cog mr-2"></i>
            Portal Settings
          </TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="monitoring-tab">
            <i className="fas fa-chart-line mr-2"></i>
            Monitoring Status
          </TabsTrigger>
          <TabsTrigger value="discoveries" data-testid="discoveries-tab">
            <i className="fas fa-search mr-2"></i>
            Recent Discoveries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portals" className="space-y-6">
          {/* Portal Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {portals?.map((portal: any) => {
              const activity = portalActivity?.find((act: any) => act.portal.id === portal.id);
              return (
                <div key={portal.id} className="space-y-4">
                  <PortalCard
                    portal={portal}
                    rfpCount={activity?.rfpCount || 0}
                    onUpdate={(updates) => updatePortalMutation.mutate({ id: portal.id, updates })}
                    onScan={() => handleStartScan(portal.id)}
                    onDelete={() => deletePortalMutation.mutate(portal.id)}
                    onUpdateMonitoring={(config) => updateMonitoringMutation.mutate({ id: portal.id, config })}
                    scanning={activeScanPortalId === portal.id && scanState?.status === 'running'}
                    deleting={deletePortalMutation.isPending}
                    updatingMonitoring={updateMonitoringMutation.isPending}
                  />
                  
                  {/* Real-time scan progress for this portal */}
                  {activeScanPortalId === portal.id && scanState && (
                    <ScanProgress
                      scanState={scanState}
                      isConnected={isConnected}
                      error={scanError}
                      onReconnect={reconnect}
                      onDisconnect={() => {
                        disconnect();
                        setActiveScanPortalId(null);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {portals?.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-globe text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Portals Configured</h3>
              <p className="text-muted-foreground mb-4">
                Add your first procurement portal to start discovering RFPs
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="add-first-portal">
                <i className="fas fa-plus mr-2"></i>
                Add Portal
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <MonitoringDashboard 
            monitoringStatus={monitoringStatus} 
            isLoading={isLoading}
            onTriggerScan={(portalId) => handleStartScan(portalId)}
          />
          
          {/* Global scan progress display for monitoring tab */}
          {activeScanPortalId && scanState && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Active Portal Scan</h3>
              <ScanProgress
                scanState={scanState}
                isConnected={isConnected}
                error={scanError}
                onReconnect={reconnect}
                onDisconnect={() => {
                  disconnect();
                  setActiveScanPortalId(null);
                }}
              />
            </div>
          )}

          {/* Scan History */}
          <ScanHistory />
        </TabsContent>

        <TabsContent value="discoveries" className="space-y-6">
          <RecentDiscoveries 
            discoveries={recentDiscoveries} 
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddPortalForm({ onSubmit }: { onSubmit: (data: PortalFormData) => void }) {
  const form = useForm<PortalFormData>({
    resolver: zodResolver(insertPortalSchema),
    defaultValues: {
      name: "",
      url: "",
      loginRequired: false,
      username: "",
      password: "",
      status: "active",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="add-portal-form">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Bonfire Hub" {...field} data-testid="portal-name-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal URL</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} data-testid="portal-url-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="loginRequired"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Requires Login</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Enable if the portal requires authentication
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="login-required-switch"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("loginRequired") && (
          <>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="portal-username-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} data-testid="portal-password-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" data-testid="save-portal-button">
            <i className="fas fa-save mr-2"></i>
            Save Portal
          </Button>
        </div>
      </form>
    </Form>
  );
}

function PortalCard({ portal, rfpCount, onUpdate, onScan, onDelete, onUpdateMonitoring, scanning, deleting, updatingMonitoring }: any) {
  const [isEditing, setIsEditing] = useState(false);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "maintenance":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getLastScannedText = (lastScanned: string | null) => {
    if (!lastScanned) return "Never scanned";
    
    const date = new Date(lastScanned);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  return (
    <Card data-testid={`portal-card-${portal.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2" data-testid={`portal-name-${portal.id}`}>
              {portal.name}
              <div 
                className={`w-2 h-2 ${getStatusColor(portal.status)} rounded-full`}
                data-testid={`portal-status-indicator-${portal.id}`}
              ></div>
            </CardTitle>
            <p className="text-sm text-muted-foreground break-all" data-testid={`portal-url-${portal.id}`}>
              {portal.url}
            </p>
          </div>
          <Badge 
            variant={portal.loginRequired ? "default" : "secondary"}
            data-testid={`portal-auth-badge-${portal.id}`}
          >
            {portal.loginRequired ? "Auth Required" : "Public"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium capitalize" data-testid={`portal-status-text-${portal.id}`}>
                {portal.status}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">RFPs Found:</span>
              <p className="font-medium" data-testid={`portal-rfp-count-${portal.id}`}>
                {rfpCount}
              </p>
            </div>
          </div>
          
          <div className="text-sm">
            <span className="text-muted-foreground">Last Scanned:</span>
            <p className="font-medium" data-testid={`portal-last-scanned-${portal.id}`}>
              {getLastScannedText(portal.lastScanned)}
            </p>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onScan}
              disabled={scanning}
              data-testid={`scan-portal-${portal.id}`}
            >
              <i className="fas fa-search mr-2"></i>
              {scanning ? "Scanning..." : "Scan Now"}
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid={`edit-portal-${portal.id}`}
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Portal</DialogTitle>
                </DialogHeader>
                <EditPortalForm portal={portal} onSubmit={onUpdate} />
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid={`configure-monitoring-${portal.id}`}
                >
                  <i className="fas fa-chart-line mr-2"></i>
                  Monitor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Monitoring Configuration</DialogTitle>
                </DialogHeader>
                <MonitoringConfigForm portal={portal} onSubmit={onUpdateMonitoring} isLoading={updatingMonitoring} />
              </DialogContent>
            </Dialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  data-testid={`delete-portal-${portal.id}`}
                >
                  <i className="fas fa-trash mr-2"></i>
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Portal</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{portal.name}"? This action will permanently remove the portal and all associated RFPs, proposals, documents, and submissions. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`cancel-delete-${portal.id}`}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid={`confirm-delete-${portal.id}`}
                  >
                    Delete Portal
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditPortalForm({ portal, onSubmit }: { portal: any; onSubmit: (data: Partial<PortalFormData>) => void }) {
  const form = useForm<PortalFormData>({
    resolver: zodResolver(insertPortalSchema),
    defaultValues: {
      name: portal.name,
      url: portal.url,
      loginRequired: portal.loginRequired,
      username: portal.username || "",
      password: portal.password || "",
      status: portal.status,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="edit-portal-form">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="edit-portal-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal URL</FormLabel>
              <FormControl>
                <Input {...field} data-testid="edit-portal-url" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="loginRequired"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Requires Login</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="edit-login-required"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("loginRequired") && (
          <>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="edit-portal-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} data-testid="edit-portal-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" data-testid="update-portal-button">
            <i className="fas fa-save mr-2"></i>
            Update Portal
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Monitoring Dashboard Component
function MonitoringDashboard({ monitoringStatus, isLoading, onTriggerScan }: any) {
  if (isLoading || !monitoringStatus) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const activePortals = monitoringStatus.filter((portal: any) => portal.status === 'active');
  const errorPortals = monitoringStatus.filter((portal: any) => portal.status === 'error');
  const totalScans = monitoringStatus.reduce((sum: number, portal: any) => sum + (portal.scanFrequency ? 24 / portal.scanFrequency : 1), 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <i className="fas fa-check-circle text-green-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Portals</p>
                <p className="text-2xl font-bold text-green-600" data-testid="active-portals-count">
                  {activePortals.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <i className="fas fa-exclamation-triangle text-red-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Error Portals</p>
                <p className="text-2xl font-bold text-red-600" data-testid="error-portals-count">
                  {errorPortals.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <i className="fas fa-clock text-blue-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Daily Scans</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="daily-scans-count">
                  {totalScans}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <i className="fas fa-globe text-purple-600 text-xl"></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Portals</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="total-portals-count">
                  {monitoringStatus.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
            {monitoringStatus.map((portal: any) => (
              <div key={portal.portalId} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`monitoring-status-${portal.portalId}`}>
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    portal.status === 'active' ? 'bg-green-500' : 
                    portal.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <div>
                    <h3 className="font-medium" data-testid={`portal-name-${portal.portalId}`}>
                      {portal.portalName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Scans every {portal.scanFrequency}h • Last: {portal.lastScanned ? new Date(portal.lastScanned).toLocaleDateString() : 'Never'}
                    </p>
                    {portal.lastError && (
                      <p className="text-sm text-red-600">Error: {portal.lastError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {portal.errorCount > 0 && (
                    <Badge variant="destructive" data-testid={`error-count-${portal.portalId}`}>
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

// Recent Discoveries Component
function RecentDiscoveries({ discoveries, isLoading }: any) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!discoveries || discoveries.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-semibold mb-2">No Recent Discoveries</h3>
          <p className="text-muted-foreground">
            No new RFPs have been discovered in the last 24 hours. Check your portal monitoring status or trigger a manual scan.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Recent RFP Discoveries</h2>
          <p className="text-muted-foreground">RFPs discovered in the last 24 hours</p>
        </div>
        <Badge variant="secondary" data-testid="discoveries-count">
          {discoveries.length} RFPs Found
        </Badge>
      </div>

      <div className="space-y-4">
        {discoveries.map((rfp: any) => (
          <Card key={rfp.id} data-testid={`discovery-${rfp.id}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 leading-tight" data-testid={`rfp-title-${rfp.id}`}>
                    {rfp.title}
                  </h3>
                  <p className="text-muted-foreground mb-3" data-testid={`rfp-agency-${rfp.id}`}>
                    {rfp.agency}
                  </p>
                  {rfp.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {rfp.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center">
                      <i className="fas fa-calendar mr-2 text-muted-foreground"></i>
                      <span>Discovered: {new Date(rfp.discoveredAt).toLocaleDateString()}</span>
                    </div>
                    {rfp.deadline && (
                      <div className="flex items-center">
                        <i className="fas fa-clock mr-2 text-red-500"></i>
                        <span className="text-red-600 font-medium">
                          Due: {new Date(rfp.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {rfp.estimatedValue && (
                      <div className="flex items-center">
                        <i className="fas fa-dollar-sign mr-2 text-green-500"></i>
                        <span className="text-green-600 font-medium">
                          ${parseFloat(rfp.estimatedValue).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2 ml-4">
                  <Badge 
                    variant={rfp.status === 'discovered' ? 'secondary' : 'default'}
                    data-testid={`rfp-status-${rfp.id}`}
                  >
                    {rfp.status}
                  </Badge>
                  <Button variant="outline" size="sm" asChild>
                    <a href={rfp.sourceUrl} target="_blank" rel="noopener noreferrer" data-testid={`view-rfp-${rfp.id}`}>
                      <i className="fas fa-external-link-alt mr-2"></i>
                      View RFP
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Monitoring Configuration Form Component
function MonitoringConfigForm({ portal, onSubmit, isLoading }: any) {
  const form = useForm({
    defaultValues: {
      scanFrequency: portal.scanFrequency || 24,
      maxRfpsPerScan: portal.maxRfpsPerScan || 50,
      selectors: JSON.stringify(portal.selectors || {
        rfpList: '.search-results',
        rfpItem: '.search-result-item',
        title: '.search-result-title a',
        agency: '.search-result-agency',
        deadline: '.search-result-deadline',
        link: '.search-result-title a',
        value: '.search-result-value',
        description: '.search-result-description',
      }, null, 2),
      filters: JSON.stringify(portal.filters || {
        minValue: null,
        maxValue: null,
        keywords: [],
        excludeKeywords: [],
      }, null, 2),
    },
  });

  const handleSubmit = (data: any) => {
    try {
      const config = {
        scanFrequency: parseInt(data.scanFrequency),
        maxRfpsPerScan: parseInt(data.maxRfpsPerScan),
        selectors: JSON.parse(data.selectors),
        filters: JSON.parse(data.filters),
      };
      onSubmit(config);
    } catch (error) {
      console.error('Invalid JSON in configuration:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6" data-testid="monitoring-config-form">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="scanFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scan Frequency (Hours)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    max="168" 
                    {...field} 
                    data-testid="scan-frequency-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxRfpsPerScan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max RFPs per Scan</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    max="200" 
                    {...field} 
                    data-testid="max-rfps-input"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="selectors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CSS Selectors (JSON)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="CSS selectors for scraping portal elements..."
                  className="font-mono text-sm"
                  rows={8}
                  {...field} 
                  data-testid="selectors-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="filters"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Filter Configuration (JSON)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Filter configuration for RFP discovery..."
                  className="font-mono text-sm"
                  rows={6}
                  {...field} 
                  data-testid="filters-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" disabled={isLoading} data-testid="save-monitoring-config">
            <i className="fas fa-save mr-2"></i>
            {isLoading ? "Updating..." : "Update Configuration"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
