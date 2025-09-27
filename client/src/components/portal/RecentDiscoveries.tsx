import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingCards, EmptyState, StatusBadge } from "@/components/shared";
import type { Discovery } from "./types";

interface RecentDiscoveriesProps {
  discoveries: Discovery[];
  isLoading: boolean;
}

export function RecentDiscoveries({ discoveries, isLoading }: RecentDiscoveriesProps) {
  if (isLoading) {
    return <LoadingCards count={5} variant="list" />;
  }

  if (!discoveries || discoveries.length === 0) {
    return (
      <EmptyState
        icon="fas fa-search"
        title="No Recent Discoveries"
        description="No new RFPs have been discovered in the last 24 hours. Check your portal monitoring status or trigger a manual scan."
      />
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
        {discoveries.map((rfp) => (
          <Card key={rfp.id} data-testid={`discovery-${rfp.id}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 leading-tight" data-testid={`rfp-title-${rfp.id}`}>
                    {rfp.title}
                  </h3>
                  <p className="text-muted-foreground mb-3" data-testid={`rfp-portal-${rfp.id}`}>
                    {rfp.portalName}
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
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2 ml-4">
                  <StatusBadge
                    status={rfp.status}
                    testId={`rfp-status-${rfp.id}`}
                  />
                  {rfp.rfpUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={rfp.rfpUrl} target="_blank" rel="noopener noreferrer" data-testid={`view-rfp-${rfp.id}`}>
                        <i className="fas fa-external-link-alt mr-2"></i>
                        View RFP
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}