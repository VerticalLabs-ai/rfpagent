# Proposal Generation Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current one-click proposal generation with a step-by-step wizard that gives users control over RFP analysis, requirement selection, custom input, and section-by-section generation with real-time progress and export capabilities.

**Architecture:** A 7-step wizard component using React state machine pattern, backed by new API endpoints for incremental generation. Each wizard step is a standalone component that communicates via shared context. SSE streams provide real-time progress during AI generation phases. Export uses pdf-lib (already installed) for PDF and docx library for Word.

**Tech Stack:** React 18, TypeScript, shadcn/ui (Dialog, Tabs, Progress, Checkbox, Textarea), TanStack Query, SSE via EventSource, pdf-lib, docx

---

## Task 1: Create Wizard Types and State Management

**Files:**
- Create: `client/src/components/proposal-wizard/types.ts`
- Create: `client/src/components/proposal-wizard/context.tsx`

**Step 1: Write the types file**

```typescript
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
  | { type: 'UPDATE_SECTION_NOTES'; payload: { sectionId: string; notes: string } }
  | { type: 'UPDATE_SECTION_CONTENT'; payload: { sectionId: string; content: string } }
  | { type: 'SET_SECTION_STATUS'; payload: { sectionId: string; status: ProposalSection['status'] } }
  | { type: 'SET_GENERATION_PROGRESS'; payload: { progress: number; section: string | null } }
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

export const DEFAULT_SECTIONS: Omit<ProposalSection, 'content' | 'userNotes'>[] = [
  { id: 'executiveSummary', name: 'executiveSummary', displayName: 'Executive Summary', status: 'pending', canRegenerate: true },
  { id: 'companyOverview', name: 'companyOverview', displayName: 'Company Overview', status: 'pending', canRegenerate: true },
  { id: 'technicalApproach', name: 'technicalApproach', displayName: 'Technical Approach', status: 'pending', canRegenerate: true },
  { id: 'qualifications', name: 'qualifications', displayName: 'Qualifications', status: 'pending', canRegenerate: true },
  { id: 'timeline', name: 'timeline', displayName: 'Project Timeline', status: 'pending', canRegenerate: true },
  { id: 'pricing', name: 'pricing', displayName: 'Pricing', status: 'pending', canRegenerate: true },
  { id: 'compliance', name: 'compliance', displayName: 'Compliance Matrix', status: 'pending', canRegenerate: true },
];
```

**Step 2: Write the context file with reducer**

```typescript
// client/src/components/proposal-wizard/context.tsx

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import {
  type WizardState,
  type WizardAction,
  WIZARD_STEPS,
  DEFAULT_SECTIONS,
} from './types';

const initialState: WizardState = {
  currentStep: 'select-rfp',
  rfpId: null,
  rfpTitle: '',
  attachments: [],
  requirements: [],
  sections: DEFAULT_SECTIONS.map(s => ({ ...s, content: '', userNotes: '' })),
  sessionId: null,
  generationProgress: 0,
  currentGeneratingSection: null,
  error: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_RFP':
      return { ...state, rfpId: action.payload.rfpId, rfpTitle: action.payload.rfpTitle };
    case 'SET_ATTACHMENTS':
      return { ...state, attachments: action.payload };
    case 'TOGGLE_ATTACHMENT':
      return {
        ...state,
        attachments: state.attachments.map(a =>
          a.id === action.payload ? { ...a, selected: !a.selected } : a
        ),
      };
    case 'SET_REQUIREMENTS':
      return { ...state, requirements: action.payload };
    case 'TOGGLE_REQUIREMENT':
      return {
        ...state,
        requirements: state.requirements.map(r =>
          r.id === action.payload ? { ...r, selected: !r.selected } : r
        ),
      };
    case 'TOGGLE_ALL_REQUIREMENTS':
      return {
        ...state,
        requirements: state.requirements.map(r => ({ ...r, selected: action.payload })),
      };
    case 'UPDATE_SECTION_NOTES':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId ? { ...s, userNotes: action.payload.notes } : s
        ),
      };
    case 'UPDATE_SECTION_CONTENT':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId ? { ...s, content: action.payload.content } : s
        ),
      };
    case 'SET_SECTION_STATUS':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId ? { ...s, status: action.payload.status } : s
        ),
      };
    case 'SET_GENERATION_PROGRESS':
      return {
        ...state,
        generationProgress: action.payload.progress,
        currentGeneratingSection: action.payload.section,
      };
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload };
    case 'NEXT_STEP': {
      const currentIndex = WIZARD_STEPS.indexOf(state.currentStep);
      if (currentIndex < WIZARD_STEPS.length - 1) {
        return { ...state, currentStep: WIZARD_STEPS[currentIndex + 1] };
      }
      return state;
    }
    case 'PREV_STEP': {
      const currentIndex = WIZARD_STEPS.indexOf(state.currentStep);
      if (currentIndex > 0) {
        return { ...state, currentStep: WIZARD_STEPS[currentIndex - 1] };
      }
      return state;
    }
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
```

**Step 3: Commit**

```bash
git add client/src/components/proposal-wizard/types.ts client/src/components/proposal-wizard/context.tsx
git commit -m "feat(wizard): add types and context for proposal wizard state management"
```

---

## Task 2: Create Wizard Shell and Step Indicator

**Files:**
- Create: `client/src/components/proposal-wizard/ProposalWizard.tsx`
- Create: `client/src/components/proposal-wizard/StepIndicator.tsx`
- Create: `client/src/components/proposal-wizard/index.ts`

**Step 1: Write the StepIndicator component**

```typescript
// client/src/components/proposal-wizard/StepIndicator.tsx

import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type WizardStep } from './types';

const STEP_LABELS: Record<WizardStep, string> = {
  'select-rfp': 'Select RFP',
  'analyze-requirements': 'Analyze',
  'select-requirements': 'Requirements',
  'section-notes': 'Notes',
  'generate': 'Generate',
  'preview-edit': 'Preview',
  'export': 'Export',
};

interface StepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between w-full px-4 py-3 border-b">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isClickable = index < currentIndex && onStepClick;

        return (
          <div key={step} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded-md transition-colors',
                isClickable && 'hover:bg-accent cursor-pointer',
                !isClickable && 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && 'bg-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-sm hidden sm:inline',
                  isCurrent && 'font-medium text-foreground',
                  !isCurrent && 'text-muted-foreground'
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-1',
                  index < currentIndex ? 'bg-green-500' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Write the main ProposalWizard shell component**

```typescript
// client/src/components/proposal-wizard/ProposalWizard.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { WizardProvider, useWizard } from './context';
import { StepIndicator } from './StepIndicator';
import type { WizardStep } from './types';

// Step components will be imported here
// import { SelectRFPStep } from './steps/SelectRFPStep';
// etc.

interface ProposalWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRfpId?: string;
}

