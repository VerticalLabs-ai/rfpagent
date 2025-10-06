import { and, desc, eq, gte, lte, or } from 'drizzle-orm';
import { db } from '../db';
import {
  submissions,
  submissionPipelines,
  submissionEvents,
  submissionStatusHistory,
  type Submission,
  type SubmissionRow,
  type SubmissionEvent,
  type SubmissionPipeline,
  type SubmissionPipelineRow,
  type SubmissionStatusHistory,
  type InsertSubmission,
  type InsertSubmissionPipeline,
  type InsertSubmissionEvent,
  type InsertSubmissionStatusHistory,
  type SubmissionLifecycleData,
  type SubmissionReceiptData,
  type SubmissionStatusValue,
  type SubmissionPipelinePhase,
  type SubmissionPipelineStatus,
  type SubmissionPipelineMetadata,
  type SubmissionPhaseResult,
  type SubmissionPipelineErrorData,
  type SubmissionVerificationResult,
} from '@shared/schema';
import { BaseRepository } from './BaseRepository';

// Helper functions for type conversion
const toSubmission = (row: SubmissionRow): Submission => ({
  ...row,
  status: row.status as SubmissionStatusValue,
  submissionData:
    (row.submissionData as SubmissionLifecycleData | null) ?? null,
  receiptData: (row.receiptData as SubmissionReceiptData | null) ?? null,
});

const mapSubmissionRows = (rows: SubmissionRow[]): Submission[] =>
  rows.map(toSubmission);

const toSubmissionPipeline = (
  row: SubmissionPipelineRow
): SubmissionPipeline => ({
  ...row,
  currentPhase: row.currentPhase as SubmissionPipelinePhase,
  status: row.status as SubmissionPipelineStatus,
  metadata: (row.metadata as SubmissionPipelineMetadata | null) ?? null,
  preflightChecks:
    (row.preflightChecks as SubmissionPhaseResult | null) ?? null,
  authenticationData:
    (row.authenticationData as SubmissionPhaseResult | null) ?? null,
  formData: (row.formData as SubmissionPhaseResult | null) ?? null,
  uploadedDocuments:
    (row.uploadedDocuments as SubmissionPhaseResult | null) ?? null,
  submissionReceipt:
    (row.submissionReceipt as SubmissionVerificationResult | null) ?? null,
  errorData: (row.errorData as SubmissionPipelineErrorData | null) ?? null,
});

/**
 * Repository for managing submissions and submission pipelines
 * Handles submission lifecycle, pipelines, events, and status tracking
 */
export class SubmissionRepository extends BaseRepository<typeof submissions> {
  constructor() {
    super(submissions);
  }

