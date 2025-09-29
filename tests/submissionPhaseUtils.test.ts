import {
  SUBMISSION_PHASES,
  SUBMISSION_PHASE_ESTIMATES_MS,
  SUBMISSION_PHASE_PROGRESS,
  getResultKeyForPhase,
  isSubmissionPhase,
} from '@shared/api/submissions';
import type {
  SubmissionPipelinePhase,
  SubmissionPhase,
} from '@shared/schema';

describe('submission phase utilities', () => {
  it('recognizes submission phases from the pipeline phase list', () => {
    SUBMISSION_PHASES.forEach(phase => {
      expect(isSubmissionPhase(phase)).toBe(true);
    });

    const nonPhases: SubmissionPipelinePhase[] = ['queued', 'completed', 'failed'];
    nonPhases.forEach(phase => {
      expect(isSubmissionPhase(phase)).toBe(false);
    });
  });

  it('maps tracked phases to deterministic result keys', () => {
    const expectations: Array<[SubmissionPhase, string]> = [
      ['preflight', 'preflight'],
      ['authenticating', 'authentication'],
      ['filling', 'formFilling'],
      ['uploading', 'documentUploads'],
      ['submitting', 'submission'],
      ['verifying', 'verification'],
    ];

    expectations.forEach(([phase, key]) => {
      expect(getResultKeyForPhase(phase)).toBe(key);
    });

    expect(getResultKeyForPhase('completed')).toBe('completed');
    expect(getResultKeyForPhase('failed')).toBe('failed');
    expect(getResultKeyForPhase('queued')).toBeNull();
  });

  it('provides non-zero duration estimates and progress for each tracked phase', () => {
    SUBMISSION_PHASES.forEach(phase => {
      expect(SUBMISSION_PHASE_PROGRESS[phase]).toBeGreaterThanOrEqual(0);
      expect(SUBMISSION_PHASE_ESTIMATES_MS[phase]).toBeGreaterThan(0);
    });
  });
});
