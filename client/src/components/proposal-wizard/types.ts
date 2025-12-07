// client/src/components/proposal-wizard/types.ts

export type WizardStep =
  | 'select-rfp'
  | 'analyze-requirements'
  | 'select-requirements'
  | 'section-notes'
  | 'generate'
  | 'preview-edit'
  | 'export';

export interface ExtractedRequirement {
  id: string;
  text: string;
  category: 'mandatory' | 'preferred' | 'optional';
  section: string;
  selected: boolean;
}

export interface ProposalSection {
  id: string;
  name: string;
  displayName: string;
  content: string;
  userNotes: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  canRegenerate: boolean;
}

export interface RFPAttachment {
  id: string;
  filename: string;
  fileType: string;
  selected: boolean;
  extractedText?: string;
}

export interface WizardState {
  currentStep: WizardStep;
  rfpId: string | null;
  rfpTitle: string;
  attachments: RFPAttachment[];
  requirements: ExtractedRequirement[];
  sections: ProposalSection[];
  sessionId: string | null;
  generationProgress: number;
  currentGeneratingSection: string | null;
  error: string | null;
}

export type WizardAction =
  | { type: 'SET_RFP'; payload: { rfpId: string; rfpTitle: string } }
  | { type: 'SET_ATTACHMENTS'; payload: RFPAttachment[] }
  | { type: 'TOGGLE_ATTACHMENT'; payload: string }
  | { type: 'SET_REQUIREMENTS'; payload: ExtractedRequirement[] }
  | { type: 'TOGGLE_REQUIREMENT'; payload: string }
  | { type: 'TOGGLE_ALL_REQUIREMENTS'; payload: boolean }
  | {
      type: 'UPDATE_SECTION_NOTES';
      payload: { sectionId: string; notes: string };
    }
  | {
      type: 'UPDATE_SECTION_CONTENT';
      payload: { sectionId: string; content: string };
    }
  | {
      type: 'SET_SECTION_STATUS';
      payload: { sectionId: string; status: ProposalSection['status'] };
    }
  | {
      type: 'SET_GENERATION_PROGRESS';
      payload: { progress: number; section: string | null };
    }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'GO_TO_STEP'; payload: WizardStep }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

export const WIZARD_STEPS: WizardStep[] = [
  'select-rfp',
  'analyze-requirements',
  'select-requirements',
  'section-notes',
  'generate',
  'preview-edit',
  'export',
];

export const DEFAULT_SECTIONS: Omit<
  ProposalSection,
  'content' | 'userNotes'
>[] = [
  {
    id: 'executiveSummary',
    name: 'executiveSummary',
    displayName: 'Executive Summary',
    status: 'pending',
    canRegenerate: true,
  },
  {
    id: 'companyOverview',
    name: 'companyOverview',
    displayName: 'Company Overview',
    status: 'pending',
    canRegenerate: true,
  },
  {
    id: 'technicalApproach',
    name: 'technicalApproach',
    displayName: 'Technical Approach',
    status: 'pending',
    canRegenerate: true,
  },
  {
    id: 'qualifications',
    name: 'qualifications',
    displayName: 'Qualifications',
    status: 'pending',
    canRegenerate: true,
  },
  {
    id: 'timeline',
    name: 'timeline',
    displayName: 'Project Timeline',
    status: 'pending',
    canRegenerate: true,
  },
  {
    id: 'pricing',
    name: 'pricing',
    displayName: 'Pricing',
    status: 'pending',
    canRegenerate: true,
  },
  {
    id: 'compliance',
    name: 'compliance',
    displayName: 'Compliance Matrix',
    status: 'pending',
    canRegenerate: true,
  },
];
