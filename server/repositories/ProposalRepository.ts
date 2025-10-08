import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  proposals,
  type Proposal,
  type InsertProposal,
  type ProposalRow,
  type SubmissionReceiptData,
} from '@shared/schema';
import { BaseRepository } from './BaseRepository';

const toProposal = (row: ProposalRow): Proposal => ({
  ...row,
  receiptData: (row.receiptData as SubmissionReceiptData | null) ?? null,
});

/**
 * Repository for managing proposals
 * Handles proposal CRUD operations and RFP associations
 */
export class ProposalRepository extends BaseRepository<typeof proposals> {
  constructor() {
    super(proposals);
  }

  /**
   * Get a proposal by ID
   */
  async getProposal(id: string): Promise<Proposal | undefined> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id));
    return proposal ? toProposal(proposal) : undefined;
  }

  /**
   * Get proposal by RFP ID
   */
  async getProposalByRFP(rfpId: string): Promise<Proposal | undefined> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.rfpId, rfpId));
    return proposal ? toProposal(proposal) : undefined;
  }

  /**
   * Create a new proposal
   */
  async createProposal(proposal: InsertProposal): Promise<Proposal> {
    const [newProposal] = await db
      .insert(proposals)
      .values(proposal)
      .returning();
    return toProposal(newProposal);
  }

  /**
   * Update a proposal
   */
  async updateProposal(
    id: string,
    updates: Partial<Proposal>
  ): Promise<Proposal> {
    const [updatedProposal] = await db
      .update(proposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(proposals.id, id))
      .returning();
    return toProposal(updatedProposal);
  }

  /**
   * Delete a proposal
   */
  async deleteProposal(id: string): Promise<void> {
    await db.delete(proposals).where(eq(proposals.id, id));
  }
}

export const proposalRepository = new ProposalRepository();
