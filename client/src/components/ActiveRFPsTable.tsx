import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { RFPProcessingProgressModal } from './RFPProcessingProgress';
import {
  getStatusBadgeVariant,
  getStatusBadgeClassName,
  getStatusLabel,
} from '@/lib/badge-utils';

export default function ActiveRFPsTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [manualRfpUrl, setManualRfpUrl] = useState('');
  const [manualRfpUrlError, setManualRfpUrlError] = useState('');
  const [manualRfpNotes, setManualRfpNotes] = useState('');
  const [manualRfpDialogOpen, setManualRfpDialogOpen] = useState(false);
  const [progressSessionId, setProgressSessionId] = useState<string | null>(
    null
  );
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: rfpData, isLoading } = useQuery({
    queryKey: ['/api/rfps', 'detailed'],
  });

  const generateProposalMutation = useMutation({
    mutationFn: async (rfpId: string) => {
      return apiRequest('POST', `/api/proposals/${rfpId}/generate`);
    },
    onSuccess: () => {
      toast({
        title: 'Proposal Generation Started',
        description:
          "AI is now generating the proposal. You will be notified when it's ready for review.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps'] });
    },
    onError: () => {
      toast({
        title: 'Generation Failed',
        description: 'Failed to start proposal generation. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const approveProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest('POST', `/api/proposals/${proposalId}/approve`);
    },
    onSuccess: () => {
      toast({
        title: 'Proposal Approved',
        description:
          'The proposal has been approved and is ready for submission.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps'] });
    },
    onError: () => {
      toast({
        title: 'Approval Failed',
        description: 'Failed to approve proposal. Please try again.',
        variant: 'destructive',
      });
    },
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

  const manualRfpMutation = useMutation({
    mutationFn: async (data: { url: string; userNotes?: string }) => {
      console.log('🚀 Submitting manual RFP:', data);
      const response = await apiRequest('POST', '/api/rfps/manual', data);
      console.log('📡 Raw response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API response not ok:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Parsed API response:', JSON.stringify(result, null, 2));
      return result;
    },
    onSuccess: data => {
      console.log(
        '🎉 Manual RFP mutation onSuccess called with data:',
        JSON.stringify(data, null, 2)
      );
      console.log(
        '🔍 Checking data.success:',
        data.success,
        typeof data.success
      );
      console.log(
        '🔍 Checking data.sessionId:',
        data.sessionId,
        typeof data.sessionId
      );

      if (data.success && data.sessionId) {
        console.log('✅ Success conditions met, opening progress modal');

        // Show progress modal
        setProgressSessionId(data.sessionId);
        setProgressDialogOpen(true);
        setManualRfpDialogOpen(false);

        // Clear form
        setManualRfpUrl('');
        setManualRfpNotes('');

        toast({
          title: 'RFP Processing Started',
          description:
            'Processing has begun. You can track progress in real-time.',
        });
      } else {
        console.log('❌ Success conditions not met:', {
          success: data.success,
          sessionId: data.sessionId,
          message: data.message,
        });

        toast({
          title: 'Manual RFP Failed',
          description: data.message || 'Failed to process the RFP URL.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message ||
        'Failed to process the RFP URL. Please check the URL and try again.';
      toast({
        title: 'Manual RFP Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const rfps = Array.isArray(rfpData) ? rfpData : [];
  const filteredRfps = rfps.filter((item: any) => {
    const matchesSearch =
      item.rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rfp.agency.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || item.rfp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'discovered':
        return 'fas fa-eye';
      case 'parsing':
        return 'fas fa-file-search';
      case 'drafting':
        return 'fas fa-edit';
      case 'review':
        return 'fas fa-clipboard-check';
      case 'approved':
        return 'fas fa-check';
      case 'submitted':
        return 'fas fa-paper-plane';
      default:
        return 'fas fa-circle';
    }
  };

  // Use actual progress values from database instead of hardcoded status mapping
  const getProgressValue = (rfp: any) => {
    return rfp.progress || 0; // Use actual progress from database, default to 0
  };

  const getProgressColor = (status: string, progress: number) => {
    if (status === 'submitted') return 'bg-green-600 dark:bg-green-500';
    if (status === 'approved') return 'bg-green-500 dark:bg-green-400';
    if (status === 'review') return 'bg-orange-500 dark:bg-orange-400';
    if (status === 'drafting') return 'bg-purple-500 dark:bg-purple-400';
    if (status === 'parsing') return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-primary';
  };

  const getDeadlineText = (deadline: string | null) => {
    if (!deadline)
      return { text: 'No deadline', color: 'text-muted-foreground' };

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', color: 'text-red-600' };
    if (diffDays <= 7)
      return { text: `${diffDays} days remaining`, color: 'text-red-600' };
    if (diffDays <= 14)
      return { text: `${diffDays} days remaining`, color: 'text-orange-600' };
    return { text: `${diffDays} days remaining`, color: 'text-green-600' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="active-rfps-table">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Active RFP Pipeline</CardTitle>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search RFPs..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 text-sm w-64"
                  data-testid="rfp-search-input"
                />
                <i className="fas fa-search absolute left-3 top-3 text-muted-foreground text-xs"></i>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="w-40"
                  data-testid="status-filter-select"
                >
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="discovered">Discovered</SelectItem>
                  <SelectItem value="parsing">Parsing</SelectItem>
                  <SelectItem value="drafting">Drafting</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                </SelectContent>
              </Select>

              <Dialog
                open={manualRfpDialogOpen}
                onOpenChange={setManualRfpDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button data-testid="manual-rfp-button">
                    <i className="fas fa-plus mr-2"></i>Manual RFP
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Manual RFP</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      
                      // Clear previous errors
                      setManualRfpUrlError('');
                      
                      // Validate URL
                      const url = manualRfpUrl.trim();
                      if (!url) {
                        setManualRfpUrlError('URL is required');
                        toast({
                          title: 'URL Required',
                          description: 'Please enter a valid RFP URL',
                          variant: 'destructive',
                        });
                        return;
                      }
                      
                      // Validate URL format
                      try {
                        new URL(url);
                      } catch {
                        setManualRfpUrlError('Please enter a valid URL format (e.g., https://example.com/rfp)');
                        toast({
                          title: 'Invalid URL',
                          description: 'Please enter a valid URL format',
                          variant: 'destructive',
                        });
                        return;
                      }
                      
                      manualRfpMutation.mutate({
                        url: url,
                        userNotes: manualRfpNotes.trim() || undefined,
                      });
                    }}
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <div>
                        <Label
                          htmlFor="rfp-url"
                          className="text-sm font-medium"
                        >
                          RFP URL <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="rfp-url"
                          type="url"
                          placeholder="https://example.com/rfp/12345"
                          value={manualRfpUrl}
                          onChange={e => {
                            setManualRfpUrl(e.target.value);
                            // Clear error when user types
                            if (manualRfpUrlError) {
                              setManualRfpUrlError('');
                            }
                          }}
                          className={`mt-1 ${manualRfpUrlError ? 'border-red-500' : ''}`}
                          required
                          data-testid="manual-rfp-url-input"
                          aria-invalid={!!manualRfpUrlError}
                          aria-describedby={manualRfpUrlError ? 'rfp-url-error' : undefined}
                        />
                        {manualRfpUrlError && (
                          <p
                            id="rfp-url-error"
                            className="text-xs text-red-500 mt-1"
                            role="alert"
                          >
                            {manualRfpUrlError}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the URL of any RFP from any portal platform. Our
                          AI will analyze and process it automatically.
                        </p>
                      </div>

                      <div>
                        <Label
                          htmlFor="rfp-notes"
                          className="text-sm font-medium"
                        >
                          Notes (Optional)
                        </Label>
                        <Textarea
                          id="rfp-notes"
                          placeholder="Add any notes, requirements, or special instructions for this RFP..."
                          value={manualRfpNotes}
                          onChange={e => setManualRfpNotes(e.target.value)}
                          className="mt-1 min-h-20"
                          data-testid="manual-rfp-notes-input"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          These notes will be included with the RFP for
                          reference during processing.
                        </p>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
                        <div className="flex items-start space-x-3">
                          <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
                          <div>
                            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              How Manual RFP Processing Works
                            </h4>
                            <ul className="text-xs text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                              <li>
                                • AI analyzes the URL and extracts RFP
                                information
                              </li>
                              <li>
                                • Documents are automatically downloaded and
                                processed
                              </li>
                              <li>
                                • Competitive pricing research is conducted
                              </li>
                              <li>
                                • Human oversight requirements are identified
                              </li>
                              <li>
                                • Complete proposal generation begins
                                automatically
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setManualRfpDialogOpen(false)}
                        disabled={manualRfpMutation.isPending}
                        data-testid="manual-rfp-cancel-button"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          manualRfpMutation.isPending || !manualRfpUrl.trim()
                        }
                        data-testid="manual-rfp-submit-button"
                      >
                        {manualRfpMutation.isPending ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Processing...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-plus mr-2"></i>
                            Add RFP
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="rfps-table">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    RFP Details
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRfps.map((item: any) => {
                  const deadline = getDeadlineText(item.rfp.deadline);
                  const calculatedProgress = getProgressValue(item.rfp);
                  const progressColor = getProgressColor(
                    item.rfp.status,
                    calculatedProgress
                  );

                  return (
                    <tr
                      key={item.rfp.id}
                      className="hover:bg-muted/20"
                      data-testid={`rfp-row-${item.rfp.id}`}
                    >
                      <td className="py-4 px-6">
                        <div>
                          <Link href={`/rfps/${item.rfp.id}`}>
                            <h4
                              className="text-sm font-medium text-foreground hover:text-primary cursor-pointer transition-colors"
                              data-testid={`rfp-title-${item.rfp.id}`}
                            >
                              {item.rfp.title}
                            </h4>
                          </Link>
                          <p
                            className="text-xs text-muted-foreground"
                            data-testid={`rfp-agency-${item.rfp.id}`}
                          >
                            {item.rfp.agency}
                          </p>
                          {item.portal && (
                            <p
                              className="text-xs text-muted-foreground mt-1"
                              data-testid={`rfp-source-${item.rfp.id}`}
                            >
                              Source: {item.portal.name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge
                          variant={getStatusBadgeVariant(item.rfp.status)}
                          className={getStatusBadgeClassName(item.rfp.status)}
                          data-testid={`rfp-status-${item.rfp.id}`}
                        >
                          <i
                            className={`${getStatusIcon(item.rfp.status)} mr-1`}
                          ></i>
                          {getStatusLabel(item.rfp.status)}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div
                          className="text-sm text-foreground"
                          data-testid={`rfp-deadline-${item.rfp.id}`}
                        >
                          {item.rfp.deadline
                            ? new Date(item.rfp.deadline).toLocaleDateString()
                            : 'Not set'}
                        </div>
                        <div
                          className={`text-xs ${deadline.color}`}
                          data-testid={`rfp-deadline-status-${item.rfp.id}`}
                        >
                          {deadline.text}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div
                          className="text-sm font-medium text-foreground"
                          data-testid={`rfp-value-${item.rfp.id}`}
                        >
                          {item.rfp.estimatedValue
                            ? `$${parseFloat(item.rfp.estimatedValue).toLocaleString()}`
                            : 'Not set'}
                        </div>
                        {item.proposal?.estimatedMargin && (
                          <div
                            className="text-xs text-muted-foreground"
                            data-testid={`rfp-margin-${item.rfp.id}`}
                          >
                            Est. margin: {item.proposal.estimatedMargin}%
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Progress
                          value={calculatedProgress}
                          className="w-full h-2"
                          data-testid={`rfp-progress-bar-${item.rfp.id}`}
                        />
                        <div
                          className="text-xs text-muted-foreground mt-1"
                          data-testid={`rfp-progress-text-${item.rfp.id}`}
                        >
                          {calculatedProgress}% complete
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex space-x-2">
                          {item.rfp.status === 'discovered' && (
                            <Button
                              size="sm"
                              onClick={() =>
                                generateProposalMutation.mutate(item.rfp.id)
                              }
                              disabled={generateProposalMutation.isPending}
                              data-testid={`generate-proposal-${item.rfp.id}`}
                            >
                              <i className="fas fa-robot mr-1"></i>
                              Generate
                            </Button>
                          )}

                          {item.rfp.status === 'parsing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              data-testid={`processing-${item.rfp.id}`}
                            >
                              Processing...
                            </Button>
                          )}

                          {item.rfp.status === 'drafting' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              data-testid={`ai-drafting-${item.rfp.id}`}
                            >
                              AI Drafting...
                            </Button>
                          )}

                          {item.rfp.status === 'review' && item.proposal && (
                            <Button
                              size="sm"
                              onClick={() =>
                                approveProposalMutation.mutate(item.proposal.id)
                              }
                              disabled={approveProposalMutation.isPending}
                              data-testid={`approve-proposal-${item.rfp.id}`}
                            >
                              <i className="fas fa-check mr-1"></i>
                              Approve
                            </Button>
                          )}

                          {item.rfp.status === 'approved' && item.proposal && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() =>
                                submitProposalMutation.mutate(item.proposal.id)
                              }
                              disabled={submitProposalMutation.isPending}
                              data-testid={`submit-proposal-${item.rfp.id}`}
                            >
                              <i className="fas fa-paper-plane mr-1"></i>
                              Submit Now
                            </Button>
                          )}

                          {item.rfp.status === 'submitted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`view-submission-${item.rfp.id}`}
                            >
                              <i className="fas fa-receipt mr-1"></i>
                              View Submission
                            </Button>
                          )}

                          <Link href={`/rfps/${item.rfp.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`view-details-${item.rfp.id}`}
                            >
                              <i className="fas fa-eye mr-1"></i>
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRfps.length === 0 && (
            <div className="text-center py-12">
              <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No RFPs Found
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'No RFPs have been discovered yet'}
              </p>
            </div>
          )}

          {/* Table Pagination */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div
              className="text-sm text-muted-foreground"
              data-testid="table-pagination-info"
            >
              Showing {Math.min(filteredRfps.length, 10)} of{' '}
              {filteredRfps.length} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                data-testid="pagination-previous"
              >
                Previous
              </Button>
              <Button size="sm" data-testid="pagination-current">
                1
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                data-testid="pagination-next"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Modal */}
      {progressSessionId && (
        <RFPProcessingProgressModal
          sessionId={progressSessionId}
          open={progressDialogOpen}
          onOpenChange={setProgressDialogOpen}
          onComplete={(rfpId: string) => {
            setProgressDialogOpen(false);
            setProgressSessionId(null);
            queryClient.invalidateQueries({ queryKey: ['/api/rfps'] });

            // Navigate to RFP details page
            navigate(`/rfps/${rfpId}`);

            toast({
              title: 'RFP Processing Complete',
              description:
                'The RFP has been successfully processed and analyzed.',
            });
          }}
          onError={(error: string) => {
            setProgressDialogOpen(false);
            setProgressSessionId(null);

            toast({
              title: 'RFP Processing Failed',
              description: error,
              variant: 'destructive',
            });
          }}
        />
      )}
    </>
  );
}
