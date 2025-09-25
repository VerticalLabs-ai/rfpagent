import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SubmissionMaterialsDialog } from "@/components/SubmissionMaterialsDialog";
import { LoadingCards } from "@/components/shared";
import {
  RFPHeader,
  RFPOverview,
  RFPDocuments,
  RequirementsList,
  ComplianceChecklist,
  RiskFlags,
  RFPSidebar,
  ProposalsSection,
} from "@/components/rfp";
import type { RFP, Document } from "@shared/schema";

export default function RFPDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const [isDownloadingDocs, setIsDownloadingDocs] = useState(false);
  const [submissionMaterialsOpen, setSubmissionMaterialsOpen] = useState(false);

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
        description: error?.message || "Failed to re-scrape RFP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const downloadDocumentsMutation = useMutation({
    mutationFn: async (documentNames: string[]) => {
      setIsDownloadingDocs(true);
      return apiRequest('POST', `/api/rfps/${id}/download-documents`, { documentNames });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${data.documentsDownloaded || 0} documents.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rfps', id, 'documents'] });
      setIsDownloadingDocs(false);
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error?.message || "Failed to download documents. Please try again.",
        variant: "destructive",
      });
      setIsDownloadingDocs(false);
    },
  });

  const deleteRFPMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/rfps/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "RFP Deleted",
        description: "The RFP has been deleted successfully.",
      });
      // Navigate back to RFPs list
      window.location.href = '/rfps';
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete RFP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteRFP = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this RFP?\n\n"${rfp?.title}"\n\nThis action cannot be undone and will also delete:\n• All downloaded documents\n• Generated proposals\n• Submission history\n• All related data`
    );
    if (confirmed) {
      deleteRFPMutation.mutate();
    }
  };

  const handleDownloadDocs = () => {
    const extractedDocNames = (() => {
      if (typeof rfp?.requirements === 'object' && rfp.requirements && 'documents' in rfp.requirements) {
        const docs = rfp.requirements.documents;
        if (Array.isArray(docs)) {
          return docs.map((doc: any) =>
            typeof doc === 'string' ? doc : (doc.name || doc.title || '')
          ).filter(Boolean);
        }
      }
      return [];
    })();
    downloadDocumentsMutation.mutate(extractedDocNames);
  };

  const handleRescrape = () => {
    rescrapeMutation.mutate({
      url: rfp?.sourceUrl,
      userNotes: "Re-scraping with enhanced Mastra/Browserbase system to capture documents"
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <LoadingCards count={6} variant="grid" />
      </div>
    );
  }

  if (error || !rfp) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Alert data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load RFP details. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const requirements = Array.isArray(rfp.requirements) ? rfp.requirements : [];
  const complianceItems = Array.isArray(rfp.complianceItems) ? rfp.complianceItems : [];
  const riskFlags = Array.isArray(rfp.riskFlags) ? rfp.riskFlags : [];

  return (
    <div className="container mx-auto px-6 py-8">
      <RFPHeader rfp={rfp} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <RFPOverview rfp={rfp} />

          <RFPDocuments
            rfp={rfp}
            documents={documents}
            isLoading={documentsLoading}
            onDownloadDocs={handleDownloadDocs}
            isDownloading={isDownloadingDocs}
          />

          <RequirementsList requirements={requirements} />

          <ComplianceChecklist complianceItems={complianceItems} />

          <RiskFlags riskFlags={riskFlags} />

          {id && <ProposalsSection rfpId={id} />}
        </div>

        {/* Sidebar */}
        <RFPSidebar
          rfp={rfp}
          onDeleteRFP={handleDeleteRFP}
          onGenerateMaterials={() => setSubmissionMaterialsOpen(true)}
          isDeletePending={deleteRFPMutation.isPending}
        />
      </div>

      {/* Submission Materials Dialog */}
      {id && (
        <SubmissionMaterialsDialog
          rfpId={id}
          open={submissionMaterialsOpen}
          onOpenChange={setSubmissionMaterialsOpen}
          onComplete={(materials) => {
            console.log('Submission materials completed:', materials);
            queryClient.invalidateQueries({ queryKey: ['/api/rfps', id] });
          }}
        />
      )}
    </div>
  );
}