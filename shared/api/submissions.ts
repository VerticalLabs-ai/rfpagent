import {
  submissionPhaseOrder,
  submissionPipelinePhaseValues,
} from '@shared/schema';
import type {
  SubmissionPhase,
  SubmissionPipelinePhase,
  SubmissionPipelineResultKey,
} from '@shared/schema';

export const SUBMISSION_PHASES: SubmissionPhase[] = [...submissionPhaseOrder];

const SUBMISSION_PHASE_SET = new Set<SubmissionPhase>(SUBMISSION_PHASES);

export const SUBMISSION_PHASE_PROGRESS: Record<SubmissionPhase, number> = {
  preflight: 10,
  authenticating: 25,
  filling: 45,
  uploading: 65,
  submitting: 80,
  verifying: 95,
};

export const SUBMISSION_PHASE_ESTIMATES_MS: Record<SubmissionPhase, number> = {
  preflight: 5 * 60 * 1000,
  authenticating: 3 * 60 * 1000,
  filling: 10 * 60 * 1000,
  uploading: 8 * 60 * 1000,
  submitting: 5 * 60 * 1000,
  verifying: 3 * 60 * 1000,
};

const RESULT_KEY_MAP: Record<SubmissionPhase, SubmissionPipelineResultKey> = {
  preflight: 'preflight',
  authenticating: 'authentication',
  filling: 'formFilling',
  uploading: 'documentUploads',
  submitting: 'submission',
  verifying: 'verification',
};

export function isSubmissionPhase(
  phase: SubmissionPipelinePhase
): phase is SubmissionPhase {
  return SUBMISSION_PHASE_SET.has(phase as SubmissionPhase);
}

export function getResultKeyForPhase(
  phase: SubmissionPipelinePhase
): SubmissionPipelineResultKey | null {
  if (phase === 'completed' || phase === 'failed') {
    return phase;
  }

  if (isSubmissionPhase(phase)) {
    return RESULT_KEY_MAP[phase];
  }

  return null;
}

export const SUBMISSION_PHASE_RESULT_KEY_MAP = RESULT_KEY_MAP;
export const SUBMISSION_PIPELINE_PHASES = [...submissionPipelinePhaseValues];
