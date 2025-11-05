/**
 * Type definitions for Unified Proposal Hub
 */

export interface Proposal {
  id: string;
  rfpId: string;
  status: 'draft' | 'review' | 'submitted' | 'won' | 'lost';
  content: string | ProposalContent;
  narratives?: string;
  pricingTables?: string;
  estimatedMargin?: string;
  createdAt?: string;
  generatedAt?: string;
  updatedAt?: string;
}

export interface ProposalContent {
  executiveSummary?: string;
  technicalApproach?: string;
  qualifications?: string;
  timeline?: string;
  teamStructure?: string;
  riskManagement?: string;
  companyOverview?: string;
  approach?: string;
  [key: string]: string | undefined;
}

export interface GenerationProgress {
  sessionId: string;
  currentStep: string;
  overallProgress: number;
  steps: ProgressStep[];
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

export interface ProgressStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
  startTime?: number;
  endTime?: number;
}

export type ViewMode = 'empty' | 'generating' | 'list' | 'detail';

export interface ProposalHubState {
  // Proposals
  proposals: Proposal[];
  selectedProposal: Proposal | null;

  // Generation
  isGenerating: boolean;
  sessionId: string | null;
  progress: GenerationProgress | null;

  // UI State
  viewMode: ViewMode;
  expandedProposalId: string | null;

  // Editing
  editingSection: string | null;
  editContent: string;
}

export const GENERATION_STEPS: ProgressStep[] = [
  {
    id: 'init',
    name: 'Initializing',
    description: 'Setting up proposal generation',
    status: 'pending',
  },
  {
    id: 'analysis',
    name: 'Document Analysis',
    description: 'Analyzing RFP requirements with AI agents',
    status: 'pending',
  },
  {
    id: 'proposal_manager',
    name: 'Proposal Planning',
    description: 'Planning proposal structure and approach',
    status: 'pending',
  },
  {
    id: 'content_generator',
    name: 'Content Generation',
    description: 'Generating proposal content with Mastra agents',
    status: 'pending',
  },
  {
    id: 'compliance_checker',
    name: 'Compliance Check',
    description: 'Ensuring proposal meets all requirements',
    status: 'pending',
  },
  {
    id: 'finalization',
    name: 'Finalizing',
    description: 'Completing proposal generation',
    status: 'pending',
  },
];
