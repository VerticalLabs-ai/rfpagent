import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle, XCircle, Clock, AlertCircle, FileText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ScanHistoryProps {
  portalId?: string;
}

interface ScanSummary {
  scanId: string;
  portalId: string;
  portalName: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  currentStep: string;
  currentProgress: number;
  discoveredRfpsCount: number;
  errorCount: number;
  duration?: number;
}

interface ScanDetails extends ScanSummary {
  events: Array<{
    id: string;
    type: string;
    level?: string;
    message?: string;
    data?: any;
    timestamp: string;
  }>;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return CheckCircle;
    case "failed":
      return XCircle;
    case "running":
      return Activity;
    default:
      return Clock;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "text-green-600 dark:text-green-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "running":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case "rfp_discovered":
      return FileText;
    case "error":
      return AlertCircle;
    case "scan_completed":
      return CheckCircle;
    case "scan_failed":
      return XCircle;
    default:
      return Activity;
  }
};

const getEventColor = (type: string, level?: string) => {
  if (level === "error" || type === "error" || type === "scan_failed") {
    return "text-red-600 dark:text-red-400";
  }
  if (type === "rfp_discovered" || type === "scan_completed") {
    return "text-green-600 dark:text-green-400";
  }
  return "text-gray-600 dark:text-gray-400";
};

function ScanDetailsDialog({ scanId, children }: { scanId: string; children: React.ReactNode }) {
  const { data: scanDetails, isLoading } = useQuery<ScanDetails>({
    queryKey: ["/api/scans", scanId, "details"],
    enabled: !!scanId,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Scan Details</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : scanDetails ? (
          <div className="space-y-6">
            {/* Scan Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const StatusIcon = getStatusIcon(scanDetails.status);
                    return <StatusIcon className={`h-5 w-5 ${getStatusColor(scanDetails.status)}`} />;
                  })()}
                  {scanDetails.portalName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="font-medium capitalize">{scanDetails.status}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <div className="font-medium">
                      {scanDetails.completedAt 
                        ? formatDistanceToNow(new Date(scanDetails.startedAt), { 
                            addSuffix: false,
                            includeSeconds: true
                          })
                        : formatDistanceToNow(new Date(scanDetails.startedAt), { addSuffix: false })
                      }
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">RFPs Found:</span>
                    <div className="font-medium">{scanDetails.discoveredRfpsCount}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Errors:</span>
                    <div className="font-medium">{scanDetails.errorCount}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Event Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {scanDetails.events.map((event) => {
                      const EventIcon = getEventIcon(event.type);
                      return (
                        <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                          <EventIcon 
                            className={`h-4 w-4 mt-1 ${getEventColor(event.type, event.level)}`} 
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium capitalize">
                                {event.type.replace(/_/g, " ")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.timestamp), "HH:mm:ss")}
                              </span>
                            </div>
                            {event.message && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.message}
                              </p>
                            )}
                            {event.data && event.type === "rfp_discovered" && (
                              <div className="text-xs text-muted-foreground mt-1">
                                RFP: {event.data.title || "Unknown"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Scan details not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ScanHistory({ portalId }: ScanHistoryProps) {
  const [selectedPortal, setSelectedPortal] = useState<string | null>(portalId || null);

  // Get scan history for specific portal or all portals
  const { data: scanHistory, isLoading } = useQuery<ScanSummary[]>({
    queryKey: selectedPortal 
      ? ["/api/portals", selectedPortal, "scans", "history"]
      : ["/api/scans/active"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get list of portals for filter
  const { data: portals } = useQuery({
    queryKey: ["/api/portals"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Scan History</CardTitle>
          {!portalId && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Button
                variant={selectedPortal ? "outline" : "default"}
                size="sm"
                onClick={() => setSelectedPortal(null)}
                data-testid="filter-all-portals"
              >
                All Portals
              </Button>
              {Array.isArray(portals) && portals.map((portal: any) => (
                <Button
                  key={portal.id}
                  variant={selectedPortal === portal.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPortal(portal.id)}
                  data-testid={`filter-portal-${portal.id}`}
                >
                  {portal.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {scanHistory && scanHistory.length > 0 ? (
          <div className="space-y-3">
            {scanHistory.map((scan) => {
              const StatusIcon = getStatusIcon(scan.status);
              return (
                <ScanDetailsDialog key={scan.scanId} scanId={scan.scanId}>
                  <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors" data-testid={`scan-${scan.scanId}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-5 w-5 ${getStatusColor(scan.status)}`} />
                        <div>
                          <h4 className="font-medium" data-testid={`scan-portal-${scan.scanId}`}>
                            {scan.portalName}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid={`scan-time-${scan.scanId}`}>
                            {formatDistanceToNow(new Date(scan.startedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-green-600" data-testid={`scan-rfps-${scan.scanId}`}>
                            {scan.discoveredRfpsCount}
                          </div>
                          <div className="text-muted-foreground">RFPs</div>
                        </div>
                        {scan.errorCount > 0 && (
                          <div className="text-center">
                            <div className="font-medium text-red-600" data-testid={`scan-errors-${scan.scanId}`}>
                              {scan.errorCount}
                            </div>
                            <div className="text-muted-foreground">Errors</div>
                          </div>
                        )}
                        <Badge 
                          variant={scan.status === "completed" ? "default" : scan.status === "failed" ? "destructive" : "secondary"}
                          data-testid={`scan-status-${scan.scanId}`}
                        >
                          {scan.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </ScanDetailsDialog>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Scan History</h3>
            <p className="text-muted-foreground">
              {selectedPortal ? "No scans found for this portal" : "No recent scans available"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}