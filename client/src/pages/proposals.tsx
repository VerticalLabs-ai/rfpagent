// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  getStatusBadgeVariant,
  getStatusBadgeClassName,
  getStatusLabel,
  getStatusIcon,
} from '@/lib/badge-utils';

export default function Proposals() {
  const [selectedRfp, setSelectedRfp] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const { toast } = useToast();

  const { data: rfps, isLoading: rfpsLoading } = useQuery({
    queryKey: ['/api/rfps', 'detailed'],
  });

  const { data: selectedProposal, isLoading: proposalLoading } = useQuery({
    queryKey: ['/api/proposals/rfp', selectedRfp],
    enabled: !!selectedRfp,
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
      queryClient.invalidateQueries({
        queryKey: ['/api/proposals/rfp', selectedRfp],
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

  const updateProposalMutation = useMutation({
    mutationFn: async ({
      proposalId,
      updates,
    }: {
      proposalId: string;
      updates: any;
    }) => {
      return apiRequest('PUT', `/api/proposals/${proposalId}`, updates);
    },
    onSuccess: () => {
      toast({
        title: 'Proposal Updated',
        description: 'Your changes have been saved successfully.',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/proposals/rfp', selectedRfp],
      });
      setEditMode(false);
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update proposal. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const proposalReadyRfps =
    rfps?.filter(
      (item: any) =>
        item.rfp.status === 'drafting' ||
        item.rfp.status === 'review' ||
        item.rfp.status === 'approved'
    ) || [];

  if (rfpsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <Card className="lg:col-span-1">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96" />
            </CardContent>
          </Card>
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
          Proposals
        </h1>
        <p className="text-muted-foreground">
          Review, edit, and approve AI-generated proposals
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* RFP List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>RFPs with Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proposalReadyRfps.map((item: any) => (
                <div
                  key={item.rfp.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedRfp === item.rfp.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => setSelectedRfp(item.rfp.id)}
                  data-testid={`rfp-item-${item.rfp.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4
                      className="font-medium text-sm leading-tight"
                      data-testid={`rfp-item-title-${item.rfp.id}`}
                    >
                      {item.rfp.title}
                    </h4>
                    <Badge
                      variant={getStatusBadgeVariant(item.rfp.status)}
                      className={`${getStatusBadgeClassName(item.rfp.status)} ml-2`}
                    >
                      <i
                        className={`${getStatusIcon(item.rfp.status)} mr-1`}
                      ></i>
                      {getStatusLabel(item.rfp.status)}
                    </Badge>
                  </div>
                  <p
                    className="text-xs text-muted-foreground mb-2"
                    data-testid={`rfp-item-agency-${item.rfp.id}`}
                  >
                    {item.rfp.agency}
                  </p>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Progress:</span>
                    <span
                      className="font-medium"
                      data-testid={`rfp-item-progress-${item.rfp.id}`}
                    >
                      {item.rfp.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1 mt-1">
                    <div
                      className="bg-primary h-1 rounded-full progress-bar"
                      style={{ width: `${item.rfp.progress}%` }}
                    ></div>
                  </div>

                  {item.rfp.status === 'discovered' && (
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={e => {
                        e.stopPropagation();
                        generateProposalMutation.mutate(item.rfp.id);
                      }}
                      disabled={generateProposalMutation.isPending}
                      data-testid={`generate-proposal-${item.rfp.id}`}
                    >
                      <i className="fas fa-robot mr-2"></i>
                      Generate Proposal
                    </Button>
                  )}
                </div>
              ))}

              {proposalReadyRfps.length === 0 && (
                <div className="text-center py-8">
                  <i className="fas fa-file-alt text-3xl text-muted-foreground mb-3"></i>
                  <p className="text-sm text-muted-foreground">
                    No proposals ready for review
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proposal Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedRfp ? 'Proposal Details' : 'Select an RFP'}
              </CardTitle>
              {selectedProposal && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(!editMode)}
                    data-testid="toggle-edit-mode"
                  >
                    <i
                      className={`fas ${editMode ? 'fa-eye' : 'fa-edit'} mr-2`}
                    ></i>
                    {editMode ? 'Preview' : 'Edit'}
                  </Button>

                  {selectedProposal.status === 'review' && (
                    <Button
                      onClick={() =>
                        approveProposalMutation.mutate(selectedProposal.id)
                      }
                      disabled={approveProposalMutation.isPending}
                      data-testid="approve-proposal"
                    >
                      <i className="fas fa-check mr-2"></i>
                      Approve
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRfp ? (
              <div className="text-center py-12">
                <i className="fas fa-arrow-left text-4xl text-muted-foreground mb-4"></i>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Select an RFP
                </h3>
                <p className="text-muted-foreground">
                  Choose an RFP from the list to view its proposal details
                </p>
              </div>
            ) : proposalLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8" />
                <Skeleton className="h-32" />
                <Skeleton className="h-24" />
              </div>
            ) : selectedProposal ? (
              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content" data-testid="tab-content">
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="pricing" data-testid="tab-pricing">
                    Pricing
                  </TabsTrigger>
                  <TabsTrigger value="compliance" data-testid="tab-compliance">
                    Compliance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4">
                  <ProposalContentEditor
                    proposal={selectedProposal}
                    editMode={editMode}
                    onUpdate={updates =>
                      updateProposalMutation.mutate({
                        proposalId: selectedProposal.id,
                        updates,
                      })
                    }
                  />
                </TabsContent>

                <TabsContent value="pricing" className="space-y-4">
                  <ProposalPricingEditor
                    proposal={selectedProposal}
                    editMode={editMode}
                    onUpdate={updates =>
                      updateProposalMutation.mutate({
                        proposalId: selectedProposal.id,
                        updates,
                      })
                    }
                  />
                </TabsContent>

                <TabsContent value="compliance" className="space-y-4">
                  <div className="text-center py-8">
                    <i className="fas fa-clipboard-check text-3xl text-muted-foreground mb-3"></i>
                    <p className="text-sm text-muted-foreground">
                      Compliance checklist will be displayed here
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12">
                <i className="fas fa-robot text-4xl text-muted-foreground mb-4"></i>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Proposal Yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  This RFP doesn't have a generated proposal yet
                </p>
                <Button
                  onClick={() =>
                    selectedRfp && generateProposalMutation.mutate(selectedRfp)
                  }
                  disabled={generateProposalMutation.isPending}
                  data-testid="generate-proposal-empty-state"
                >
                  <i className="fas fa-robot mr-2"></i>
                  Generate Proposal
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProposalContentEditor({ proposal, editMode, onUpdate }: any) {
  const [content, setContent] = useState(proposal.content || {});

  const handleSave = () => {
    onUpdate({ content });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="executive-summary">Executive Summary</Label>
        {editMode ? (
          <Textarea
            id="executive-summary"
            value={content.executiveSummary || ''}
            onChange={e =>
              setContent({ ...content, executiveSummary: e.target.value })
            }
            className="min-h-32 mt-1"
            data-testid="executive-summary-input"
          />
        ) : (
          <div
            className="mt-1 p-3 border rounded-md bg-muted/20"
            data-testid="executive-summary-display"
          >
            {content.executiveSummary || 'No executive summary available'}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="technical-approach">Technical Approach</Label>
        {editMode ? (
          <Textarea
            id="technical-approach"
            value={content.technicalApproach || ''}
            onChange={e =>
              setContent({ ...content, technicalApproach: e.target.value })
            }
            className="min-h-24 mt-1"
            data-testid="technical-approach-input"
          />
        ) : (
          <div
            className="mt-1 p-3 border rounded-md bg-muted/20"
            data-testid="technical-approach-display"
          >
            {content.technicalApproach || 'No technical approach available'}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="qualifications">Qualifications</Label>
        {editMode ? (
          <Textarea
            id="qualifications"
            value={content.qualifications || ''}
            onChange={e =>
              setContent({ ...content, qualifications: e.target.value })
            }
            className="min-h-24 mt-1"
            data-testid="qualifications-input"
          />
        ) : (
          <div
            className="mt-1 p-3 border rounded-md bg-muted/20"
            data-testid="qualifications-display"
          >
            {content.qualifications || 'No qualifications available'}
          </div>
        )}
      </div>

      {editMode && (
        <Button onClick={handleSave} data-testid="save-content">
          <i className="fas fa-save mr-2"></i>
          Save Changes
        </Button>
      )}
    </div>
  );
}

function ProposalPricingEditor({ proposal, editMode, onUpdate }: any) {
  const [pricing, setPricing] = useState(proposal.pricingTables || {});

  const handleSave = () => {
    onUpdate({ pricingTables: pricing });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="total-price">Total Price</Label>
          {editMode ? (
            <Input
              id="total-price"
              type="number"
              value={pricing.totalPrice || ''}
              onChange={e =>
                setPricing({
                  ...pricing,
                  totalPrice: parseFloat(e.target.value),
                })
              }
              className="mt-1"
              data-testid="total-price-input"
            />
          ) : (
            <div
              className="mt-1 p-3 border rounded-md bg-muted/20"
              data-testid="total-price-display"
            >
              ${pricing.totalPrice?.toLocaleString() || 'Not set'}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="margin">Estimated Margin (%)</Label>
          {editMode ? (
            <Input
              id="margin"
              type="number"
              value={proposal.estimatedMargin || ''}
              onChange={e =>
                setPricing({
                  ...pricing,
                  defaultMargin: parseFloat(e.target.value),
                })
              }
              className="mt-1"
              data-testid="margin-input"
            />
          ) : (
            <div
              className="mt-1 p-3 border rounded-md bg-muted/20"
              data-testid="margin-display"
            >
              {proposal.estimatedMargin}%
            </div>
          )}
        </div>
      </div>

      {pricing.lineItems && (
        <div>
          <Label>Line Items</Label>
          <div className="mt-2 space-y-2">
            {pricing.lineItems.map((item: any, index: number) => (
              <div
                key={index}
                className="grid grid-cols-4 gap-2 p-3 border rounded-md bg-muted/20"
              >
                <div className="font-medium">{item.description}</div>
                <div className="text-muted-foreground">
                  {item.quantity} {item.unit}
                </div>
                <div className="text-muted-foreground">${item.unitCost}</div>
                <div className="font-medium">
                  ${item.totalCost?.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editMode && (
        <Button onClick={handleSave} data-testid="save-pricing">
          <i className="fas fa-save mr-2"></i>
          Save Changes
        </Button>
      )}
    </div>
  );
}
