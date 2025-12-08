import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useApiPost, useApiDelete } from '@/hooks/useApiMutation';
import { PageLoading, LoadingButton } from '@/components/ui/loading-states';
import { SubmissionMaterialsDialog } from '@/components/SubmissionMaterialsDialog';
import { ProposalGenerationProgress } from '@/components/ProposalGenerationProgress';
import { ProposalWizard } from '@/components/proposal-wizard/ProposalWizard';
import { LoadingCards } from '@/components/shared';
import { AgentWorkPanel } from '@/components/agents/AgentWorkPanel';
import {
  RFPHeader,
  RFPOverview,
  RFPDocuments,
  RequirementsList,
  ComplianceChecklist,
  RiskFlags,
  RFPSidebar,
  ProposalsSection,
} from '@/components/rfp';
import type { RFP, Document } from '@shared/schema';

export default function RFPDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const [isDownloadingDocs, setIsDownloadingDocs] = useState(false);
  const [submissionMaterialsOpen, setSubmissionMaterialsOpen] = useState(false);
  const [proposalGenerationActive, setProposalGenerationActive] =
    useState(false);
  const [proposalSessionId, setProposalSessionId] = useState<string>('');
  const [wizardOpen, setWizardOpen] = useState(false);

  const {
    data: rfp,
    isLoading,
    error,
  } = useQuery<RFP>({
    queryKey: ['/api/rfps', id],
    enabled: !!id,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<
    Document[]
  >({
    queryKey: ['/api/rfps', id, 'documents'],
    queryFn: async () => {
      const response = await fetch(`/api/rfps/${id}/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!id,
  });

  const rescrapeMutation = useApiPost<any, { url?: string; userNotes?: string }>(
    `/api/rfps/${id}/rescrape`,
    {
      invalidateQueries: ['/api/rfps', `/api/rfps/${id}`, `/api/rfps/${id}/documents`],
      successMessage: 'RFP re-scraped successfully!',
      errorTitle: 'Re-scraping Failed',
      onSuccess: (data) => {
        toast({
          title: 'Re-scraping Complete',
          description: `RFP re-scraped successfully! ${data?.documentsFound || 0} documents were captured.`,
        });
      },
    }
  );

  const downloadDocumentsMutation = useApiPost<any, { documentNames: string[] }>(
    `/api/rfps/${id}/download-documents`,
    {
      invalidateQueries: [`/api/rfps/${id}/documents`],
      successMessage: 'Documents downloaded successfully!',
      errorTitle: 'Download Failed',
      onSuccess: (data) => {
        toast({
          title: 'Download Complete',
          description: `Successfully downloaded ${data?.documentsDownloaded || 0} documents.`,
        });
        setIsDownloadingDocs(false);
      },
      onError: () => {
        setIsDownloadingDocs(false);
      },
    }
  );

  const deleteRFPMutation = useApiDelete<void>(
    `/api/rfps/${id}`,
    {
      successMessage: 'The RFP has been deleted successfully.',
      errorTitle: 'Delete Failed',
      onSuccess: () => {
        // Navigate back to RFPs list
        window.location.href = '/rfps';
      },
    }
  );

  const generateProposalMutation = useMutation({
    mutationFn: async () => {
      // Get the first available company profile
      const profilesResponse = await fetch('/api/company/profiles');
      const profiles = await profilesResponse.json();

      if (!profiles || profiles.length === 0) {
        throw new Error(
          'No company profiles found. Please create a company profile first.'
        );
      }

      const companyProfileId = profiles[0].id;
      console.log(`Using company profile: ${companyProfileId}`);

      return apiRequest('POST', `/api/proposals/enhanced/generate`, {
        rfpId: id,
        companyProfileId,
        options: {},
      });
    },
    onMutate: () => {
      // Start progress tracking immediately when mutation starts
      const immediateSessionId = `session_${Date.now()}`;
      console.log(
        'Starting proposal generation with session:',
        immediateSessionId
      );
      setProposalSessionId(immediateSessionId);
      setProposalGenerationActive(true);
    },
    onSuccess: (data: any) => {
      console.log('Proposal generation response:', data);
      const sessionId = data?.sessionId || proposalSessionId;

      console.log('Updating progress state with real session:', {
        sessionId,
        active: true,
      });

      // Update with actual session ID if provided
      if (data?.sessionId && data.sessionId !== proposalSessionId) {
        setProposalSessionId(data.sessionId);
      }

      toast({
        title: 'Proposal Generation Started',
        description: `AI agents are now processing your RFP. Session ID: ${sessionId}`,
      });
    },
    onError: (error: any) => {
      console.log('Proposal generation error:', error);
      // Reset progress state on error
      setProposalGenerationActive(false);
      setProposalSessionId('');

      toast({
        title: 'Proposal Generation Failed',
        description:
          error?.message ||
          'Failed to start proposal generation. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteRFP = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this RFP?\n\n"${rfp?.title}"\n\nThis action cannot be undone and will also delete:\n• All downloaded documents\n• Generated proposals\n• Submission history\n• All related data`
    );
    if (confirmed) {
      deleteRFPMutation.execute();
    }
  };

  const handleDownloadDocs = () => {
    const extractedDocNames = (() => {
      if (
        typeof rfp?.requirements === 'object' &&
        rfp.requirements &&
        'documents' in rfp.requirements
      ) {
        const docs = rfp.requirements.documents;
        if (Array.isArray(docs)) {
          return docs
            .map((doc: any) =>
              typeof doc === 'string' ? doc : doc.name || doc.title || ''
            )
            .filter(Boolean);
        }
      }
      return [];
    })();
    setIsDownloadingDocs(true);
    downloadDocumentsMutation.execute({ documentNames: extractedDocNames });
  };

  const handleRescrape = () => {
    rescrapeMutation.execute({
      url: rfp?.sourceUrl,
      userNotes:
        'Re-scraping with enhanced Mastra/Browserbase system to capture documents',
    });
  };

  const handleGenerateProposal = () => {
    generateProposalMutation.mutate();
  };

  const handleProgressComplete = () => {
    setProposalGenerationActive(false);
    toast({
      title: 'Proposal Generated Successfully!',
      description: 'Your proposal is now ready for review.',
    });
    // Refresh data to show the new proposal
    queryClient.invalidateQueries({ queryKey: ['/api/rfps', id] });
    queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', id] });
  };

  const handleProgressError = (error: string) => {
    setProposalGenerationActive(false);
    toast({
      title: 'Proposal Generation Failed',
      description: error,
      variant: 'destructive',
    });
  };

  if (isLoading) {
    return <PageLoading message="Loading RFP details..." />;
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
  const complianceItems = Array.isArray(rfp.complianceItems)
    ? rfp.complianceItems
    : [];
  const riskFlags = Array.isArray(rfp.riskFlags) ? rfp.riskFlags : [];

  return (
    <div className="container mx-auto px-6 py-8">
      <RFPHeader rfp={rfp} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <RFPOverview rfp={rfp} />

          {/* Proposal Generation Progress */}
          <ProposalGenerationProgress
            sessionId={proposalSessionId}
            isVisible={proposalGenerationActive}
            onComplete={handleProgressComplete}
            onError={handleProgressError}
          />

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
        <div className="space-y-6">
          <RFPSidebar
            rfp={rfp}
            onDeleteRFP={handleDeleteRFP}
            onGenerateMaterials={() => setSubmissionMaterialsOpen(true)}
            onGenerateProposal={handleGenerateProposal}
            onGenerateWithWizard={() => setWizardOpen(true)}
            onRescrape={handleRescrape}
            isDeletePending={deleteRFPMutation.isLoading}
            isGeneratingProposal={generateProposalMutation.isPending}
            isRescrapePending={rescrapeMutation.isLoading}
          />

          {/* Agent Work Panel */}
          {id && <AgentWorkPanel rfpId={id} showCompleted />}
        </div>
      </div>

      {/* Submission Materials Dialog */}
      {id && (
        <SubmissionMaterialsDialog
          rfpId={id}
          open={submissionMaterialsOpen}
          onOpenChange={setSubmissionMaterialsOpen}
          onComplete={materials => {
            console.log('Submission materials completed:', materials);
            queryClient.invalidateQueries({ queryKey: ['/api/rfps', id] });
            // Also invalidate proposals query to show the newly generated proposal
            queryClient.invalidateQueries({
              queryKey: ['/api/proposals/rfp', id],
            });
          }}
        />
      )}

      {/* Proposal Wizard Dialog */}
      <ProposalWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialRfpId={id}
      />
    </div>
  );
}