  /**
   * Get a submission by ID
   */
  async getSubmission(id: string): Promise<Submission | undefined> {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id));
    return submission ? toSubmission(submission) : undefined;
  }

  /**
   * Get submissions with optional filters
   */
  async getSubmissions(options?: {
    limit?: number;
    status?: string;
  }): Promise<Submission[]> {
    const { limit = 100, status } = options || {};

    let query = db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt))
      .limit(limit);

    if (status) {
      query = query.where(eq(submissions.status, status)) as any;
    }

    const rows = await query;
    return mapSubmissionRows(rows);
  }

  /**
   * Get submissions for a specific RFP
   */
  async getSubmissionsByRFP(rfpId: string): Promise<Submission[]> {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.rfpId, rfpId));
    return mapSubmissionRows(rows);
  }

  /**
   * Get submissions within a date range
   */
  async getSubmissionsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Submission[]> {
    const rows = await db
      .select()
      .from(submissions)
      .where(
        and(
          gte(submissions.createdAt, startDate),
          lte(submissions.createdAt, endDate)
        )
      )
      .orderBy(desc(submissions.createdAt));
    return mapSubmissionRows(rows);
  }

  /**
   * Get submission by proposal ID
   */
  async getSubmissionByProposal(
    proposalId: string
  ): Promise<Submission | undefined> {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.proposalId, proposalId));
    return submission ? toSubmission(submission) : undefined;
  }

  /**
   * Create a new submission
   */
  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [newSubmission] = await db
      .insert(submissions)
      .values(submission)
      .returning();
    return toSubmission(newSubmission);
  }

  /**
   * Update a submission
   */
  async updateSubmission(
    id: string,
    updates: Partial<Submission>
  ): Promise<Submission> {
    const [updatedSubmission] = await db
      .update(submissions)
      .set(updates)
      .where(eq(submissions.id, id))
      .returning();
    return toSubmission(updatedSubmission);
  }

  // Submission Pipelines

  /**
   * Get a submission pipeline by ID
   */
  async getSubmissionPipeline(
    id: string
  ): Promise<SubmissionPipeline | undefined> {
    const [pipeline] = await db
      .select()
      .from(submissionPipelines)
      .where(eq(submissionPipelines.id, id));
    return pipeline ? toSubmissionPipeline(pipeline) : undefined;
  }

  /**
   * Get submission pipeline by submission ID
   */
  async getSubmissionPipelineBySubmission(
    submissionId: string
  ): Promise<SubmissionPipeline | undefined> {
    const [pipeline] = await db
      .select()
      .from(submissionPipelines)
      .where(eq(submissionPipelines.submissionId, submissionId));
    return pipeline ? toSubmissionPipeline(pipeline) : undefined;
  }

  /**
   * Get submission pipelines by status
   */
  async getSubmissionPipelinesByStatus(
    status: string
  ): Promise<SubmissionPipeline[]> {
    const rows = await db
      .select()
      .from(submissionPipelines)
      .where(eq(submissionPipelines.status, status));
    return rows.map(toSubmissionPipeline);
  }

  /**
   * Get submission pipelines by phase
   */
  async getSubmissionPipelinesByPhase(
    phase: string
  ): Promise<SubmissionPipeline[]> {
    const rows = await db
      .select()
      .from(submissionPipelines)
      .where(eq(submissionPipelines.currentPhase, phase));
    return rows.map(toSubmissionPipeline);
  }

  /**
   * Get active submission pipelines (pending or in_progress)
   */
  async getActiveSubmissionPipelines(): Promise<SubmissionPipeline[]> {
    const rows = await db
      .select()
      .from(submissionPipelines)
      .where(
        or(
          eq(submissionPipelines.status, 'pending'),
          eq(submissionPipelines.status, 'in_progress')
        )
      );
    return rows.map(toSubmissionPipeline);
  }

  /**
   * Create a new submission pipeline
   */
  async createSubmissionPipeline(
    pipeline: InsertSubmissionPipeline
  ): Promise<SubmissionPipeline> {
    const [newPipeline] = await db
      .insert(submissionPipelines)
      .values(pipeline)
      .returning();
    return toSubmissionPipeline(newPipeline);
  }

  /**
   * Update a submission pipeline
   */
  async updateSubmissionPipeline(
    id: string,
    updates: Partial<SubmissionPipeline>
  ): Promise<SubmissionPipeline> {
    const [updatedPipeline] = await db
      .update(submissionPipelines)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(submissionPipelines.id, id))
      .returning();
    return toSubmissionPipeline(updatedPipeline);
  }

  /**
   * Delete a submission pipeline
   */
  async deleteSubmissionPipeline(id: string): Promise<void> {
    await db.delete(submissionPipelines).where(eq(submissionPipelines.id, id));
  }

  // Submission Events

  /**
   * Get a submission event by ID
   */
  async getSubmissionEvent(id: string): Promise<SubmissionEvent | undefined> {
    const [event] = await db
      .select()
      .from(submissionEvents)
      .where(eq(submissionEvents.id, id));
    return event || undefined;
  }

  /**
   * Get submission events by pipeline ID
   */
  async getSubmissionEventsByPipeline(
    pipelineId: string
  ): Promise<SubmissionEvent[]> {
    return await db
      .select()
      .from(submissionEvents)
      .where(eq(submissionEvents.pipelineId, pipelineId))
      .orderBy(desc(submissionEvents.timestamp));
  }

  /**
   * Get submission events by submission ID
   */
  async getSubmissionEventsBySubmission(
    submissionId: string,
    limit?: number
  ): Promise<SubmissionEvent[]> {
    const baseQuery = db
      .select()
      .from(submissionEvents)
      .where(eq(submissionEvents.submissionId, submissionId))
      .orderBy(desc(submissionEvents.timestamp));

    const query =
      typeof limit === 'number' ? baseQuery.limit(limit) : baseQuery;

    return await query;
  }

  /**
   * Get submission events by type
   */
  async getSubmissionEventsByType(
    eventType: string
  ): Promise<SubmissionEvent[]> {
    return await db
      .select()
      .from(submissionEvents)
      .where(eq(submissionEvents.eventType, eventType))
      .orderBy(desc(submissionEvents.timestamp));
  }

  /**
   * Get recent submission events
   */
  async getRecentSubmissionEvents(
    limit: number = 50
  ): Promise<SubmissionEvent[]> {
    return await db
      .select()
      .from(submissionEvents)
      .orderBy(desc(submissionEvents.timestamp))
      .limit(limit);
  }

  /**
   * Create a new submission event
   */
  async createSubmissionEvent(
    event: InsertSubmissionEvent
  ): Promise<SubmissionEvent> {
    const [newEvent] = await db
      .insert(submissionEvents)
      .values(event)
      .returning();
    return newEvent;
  }

  // Submission Status History

  /**
   * Get submission status history by submission ID
   */
  async getSubmissionStatusHistory(
    submissionId: string
  ): Promise<SubmissionStatusHistory[]> {
    return await db
      .select()
      .from(submissionStatusHistory)
      .where(eq(submissionStatusHistory.submissionId, submissionId))
      .orderBy(desc(submissionStatusHistory.timestamp));
  }

  /**
   * Get submission status history by pipeline ID
   */
  async getSubmissionStatusHistoryByPipeline(
    pipelineId: string
  ): Promise<SubmissionStatusHistory[]> {
    return await db
      .select()
      .from(submissionStatusHistory)
      .where(eq(submissionStatusHistory.pipelineId, pipelineId))
      .orderBy(desc(submissionStatusHistory.timestamp));
  }

  /**
   * Create a new submission status history entry
   */
  async createSubmissionStatusHistory(
    statusHistory: InsertSubmissionStatusHistory
  ): Promise<SubmissionStatusHistory> {
    const [newStatusHistory] = await db
      .insert(submissionStatusHistory)
      .values(statusHistory)
      .returning();
    return newStatusHistory;
  }
}

export const submissionRepository = new SubmissionRepository();
