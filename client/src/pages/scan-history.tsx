import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search,
  Calendar,
  Activity
} from 'lucide-react';

// Mock data for scan history - in a real app this would come from an API
const mockScanHistory = [
  {
    id: '1',
    portalName: 'Bonfire Hub',
    scanType: 'Automated',
    status: 'completed',
    startTime: '2024-01-15T10:30:00Z',
    endTime: '2024-01-15T10:32:15Z',
    rfpsFound: 12,
    errors: [],
    duration: '2m 15s'
  },
  {
    id: '2', 
    portalName: 'Austin Finance Online',
    scanType: 'Manual',
    status: 'completed',
    startTime: '2024-01-15T09:15:00Z',
    endTime: '2024-01-15T09:17:30Z',
    rfpsFound: 8,
    errors: [],
    duration: '2m 30s'
  },
  {
    id: '3',
    portalName: 'Bonfire Hub',
    scanType: 'Automated',
    status: 'failed',
    startTime: '2024-01-14T14:20:00Z',
    endTime: '2024-01-14T14:22:45Z',
    rfpsFound: 0,
    errors: [
      {
        code: 'BONFIRE_AUTH_TIMEOUT',
        message: 'Authentication timeout: The portal may be slow or experiencing issues. This is recoverable - retry recommended.',
        recoverable: true
      }
    ],
    duration: '2m 45s'
  },
  {
    id: '4',
    portalName: 'FindRFP',
    scanType: 'Automated',
    status: 'completed_with_warnings',
    startTime: '2024-01-14T08:45:00Z',
    endTime: '2024-01-14T08:47:20Z',
    rfpsFound: 15,
    errors: [
      {
        code: 'MINOR_PARSING_ERROR',
        message: 'Some RFP details could not be fully extracted but core information was captured',
        recoverable: true
      }
    ],
    duration: '2m 20s'
  },
  {
    id: '5',
    portalName: 'Bonfire Hub',
    scanType: 'Manual',
    status: 'failed',
    startTime: '2024-01-13T16:10:00Z',
    endTime: '2024-01-13T16:12:30Z',
    rfpsFound: 0,
    errors: [
      {
        code: 'BONFIRE_AUTH_2FA_REQUIRED',
        message: 'Two-factor authentication detected: This portal requires manual 2FA verification. Account needs manual intervention.',
        recoverable: false
      }
    ],
    duration: '2m 30s'
  }
];

type ScanStatus = 'all' | 'completed' | 'failed' | 'completed_with_warnings';

export default function ScanHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScanStatus>('all');
  
  const filteredScans = mockScanHistory.filter(scan => {
    const matchesSearch = scan.portalName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || scan.status === statusFilter;
    return matchesSearch && matchesStatus;
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
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6" data-testid="scan-history-page">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Scan History</h1>
        <Badge variant="outline" data-testid="scan-count">
          {filteredScans.length} Scans
        </Badge>
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value: ScanStatus) => setStatusFilter(value)}>
              <SelectTrigger className="w-48" data-testid="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="completed_with_warnings">Completed with Warnings</SelectItem>
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
          {filteredScans.map((scan) => (
            <Card key={scan.id} className="hover:shadow-md transition-shadow" data-testid={`scan-${scan.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(scan.status)}
                    <div>
                      <CardTitle className="text-lg" data-testid={`scan-portal-${scan.id}`}>
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
                    <p className="text-sm text-gray-600" data-testid={`scan-start-${scan.id}`}>
                      {formatDateTime(scan.startTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Duration</p>
                    <p className="text-sm text-gray-600" data-testid={`scan-duration-${scan.id}`}>
                      {scan.duration}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">RFPs Found</p>
                    <p className="text-sm text-gray-600" data-testid={`scan-rfps-${scan.id}`}>
                      {scan.rfpsFound}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Errors</p>
                    <p className="text-sm text-gray-600" data-testid={`scan-errors-${scan.id}`}>
                      {scan.errors.length}
                    </p>
                  </div>
                </div>
                
                {/* Error Details */}
                {scan.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="text-sm font-medium text-red-800 mb-2">Error Details</h4>
                    {scan.errors.map((error, index) => (
                      <div key={index} className="text-sm" data-testid={`error-${scan.id}-${index}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" data-testid={`error-code-${scan.id}-${index}`}>
                            {error.code}
                          </Badge>
                          <Badge 
                            variant={error.recoverable ? "secondary" : "destructive"} 
                            data-testid={`error-recovery-${scan.id}-${index}`}
                          >
                            {error.recoverable ? 'Recoverable' : 'Manual intervention required'}
                          </Badge>
                        </div>
                        <p className="text-red-700" data-testid={`error-message-${scan.id}-${index}`}>
                          {error.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}