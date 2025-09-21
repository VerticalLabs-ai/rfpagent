import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, ExternalLink, Download, FileText, Clock, DollarSign, Building, AlertTriangle, CheckCircle2, Loader2, Paperclip, CheckSquare, FileQuestion, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RFP, Document } from "@shared/schema";

export default function RFPDetails() {
  const { id } = useParams();
  const { toast } = useToast();

  const getProgressFromStatus = (status: string) => {
    // Step-based progress based on actual work completed
    switch (status) {
      case "discovered": return 0;   // Just found, no work done yet
      case "parsing": return 25;     // Analyzing documents
      case "drafting": return 50;    // AI drafting proposal
      case "review": return 75;      // Under review
      case "approved": return 90;    // Approved, ready to submit
      case "submitted": return 100;  // Submitted
      case "closed": return 100;     // Process complete
      default: return 0;            // Unknown status
    }
  };

  const { data: rfp, isLoading, error } = useQuery<RFP>({
    queryKey: ['/api/rfps', id],
    enabled: !!id,
  });
  
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/rfps', id, 'documents'],
    queryFn: async () => {
      const response = await fetch(`/api/rfps/${id}/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!id,
  });

  const generateMaterialsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/proposals/${id}/generate`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Submission materials generated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps', id] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate submission materials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rescrapeMutation = useMutation({
    mutationFn: async (data: { url?: string; userNotes?: string }) => {
      return apiRequest('POST', `/api/rfps/${id}/rescrape`, data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Re-scraping Complete",
        description: `RFP re-scraped successfully! ${data.documentsFound || 0} documents were captured.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps', id, 'documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Re-scraping Failed",
        description: error?.message || "Failed to re-scrape the RFP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteRFPMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/rfps/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "RFP Deleted",
        description: "RFP and all related data have been successfully deleted.",
      });
      // Navigate back to proposals list after successful deletion
      window.location.href = '/proposals';
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete the RFP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteRFP = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this RFP?\n\n"${rfp.title}"\n\nThis action cannot be undone and will also delete:\n• All downloaded documents\n• Generated proposals\n• Submission history\n• All related data`
    );
    if (confirmed) {
      deleteRFPMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/proposals">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Proposals
            </Button>
          </Link>
        </div>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !rfp) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/proposals">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Proposals
            </Button>
          </Link>
        </div>
        <Alert data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load RFP details. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "discovered": return "bg-blue-500";
      case "parsing": return "bg-yellow-500";
      case "drafting": return "bg-orange-500";
      case "review": return "bg-purple-500";
      case "approved": return "bg-green-500";
      case "submitted": return "bg-gray-500";
      case "closed": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "discovered": return "Discovered";
      case "parsing": return "Parsing";
      case "drafting": return "Drafting";
      case "review": return "Under Review";
      case "approved": return "Approved";
      case "submitted": return "Submitted";
      case "closed": return "Closed";
      default: return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysUntilDeadline = (deadline: string | Date | null | undefined) => {
    if (!deadline) return 0;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const requirements = Array.isArray(rfp.requirements) ? rfp.requirements : [];
  const complianceItems = Array.isArray(rfp.complianceItems) ? rfp.complianceItems : [];
  const riskFlags = Array.isArray(rfp.riskFlags) ? rfp.riskFlags : [];

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/proposals">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Proposals
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-rfp-title">
              {rfp.title}
            </h1>
            <p className="text-muted-foreground" data-testid="text-rfp-agency">
              {rfp.agency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            className={`${getStatusColor(rfp.status)} text-white`}
            data-testid="badge-status"
          >
            {getStatusLabel(rfp.status)}
          </Badge>
          <Button 
            onClick={() => window.open(rfp.sourceUrl, '_blank', 'noopener,noreferrer')}
            variant="outline"
            data-testid="button-view-original"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Original RFP
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card data-testid="card-overview">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rfp.description && (
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground" data-testid="text-description">
                    {rfp.description}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rfp.deadline && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Deadline</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-deadline">
                        {formatDate(rfp.deadline)}
                      </p>
                      {(() => {
                        const days = getDaysUntilDeadline(rfp.deadline);
                        return (
                          <p className={`text-xs ${days <= 7 ? 'text-red-600' : days <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {days > 0 ? `${days} days remaining` : `${Math.abs(days)} days overdue`}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                )}
                
                {rfp.estimatedValue && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Estimated Value</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-estimated-value">
                        {formatCurrency(parseFloat(rfp.estimatedValue))}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Agency</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-agency">
                      {rfp.agency}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Progress</p>
                    <div className="flex items-center gap-2">
                      <Progress value={getProgressFromStatus(rfp.status)} className="w-20" />
                      <span className="text-sm text-muted-foreground" data-testid="text-progress">
                        {getProgressFromStatus(rfp.status)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional RFP Details */}
              {rfp.requirements && typeof rfp.requirements === 'object' && !Array.isArray(rfp.requirements) && (
                <div className="border-t pt-4 space-y-4">
                  {rfp.requirements.solicitation_number && (
                    <div>
                      <p className="text-sm font-medium mb-1">Solicitation Number</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-solicitation-number">
                        {rfp.requirements.solicitation_number}
                      </p>
                    </div>
                  )}
                  
                  {rfp.requirements.contact && (
                    <div>
                      <p className="text-sm font-medium mb-1">Contact Information</p>
                      <div className="space-y-1" data-testid="text-contact-info">
                        {rfp.requirements.contact.name && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Name:</span> {rfp.requirements.contact.name}
                          </p>
                        )}
                        {rfp.requirements.contact.email && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Email:</span> {rfp.requirements.contact.email}
                          </p>
                        )}
                        {rfp.requirements.contact.phone && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Phone:</span> {rfp.requirements.contact.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {rfp.requirements.pre_bid_meeting && (
                    <div>
                      <p className="text-sm font-medium mb-1">Pre-bid Meeting</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-pre-bid-meeting">
                        {rfp.requirements.pre_bid_meeting}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Downloaded Documents */}
          <Card data-testid="card-documents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                RFP Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                </div>
              ) : documents.length > 0 ? (
                <div className="space-y-4">
                  {/* Fillable Documents */}
                  {documents.filter(doc => (doc.parsedData as any)?.needsFillOut).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-orange-500" />
                        Forms to Complete
                      </h4>
                      <div className="space-y-2">
                        {documents
                          .filter(doc => (doc.parsedData as any)?.needsFillOut)
                          .map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/20 rounded" data-testid={`fillable-doc-${doc.id}`}>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-orange-500" />
                                <div>
                                  <p className="text-sm font-medium">{doc.filename}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.fileType.toUpperCase()} • {(doc.parsedData as any)?.category || 'Document'}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-orange-600">
                                Needs Completion
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Reference Documents */}
                  {documents.filter(doc => !(doc.parsedData as any)?.needsFillOut).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <FileQuestion className="w-4 h-4 text-blue-500" />
                        Reference Documents
                      </h4>
                      <div className="space-y-2">
                        {documents
                          .filter(doc => !(doc.parsedData as any)?.needsFillOut)
                          .map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded" data-testid={`reference-doc-${doc.id}`}>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm">{doc.filename}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.fileType.toUpperCase()} • {(doc.parsedData as any)?.category || 'Document'}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="secondary">
                                Reference
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    No documents have been downloaded for this RFP yet. Documents will be automatically captured during the next portal scan.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Requirements */}
          {requirements.length > 0 && (
            <Card data-testid="card-requirements">
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {requirements.map((requirement, index) => (
                    <li key={index} className="flex items-start gap-2" data-testid={`requirement-${index}`}>
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{requirement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Compliance Items */}
          {complianceItems.length > 0 && (
            <Card data-testid="card-compliance">
              <CardHeader>
                <CardTitle>Compliance Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {complianceItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-2" data-testid={`compliance-${index}`}>
                      <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Risk Flags */}
          {riskFlags.length > 0 && (
            <Card data-testid="card-risks">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Risk Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {riskFlags.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2" data-testid={`risk-${index}`}>
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card data-testid="card-actions">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => generateMaterialsMutation.mutate()}
                disabled={generateMaterialsMutation.isPending}
                className="w-full"
                data-testid="button-generate-materials"
              >
                {generateMaterialsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Generate Submission Materials
              </Button>
              
              <Button
                variant="secondary"
                onClick={() => rescrapeMutation.mutate({ 
                  url: rfp.sourceUrl, // Use the existing RFP's source URL
                  userNotes: "Re-scraping with enhanced Mastra/Browserbase system to capture documents"
                })}
                disabled={rescrapeMutation.isPending}
                className="w-full"
                data-testid="button-rescrape"
              >
                {rescrapeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Re-scrape RFP
              </Button>
              
              <Button
                variant="outline"
                onClick={() => window.open(rfp.sourceUrl, '_blank', 'noopener,noreferrer')}
                className="w-full"
                data-testid="button-open-portal"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Portal
              </Button>
              
              <Button
                variant="destructive"
                onClick={handleDeleteRFP}
                disabled={deleteRFPMutation.isPending}
                className="w-full"
                data-testid="button-delete-rfp"
              >
                {deleteRFPMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete RFP
              </Button>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card data-testid="card-metadata">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Discovered</p>
                <p className="text-sm text-muted-foreground" data-testid="text-discovered-at">
                  {formatDate(rfp.discoveredAt)}
                </p>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm font-medium">Last Updated</p>
                <p className="text-sm text-muted-foreground" data-testid="text-updated-at">
                  {formatDate(rfp.updatedAt)}
                </p>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm font-medium">Source URL</p>
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm"
                  onClick={() => window.open(rfp.sourceUrl, '_blank')}
                  data-testid="link-source-url"
                >
                  View Original Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}