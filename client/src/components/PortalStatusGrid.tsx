import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function PortalStatusGrid() {
  const [selectedPortal, setSelectedPortal] = useState('');
  const [scanFilter, setScanFilter] = useState('');
  const { toast } = useToast();

  const { data: portals, isLoading } = useQuery({
    queryKey: ['/api/portals'],
  });

  const scanPortalMutation = useMutation({
    mutationFn: async ({
      portalId,
      searchFilter,
    }: {
      portalId: string;
      searchFilter?: string;
    }) => {
      return apiRequest('POST', `/api/portals/${portalId}/scan`, {
        body: searchFilter ? { searchFilter } : undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Portal Scan Started',
        description: 'The portal scan has been initiated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps'] });
    },
    onError: () => {
      toast({
        title: 'Scan Failed',
        description: 'Failed to start portal scan. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const portalsList = Array.isArray(portals) ? portals : [];

  if (isLoading) {
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Portal Monitoring Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
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
      case 'active':
        return 'bg-green-500';
      case 'maintenance':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusMessage = (portal: any) => {
    if (!portal.lastScanned) {
      return 'Never scanned';
    }

    const lastScanned = new Date(portal.lastScanned);
    const now = new Date();
    const minutesAgo = Math.floor(
      (now.getTime() - lastScanned.getTime()) / (1000 * 60)
    );

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Portal Monitoring & Scanning
        </h3>
        <div className="flex items-center space-x-3">
          <Select
            value={selectedPortal}
            onValueChange={setSelectedPortal}
            data-testid="portal-select"
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Portal" />
            </SelectTrigger>
            <SelectContent>
              {portalsList
                .filter((portal: any) => portal.id && portal.id.trim() !== '')
                .map((portal: any) => (
                  <SelectItem key={portal.id} value={portal.id}>
                    {portal.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter (e.g., Water, Construction)"
            value={scanFilter}
            onChange={e => setScanFilter(e.target.value)}
            className="w-[250px]"
            data-testid="scan-filter-input"
          />

          <Button
            onClick={() => {
              if (!selectedPortal) {
                toast({
                  title: 'No Portal Selected',
                  description: 'Please select a portal to scan.',
                  variant: 'destructive',
                });
                return;
              }
              scanPortalMutation.mutate({
                portalId: selectedPortal,
                searchFilter: scanFilter.trim() || undefined,
              });
            }}
            disabled={scanPortalMutation.isPending || !selectedPortal}
            data-testid="scan-button"
          >
            <i className="fas fa-search mr-2"></i>
            {scanPortalMutation.isPending ? 'Scanning...' : 'Scan Portal'}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {portalsList.map((portal: any) => (
          <Link
            key={portal.id}
            href="/portal-settings"
            data-testid={`link-portal-${portal.id}`}
          >
            <Card
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 border-2 hover:border-primary/20"
              data-testid={`portal-status-${
                portal.id ||
                portal.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/gi, '-')
                  .replace(/^-+|-+$/g, '')
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-sm font-medium text-foreground"
                    data-testid={`portal-name-${portal.id}`}
                  >
                    {portal.name}
                  </span>
                  <div
                    className={`w-2 h-2 ${getStatusColor(portal.status)} rounded-full`}
                    data-testid={`portal-status-indicator-${portal.id}`}
                  ></div>
                </div>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid={`portal-last-scan-${portal.id}`}
                >
                  {getStatusMessage(portal)}
                </p>
                <p
                  className="text-xs text-green-600 mt-1"
                  data-testid={`portal-activity-${portal.id}`}
                >
                  {portal.status === 'active'
                    ? 'Active monitoring'
                    : portal.status === 'maintenance'
                      ? 'Maintenance window'
                      : portal.status === 'error'
                        ? 'Connection error'
                        : 'Unknown status'}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
