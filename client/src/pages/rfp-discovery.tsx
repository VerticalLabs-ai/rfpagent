import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function RFPDiscovery() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPortal, setSelectedPortal] = useState("");
  const [scanFilter, setScanFilter] = useState("");
  const { toast } = useToast();

  const getProgressFromStatus = (status: string) => {
    // Step-based progress based on actual work completed
    switch (status) {
      case "discovered": return 5;   // Just found, no work done yet
      case "parsing": return 25;     // Analyzing documents
      case "drafting": return 50;    // AI drafting proposal
      case "review": return 75;      // Under review
      case "approved": return 90;    // Approved, ready to submit
      case "submitted": return 100;  // Submitted
      case "closed": return 100;     // Process complete
      default: return 0;            // Unknown status
    }
  };

  const { data: rfps, isLoading } = useQuery({
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
    },
    onError: () => {
      toast({
        title: "Scan Failed", 
        description: "Failed to start portal scan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const discoveredRfps = Array.isArray(rfps) ? rfps.filter((item: any) => 
    item.rfp.status === "discovered" || item.rfp.status === "parsing"
  ) : [];

  const filteredRfps = discoveredRfps.filter((item: any) => {
    // Filter by search query
    const matchesSearch = !searchQuery || 
      item.rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rfp.agency.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by selected portal
    const matchesPortal = !selectedPortal || selectedPortal === "all" || 
      (item.portal && item.portal.id === selectedPortal);
    
    return matchesSearch && matchesPortal;
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="page-title">
            RFP Discovery
          </h1>
          <p className="text-muted-foreground">
            Monitor and discover new procurement opportunities
          </p>
        </div>
        
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
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="page-title">
          RFP Discovery
        </h1>
        <p className="text-muted-foreground">
          Monitor and discover new procurement opportunities
        </p>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search RFPs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-input"
          />
          <i className="fas fa-search absolute left-3 top-3 text-muted-foreground text-xs"></i>
        </div>
        
        {/* Portal Scanning Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Select value={selectedPortal} onValueChange={setSelectedPortal} data-testid="portal-select">
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
              data-testid="scan-filter-input"
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
              data-testid="scan-button"
            >
              <i className="fas fa-search mr-2"></i>
              {scanPortalMutation.isPending ? "Scanning..." : "Scan Portal"}
            </Button>
          </div>
        </div>
      </div>

      {/* Discovery Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRfps.map((item: any) => (
          <Card key={item.rfp.id} className="hover:shadow-md transition-shadow" data-testid={`rfp-card-${item.rfp.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg leading-tight" data-testid={`rfp-title-${item.rfp.id}`}>
                  {item.rfp.title}
                </CardTitle>
                <Badge 
                  className={`status-badge status-${item.rfp.status} ml-2`}
                  data-testid={`rfp-status-${item.rfp.id}`}
                >
                  {item.rfp.status === "discovered" && <i className="fas fa-eye mr-1"></i>}
                  {item.rfp.status === "parsing" && <i className="fas fa-file-search mr-1"></i>}
                  {item.rfp.status.charAt(0).toUpperCase() + item.rfp.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground" data-testid={`rfp-agency-${item.rfp.id}`}>
                {item.rfp.agency}
              </p>
              {item.portal && (
                <p className="text-xs text-muted-foreground" data-testid={`rfp-source-${item.rfp.id}`}>
                  Source: {item.portal.name}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {item.rfp.deadline && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deadline:</span>
                    <span className="font-medium" data-testid={`rfp-deadline-${item.rfp.id}`}>
                      {new Date(item.rfp.deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {item.rfp.estimatedValue && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Est. Value:</span>
                    <span className="font-medium" data-testid={`rfp-value-${item.rfp.id}`}>
                      ${parseFloat(item.rfp.estimatedValue).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium" data-testid={`rfp-progress-${item.rfp.id}`}>
                    {getProgressFromStatus(item.rfp.status)}%
                  </span>
                </div>

                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full progress-bar" 
                    style={{ width: `${getProgressFromStatus(item.rfp.status)}%` }}
                    data-testid={`rfp-progress-bar-${item.rfp.id}`}
                  ></div>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Link href={`/rfps/${item.rfp.id}`} className="flex-1">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      data-testid={`rfp-view-details-${item.rfp.id}`}
                    >
                      <i className="fas fa-eye mr-2"></i>
                      View Details
                    </Button>
                  </Link>
                  
                  {item.rfp.status === "discovered" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      data-testid={`rfp-start-processing-${item.rfp.id}`}
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

      {filteredRfps.length === 0 && (
        <div className="text-center py-12">
          <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-semibold text-foreground mb-2">No RFPs Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? "Try adjusting your search criteria" : "No new opportunities have been discovered yet"}
          </p>
          <Button onClick={() => setSearchQuery("")} data-testid="clear-search">
            <i className="fas fa-refresh mr-2"></i>
            {searchQuery ? "Clear Search" : "Refresh"}
          </Button>
        </div>
      )}
    </div>
  );
}
