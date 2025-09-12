import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertPortalSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

type PortalFormData = z.infer<typeof insertPortalSchema>;

export default function PortalSettings() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: portals, isLoading } = useQuery({
    queryKey: ["/api/portals"],
  });

  const { data: portalActivity } = useQuery({
    queryKey: ["/api/portals/activity"],
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

  const scanPortalMutation = useMutation({
    mutationFn: async (portalId: string) => {
      return apiRequest("POST", `/api/portals/${portalId}/scan`);
    },
    onSuccess: () => {
      toast({
        title: "Scan Started",
        description: "Portal scan has been initiated.",
      });
    },
    onError: () => {
      toast({
        title: "Scan Failed",
        description: "Failed to start portal scan.",
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
              Portal Settings
            </h1>
            <p className="text-muted-foreground">
              Configure and manage procurement portal connections
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

      {/* Portal Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {portals?.map((portal: any) => {
          const activity = portalActivity?.find((act: any) => act.portal.id === portal.id);
          return (
            <PortalCard
              key={portal.id}
              portal={portal}
              rfpCount={activity?.rfpCount || 0}
              onUpdate={(updates) => updatePortalMutation.mutate({ id: portal.id, updates })}
              onScan={() => scanPortalMutation.mutate(portal.id)}
              scanning={scanPortalMutation.isPending}
            />
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

function PortalCard({ portal, rfpCount, onUpdate, onScan, scanning }: any) {
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
