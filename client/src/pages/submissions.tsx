import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  getStatusBadgeVariant,
  getStatusBadgeClassName,
  getStatusLabel,
  getStatusIcon,
} from '@/lib/badge-utils';
import {
  SUBMISSION_PROGRESS_STATUSES,
  type RfpDetail,
  type SubmissionStatusFilter,
} from '../types/api';
import {
  filterSubmissionRfps,
  getSubmissionReadyRfps,
} from '../utils/submissionFilters';

const statusFilterOptions: SubmissionStatusFilter[] = [
  'all',
  ...SUBMISSION_PROGRESS_STATUSES,
];

export default function Submissions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<SubmissionStatusFilter>('all');
  const { toast } = useToast();

  const { data: rfps = [], isLoading } = useQuery<RfpDetail[]>({
    queryKey: ['/api/rfps', 'detailed'],
  });

  const submitProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest('POST', `/api/submissions/${proposalId}/submit`);
    },
    onSuccess: () => {
      toast({
        title: 'Submission Started',
        description: 'The proposal submission process has been initiated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps'] });
    },
    onError: () => {
      toast({
        title: 'Submission Failed',
        description:
          'Failed to start the submission process. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const submissionReadyRfps = getSubmissionReadyRfps(rfps);

  const filteredRfps = filterSubmissionRfps(
    submissionReadyRfps,
    searchQuery,
    statusFilter
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24" />
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
        <h1
          className="text-3xl font-bold text-foreground mb-2"
          data-testid="page-title"
        >
          Submissions
        </h1>
        <p className="text-muted-foreground">
          Manage and monitor proposal submissions to procurement portals
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search submissions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-input"
          />
          <i className="fas fa-search absolute left-3 top-3 text-muted-foreground text-xs"></i>
        </div>

        <Select
          value={statusFilter}
          onValueChange={value =>
            setStatusFilter(value as SubmissionStatusFilter)
          }
        >
          <SelectTrigger className="w-48" data-testid="status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusFilterOptions.map(option => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All Statuses' : getStatusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submissions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRfps.map(item => (
          <SubmissionCard
            key={item.rfp.id}
            item={item}
            onSubmit={() =>
              item.proposal && submitProposalMutation.mutate(item.proposal.id)
            }
            submitting={submitProposalMutation.isPending}
          />
        ))}
      </div>

      {filteredRfps.length === 0 && (
        <div className="text-center py-12">
          <i className="fas fa-paper-plane text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery || statusFilter !== 'all'
              ? 'No Matching Submissions'
              : 'No Submissions Ready'}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search criteria'
              : 'Proposals need to be approved before they can be submitted'}
          </p>
        </div>
      )}
    </div>
  );
}

interface SubmissionCardProps {
  item: RfpDetail;
  onSubmit: () => void;
  submitting: boolean;
}

