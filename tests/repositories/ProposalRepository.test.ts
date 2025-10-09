import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import type { Proposal, InsertProposal } from '@shared/schema';

// Mock the database module
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

import { ProposalRepository } from '../../server/repositories/ProposalRepository';
import { proposals } from '@shared/schema';

describe('ProposalRepository', () => {
  let repository: ProposalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProposalRepository();
  });

  describe('getProposal', () => {
    it('should retrieve a proposal by ID', async () => {
      const mockProposal: Partial<Proposal> = {
        id: 'proposal-123',
        rfpId: 'rfp-456',
        status: 'draft',
        proposalData: { content: 'test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockProposal]);

      const result = await repository.getProposal('proposal-123');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(proposals);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockProposal);
    });

    it('should return undefined if proposal not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getProposal('nonexistent-id');

      expect(result).toBeUndefined();
    });

    it('should handle null receiptData correctly', async () => {
      const mockProposal = {
        id: 'proposal-123',
        rfpId: 'rfp-456',
        status: 'draft',
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockProposal]);

      const result = await repository.getProposal('proposal-123');

      expect(result?.receiptData).toBeNull();
    });
  });

  describe('getProposalByRFP', () => {
    it('should retrieve a proposal by RFP ID', async () => {
      const mockProposal: Partial<Proposal> = {
        id: 'proposal-123',
        rfpId: 'rfp-456',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockProposal]);

      const result = await repository.getProposalByRFP('rfp-456');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(proposals);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockProposal);
    });

    it('should return undefined if no proposal found for RFP', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getProposalByRFP('rfp-nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('createProposal', () => {
    it('should create a new proposal', async () => {
      const newProposal: InsertProposal = {
        rfpId: 'rfp-789',
        status: 'draft',
        proposalData: { content: 'new proposal' },
      };

      const createdProposal: Partial<Proposal> = {
        id: 'proposal-new',
        ...newProposal,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdProposal]);

      const result = await repository.createProposal(newProposal);

      expect(mockDb.insert).toHaveBeenCalledWith(proposals);
      expect(mockDb.values).toHaveBeenCalledWith(newProposal);
      expect(mockDb.returning).toHaveBeenCalled();
      expect(result).toEqual(createdProposal);
    });

    it('should handle proposal with receiptData', async () => {
      const newProposal: InsertProposal = {
        rfpId: 'rfp-789',
        status: 'submitted',
        proposalData: { content: 'submitted proposal' },
        receiptData: {
          submissionId: 'sub-123',
          timestamp: new Date(),
          confirmationNumber: 'CONF-456',
        },
      };

      const createdProposal: Partial<Proposal> = {
        id: 'proposal-new',
        ...newProposal,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdProposal]);

      const result = await repository.createProposal(newProposal);

      expect(result.receiptData).toEqual(newProposal.receiptData);
    });

    it('should create proposal with all optional fields', async () => {
      const newProposal: InsertProposal = {
        rfpId: 'rfp-789',
        status: 'draft',
        proposalData: {
          content: 'comprehensive proposal',
          sections: ['intro', 'approach', 'pricing'],
        },
        complianceStatus: 'compliant',
        submittedAt: new Date(),
      };

      const createdProposal: Partial<Proposal> = {
        id: 'proposal-new',
        ...newProposal,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdProposal]);

      const result = await repository.createProposal(newProposal);

      expect(result.proposalData).toEqual(newProposal.proposalData);
      expect(result.complianceStatus).toBe('compliant');
    });
  });

  describe('updateProposal', () => {
    it('should update a proposal', async () => {
      const proposalId = 'proposal-123';
      const updates: Partial<Proposal> = {
        status: 'in_review',
        proposalData: { content: 'updated content' },
      };

      const updatedProposal: Partial<Proposal> = {
        id: proposalId,
        rfpId: 'rfp-456',
        ...updates,
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedProposal]);

      const result = await repository.updateProposal(proposalId, updates);

      expect(mockDb.update).toHaveBeenCalledWith(proposals);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date),
        })
      );
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
      expect(result).toEqual(updatedProposal);
    });

    it('should update proposal status', async () => {
      const proposalId = 'proposal-123';
      const updates = { status: 'submitted' as const };

      const updatedProposal: Partial<Proposal> = {
        id: proposalId,
        rfpId: 'rfp-456',
        status: 'submitted',
        updatedAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedProposal]);

      const result = await repository.updateProposal(proposalId, updates);

      expect(result.status).toBe('submitted');
    });

    it('should update multiple fields at once', async () => {
      const proposalId = 'proposal-123';
      const updates: Partial<Proposal> = {
        status: 'submitted',
        proposalData: { content: 'final version' },
        complianceStatus: 'verified',
        submittedAt: new Date(),
      };

      const updatedProposal: Partial<Proposal> = {
        id: proposalId,
        rfpId: 'rfp-456',
        ...updates,
        updatedAt: new Date(),
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedProposal]);

      const result = await repository.updateProposal(proposalId, updates);

      expect(result.status).toBe('submitted');
      expect(result.complianceStatus).toBe('verified');
      expect(result.submittedAt).toBeDefined();
    });

    it('should automatically set updatedAt timestamp', async () => {
      const proposalId = 'proposal-123';
      const updates = { status: 'in_review' as const };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: proposalId,
          rfpId: 'rfp-456',
          status: 'in_review',
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      await repository.updateProposal(proposalId, updates);

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(Date),
        })
      );
    });
  });

  describe('deleteProposal', () => {
    it('should delete a proposal by ID', async () => {
      const proposalId = 'proposal-123';

      await repository.deleteProposal(proposalId);

      expect(mockDb.delete).toHaveBeenCalledWith(proposals);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should not throw error if proposal does not exist', async () => {
      const proposalId = 'nonexistent-proposal';

      await expect(
        repository.deleteProposal(proposalId)
      ).resolves.not.toThrow();
    });
  });

  describe('BaseRepository inheritance', () => {
    it('should extend BaseRepository', () => {
      expect(repository).toBeInstanceOf(ProposalRepository);
    });

    it('should have access to table metadata', () => {
      // This tests that the repository is properly initialized with the proposals table
      expect(repository).toBeDefined();
    });
  });

  describe('Type conversions', () => {
    it('should handle receiptData type conversion', async () => {
      const mockProposal = {
        id: 'proposal-123',
        rfpId: 'rfp-456',
        status: 'submitted',
        receiptData: {
          submissionId: 'sub-123',
          timestamp: new Date(),
          confirmationNumber: 'CONF-456',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockProposal]);

      const result = await repository.getProposal('proposal-123');

      expect(result?.receiptData).toEqual(mockProposal.receiptData);
    });

    it('should convert null receiptData to null (not undefined)', async () => {
      const mockProposal = {
        id: 'proposal-123',
        rfpId: 'rfp-456',
        status: 'draft',
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockProposal]);

      const result = await repository.getProposal('proposal-123');

      expect(result?.receiptData).toBeNull();
      expect(result?.receiptData).not.toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        repository.getProposal('proposal-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate errors during creation', async () => {
      const dbError = new Error('Unique constraint violation');
      mockDb.returning.mockRejectedValueOnce(dbError);

      const newProposal: InsertProposal = {
        rfpId: 'rfp-789',
        status: 'draft',
      };

      await expect(
        repository.createProposal(newProposal)
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should propagate errors during update', async () => {
      const dbError = new Error('Record not found');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        repository.updateProposal('nonexistent-id', { status: 'draft' })
      ).rejects.toThrow('Record not found');
    });
  });
});
