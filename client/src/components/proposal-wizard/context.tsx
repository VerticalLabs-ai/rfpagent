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
      return {
        ...state,
        rfpId: action.payload.rfpId,
        rfpTitle: action.payload.rfpTitle,
      };
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
        requirements: state.requirements.map(r => ({
          ...r,
          selected: action.payload,
        })),
      };
    case 'UPDATE_SECTION_NOTES':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId
            ? { ...s, userNotes: action.payload.notes }
            : s
        ),
      };
    case 'UPDATE_SECTION_CONTENT':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId
            ? { ...s, content: action.payload.content }
            : s
        ),
      };
    case 'SET_SECTION_STATUS':
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.sectionId
            ? { ...s, status: action.payload.status }
            : s
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

interface WizardProviderProps {
  children: ReactNode;
  initialRfpId?: string;
}

export function WizardProvider({ children, initialRfpId }: WizardProviderProps) {
  const [state, dispatch] = useReducer(wizardReducer, {
    ...initialState,
    rfpId: initialRfpId || null,
  });
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