function SubmissionCard({ item, onSubmit, submitting }: SubmissionCardProps) {
  const isSubmitted = item.rfp.status === 'submitted';
  const canSubmit = item.rfp.status === 'approved' && item.proposal;

  return (
    <Card
      className={`hover:shadow-md transition-shadow ${
        isSubmitted ? 'border-green-200 dark:border-green-900' : ''
      }`}
      data-testid={`submission-card-${item.rfp.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle
            className="text-lg leading-tight"
            data-testid={`submission-title-${item.rfp.id}`}
          >
            {item.rfp.title}
          </CardTitle>
          <Badge
            variant={getStatusBadgeVariant(item.rfp.status)}
            className={`${getStatusBadgeClassName(item.rfp.status)} ml-2`}
            data-testid={`submission-status-${item.rfp.id}`}
          >
            <i className={`${getStatusIcon(item.rfp.status)} mr-1`}></i>
            {getStatusLabel(item.rfp.status)}
          </Badge>
        </div>
        <p
          className="text-sm text-muted-foreground"
          data-testid={`submission-agency-${item.rfp.id}`}
        >
          {item.rfp.agency}
        </p>
        {item.portal && (
          <p
            className="text-xs text-muted-foreground"
            data-testid={`submission-portal-${item.rfp.id}`}
          >
            Portal: {item.portal.name}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {item.rfp.deadline && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deadline:</span>
              <span
                className="font-medium"
                data-testid={`submission-deadline-${item.rfp.id}`}
              >
                {new Date(item.rfp.deadline).toLocaleDateString()}
              </span>
            </div>
          )}

          {item.rfp.estimatedValue && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Value:</span>
              <span
                className="font-medium"
                data-testid={`submission-value-${item.rfp.id}`}
              >
                ${parseFloat(item.rfp.estimatedValue).toLocaleString()}
              </span>
            </div>
          )}

          {item.proposal?.estimatedMargin && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Margin:</span>
              <span
                className="font-medium text-green-600"
                data-testid={`submission-margin-${item.rfp.id}`}
              >
                {item.proposal.estimatedMargin}%
              </span>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  data-testid={`view-submission-details-${item.rfp.id}`}
                >
                  <i className="fas fa-eye mr-2"></i>
                  View Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Submission Details</DialogTitle>
                </DialogHeader>
                <SubmissionDetailsModal item={item} />
              </DialogContent>
            </Dialog>

            {canSubmit && (
              <Button
                size="sm"
                onClick={onSubmit}
                disabled={submitting}
                data-testid={`submit-proposal-${item.rfp.id}`}
              >
                <i className="fas fa-paper-plane mr-2"></i>
                {submitting ? 'Submitting...' : 'Submit Now'}
              </Button>
            )}

            {isSubmitted && (
              <Button
                size="sm"
                variant="outline"
                data-testid={`view-receipt-${item.rfp.id}`}
              >
                <i className="fas fa-receipt mr-2"></i>
                Receipt
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SubmissionDetailsModalProps {
  item: RfpDetail;
}

interface PricingSummary {
  totalPrice?: number;
}

interface RiskFlag {
  type?: string;
  category?: string;
  description?: string;
}

function hasTotalPrice(
  pricingTables: unknown
): pricingTables is PricingSummary {
  return (
    typeof pricingTables === 'object' &&
    pricingTables !== null &&
    'totalPrice' in pricingTables
  );
}

function isRiskFlag(value: unknown): value is RiskFlag {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('type' in value || 'category' in value || 'description' in value)
  );
}

function SubmissionDetailsModal({ item }: SubmissionDetailsModalProps) {
  const totalPrice = hasTotalPrice(item.proposal?.pricingTables)
    ? (item.proposal?.pricingTables.totalPrice ?? null)
    : null;
  const riskFlags = Array.isArray(item.rfp.riskFlags)
    ? item.rfp.riskFlags.filter(isRiskFlag)
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="font-medium text-muted-foreground">
            RFP Title:
          </label>
          <p className="mt-1" data-testid="modal-rfp-title">
            {item.rfp.title}
          </p>
        </div>
        <div>
          <label className="font-medium text-muted-foreground">Agency:</label>
          <p className="mt-1" data-testid="modal-rfp-agency">
            {item.rfp.agency}
          </p>
        </div>
        <div>
          <label className="font-medium text-muted-foreground">Portal:</label>
          <p className="mt-1" data-testid="modal-rfp-portal">
            {item.portal?.name || 'N/A'}
          </p>
        </div>
        <div>
          <label className="font-medium text-muted-foreground">Status:</label>
          <p className="mt-1" data-testid="modal-rfp-status">
            <Badge
              variant={getStatusBadgeVariant(item.rfp.status)}
              className={getStatusBadgeClassName(item.rfp.status)}
            >
              <i className={`${getStatusIcon(item.rfp.status)} mr-1`}></i>
              {getStatusLabel(item.rfp.status)}
            </Badge>
          </p>
        </div>
      </div>

      {item.rfp.deadline && (
        <div className="text-sm">
          <label className="font-medium text-muted-foreground">Deadline:</label>
          <p className="mt-1" data-testid="modal-rfp-deadline">
            {new Date(item.rfp.deadline).toLocaleDateString()} at{' '}
            {new Date(item.rfp.deadline).toLocaleTimeString()}
          </p>
        </div>
      )}

      {item.proposal && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Proposal Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-muted-foreground">
                Total Price:
              </label>
              <p className="mt-1" data-testid="modal-proposal-price">
                {typeof totalPrice === 'number'
                  ? `$${totalPrice.toLocaleString()}`
                  : 'Not set'}
              </p>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">
                Estimated Margin:
              </label>
              <p
                className="mt-1 text-green-600"
                data-testid="modal-proposal-margin"
              >
                {item.proposal.estimatedMargin}%
              </p>
            </div>
          </div>
        </div>
      )}

      {riskFlags.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Compliance Notes</h4>
          <div className="space-y-2">
            {riskFlags.slice(0, 3).map((flag, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs ${
                  flag.type === 'high'
                    ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : flag.type === 'medium'
                      ? 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                      : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                }`}
                data-testid={`modal-risk-flag-${index}`}
              >
                <strong>{flag.category}:</strong> {flag.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
