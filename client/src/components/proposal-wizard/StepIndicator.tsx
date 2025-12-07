import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type WizardStep } from './types';

const STEP_LABELS: Record<WizardStep, string> = {
  'select-rfp': 'Select RFP',
  'analyze-requirements': 'Analyze',
  'select-requirements': 'Requirements',
  'section-notes': 'Notes',
  generate: 'Generate',
  'preview-edit': 'Preview',
  export: 'Export',
};

interface StepIndicatorProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
}

export function StepIndicator({
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
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
