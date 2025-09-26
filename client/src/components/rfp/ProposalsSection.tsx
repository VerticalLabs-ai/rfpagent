import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface Proposal {
  id: string;
  rfpId: string;
  status: 'draft' | 'review' | 'submitted' | 'won' | 'lost';
  content: string;
  narratives?: string;
  pricingTables?: string;
  estimatedMargin?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProposalsSectionProps {
  rfpId: string;
}

export function ProposalsSection({ rfpId }: ProposalsSectionProps) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const { toast } = useToast();

  const { data: proposals = [], isLoading, error } = useQuery<Proposal[]>({
    queryKey: ['/api/proposals/rfp', rfpId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/proposals/rfp/${rfpId}`);
        if (!response.ok) {
          if (response.status === 404) {
            return []; // No proposals found, return empty array
          }
          // For other errors, still return empty array to avoid showing error state
          console.warn('Failed to fetch proposals:', response.status, response.statusText);
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('Error fetching proposals:', err);
        return []; // Return empty array instead of throwing
      }
    },
    enabled: !!rfpId,
    // Disable retries to avoid spam
    retry: false,
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete proposal');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Proposal Deleted",
        description: "The proposal has been deleted successfully.",
      });
      // Invalidate and refetch proposals
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', rfpId] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteProposal = (proposalId: string, proposalIndex: number) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Proposal #${proposalIndex + 1}?\n\nThis action cannot be undone and will permanently remove:\n• All proposal content and narratives\n• Pricing tables and analysis\n• Compliance documentation\n• All related data`
    );
    if (confirmed) {
      deleteProposalMutation.mutate(proposalId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'review':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'draft':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'won':
        return <CheckCircle className="w-4 h-4 text-green-700" />;
      case 'lost':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800';
      case 'review':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'won':
        return 'bg-green-100 text-green-900';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const parseContent = (contentString: string) => {
    try {
      return JSON.parse(contentString);
    } catch {
      return { text: contentString };
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';

    // Try different date parsing strategies
    let date: Date;

    // First try direct parsing
    date = new Date(dateString);

    // If that fails, try ISO string parsing
    if (isNaN(date.getTime())) {
      const isoString = dateString.includes('T') ? dateString : `${dateString}T00:00:00.000Z`;
      date = new Date(isoString);
    }

    // If still invalid, try timestamp parsing
    if (isNaN(date.getTime()) && !isNaN(Number(dateString))) {
      date = new Date(Number(dateString));
    }

    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString, 'Type:', typeof dateString);
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generated Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading proposals...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Remove error state since we handle errors gracefully by returning empty arrays

  if (proposals.length === 0) {
    // Don't render the section at all if there are no proposals
    // This avoids showing an empty state when no generation has been attempted
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Generated Proposals
          <Badge variant="secondary" className="ml-auto">
            {proposals.length} {proposals.length === 1 ? 'Proposal' : 'Proposals'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {proposals.map((proposal, index) => {
            const content = parseContent(proposal.content);
            const narratives = proposal.narratives ? parseContent(proposal.narratives) : null;
            const pricing = proposal.pricingTables ? parseContent(proposal.pricingTables) : null;

            return (
              <div key={proposal.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(proposal.status)}
                    <span className="font-medium">
                      Proposal #{index + 1}
                    </span>
                    <Badge className={getStatusColor(proposal.status)}>
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(proposal.createdAt)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {proposal.estimatedMargin && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span>Margin: {proposal.estimatedMargin}%</span>
                    </div>
                  )}

                  {content.executiveSummary && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Executive Summary</span>
                    </div>
                  )}

                  {pricing && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-purple-600" />
                      <span>Pricing Tables</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProposal(proposal)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>
                          Proposal #{index + 1} - {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-6">
                          {/* Debug Info */}
                          <div className="text-xs text-muted-foreground bg-gray-100 p-2 rounded">
                            <div>Debug Info:</div>
                            <div>• Content keys: {Object.keys(content).join(', ') || 'No content keys'}</div>
                            <div>• Content type: {typeof proposal.content}</div>
                            <div>• Content length: {proposal.content?.length || 0}</div>
                            <div>• Narratives: {proposal.narratives ? 'Present' : 'None'}</div>
                            <div>• Pricing: {proposal.pricingTables ? 'Present' : 'None'}</div>
                          </div>

                          {/* Executive Summary */}
                          {content.executiveSummary && (
                            <div>
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Executive Summary
                              </h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {content.executiveSummary}
                              </div>
                            </div>
                          )}

                          {/* Technical Approach */}
                          {content.technicalApproach && (
                            <div>
                              <h3 className="font-semibold mb-2">Technical Approach</h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {content.technicalApproach}
                              </div>
                            </div>
                          )}

                          {/* Company Qualifications */}
                          {content.qualifications && (
                            <div>
                              <h3 className="font-semibold mb-2">Company Qualifications</h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {content.qualifications}
                              </div>
                            </div>
                          )}

                          {/* Project Timeline */}
                          {content.timeline && (
                            <div>
                              <h3 className="font-semibold mb-2">Project Timeline</h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {content.timeline}
                              </div>
                            </div>
                          )}

                          {/* Team Structure */}
                          {content.teamStructure && (
                            <div>
                              <h3 className="font-semibold mb-2">Team Structure</h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {content.teamStructure}
                              </div>
                            </div>
                          )}

                          {/* Risk Management */}
                          {content.riskManagement && (
                            <div>
                              <h3 className="font-semibold mb-2">Risk Management</h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {content.riskManagement}
                              </div>
                            </div>
                          )}

                          {/* Pricing Tables */}
                          {pricing && (
                            <div>
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Pricing Information
                              </h3>
                              <div className="bg-gray-50 p-3 rounded text-sm">
                                {pricing.summary && (
                                  <div className="mb-3">
                                    <p><strong>Total:</strong> ${pricing.summary.total?.toFixed(2) || 'N/A'}</p>
                                    <p><strong>Margin:</strong> {pricing.summary.margin || 'N/A'}%</p>
                                  </div>
                                )}
                                {pricing.lineItems && pricing.lineItems.length > 0 && (
                                  <div>
                                    <p className="font-medium mb-2">Line Items:</p>
                                    <div className="space-y-1">
                                      {pricing.lineItems.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-xs">
                                          <span>{item.description}</span>
                                          <span>${item.total?.toFixed(2) || 'N/A'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Compliance Information */}
                          {narratives && (
                            <div>
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Compliance Analysis
                              </h3>
                              <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                                {JSON.stringify(narratives, null, 2)}
                              </div>
                            </div>
                          )}

                          {/* Fallback content - always show if no structured content */}
                          {!content.executiveSummary && !content.technicalApproach && !content.timeline && !content.qualifications && !narratives && !pricing && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-600" />
                                Raw Proposal Content
                              </h3>
                              <div className="text-sm">
                                <p className="mb-2 text-yellow-700">
                                  The proposal content is available but not in structured format.
                                  This may happen during the initial generation process.
                                </p>
                                <div className="bg-white p-3 rounded border text-xs font-mono max-h-40 overflow-y-auto">
                                  {proposal.content ? (
                                    <pre className="whitespace-pre-wrap">
                                      {typeof proposal.content === 'string'
                                        ? proposal.content
                                        : JSON.stringify(proposal.content, null, 2)
                                      }
                                    </pre>
                                  ) : (
                                    <p className="text-gray-500 italic">No content available</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Emergency fallback - if all content checks fail */}
                          {Object.keys(content).length === 0 && !proposal.content && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                No Content Available
                              </h3>
                              <p className="text-sm text-red-700">
                                This proposal appears to be empty. This might indicate an issue with the generation process.
                              </p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteProposal(proposal.id, index)}
                      disabled={deleteProposalMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}