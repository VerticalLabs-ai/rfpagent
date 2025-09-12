import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function PortalStatusGrid() {
  const { data: portals, isLoading } = useQuery({
    queryKey: ["/api/portals"],
  });

  const portalsList = Array.isArray(portals) ? portals : [];

  if (isLoading) {
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Portal Monitoring Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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

  const getStatusMessage = (portal: any) => {
    if (!portal.lastScanned) {
      return "Never scanned";
    }

    const lastScanned = new Date(portal.lastScanned);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastScanned.getTime()) / (1000 * 60));

    if (minutesAgo < 60) {
      return `Last scan: ${minutesAgo} min ago`;
    } else if (minutesAgo < 1440) {
      const hoursAgo = Math.floor(minutesAgo / 60);
      return `Last scan: ${hoursAgo}h ago`;
    } else {
      const daysAgo = Math.floor(minutesAgo / 1440);
      return `Last scan: ${daysAgo}d ago`;
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-foreground mb-4">Portal Monitoring Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {portalsList.map((portal: any) => (
          <Link key={portal.id} href="/portal-settings" data-testid={`link-portal-${portal.id}`}>
            <Card 
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 border-2 hover:border-primary/20" 
              data-testid={`portal-status-${portal.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground" data-testid={`portal-name-${portal.id}`}>
                    {portal.name}
                  </span>
                  <div 
                    className={`w-2 h-2 ${getStatusColor(portal.status)} rounded-full`}
                    data-testid={`portal-status-indicator-${portal.id}`}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground" data-testid={`portal-last-scan-${portal.id}`}>
                  {getStatusMessage(portal)}
                </p>
                <p className="text-xs text-green-600 mt-1" data-testid={`portal-activity-${portal.id}`}>
                  {portal.status === "active" ? "Active monitoring" : 
                   portal.status === "maintenance" ? "Maintenance window" :
                   portal.status === "error" ? "Connection error" : "Unknown status"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
