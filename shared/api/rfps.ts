import type { Proposal, PublicPortal, RFP } from '@shared/schema';

export interface RfpDetail {
  rfp: RFP;
  portal: PublicPortal | null;
  proposal: Proposal | null;
}

export const SUBMISSION_PROGRESS_STATUSES = ['approved', 'submitted'] as const;

export type SubmissionProgressStatus =
  (typeof SUBMISSION_PROGRESS_STATUSES)[number];

export type SubmissionStatusFilter = 'all' | SubmissionProgressStatus;
