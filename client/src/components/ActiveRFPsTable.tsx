import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ObjectUploader } from "./ObjectUploader";

export default function ActiveRFPsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRfp, setSelectedRfp] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: rfpData, isLoading } = useQuery({
    queryKey: ["/api/rfps", "detailed"],
  });

  const generateProposalMutation = useMutation({
    mutationFn: async (rfpId: string) => {
      return apiRequest("POST", `/api/proposals/${rfpId}/generate`);
    },
    onSuccess: () => {
      toast({
        title: "Proposal Generation Started",
        description: "AI is now generating the proposal. You will be notified when it's ready for review.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to start proposal generation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest("POST", `/api/proposals/${proposalId}/approve`);
    },
    onSuccess: () => {
      toast({
        title: "Proposal Approved",
        description: "The proposal has been approved and is ready for submission.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
    },
    onError: () => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest("POST", `/api/submissions/${proposalId}/submit`);
    },
    onSuccess: () => {
      toast({
        title: "Submission Started",
        description: "The proposal submission process has been initiated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to start the submission process. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rfps = Array.isArray(rfpData) ? rfpData : [];
  const filteredRfps = rfps.filter((item: any) => {
    const matchesSearch = item.rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.rfp.agency.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.rfp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "discovered": return "fas fa-eye";
      case "parsing": return "fas fa-file-search";
      case "drafting": return "fas fa-edit";
      case "review": return "fas fa-clipboard-check";
      case "approved": return "fas fa-check";
      case "submitted": return "fas fa-paper-plane";
      default: return "fas fa-circle";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "discovered": return "Discovered";
      case "parsing": return "Parsing";
      case "drafting": return "AI Drafting";
      case "review": return "Pending Review";
      case "approved": return "Approved";
      case "submitted": return "Submitted";
      default: return status;
    }
  };

  const getProgressFromStatus = (status: string) => {
    // Step-based progress based on actual work completed
    switch (status) {
      case "discovered": return 5;   // Just found, no work done yet
      case "parsing": return 25;     // Analyzing documents
      case "drafting": return 50;    // AI drafting proposal
      case "review": return 75;      // Under review
      case "approved": return 90;    // Approved, ready to submit
      case "submitted": return 100;  // Submitted
      case "closed": return 100;     // Process complete
      default: return 0;            // Unknown status
    }
  };

  const getProgressColor = (status: string, progress: number) => {
    if (status === "submitted") return "bg-green-600";
    if (status === "approved") return "bg-green-500";
    if (status === "review") return "bg-orange-500";
    if (status === "drafting") return "bg-purple-500";
    if (status === "parsing") return "bg-yellow-500";
    return "bg-primary";
  };

  const getDeadlineText = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", color: "text-muted-foreground" };
    
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: "Overdue", color: "text-red-600" };
    if (diffDays <= 7) return { text: `${diffDays} days remaining`, color: "text-red-600" };
    if (diffDays <= 14) return { text: `${diffDays} days remaining`, color: "text-orange-600" };
    return { text: `${diffDays} days remaining`, color: "text-green-600" };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm w-64"
                data-testid="rfp-search-input"
              />
              <i className="fas fa-search absolute left-3 top-3 text-muted-foreground text-xs"></i>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="status-filter-select">
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

            <Dialog>
              <DialogTrigger asChild>
                <Button data-testid="manual-rfp-button">
                  <i className="fas fa-plus mr-2"></i>Manual RFP
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Manual RFP</DialogTitle>
                </DialogHeader>
                <div className="text-center py-8">
                  <i className="fas fa-file-plus text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">Manual RFP entry form would be implemented here</p>
                </div>
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
                const calculatedProgress = getProgressFromStatus(item.rfp.status);
                const progressColor = getProgressColor(item.rfp.status, calculatedProgress);
                
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
                        className={`status-badge status-${item.rfp.status}`}
                        data-testid={`rfp-status-${item.rfp.id}`}
                      >
                        <i className={`${getStatusIcon(item.rfp.status)} mr-1`}></i>
                        {getStatusLabel(item.rfp.status)}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-foreground" data-testid={`rfp-deadline-${item.rfp.id}`}>
                        {item.rfp.deadline ? new Date(item.rfp.deadline).toLocaleDateString() : "Not set"}
                      </div>
                      <div className={`text-xs ${deadline.color}`} data-testid={`rfp-deadline-status-${item.rfp.id}`}>
                        {deadline.text}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-medium text-foreground" data-testid={`rfp-value-${item.rfp.id}`}>
                        {item.rfp.estimatedValue ? `$${parseFloat(item.rfp.estimatedValue).toLocaleString()}` : "Not set"}
                      </div>
                      {item.proposal?.estimatedMargin && (
                        <div className="text-xs text-muted-foreground" data-testid={`rfp-margin-${item.rfp.id}`}>
                          Est. margin: {item.proposal.estimatedMargin}%
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full progress-bar ${progressColor}`}
                          style={{ width: `${calculatedProgress}%` }}
                          data-testid={`rfp-progress-bar-${item.rfp.id}`}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1" data-testid={`rfp-progress-text-${item.rfp.id}`}>
                        {calculatedProgress}% complete
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        {item.rfp.status === "discovered" && (
                          <Button
                            size="sm"
                            onClick={() => generateProposalMutation.mutate(item.rfp.id)}
                            disabled={generateProposalMutation.isPending}
                            data-testid={`generate-proposal-${item.rfp.id}`}
                          >
                            <i className="fas fa-robot mr-1"></i>
                            Generate
                          </Button>
                        )}
                        
                        {item.rfp.status === "parsing" && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            disabled
                            data-testid={`processing-${item.rfp.id}`}
                          >
                            Processing...
                          </Button>
                        )}
                        
                        {item.rfp.status === "drafting" && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            disabled
                            data-testid={`ai-drafting-${item.rfp.id}`}
                          >
                            AI Drafting...
                          </Button>
                        )}
                        
                        {item.rfp.status === "review" && item.proposal && (
                          <Button
                            size="sm"
                            onClick={() => approveProposalMutation.mutate(item.proposal.id)}
                            disabled={approveProposalMutation.isPending}
                            data-testid={`approve-proposal-${item.rfp.id}`}
                          >
                            <i className="fas fa-check mr-1"></i>
                            Approve
                          </Button>
                        )}
                        
                        {item.rfp.status === "approved" && item.proposal && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => submitProposalMutation.mutate(item.proposal.id)}
                            disabled={submitProposalMutation.isPending}
                            data-testid={`submit-proposal-${item.rfp.id}`}
                          >
                            <i className="fas fa-paper-plane mr-1"></i>
                            Submit Now
                          </Button>
                        )}
                        
                        {item.rfp.status === "submitted" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            data-testid={`view-submission-${item.rfp.id}`}
                          >
                            <i className="fas fa-receipt mr-1"></i>
                            View Submission
                          </Button>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`view-details-${item.rfp.id}`}
                            >
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>{item.rfp.title}</DialogTitle>
                            </DialogHeader>
                            <RFPDetailsModal rfp={item.rfp} proposal={item.proposal} portal={item.portal} />
                          </DialogContent>
                        </Dialog>
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
            <h3 className="text-lg font-semibold text-foreground mb-2">No RFPs Found</h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all" 
                ? "Try adjusting your search criteria" 
                : "No RFPs have been discovered yet"}
            </p>
          </div>
        )}
        
        {/* Table Pagination */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground" data-testid="table-pagination-info">
            Showing {Math.min(filteredRfps.length, 10)} of {filteredRfps.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled data-testid="pagination-previous">
              Previous
            </Button>
            <Button size="sm" data-testid="pagination-current">1</Button>
            <Button variant="outline" size="sm" disabled data-testid="pagination-next">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RFPDetailsModal({ rfp, proposal, portal }: any) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", `/api/rfps/${rfp.id}/documents/upload`);
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      
      await apiRequest("POST", `/api/rfps/${rfp.id}/documents`, {
        documentURL: uploadedFile.uploadURL,
        filename: uploadedFile.name,
        fileType: uploadedFile.type || 'application/octet-stream'
      });

      toast({
        title: "Document Uploaded",
        description: "The document has been uploaded and will be processed shortly.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/rfps"] });
      setUploadDialogOpen(false);
    }
  };

  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Agency</label>
            <p className="mt-1" data-testid="modal-rfp-agency">{rfp.agency}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Source Portal</label>
            <p className="mt-1" data-testid="modal-rfp-portal">{portal?.name || "Unknown"}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Discovered</label>
            <p className="mt-1" data-testid="modal-rfp-discovered">
              {new Date(rfp.discoveredAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Estimated Value</label>
            <p className="mt-1" data-testid="modal-rfp-value">
              {rfp.estimatedValue ? `$${parseFloat(rfp.estimatedValue).toLocaleString()}` : "Not specified"}
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Deadline</label>
            <p className="mt-1" data-testid="modal-rfp-deadline">
              {rfp.deadline ? new Date(rfp.deadline).toLocaleDateString() : "Not specified"}
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <div className="mt-1">
              <Badge className={`status-badge status-${rfp.status}`} data-testid="modal-rfp-status">
                {rfp.status.charAt(0).toUpperCase() + rfp.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {rfp.description && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">Description</label>
          <p className="mt-1 text-sm" data-testid="modal-rfp-description">{rfp.description}</p>
        </div>
      )}

      {rfp.riskFlags && rfp.riskFlags.length > 0 && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">Risk Flags</label>
          <div className="mt-2 space-y-2">
            {rfp.riskFlags.slice(0, 3).map((flag: any, index: number) => (
              <div 
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  flag.type === "high" ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300" :
                  flag.type === "medium" ? "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950 dark:text-orange-300" :
                  "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300"
                }`}
                data-testid={`modal-risk-flag-${index}`}
              >
                <strong>{flag.category}:</strong> {flag.description}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-muted-foreground">Documents</label>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="upload-document-button">
                <i className="fas fa-upload mr-2"></i>
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload RFP Document</DialogTitle>
              </DialogHeader>
              <ObjectUploader
                maxNumberOfFiles={5}
                maxFileSize={50 * 1024 * 1024} // 50MB
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
              >
                <div className="flex items-center gap-2">
                  <i className="fas fa-upload"></i>
                  <span>Select Files to Upload</span>
                </div>
              </ObjectUploader>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="text-center py-6 text-muted-foreground">
          <i className="fas fa-file-alt text-2xl mb-2"></i>
          <p className="text-sm">Document list would be displayed here</p>
        </div>
      </div>
    </div>
  );
}
