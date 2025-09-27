import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getStatusBadgeVariant, getStatusBadgeClassName, getStatusLabel, getStatusIcon } from "@/lib/badge-utils";
import MetricsCards from "@/components/MetricsCards";
import PortalStatusGrid from "@/components/PortalStatusGrid";
import ActiveRFPsTable from "@/components/ActiveRFPsTable";
import ActivityFeed from "@/components/ActivityFeed";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPortal, setSelectedPortal] = useState("");
  const [scanFilter, setScanFilter] = useState("");
  const { toast } = useToast();

  // Use actual progress values from database instead of hardcoded status mapping
  const getProgressValue = (rfp: any) => {
    return rfp.progress || 0;  // Use actual progress from database, default to 0
  };

  const { data: rfps, isLoading: rfpsLoading } = useQuery({
    queryKey: ["/api/rfps", "detailed"],
  });

  const { data: portals } = useQuery({
    queryKey: ["/api/portals"],
  });

  const scanPortalMutation = useMutation({
    mutationFn: async ({ portalId, searchFilter }: { portalId: string; searchFilter?: string }) => {
      return apiRequest("POST", `/api/portals/${portalId}/scan`, { 
        body: searchFilter ? { searchFilter } : undefined 
      });
    },
    onSuccess: () => {
      toast({
        title: "Portal Scan Started",
        description: "The portal scan has been initiated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
    },
    onError: () => {
      toast({
        title: "Scan Failed", 
        description: "Failed to start portal scan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter RFPs for discovery tab (discovered/parsing status)
  const discoveredRfps = Array.isArray(rfps) ? rfps.filter((item: any) => 
    item.rfp.status === "discovered" || item.rfp.status === "parsing"
  ) : [];

  const filteredDiscoveredRfps = discoveredRfps.filter((item: any) => {
    const matchesSearch = !searchQuery || 
      item.rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rfp.agency.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPortal = !selectedPortal || selectedPortal === "all" || 
      (item.portal && item.portal.id === selectedPortal);
    
    return matchesSearch && matchesPortal;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="dashboard-title">
          RFP Management Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor metrics, discover opportunities, and manage your RFP pipeline
        </p>
      </div>

      {/* Key Metrics Cards */}
      <MetricsCards />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4" data-testid="dashboard-tabs">
          <TabsTrigger value="overview" data-testid="overview-tab">Overview</TabsTrigger>
          <TabsTrigger value="discovery" data-testid="discovery-tab">Discovery</TabsTrigger>
          <TabsTrigger value="active" data-testid="active-tab">Active RFPs</TabsTrigger>
          <TabsTrigger value="activity" data-testid="activity-tab">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Portal Status Grid */}
          <PortalStatusGrid />

          {/* Active RFPs Table */}
          <ActiveRFPsTable />
        </TabsContent>

        <TabsContent value="discovery" className="space-y-6">
          {/* Discovery Search and Actions */}
          <Card>
            <CardHeader>
              <CardTitle>RFP Discovery & Portal Scanning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between space-x-4">
                <div className="relative flex-1 max-w-sm">
                  <Input
                    placeholder="Search discovered RFPs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="discovery-search-input"
                  />
                  <i className="fas fa-search absolute left-3 top-3 text-muted-foreground text-xs"></i>
                </div>
                
                {/* Portal Scanning Controls */}
                <div className="flex items-center space-x-3">
                  <Select value={selectedPortal} onValueChange={setSelectedPortal} data-testid="discovery-portal-select">
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Portals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Portals</SelectItem>
                      {Array.isArray(portals) ? portals
                        .filter((portal: any) => portal.id && portal.id.trim() !== '')
                        .map((portal: any) => (
                          <SelectItem key={portal.id} value={portal.id}>
                            {portal.name}
                          </SelectItem>
                        )) : []
                      }
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Filter search (e.g., Water, Construction)"
                    value={scanFilter}
                    onChange={(e) => setScanFilter(e.target.value)}
                    className="w-[250px]"
                    data-testid="discovery-scan-filter"
                  />
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!selectedPortal || selectedPortal === "all") {
                        toast({
                          title: "No Portal Selected",
                          description: "Please select a specific portal to scan.",
                          variant: "destructive",
                        });
                        return;
                      }
                      scanPortalMutation.mutate({ 
                        portalId: selectedPortal, 
                        searchFilter: scanFilter.trim() || undefined 
                      });
                    }}
                    disabled={scanPortalMutation.isPending || !selectedPortal || selectedPortal === "all"}
                    data-testid="discovery-scan-button"
                  >
                    <i className="fas fa-search mr-2"></i>
                    {scanPortalMutation.isPending ? "Scanning..." : "Scan Portal"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Discovery Results */}
          {rfpsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDiscoveredRfps.map((item: any) => (
                <Card key={item.rfp.id} className="hover:shadow-md transition-shadow" data-testid={`discovery-rfp-card-${item.rfp.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight" data-testid={`discovery-rfp-title-${item.rfp.id}`}>
                        {item.rfp.title}
                      </CardTitle>
                      <Badge 
                        variant={getStatusBadgeVariant(item.rfp.status)}
                        className={`${getStatusBadgeClassName(item.rfp.status)} ml-2`}
                        data-testid={`discovery-rfp-status-${item.rfp.id}`}
                      >
                        <i className={`${getStatusIcon(item.rfp.status)} mr-1`}></i>
                        {getStatusLabel(item.rfp.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`discovery-rfp-agency-${item.rfp.id}`}>
                      {item.rfp.agency}
                    </p>
                    {item.portal && (
                      <p className="text-xs text-muted-foreground" data-testid={`discovery-rfp-source-${item.rfp.id}`}>
                        Source: {item.portal.name}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {item.rfp.deadline && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Deadline:</span>
                          <span className="font-medium" data-testid={`discovery-rfp-deadline-${item.rfp.id}`}>
                            {new Date(item.rfp.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      {item.rfp.estimatedValue && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Est. Value:</span>
                          <span className="font-medium" data-testid={`discovery-rfp-value-${item.rfp.id}`}>
                            ${parseFloat(item.rfp.estimatedValue).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress:</span>
                        <span className="font-medium" data-testid={`discovery-rfp-progress-${item.rfp.id}`}>
                          {getProgressValue(item.rfp)}%
                        </span>
                      </div>

                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full progress-bar" 
                          style={{ width: `${getProgressValue(item.rfp)}%` }}
                          data-testid={`discovery-rfp-progress-bar-${item.rfp.id}`}
                        ></div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Link href={`/rfps/${item.rfp.id}`} className="flex-1">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            data-testid={`discovery-rfp-view-details-${item.rfp.id}`}
                          >
                            <i className="fas fa-eye mr-2"></i>
                            View Details
                          </Button>
                        </Link>
                        
                        {item.rfp.status === "discovered" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`discovery-rfp-start-processing-${item.rfp.id}`}
                          >
                            <i className="fas fa-play mr-2"></i>
                            Process
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredDiscoveredRfps.length === 0 && !rfpsLoading && (
            <div className="text-center py-12">
              <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-lg font-semibold text-foreground mb-2">No New RFPs Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search criteria" : "No new opportunities have been discovered yet"}
              </p>
              <Button onClick={() => setSearchQuery("")} data-testid="discovery-clear-search">
                <i className="fas fa-refresh mr-2"></i>
                {searchQuery ? "Clear Search" : "Refresh"}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-6">
          {/* Active RFPs Table */}
          <ActiveRFPsTable />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          {/* Recent Activity & Notifications */}
          <ActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
