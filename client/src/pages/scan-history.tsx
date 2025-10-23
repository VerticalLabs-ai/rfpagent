import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Calendar,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ScanHistoryItem {
  id: string;
  portalName: string;
  scanType: 'Automated' | 'Manual';
  status: 'completed' | 'failed' | 'completed_with_warnings' | 'running';
  startTime: string;
  endTime?: string;
  rfpsFound: number;
  errors: Array<{
    code: string;
    message: string;
    recoverable: boolean;
  }>;
  duration: string;
}

interface ScanHistoryResponse {
  scans: ScanHistoryItem[];
  total: number;
  hasMore: boolean;
}

interface ScanStatistics {
  successRate: number;
  avgRfpsPerScan: number;
  totalRfpsDiscovered: number;
}

type ScanStatus =
  | 'all'
  | 'completed'
  | 'failed'
  | 'completed_with_warnings'
  | 'running';

export default function ScanHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScanStatus>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  // Fetch scan history from API
  const {
    data: scanHistoryResponse,
    isLoading,
    error,
    refetch,
  } = useQuery<ScanHistoryResponse>({
    queryKey: [
      '/api/scans/history',
      {
        portalName: searchTerm || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: pageSize,
        offset: currentPage * pageSize,
      },
    ],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey as [string, Record<string, unknown>];
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });

      const response = await apiRequest(
        'GET',
        `${url}?${searchParams.toString()}`
      );
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Also fetch scan statistics
  const { data: scanStats } = useQuery<ScanStatistics>({
    queryKey: ['/api/scans/statistics'],
    queryFn: async ({ queryKey }) => {
      const response = await apiRequest('GET', queryKey[0] as string);
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const scans = scanHistoryResponse?.scans || [];
  const totalScans = scanHistoryResponse?.total || 0;
  const hasMore = scanHistoryResponse?.hasMore || false;

  // Filter scans based on search term (client-side filtering for UX)
  const filteredScans = scans.filter((scan: ScanHistoryItem) => {
    if (!searchTerm) return true;
    return scan.portalName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'completed_with_warnings':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      completed_with_warnings: 'secondary',
    } as const;

    return (
      <Badge
        variant={variants[status as keyof typeof variants] || 'outline-solid'}
      >
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="scan-history-page">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Scan History</h1>
          <Skeleton className="h-6 w-20" />
        </div>

        {/* Loading skeleton for filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Skeleton className="flex-1 h-10" />
              <Skeleton className="w-48 h-10" />
              <Skeleton className="w-32 h-10" />
            </div>
          </CardContent>
        </Card>

        {/* Loading skeleton for scan cards */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto p-6" data-testid="scan-history-page">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Scan History</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600 mb-4">Failed to load scan history</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" data-testid="scan-history-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Scan History</h1>
          {scanStats && (
            <p className="text-muted-foreground mt-2">
              Success rate: {scanStats.successRate.toFixed(1)}% • Avg.{' '}
              {scanStats.avgRfpsPerScan.toFixed(1)} RFPs per scan •
              {scanStats.totalRfpsDiscovered} RFPs discovered in last 30 days
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" data-testid="scan-count">
            {totalScans} Total Scans
          </Badge>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by portal name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: ScanStatus) => setStatusFilter(value)}
            >
              <SelectTrigger className="w-48" data-testid="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="completed_with_warnings">
                  Completed with Warnings
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Scan History List */}
      {filteredScans.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all'
                ? 'No scans match your filters'
                : 'No scan history available'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredScans.map((scan: ScanHistoryItem) => (
            <Card
              key={scan.id}
              className="hover:shadow-md transition-shadow"
              data-testid={`scan-${scan.id}`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(scan.status)}
                    <div>
                      <CardTitle
                        className="text-lg"
                        data-testid={`scan-portal-${scan.id}`}
                      >
                        {scan.portalName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {scan.scanType} Scan
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(scan.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Started</p>
                    <p
                      className="text-sm text-gray-600"
                      data-testid={`scan-start-${scan.id}`}
                    >
                      {formatDateTime(scan.startTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Duration
                    </p>
                    <p
                      className="text-sm text-gray-600"
                      data-testid={`scan-duration-${scan.id}`}
                    >
                      {scan.duration}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      RFPs Found
                    </p>
                    <p
                      className="text-sm text-gray-600"
                      data-testid={`scan-rfps-${scan.id}`}
                    >
                      {scan.rfpsFound}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Errors</p>
                    <p
                      className="text-sm text-gray-600"
                      data-testid={`scan-errors-${scan.id}`}
                    >
                      {scan.errors.length}
                    </p>
                  </div>
                </div>

                {/* Error Details */}
                {scan.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="text-sm font-medium text-red-800 mb-2">
                      Error Details
                    </h4>
                    {scan.errors.map(
                      (error: ScanHistoryItem['errors'][0], index: number) => (
                        <div
                          key={index}
                          className="text-sm"
                          data-testid={`error-${scan.id}-${index}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              data-testid={`error-code-${scan.id}-${index}`}
                            >
                              {error.code}
                            </Badge>
                            <Badge
                              variant={
                                error.recoverable ? 'secondary' : 'destructive'
                              }
                              data-testid={`error-recovery-${scan.id}-${index}`}
                            >
                              {error.recoverable
                                ? 'Recoverable'
                                : 'Manual intervention required'}
                            </Badge>
                          </div>
                          <p
                            className="text-red-700"
                            data-testid={`error-message-${scan.id}-${index}`}
                          >
                            {error.message}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalScans > pageSize && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * pageSize + 1} to{' '}
                {Math.min((currentPage + 1) * pageSize, totalScans)} of{' '}
                {totalScans} scans
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="text-sm px-3">
                  Page {currentPage + 1} of {Math.ceil(totalScans / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
