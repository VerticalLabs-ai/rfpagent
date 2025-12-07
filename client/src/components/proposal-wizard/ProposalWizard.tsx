import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { WizardProvider, useWizard } from './context';
import { StepIndicator } from './StepIndicator';
import { SelectRFPStep } from './steps/SelectRFPStep';
import { AnalyzeRequirementsStep } from './steps/AnalyzeRequirementsStep';
import { SelectRequirementsStep } from './steps/SelectRequirementsStep';
import { SectionNotesStep } from './steps/SectionNotesStep';
import { GenerateStep } from './steps/GenerateStep';
import { PreviewEditStep } from './steps/PreviewEditStep';
import { ExportStep } from './steps/ExportStep';
import type { WizardStep } from './types';

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
        return <SelectRFPStep />;
      case 'analyze-requirements':
        return <AnalyzeRequirementsStep />;
      case 'select-requirements':
        return <SelectRequirementsStep />;
      case 'section-notes':
        return <SectionNotesStep />;
      case 'generate':
        return <GenerateStep />;
      case 'preview-edit':
        return <PreviewEditStep />;
      case 'export':
        return <ExportStep />;
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