function WizardContent({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useWizard();

  const handleStepClick = (step: WizardStep) => {
    dispatch({ type: 'GO_TO_STEP', payload: step });
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 'select-rfp':
        return <div className="p-6 text-center text-muted-foreground">Step 1: Select RFP (placeholder)</div>;
      case 'analyze-requirements':
        return <div className="p-6 text-center text-muted-foreground">Step 2: Analyze Requirements (placeholder)</div>;
      case 'select-requirements':
        return <div className="p-6 text-center text-muted-foreground">Step 3: Select Requirements (placeholder)</div>;
      case 'section-notes':
        return <div className="p-6 text-center text-muted-foreground">Step 4: Section Notes (placeholder)</div>;
      case 'generate':
        return <div className="p-6 text-center text-muted-foreground">Step 5: Generate (placeholder)</div>;
      case 'preview-edit':
        return <div className="p-6 text-center text-muted-foreground">Step 6: Preview & Edit (placeholder)</div>;
      case 'export':
        return <div className="p-6 text-center text-muted-foreground">Step 7: Export (placeholder)</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      <StepIndicator currentStep={state.currentStep} onStepClick={handleStepClick} />

      <div className="flex-1 overflow-auto">
        {renderStep()}
      </div>

      {state.error && (
        <div className="px-6 py-3 bg-destructive/10 border-t border-destructive/20">
          <p className="text-sm text-destructive">{state.error}</p>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
        <Button
          variant="outline"
          onClick={() => dispatch({ type: 'PREV_STEP' })}
          disabled={state.currentStep === 'select-rfp'}
        >
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {state.currentStep !== 'export' && (
            <Button onClick={() => dispatch({ type: 'NEXT_STEP' })}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProposalWizard({ open, onOpenChange, initialRfpId }: ProposalWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Generate Proposal</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <WizardProvider>
          <WizardContent onClose={() => onOpenChange(false)} />
        </WizardProvider>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Write the index barrel file**

```typescript
// client/src/components/proposal-wizard/index.ts

export { ProposalWizard } from './ProposalWizard';
export { WizardProvider, useWizard } from './context';
export * from './types';
```

**Step 4: Commit**

```bash
git add client/src/components/proposal-wizard/
git commit -m "feat(wizard): add wizard shell with step indicator and navigation"
```

---

## Task 3: Create Select RFP Step

**Files:**
- Create: `client/src/components/proposal-wizard/steps/SelectRFPStep.tsx`

**Step 1: Write the SelectRFPStep component**

```typescript
// client/src/components/proposal-wizard/steps/SelectRFPStep.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, Calendar, Building } from 'lucide-react';
import { useWizard } from '../context';
import { cn } from '@/lib/utils';
import type { RFP } from '@shared/schema';

interface RFPWithDocuments extends RFP {
  documents?: Array<{
    id: string;
    filename: string;
    fileType: string;
    extractedText?: string;
  }>;
}

export function SelectRFPStep() {
  const { state, dispatch } = useWizard();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rfps, isLoading } = useQuery<RFPWithDocuments[]>({
    queryKey: ['/api/rfps', { status: 'discovered,parsing,drafting,review' }],
  });

  const filteredRfps = rfps?.filter(rfp =>
    rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfp.agency?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSelectRfp = (rfp: RFPWithDocuments) => {
    dispatch({ type: 'SET_RFP', payload: { rfpId: rfp.id, rfpTitle: rfp.title } });

    // Set attachments from documents
    const attachments = (rfp.documents || []).map(doc => ({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      selected: true, // Select all by default
      extractedText: doc.extractedText,
    }));
    dispatch({ type: 'SET_ATTACHMENTS', payload: attachments });
  };

  const handleToggleAttachment = (attachmentId: string) => {
    dispatch({ type: 'TOGGLE_ATTACHMENT', payload: attachmentId });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search RFPs by title or agency..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RFP List */}
        <div>
          <h3 className="text-sm font-medium mb-3">Available RFPs</h3>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-3 space-y-2">
              {filteredRfps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No RFPs found</p>
                </div>
              ) : (
                filteredRfps.map(rfp => (
                  <Card
                    key={rfp.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      state.rfpId === rfp.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    )}
                    onClick={() => handleSelectRfp(rfp)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm line-clamp-2">{rfp.title}</h4>
                        <Badge variant="secondary" className="shrink-0">
                          {rfp.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {rfp.agency || 'Unknown Agency'}
                        </span>
                        {rfp.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(rfp.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Attachments Selection */}
        <div>
          <h3 className="text-sm font-medium mb-3">
            Attachments to Analyze
            {state.attachments.length > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                ({state.attachments.filter(a => a.selected).length} of {state.attachments.length} selected)
              </span>
            )}
          </h3>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-3 space-y-2">
              {!state.rfpId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select an RFP to see attachments</p>
                </div>
              ) : state.attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No attachments available</p>
                  <p className="text-xs mt-1">The RFP description will be analyzed instead</p>
                </div>
              ) : (
                state.attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg transition-colors',
                      attachment.selected ? 'bg-primary/5 border-primary/30' : 'hover:bg-accent'
                    )}
                  >
                    <Checkbox
                      checked={attachment.selected}
                      onCheckedChange={() => handleToggleAttachment(attachment.id)}
                    />
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.filename}</p>
                      <p className="text-xs text-muted-foreground uppercase">{attachment.fileType}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update ProposalWizard to use SelectRFPStep**

In `client/src/components/proposal-wizard/ProposalWizard.tsx`, add the import and update renderStep:

```typescript
import { SelectRFPStep } from './steps/SelectRFPStep';

// In renderStep():
case 'select-rfp':
  return <SelectRFPStep />;
```

**Step 3: Commit**

```bash
git add client/src/components/proposal-wizard/steps/SelectRFPStep.tsx client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Select RFP step with attachment selection"
```

---

## Task 4: Create Backend Requirements Extraction Endpoint

**Files:**
- Modify: `server/routes/proposals.routes.ts:780+`

**Step 1: Add the requirements extraction endpoint**

Add this route before the `export default router;` line in `server/routes/proposals.routes.ts`:

```typescript
/**
 * Extract requirements from RFP for wizard
 * POST /api/proposals/wizard/extract-requirements
 */
const extractRequirementsSchema = z.object({
  rfpId: z.string().uuid('RFP ID must be a valid UUID'),
  documentIds: z.array(z.string()).optional(),
});

router.post(
  '/wizard/extract-requirements',
  aiOperationLimiter,
  validateSchema(extractRequirementsSchema),
  handleAsyncError(async (req, res) => {
    const { rfpId, documentIds } = req.body;

    // Get RFP
    const rfp = await storage.getRFP(rfpId);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Get documents if IDs provided
    let documentText = '';
    if (documentIds && documentIds.length > 0) {
      const documents = await storage.getDocumentsByRFP(rfpId);
      const selectedDocs = documents.filter(doc => documentIds.includes(doc.id));
      documentText = selectedDocs
        .map(doc => doc.extractedText || '')
        .filter(text => text.length > 0)
        .join('\n\n');
    }

    // Combine RFP description with document text
    const fullText = [
      rfp.description || '',
      rfp.analysis ? JSON.stringify(rfp.analysis) : '',
      documentText,
    ]
      .filter(t => t.length > 0)
      .join('\n\n')
      .slice(0, 50000);

    // Use AI service to analyze
    const { aiProposalService } = await import(
      '../services/proposals/ai-proposal-service'
    );

    const analysis = await aiProposalService.analyzeRFPDocument(fullText);

    // Transform compliance items into requirements format
    const requirements = analysis.complianceItems.map((item, index) => ({
      id: `req-${index + 1}`,
      text: item.item,
      category: item.required ? 'mandatory' : 'preferred',
      section: item.category,
      description: item.description,
    }));

    // Add extracted requirements from the requirements object
    if (analysis.requirements) {
      const additionalReqs: Array<{ id: string; text: string; category: string; section: string }> = [];

      if (analysis.requirements.certifications) {
        analysis.requirements.certifications.forEach((cert, i) => {
          additionalReqs.push({
            id: `cert-${i + 1}`,
            text: `Certification required: ${cert}`,
            category: 'mandatory',
            section: 'Certifications',
          });
        });
      }

      if (analysis.requirements.insurance?.types) {
        analysis.requirements.insurance.types.forEach((ins, i) => {
          additionalReqs.push({
            id: `ins-${i + 1}`,
            text: `Insurance required: ${ins}${analysis.requirements.insurance?.minimumCoverage ? ` (min $${analysis.requirements.insurance.minimumCoverage.toLocaleString()})` : ''}`,
            category: 'mandatory',
            section: 'Insurance',
          });
        });
      }

      if (analysis.requirements.experienceRequirements) {
        analysis.requirements.experienceRequirements.forEach((exp, i) => {
          additionalReqs.push({
            id: `exp-${i + 1}`,
            text: exp,
            category: 'preferred',
            section: 'Experience',
          });
        });
      }

      requirements.push(...additionalReqs);
    }

    res.json({
      success: true,
      requirements,
      keyDates: analysis.keyDates,
      riskFlags: analysis.riskFlags,
    });
  })
);
```

**Step 2: Commit**

```bash
git add server/routes/proposals.routes.ts
git commit -m "feat(api): add requirements extraction endpoint for proposal wizard"
```

---

## Task 5: Create Analyze Requirements Step

**Files:**
- Create: `client/src/components/proposal-wizard/steps/AnalyzeRequirementsStep.tsx`

**Step 1: Write the AnalyzeRequirementsStep component**

```typescript
// client/src/components/proposal-wizard/steps/AnalyzeRequirementsStep.tsx

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, FileSearch } from 'lucide-react';
import { useWizard } from '../context';
import { apiRequest } from '@/lib/queryClient';
import type { ExtractedRequirement } from '../types';

interface ExtractionResponse {
  success: boolean;
  requirements: Array<{
    id: string;
    text: string;
    category: string;
    section: string;
    description?: string;
  }>;
  keyDates?: {
    deadline?: string;
    prebidMeeting?: string | null;
    questionsDeadline?: string | null;
  };
  riskFlags?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
}

export function AnalyzeRequirementsStep() {
  const { state, dispatch } = useWizard();
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const extractMutation = useMutation({
    mutationFn: async () => {
      const selectedDocIds = state.attachments
        .filter(a => a.selected)
        .map(a => a.id);

      return apiRequest('POST', '/api/proposals/wizard/extract-requirements', {
        rfpId: state.rfpId,
        documentIds: selectedDocIds,
      }) as Promise<ExtractionResponse>;
    },
    onSuccess: (data) => {
      const requirements: ExtractedRequirement[] = data.requirements.map(req => ({
        id: req.id,
        text: req.text,
        category: req.category as 'mandatory' | 'preferred' | 'optional',
        section: req.section,
        selected: req.category === 'mandatory', // Auto-select mandatory requirements
      }));
      dispatch({ type: 'SET_REQUIREMENTS', payload: requirements });
      dispatch({ type: 'SET_ERROR', payload: null });
    },
    onError: (error: Error) => {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to analyze requirements' });
    },
  });

  // Auto-start analysis when step is reached
  useEffect(() => {
    if (state.rfpId && state.requirements.length === 0 && !extractMutation.isPending) {
      extractMutation.mutate();
    }
  }, [state.rfpId]);

  // Simulate progress during analysis
  useEffect(() => {
    if (extractMutation.isPending) {
      setAnalysisProgress(0);
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else if (extractMutation.isSuccess) {
      setAnalysisProgress(100);
    }
  }, [extractMutation.isPending, extractMutation.isSuccess]);

  const mandatoryCount = state.requirements.filter(r => r.category === 'mandatory').length;
  const preferredCount = state.requirements.filter(r => r.category === 'preferred').length;
  const optionalCount = state.requirements.filter(r => r.category === 'optional').length;

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Analyzing RFP Requirements</h2>
        <p className="text-muted-foreground">
          AI is extracting requirements from {state.rfpTitle}
        </p>
      </div>

      {extractMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <FileSearch className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analyzing Documents</p>
                <p className="text-sm text-muted-foreground">
                  Extracting requirements, compliance items, and key dates...
                </p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
            <Progress value={analysisProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {Math.round(analysisProgress)}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {extractMutation.isSuccess && state.requirements.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analysis Complete</p>
                <p className="text-sm text-muted-foreground">
                  Found {state.requirements.length} requirements
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{mandatoryCount}</p>
                <p className="text-xs text-muted-foreground">Mandatory</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{preferredCount}</p>
                <p className="text-xs text-muted-foreground">Preferred</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{optionalCount}</p>
                <p className="text-xs text-muted-foreground">Optional</p>
              </div>
            </div>

            <p className="text-sm text-center text-muted-foreground mt-4">
              Click Continue to review and select which requirements to address
            </p>
          </CardContent>
        </Card>
      )}

      {extractMutation.isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analysis Failed</p>
                <p className="text-sm text-muted-foreground">
                  {extractMutation.error?.message || 'An error occurred during analysis'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Update ProposalWizard imports and renderStep**

Add to `client/src/components/proposal-wizard/ProposalWizard.tsx`:

```typescript
import { AnalyzeRequirementsStep } from './steps/AnalyzeRequirementsStep';

// In renderStep():
case 'analyze-requirements':
  return <AnalyzeRequirementsStep />;
```

**Step 3: Commit**

```bash
git add client/src/components/proposal-wizard/steps/AnalyzeRequirementsStep.tsx client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Analyze Requirements step with AI extraction"
```

---

## Task 6: Create Select Requirements Step

**Files:**
- Create: `client/src/components/proposal-wizard/steps/SelectRequirementsStep.tsx`

**Step 1: Write the SelectRequirementsStep component**

```typescript
// client/src/components/proposal-wizard/steps/SelectRequirementsStep.tsx

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, CheckSquare, Square } from 'lucide-react';
import { useWizard } from '../context';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  mandatory: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  preferred: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  optional: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export function SelectRequirementsStep() {
  const { state, dispatch } = useWizard();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const groupedRequirements = useMemo(() => {
    const filtered = state.requirements.filter(req => {
      const matchesSearch = req.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.section.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !filterCategory || req.category === filterCategory;
      return matchesSearch && matchesCategory;
    });

    // Group by section
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(req => {
      const section = req.section || 'General';
      if (!groups[section]) groups[section] = [];
      groups[section].push(req);
    });
    return groups;
  }, [state.requirements, searchQuery, filterCategory]);

  const selectedCount = state.requirements.filter(r => r.selected).length;
  const allSelected = state.requirements.length > 0 && selectedCount === state.requirements.length;
  const someSelected = selectedCount > 0 && selectedCount < state.requirements.length;

  const handleToggleAll = () => {
    dispatch({ type: 'TOGGLE_ALL_REQUIREMENTS', payload: !allSelected });
  };

  const handleToggleRequirement = (id: string) => {
    dispatch({ type: 'TOGGLE_REQUIREMENT', payload: id });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Select Requirements to Address</h2>
          <p className="text-sm text-muted-foreground">
            {selectedCount} of {state.requirements.length} requirements selected
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleAll}
          className="gap-2"
        >
          {allSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory(null)}
          >
            All
          </Button>
          <Button
            variant={filterCategory === 'mandatory' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('mandatory')}
          >
            Mandatory
          </Button>
          <Button
            variant={filterCategory === 'preferred' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('preferred')}
          >
            Preferred
          </Button>
        </div>
      </div>

      {/* Requirements List */}
      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-4 space-y-6">
          {Object.entries(groupedRequirements).map(([section, requirements]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {section}
              </h3>
              <div className="space-y-2">
                {requirements.map(req => (
                  <div
                    key={req.id}
                    className={cn(
                      'flex items-start gap-3 p-3 border rounded-lg transition-colors cursor-pointer',
                      req.selected
                        ? 'bg-primary/5 border-primary/30'
                        : 'hover:bg-accent'
                    )}
                    onClick={() => handleToggleRequirement(req.id)}
                  >
                    <Checkbox
                      checked={req.selected}
                      onCheckedChange={() => handleToggleRequirement(req.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{req.text}</p>
                    </div>
                    <Badge className={cn('shrink-0', CATEGORY_COLORS[req.category])}>
                      {req.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedRequirements).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No requirements match your filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Step 2: Update ProposalWizard imports and renderStep**

Add to `client/src/components/proposal-wizard/ProposalWizard.tsx`:

```typescript
import { SelectRequirementsStep } from './steps/SelectRequirementsStep';

// In renderStep():
case 'select-requirements':
  return <SelectRequirementsStep />;
```

**Step 3: Commit**

```bash
git add client/src/components/proposal-wizard/steps/SelectRequirementsStep.tsx client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Select Requirements step with filtering and grouping"
```

---

## Task 7: Create Section Notes Step

**Files:**
- Create: `client/src/components/proposal-wizard/steps/SectionNotesStep.tsx`

**Step 1: Write the SectionNotesStep component**

```typescript
// client/src/components/proposal-wizard/steps/SectionNotesStep.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, Lightbulb } from 'lucide-react';
import { useWizard } from '../context';

const SECTION_TIPS: Record<string, string> = {
  executiveSummary: 'Highlight your unique value proposition and why your company is the best fit for this RFP.',
  companyOverview: 'Include years of experience, key achievements, and relevant past performance.',
  technicalApproach: 'Describe your methodology, tools, and how you will meet the technical requirements.',
  qualifications: 'List relevant certifications, team expertise, and similar project experience.',
  timeline: 'Provide key milestones, deliverable dates, and any phased approach you plan to use.',
  pricing: 'Note any pricing constraints, preferred payment terms, or cost optimization strategies.',
  compliance: 'Mention any certifications or documentation you have ready to demonstrate compliance.',
};

export function SectionNotesStep() {
  const { state, dispatch } = useWizard();

  const handleNotesChange = (sectionId: string, notes: string) => {
    dispatch({ type: 'UPDATE_SECTION_NOTES', payload: { sectionId, notes } });
  };

  const selectedRequirements = state.requirements.filter(r => r.selected);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Add Section Notes</h2>
        <p className="text-muted-foreground">
          Provide custom input for each proposal section. The AI will incorporate your notes during generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section Notes */}
        <div className="lg:col-span-2">
          <ScrollArea className="h-[450px] pr-4">
            <Accordion type="multiple" defaultValue={state.sections.map(s => s.id)} className="space-y-3">
              {state.sections.map(section => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{section.displayName}</span>
                      {section.userNotes && (
                        <Badge variant="secondary" className="text-xs">
                          Has notes
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    {SECTION_TIPS[section.id] && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                        <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">{SECTION_TIPS[section.id]}</p>
                      </div>
                    )}
                    <div>
                      <Label htmlFor={`notes-${section.id}`} className="text-xs text-muted-foreground">
                        Custom notes for {section.displayName}
                      </Label>
                      <Textarea
                        id={`notes-${section.id}`}
                        placeholder={`Add any specific points, key messages, or custom content you want included in the ${section.displayName}...`}
                        value={section.userNotes}
                        onChange={e => handleNotesChange(section.id, e.target.value)}
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </div>

        {/* Selected Requirements Summary */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Selected Requirements ({selectedRequirements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[380px]">
                <div className="space-y-2">
                  {selectedRequirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No requirements selected
                    </p>
                  ) : (
                    selectedRequirements.map(req => (
                      <div
                        key={req.id}
                        className="p-2 text-xs border rounded bg-muted/30"
                      >
                        <p className="line-clamp-2">{req.text}</p>
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px]"
                        >
                          {req.section}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update ProposalWizard imports and renderStep**

Add to `client/src/components/proposal-wizard/ProposalWizard.tsx`:

```typescript
import { SectionNotesStep } from './steps/SectionNotesStep';

// In renderStep():
case 'section-notes':
  return <SectionNotesStep />;
```

**Step 3: Commit**

```bash
git add client/src/components/proposal-wizard/steps/SectionNotesStep.tsx client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Section Notes step with tips and requirements summary"
```

---

## Task 8: Create Backend Wizard Generation Endpoint with SSE

**Files:**
- Modify: `server/routes/proposals.routes.ts`

**Step 1: Add the wizard generation endpoint**

Add this route in `server/routes/proposals.routes.ts` after the extract-requirements endpoint:

```typescript
/**
 * Generate proposal sections for wizard (with SSE progress)
 * POST /api/proposals/wizard/generate
 */
const wizardGenerateSchema = z.object({
  rfpId: z.string().uuid('RFP ID must be a valid UUID'),
  companyProfileId: z.string().uuid().optional(),
  selectedRequirements: z.array(z.object({
    id: z.string(),
    text: z.string(),
    category: z.string(),
    section: z.string(),
  })),
  sectionNotes: z.record(z.string(), z.string()),
  qualityLevel: proposalQualityLevelSchema.default('standard'),
});

router.post(
  '/wizard/generate',
  heavyOperationLimiter,
  validateSchema(wizardGenerateSchema),
  handleAsyncError(async (req, res) => {
    const { rfpId, companyProfileId, selectedRequirements, sectionNotes, qualityLevel } = req.body;

    const sessionId = `wizard_${rfpId}_${Date.now()}`;

    // Start async generation
    generateWizardProposal({
      sessionId,
      rfpId,
      companyProfileId,
      selectedRequirements,
      sectionNotes,
      qualityLevel,
    }).catch(error => {
      console.error('Wizard proposal generation failed:', error);
      progressTracker.updateStep(sessionId, 'completion', 'failed', error.message);
    });

    res.json({
      success: true,
      sessionId,
      message: 'Proposal generation started',
    });
  })
);

/**
 * Stream wizard generation progress
 * GET /api/proposals/wizard/stream/:sessionId
 */
router.get('/wizard/stream/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  console.log(`📡 SSE connection for wizard session: ${sessionId}`);
  progressTracker.registerSSEClient(sessionId, res);

  req.on('close', () => {
    console.log(`📡 SSE closed for wizard session: ${sessionId}`);
  });
});

/**
 * Regenerate a single section
 * POST /api/proposals/wizard/regenerate-section
 */
const regenerateSectionSchema = z.object({
  proposalId: z.string().uuid(),
  sectionId: z.string(),
  userNotes: z.string().optional(),
  qualityLevel: proposalQualityLevelSchema.default('standard'),
});

router.post(
  '/wizard/regenerate-section',
  aiOperationLimiter,
  validateSchema(regenerateSectionSchema),
  handleAsyncError(async (req, res) => {
    const { proposalId, sectionId, userNotes, qualityLevel } = req.body;

    const proposal = await storage.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const rfp = await storage.getRFP(proposal.rfpId);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Generate single section
    const { claudeProposalService } = await import(
      '../services/proposals/claude-proposal-service'
    );

    const sectionContent = await claudeProposalService.generateSingleSection({
      rfpId: proposal.rfpId,
      sectionId,
      rfpContext: rfp.description || '',
      userNotes: userNotes || '',
      qualityLevel,
    });

    // Update proposal with new section content
    const existingContent = typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content || {};

    existingContent[sectionId] = sectionContent;

    await storage.updateProposal(proposalId, {
      content: JSON.stringify(existingContent),
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      sectionId,
      content: sectionContent,
    });
  })
);

// Helper function for wizard generation
async function generateWizardProposal(params: {
  sessionId: string;
  rfpId: string;
  companyProfileId?: string;
  selectedRequirements: Array<{ id: string; text: string; category: string; section: string }>;
  sectionNotes: Record<string, string>;
  qualityLevel: string;
}) {
  const { sessionId, rfpId, companyProfileId, selectedRequirements, sectionNotes, qualityLevel } = params;

  progressTracker.startTracking(sessionId, `Wizard Proposal for RFP`, 'submission_materials');

  try {
    // Get RFP and company data
    progressTracker.updateStep(sessionId, 'initialization', 'in_progress', 'Loading RFP data...');
    const rfp = await storage.getRFP(rfpId);
    if (!rfp) throw new Error('RFP not found');

    let companyProfile;
    if (companyProfileId) {
      companyProfile = await storage.getCompanyProfileWithDetails(companyProfileId);
    } else {
      const profiles = await storage.getAllCompanyProfiles();
      companyProfile = profiles[0] ? await storage.getCompanyProfileWithDetails(profiles[0].id) : null;
    }

    progressTracker.updateStep(sessionId, 'initialization', 'completed', 'Data loaded');

    // Generate sections
    const sections = [
      'executiveSummary',
      'companyOverview',
      'technicalApproach',
      'qualifications',
      'timeline',
      'pricing',
      'compliance',
    ];

    const generatedContent: Record<string, string> = {};

    progressTracker.updateStep(sessionId, 'content_generation', 'in_progress', 'Starting content generation...');

    const { claudeProposalService } = await import(
      '../services/proposals/claude-proposal-service'
    );

    for (let i = 0; i < sections.length; i++) {
      const sectionId = sections[i];
      const progress = Math.round(((i + 1) / sections.length) * 100);

      progressTracker.updateStep(
        sessionId,
        'content_generation',
        'in_progress',
        `Generating ${sectionId}... (${progress}%)`
      );

      // Filter requirements relevant to this section
      const relevantReqs = selectedRequirements
        .filter(r => r.section.toLowerCase().includes(sectionId.toLowerCase()) || r.category === 'mandatory')
        .map(r => r.text)
        .join('\n');

      const sectionContent = await claudeProposalService.generateSingleSection({
        rfpId,
        sectionId,
        rfpContext: `${rfp.description || ''}\n\nRelevant Requirements:\n${relevantReqs}`,
        userNotes: sectionNotes[sectionId] || '',
        qualityLevel,
        companyProfile,
      });

      generatedContent[sectionId] = sectionContent;
    }

    progressTracker.updateStep(sessionId, 'content_generation', 'completed', 'All sections generated');

    // Save proposal
    progressTracker.updateStep(sessionId, 'document_assembly', 'in_progress', 'Saving proposal...');

    const existingProposal = await storage.getProposalByRFP(rfpId);
    let proposalId: string;

    const proposalData = {
      rfpId,
      content: JSON.stringify(generatedContent),
      status: 'review' as const,
      proposalData: JSON.stringify({
        generatedWith: 'wizard',
        qualityLevel,
        selectedRequirementsCount: selectedRequirements.length,
        sectionsWithNotes: Object.keys(sectionNotes).filter(k => sectionNotes[k]),
      }),
    };

    if (existingProposal) {
      await storage.updateProposal(existingProposal.id, proposalData);
      proposalId = existingProposal.id;
    } else {
      const newProposal = await storage.createProposal(proposalData);
      proposalId = newProposal.id;
    }

    progressTracker.updateStep(sessionId, 'document_assembly', 'completed', 'Proposal saved');
    progressTracker.updateStep(sessionId, 'completion', 'completed', `Proposal generated: ${proposalId}`);

  } catch (error) {
    console.error('Wizard generation error:', error);
    progressTracker.updateStep(
      sessionId,
      'completion',
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}
```

**Step 2: Add generateSingleSection to claudeProposalService**

Add this method to `server/services/proposals/claude-proposal-service.ts`:

```typescript
/**
 * Generate a single proposal section
 */
async generateSingleSection(params: {
  rfpId: string;
  sectionId: string;
  rfpContext: string;
  userNotes: string;
  qualityLevel: string;
  companyProfile?: any;
}): Promise<string> {
  const { sectionId, rfpContext, userNotes, qualityLevel, companyProfile } = params;

  const sectionPrompts: Record<string, string> = {
    executiveSummary: 'Write a compelling executive summary that highlights our unique value proposition and key qualifications.',
    companyOverview: 'Provide a comprehensive company overview including history, capabilities, and relevant experience.',
    technicalApproach: 'Describe our detailed technical approach, methodology, and implementation strategy.',
    qualifications: 'Present our team qualifications, certifications, and relevant past performance.',
    timeline: 'Create a realistic project timeline with milestones and deliverables.',
    pricing: 'Outline our pricing strategy and cost breakdown.',
    compliance: 'Generate a compliance matrix showing how we meet each requirement.',
  };

  const config = this.getQualityConfig(qualityLevel as any);

  const response = await this.anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    thinking: config.thinking,
    messages: [
      {
        role: 'user',
        content: `Generate the ${sectionId} section for a government proposal.

RFP Context:
${rfpContext.slice(0, 8000)}

${companyProfile ? `Company: ${companyProfile.companyName || 'Our Company'}` : ''}

User Notes/Instructions:
${userNotes || 'None provided'}

Task: ${sectionPrompts[sectionId] || `Write the ${sectionId} section.`}

Write professional, detailed content suitable for a government RFP response. Be specific and substantive.`,
      },
    ],
  });

  const textBlock = response.content.find((block: any) => block.type === 'text');
  return textBlock?.text || '';
}
```

**Step 3: Commit**

```bash
git add server/routes/proposals.routes.ts server/services/proposals/claude-proposal-service.ts
git commit -m "feat(api): add wizard generation endpoints with SSE progress and section regeneration"
```

---

## Task 9: Create Generate Step

**Files:**
- Create: `client/src/components/proposal-wizard/steps/GenerateStep.tsx`
- Create: `client/src/components/proposal-wizard/hooks/useWizardGeneration.ts`

**Step 1: Write the generation hook**

```typescript
// client/src/components/proposal-wizard/hooks/useWizardGeneration.ts

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useWizard } from '../context';

interface GenerationProgress {
  step: string;
  status: string;
  message: string;
  progress: number;
}

export function useWizardGeneration() {
  const { state, dispatch } = useWizard();
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const startGeneration = useMutation({
    mutationFn: async () => {
      const selectedReqs = state.requirements
        .filter(r => r.selected)
        .map(r => ({ id: r.id, text: r.text, category: r.category, section: r.section }));

      const sectionNotes: Record<string, string> = {};
      state.sections.forEach(s => {
        if (s.userNotes) sectionNotes[s.id] = s.userNotes;
      });

      return apiRequest('POST', '/api/proposals/wizard/generate', {
        rfpId: state.rfpId,
        selectedRequirements: selectedReqs,
        sectionNotes,
        qualityLevel: 'standard',
      }) as Promise<{ success: boolean; sessionId: string }>;
    },
    onSuccess: (data) => {
      dispatch({ type: 'SET_SESSION_ID', payload: data.sessionId });
    },
    onError: (error: Error) => {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    },
  });

  // SSE connection for progress
  useEffect(() => {
    if (!state.sessionId) return;

    const eventSource = new EventSource(`/api/proposals/wizard/stream/${state.sessionId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        // Update section statuses based on progress
        if (data.step === 'content_generation' && data.message) {
          const sectionMatch = data.message.match(/Generating (\w+)/);
          if (sectionMatch) {
            const sectionId = sectionMatch[1];
            dispatch({
              type: 'SET_SECTION_STATUS',
              payload: { sectionId, status: 'generating' },
            });
          }
        }

        // Calculate overall progress
        const progressPercent = data.progress || 0;
        dispatch({
          type: 'SET_GENERATION_PROGRESS',
          payload: { progress: progressPercent, section: data.step },
        });

        // Move to next step on completion
        if (data.step === 'completion' && data.status === 'completed') {
          state.sections.forEach(s => {
            dispatch({ type: 'SET_SECTION_STATUS', payload: { sectionId: s.id, status: 'completed' } });
          });
          setTimeout(() => {
            dispatch({ type: 'NEXT_STEP' });
          }, 1000);
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [state.sessionId, dispatch]);

  return {
    startGeneration: startGeneration.mutate,
    isStarting: startGeneration.isPending,
    progress,
  };
}
```

**Step 2: Write the GenerateStep component**

```typescript
// client/src/components/proposal-wizard/steps/GenerateStep.tsx

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, Circle, AlertCircle, Sparkles } from 'lucide-react';
import { useWizard } from '../context';
import { useWizardGeneration } from '../hooks/useWizardGeneration';
import { cn } from '@/lib/utils';

export function GenerateStep() {
  const { state } = useWizard();
  const { startGeneration, isStarting, progress } = useWizardGeneration();

  // Auto-start generation when entering this step
  useEffect(() => {
    if (!state.sessionId && !isStarting) {
      startGeneration();
    }
  }, []);

  const getSectionIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'generating':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Generating Your Proposal</h2>
        <p className="text-muted-foreground">
          AI is creating each section based on your requirements and notes
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {state.generationProgress}%
            </span>
          </div>
          <Progress value={state.generationProgress} className="h-2" />
          {progress?.message && (
            <p className="text-xs text-muted-foreground mt-2">
              {progress.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {state.sections.map(section => (
          <div
            key={section.id}
            className={cn(
              'flex items-center gap-3 p-4 border rounded-lg transition-colors',
              section.status === 'generating' && 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
              section.status === 'completed' && 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
              section.status === 'error' && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            )}
          >
            {getSectionIcon(section.status)}
            <span className="font-medium text-sm">{section.displayName}</span>
            {section.status === 'generating' && (
              <Badge variant="secondary" className="ml-auto text-xs">
                In Progress
              </Badge>
            )}
            {section.status === 'completed' && (
              <Badge className="ml-auto text-xs bg-green-500">
                Complete
              </Badge>
            )}
          </div>
        ))}
      </div>

      {state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div className="flex-1">
              <p className="font-medium text-red-700 dark:text-red-400">Generation Error</p>
              <p className="text-sm text-red-600 dark:text-red-300">{state.error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => startGeneration()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 3: Update ProposalWizard imports and renderStep**

```typescript
import { GenerateStep } from './steps/GenerateStep';

// In renderStep():
case 'generate':
  return <GenerateStep />;
```

**Step 4: Commit**

```bash
git add client/src/components/proposal-wizard/steps/GenerateStep.tsx client/src/components/proposal-wizard/hooks/useWizardGeneration.ts client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Generate step with SSE progress tracking"
```

---

## Task 10: Create Preview & Edit Step

**Files:**
- Create: `client/src/components/proposal-wizard/steps/PreviewEditStep.tsx`

**Step 1: Write the PreviewEditStep component**

```typescript
// client/src/components/proposal-wizard/steps/PreviewEditStep.tsx

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Check, Edit2, Eye } from 'lucide-react';
import { useWizard } from '../context';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { ProposalRow } from '@shared/schema';

export function PreviewEditStep() {
  const { state, dispatch } = useWizard();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Fetch the generated proposal
  const { data: proposal, isLoading } = useQuery<ProposalRow>({
    queryKey: ['/api/proposals/rfp', state.rfpId],
    enabled: !!state.rfpId,
  });

  const proposalContent = proposal?.content
    ? typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content
    : {};

  // Regenerate section mutation
  const regenerateMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const section = state.sections.find(s => s.id === sectionId);
      return apiRequest('POST', '/api/proposals/wizard/regenerate-section', {
        proposalId: proposal?.id,
        sectionId,
        userNotes: section?.userNotes || '',
        qualityLevel: 'standard',
      }) as Promise<{ success: boolean; content: string }>;
    },
    onSuccess: (data, sectionId) => {
      dispatch({
        type: 'UPDATE_SECTION_CONTENT',
        payload: { sectionId, content: data.content },
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', state.rfpId] });
    },
  });

  // Save edit mutation
  const saveEditMutation = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: string }) => {
      const updatedContent = { ...proposalContent, [sectionId]: content };
      return apiRequest('PUT', `/api/proposals/${proposal?.id}`, {
        content: JSON.stringify(updatedContent),
      });
    },
    onSuccess: (_, { sectionId }) => {
      setEditingSection(null);
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', state.rfpId] });
    },
  });

  const handleStartEdit = (sectionId: string) => {
    setEditingSection(sectionId);
    setEditContent(proposalContent[sectionId] || '');
  };

  const handleSaveEdit = () => {
    if (editingSection) {
      saveEditMutation.mutate({ sectionId: editingSection, content: editContent });
    }
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditContent('');
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Preview & Edit Proposal</h2>
          <p className="text-muted-foreground text-sm">
            Review each section and make edits as needed
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {Object.keys(proposalContent).length} sections
        </Badge>
      </div>

      <Tabs defaultValue={state.sections[0]?.id} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
          {state.sections.map(section => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="text-xs"
            >
              {section.displayName}
            </TabsTrigger>
          ))}
        </TabsList>

        {state.sections.map(section => (
          <TabsContent key={section.id} value={section.id} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{section.displayName}</CardTitle>
                  <div className="flex gap-2">
                    {editingSection === section.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={saveEditMutation.isPending}
                        >
                          {saveEditMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => regenerateMutation.mutate(section.id)}
                          disabled={regenerateMutation.isPending}
                        >
                          {regenerateMutation.isPending && regenerateMutation.variables === section.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Regenerate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(section.id)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingSection === section.id ? (
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {proposalContent[section.id] || 'No content generated for this section.'}
                      </pre>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

**Step 2: Update ProposalWizard imports and renderStep**

```typescript
import { PreviewEditStep } from './steps/PreviewEditStep';

// In renderStep():
case 'preview-edit':
  return <PreviewEditStep />;
```

**Step 3: Commit**

```bash
git add client/src/components/proposal-wizard/steps/PreviewEditStep.tsx client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Preview & Edit step with section regeneration"
```

---

## Task 11: Create Export Step with PDF/Word Generation

**Files:**
- Create: `client/src/components/proposal-wizard/steps/ExportStep.tsx`
- Modify: `server/routes/proposals.routes.ts`

**Step 1: Add export endpoint to backend**

Add to `server/routes/proposals.routes.ts`:

```typescript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Export proposal as PDF
 * GET /api/proposals/:id/export/pdf
 */
router.get(
  '/:id/export/pdf',
  handleAsyncError(async (req, res) => {
    const proposal = await storage.getProposal(req.params.id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const rfp = await storage.getRFP(proposal.rfpId);
    const content = typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content || {};

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const addPage = (title: string, text: string) => {
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { height } = page.getSize();

      // Title
      page.drawText(title, {
        x: 50,
        y: height - 50,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Content (simple text wrapping)
      const lines = text.split('\n');
      let y = height - 90;
      const lineHeight = 14;

      for (const line of lines) {
        if (y < 50) {
          // Need new page
          break;
        }
        page.drawText(line.slice(0, 80), {
          x: 50,
          y,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= lineHeight;
      }
    };

    // Cover page
    const coverPage = pdfDoc.addPage([612, 792]);
    coverPage.drawText('PROPOSAL', {
      x: 50,
      y: 700,
      size: 36,
      font: boldFont,
    });
    coverPage.drawText(rfp?.title || 'Untitled RFP', {
      x: 50,
      y: 650,
      size: 18,
      font,
    });
    coverPage.drawText(`Agency: ${rfp?.agency || 'Unknown'}`, {
      x: 50,
      y: 620,
      size: 12,
      font,
    });
    coverPage.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: 600,
      size: 12,
      font,
    });

    // Add content sections
    const sections = [
      { key: 'executiveSummary', title: 'Executive Summary' },
      { key: 'companyOverview', title: 'Company Overview' },
      { key: 'technicalApproach', title: 'Technical Approach' },
      { key: 'qualifications', title: 'Qualifications' },
      { key: 'timeline', title: 'Project Timeline' },
      { key: 'pricing', title: 'Pricing' },
      { key: 'compliance', title: 'Compliance Matrix' },
    ];

    for (const section of sections) {
      if (content[section.key]) {
        addPage(section.title, content[section.key]);
      }
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.id}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  })
);

/**
 * Export proposal as Word (simplified DOCX)
 * GET /api/proposals/:id/export/docx
 */
router.get(
  '/:id/export/docx',
  handleAsyncError(async (req, res) => {
    const proposal = await storage.getProposal(req.params.id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const rfp = await storage.getRFP(proposal.rfpId);
    const content = typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content || {};

    // Build simple HTML that can be opened as Word doc
    const sections = [
      { key: 'executiveSummary', title: 'Executive Summary' },
      { key: 'companyOverview', title: 'Company Overview' },
      { key: 'technicalApproach', title: 'Technical Approach' },
      { key: 'qualifications', title: 'Qualifications' },
      { key: 'timeline', title: 'Project Timeline' },
      { key: 'pricing', title: 'Pricing' },
      { key: 'compliance', title: 'Compliance Matrix' },
    ];

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Proposal - ${rfp?.title || 'Untitled'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          p { line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>PROPOSAL</h1>
        <p><strong>RFP:</strong> ${rfp?.title || 'Untitled'}</p>
        <p><strong>Agency:</strong> ${rfp?.agency || 'Unknown'}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    `;

    for (const section of sections) {
      if (content[section.key]) {
        html += `
          <h2>${section.title}</h2>
          <p>${content[section.key].replace(/\n/g, '<br>')}</p>
        `;
      }
    }

    html += '</body></html>';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.id}.docx"`);
    res.send(html);
  })
);
```

**Step 2: Write the ExportStep component**

```typescript
// client/src/components/proposal-wizard/steps/ExportStep.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, FileText, FileSpreadsheet, CheckCircle, Loader2 } from 'lucide-react';
import { useWizard } from '../context';
import type { ProposalRow } from '@shared/schema';

type ExportFormat = 'pdf' | 'docx';

export function ExportStep() {
  const { state } = useWizard();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const { data: proposal } = useQuery<ProposalRow>({
    queryKey: ['/api/proposals/rfp', state.rfpId],
    enabled: !!state.rfpId,
  });

  const handleExport = async () => {
    if (!proposal?.id) return;

    setIsExporting(true);
    try {
      const response = await fetch(`/api/proposals/${proposal.id}/export/${format}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${proposal.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const proposalContent = proposal?.content
    ? typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content
    : {};

  const sectionCount = Object.keys(proposalContent).filter(k => proposalContent[k]).length;

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold">Proposal Ready!</h2>
        <p className="text-muted-foreground">
          Your proposal has been generated with {sectionCount} sections
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proposal Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">RFP:</span>
              <p className="font-medium">{state.rfpTitle}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Requirements Addressed:</span>
              <p className="font-medium">{state.requirements.filter(r => r.selected).length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sections Generated:</span>
              <p className="font-medium">{sectionCount}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <Badge className="ml-1">{proposal?.status || 'review'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="pdf" id="pdf" />
              <Label htmlFor="pdf" className="flex items-center gap-3 cursor-pointer flex-1">
                <FileText className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium">PDF Document</p>
                  <p className="text-xs text-muted-foreground">Best for printing and sharing</p>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
              <RadioGroupItem value="docx" id="docx" />
              <Label htmlFor="docx" className="flex items-center gap-3 cursor-pointer flex-1">
                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">Word Document</p>
                  <p className="text-xs text-muted-foreground">Best for further editing</p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <Button
            onClick={handleExport}
            disabled={isExporting || !proposal?.id}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Update ProposalWizard imports and renderStep**

```typescript
import { ExportStep } from './steps/ExportStep';

// In renderStep():
case 'export':
  return <ExportStep />;
```

**Step 4: Commit**

```bash
git add client/src/components/proposal-wizard/steps/ExportStep.tsx server/routes/proposals.routes.ts client/src/components/proposal-wizard/ProposalWizard.tsx
git commit -m "feat(wizard): add Export step with PDF and Word download"
```

---

## Task 12: Integrate Wizard into RFPs Page

**Files:**
- Modify: `client/src/pages/rfps.tsx` (or wherever the main RFPs page is)

**Step 1: Import and add wizard trigger**

Add to the RFPs page component:

```typescript
import { useState } from 'react';
import { ProposalWizard } from '@/components/proposal-wizard';

// Inside the component:
const [wizardOpen, setWizardOpen] = useState(false);
const [selectedRfpForWizard, setSelectedRfpForWizard] = useState<string | undefined>();

const handleOpenWizard = (rfpId?: string) => {
  setSelectedRfpForWizard(rfpId);
  setWizardOpen(true);
};

// Add button to trigger wizard (e.g., in the page header or RFP actions):
<Button onClick={() => handleOpenWizard()}>
  <Sparkles className="w-4 h-4 mr-2" />
  Generate Proposal
</Button>

// Add the wizard dialog at the bottom of the component:
<ProposalWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  initialRfpId={selectedRfpForWizard}
/>
```

**Step 2: Commit**

```bash
git add client/src/pages/rfps.tsx
git commit -m "feat(ui): integrate proposal wizard into RFPs page"
```

---

## Task 13: Final Integration and Testing

**Files:**
- Update: `client/src/components/proposal-wizard/ProposalWizard.tsx` (final imports)

**Step 1: Verify all step imports are in place**

Ensure `ProposalWizard.tsx` has all imports:

```typescript
import { SelectRFPStep } from './steps/SelectRFPStep';
import { AnalyzeRequirementsStep } from './steps/AnalyzeRequirementsStep';
import { SelectRequirementsStep } from './steps/SelectRequirementsStep';
import { SectionNotesStep } from './steps/SectionNotesStep';
import { GenerateStep } from './steps/GenerateStep';
import { PreviewEditStep } from './steps/PreviewEditStep';
import { ExportStep } from './steps/ExportStep';
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

**Step 3: Run build**

```bash
pnpm run build
```

**Step 4: Run tests (if applicable)**

```bash
pnpm run test
```

**Step 5: Final commit**

```bash
git add .
git commit -m "feat(wizard): complete proposal generation wizard implementation"
```

---

## Summary

This plan implements a 7-step proposal generation wizard with:

1. **Select RFP** - Choose RFP and attachments to analyze
2. **Analyze Requirements** - AI extracts requirements from documents
3. **Select Requirements** - User picks which requirements to address
4. **Section Notes** - User provides custom input per section
5. **Generate** - AI generates proposal with real-time SSE progress
6. **Preview & Edit** - Review and edit sections, regenerate individually
7. **Export** - Download as PDF or Word document

**Key Features:**
- State management via React Context + useReducer
- Real-time progress via SSE
- Section-by-section regeneration
- PDF export with pdf-lib (already installed)
- Word export as formatted HTML

**New Files Created:**
- `client/src/components/proposal-wizard/types.ts`
- `client/src/components/proposal-wizard/context.tsx`
- `client/src/components/proposal-wizard/ProposalWizard.tsx`
- `client/src/components/proposal-wizard/StepIndicator.tsx`
- `client/src/components/proposal-wizard/index.ts`
- `client/src/components/proposal-wizard/steps/SelectRFPStep.tsx`
- `client/src/components/proposal-wizard/steps/AnalyzeRequirementsStep.tsx`
- `client/src/components/proposal-wizard/steps/SelectRequirementsStep.tsx`
- `client/src/components/proposal-wizard/steps/SectionNotesStep.tsx`
- `client/src/components/proposal-wizard/steps/GenerateStep.tsx`
- `client/src/components/proposal-wizard/steps/PreviewEditStep.tsx`
- `client/src/components/proposal-wizard/steps/ExportStep.tsx`
- `client/src/components/proposal-wizard/hooks/useWizardGeneration.ts`

**Modified Files:**
- `server/routes/proposals.routes.ts` (new endpoints)
- `server/services/proposals/claude-proposal-service.ts` (single section generation)
- `client/src/pages/rfps.tsx` (wizard integration)
