import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink
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

  const { data: proposals = [], isLoading, error } = useQuery<Proposal[]>({
    queryKey: ['/api/proposals', rfpId],
    queryFn: async () => {
      const response = await fetch(`/api/proposals/${rfpId}`);
      if (!response.ok) throw new Error('Failed to fetch proposals');
      return response.json();
    },
    enabled: !!rfpId,
  });

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
    return new Date(dateString).toLocaleDateString('en-US', {
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generated Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load proposals. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (proposals.length === 0) {
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
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No proposals generated yet.</p>
            <p className="text-sm mt-1">Click "Generate Submission Materials" to create your first proposal.</p>
          </div>
        </CardContent>
      </Card>
    );
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