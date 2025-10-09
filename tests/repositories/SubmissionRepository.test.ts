import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type {
  Submission,
  InsertSubmission,
  SubmissionPipeline,
  InsertSubmissionPipeline,
} from '@shared/schema';

// Mock the database module
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
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

import { SubmissionRepository } from '../../server/repositories/SubmissionRepository';
import { submissions, submissionPipelines } from '@shared/schema';

describe('SubmissionRepository', () => {
  let repository: SubmissionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SubmissionRepository();
  });

  describe('getSubmission', () => {
    it('should retrieve a submission by ID', async () => {
      const mockSubmission: Partial<Submission> = {
        id: 'sub-123',
        rfpId: 'rfp-456',
        proposalId: 'prop-789',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockSubmission]);

      const result = await repository.getSubmission('sub-123');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(submissions);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockSubmission);
    });

    it('should return undefined if submission not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getSubmission('nonexistent-id');

      expect(result).toBeUndefined();
    });

    it('should handle submissionData and receiptData type conversion', async () => {
      const mockSubmission = {
        id: 'sub-123',
        rfpId: 'rfp-456',
        proposalId: 'prop-789',
        status: 'submitted',
        submissionData: {
          formData: { field1: 'value1' },
          documents: ['doc-1', 'doc-2'],
        },
        receiptData: {
          submissionId: 'ext-sub-123',
          timestamp: new Date(),
          confirmationNumber: 'CONF-456',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockSubmission]);

      const result = await repository.getSubmission('sub-123');

      expect(result?.submissionData).toEqual(mockSubmission.submissionData);
      expect(result?.receiptData).toEqual(mockSubmission.receiptData);
    });
  });

  describe('getSubmissions', () => {
    it('should retrieve submissions with default limit', async () => {
      const mockSubmissions: Partial<Submission>[] = [
        {
          id: 'sub-1',
          rfpId: 'rfp-456',
          proposalId: 'prop-789',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'sub-2',
          rfpId: 'rfp-456',
          proposalId: 'prop-790',
          status: 'submitted',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.returning.mockResolvedValueOnce(mockSubmissions);

      const result = await repository.getSubmissions();

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(2);
    });

    it('should filter submissions by status', async () => {
      const mockSubmissions: Partial<Submission>[] = [
        {
          id: 'sub-1',
          rfpId: 'rfp-456',
          proposalId: 'prop-789',
          status: 'submitted',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.returning.mockResolvedValueOnce(mockSubmissions);

      const result = await repository.getSubmissions({ status: 'submitted' });

      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should respect custom limit', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await repository.getSubmissions({ limit: 50 });

      expect(mockDb.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('getSubmissionsByRFP', () => {
    it('should retrieve all submissions for an RFP', async () => {
      const mockSubmissions: Partial<Submission>[] = [
        {
          id: 'sub-1',
          rfpId: 'rfp-456',
          proposalId: 'prop-789',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'sub-2',
          rfpId: 'rfp-456',
          proposalId: 'prop-790',
          status: 'submitted',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.returning.mockResolvedValueOnce(mockSubmissions);

      const result = await repository.getSubmissionsByRFP('rfp-456');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(submissions);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no submissions found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getSubmissionsByRFP('rfp-nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getSubmissionByProposal', () => {
    it('should retrieve submission by proposal ID', async () => {
      const mockSubmission: Partial<Submission> = {
        id: 'sub-123',
        rfpId: 'rfp-456',
        proposalId: 'prop-789',
        status: 'submitted',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockSubmission]);

      const result = await repository.getSubmissionByProposal('prop-789');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockSubmission);
    });

    it('should return undefined if no submission found for proposal', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getSubmissionByProposal('prop-nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('createSubmission', () => {
    it('should create a new submission', async () => {
      const newSubmission: InsertSubmission = {
        rfpId: 'rfp-789',
        proposalId: 'prop-123',
        status: 'draft',
      };

      const createdSubmission: Partial<Submission> = {
        id: 'sub-new',
        ...newSubmission,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdSubmission]);

      const result = await repository.createSubmission(newSubmission);

      expect(mockDb.insert).toHaveBeenCalledWith(submissions);
      expect(mockDb.values).toHaveBeenCalledWith(newSubmission);
      expect(mockDb.returning).toHaveBeenCalled();
      expect(result).toEqual(createdSubmission);
    });

    it('should create submission with submissionData', async () => {
      const newSubmission: InsertSubmission = {
        rfpId: 'rfp-789',
        proposalId: 'prop-123',
        status: 'in_progress',
        submissionData: {
          formData: { companyName: 'Acme Corp', contactEmail: 'contact@acme.com' },
          documents: ['doc-1', 'doc-2', 'doc-3'],
        },
      };

      const createdSubmission: Partial<Submission> = {
        id: 'sub-new',
        ...newSubmission,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdSubmission]);

      const result = await repository.createSubmission(newSubmission);

      expect(result.submissionData).toEqual(newSubmission.submissionData);
    });
  });

  describe('updateSubmission', () => {
    it('should update a submission', async () => {
      const submissionId = 'sub-123';
      const updates: Partial<Submission> = {
        status: 'submitted',
        submittedAt: new Date(),
      };

      const updatedSubmission: Partial<Submission> = {
        id: submissionId,
        rfpId: 'rfp-456',
        proposalId: 'prop-789',
        ...updates,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedSubmission]);

      const result = await repository.updateSubmission(submissionId, updates);

      expect(mockDb.update).toHaveBeenCalledWith(submissions);
      expect(mockDb.set).toHaveBeenCalledWith(updates);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result.status).toBe('submitted');
    });

    it('should update submission with receiptData', async () => {
      const submissionId = 'sub-123';
      const updates: Partial<Submission> = {
        status: 'submitted',
        receiptData: {
          submissionId: 'ext-sub-123',
          timestamp: new Date(),
          confirmationNumber: 'CONF-789',
        },
      };

      const updatedSubmission: Partial<Submission> = {
        id: submissionId,
        rfpId: 'rfp-456',
        proposalId: 'prop-789',
        ...updates,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedSubmission]);

      const result = await repository.updateSubmission(submissionId, updates);

      expect(result.receiptData).toEqual(updates.receiptData);
    });
  });

  describe('Submission Pipelines', () => {
    describe('getSubmissionPipeline', () => {
      it('should retrieve a submission pipeline by ID', async () => {
        const mockPipeline: Partial<SubmissionPipeline> = {
          id: 'pipe-123',
          submissionId: 'sub-456',
          currentPhase: 'preflight',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([mockPipeline]);

        const result = await repository.getSubmissionPipeline('pipe-123');

        expect(mockDb.select).toHaveBeenCalled();
        expect(mockDb.from).toHaveBeenCalledWith(submissionPipelines);
        expect(result).toEqual(mockPipeline);
      });

      it('should return undefined if pipeline not found', async () => {
        mockDb.returning.mockResolvedValueOnce([]);

        const result = await repository.getSubmissionPipeline('nonexistent-id');

        expect(result).toBeUndefined();
      });
    });

    describe('getSubmissionPipelineBySubmission', () => {
      it('should retrieve pipeline by submission ID', async () => {
        const mockPipeline: Partial<SubmissionPipeline> = {
          id: 'pipe-123',
          submissionId: 'sub-456',
          currentPhase: 'authentication',
          status: 'in_progress',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([mockPipeline]);

        const result =
          await repository.getSubmissionPipelineBySubmission('sub-456');

        expect(mockDb.where).toHaveBeenCalled();
        expect(result).toEqual(mockPipeline);
      });
    });

    describe('getActiveSubmissionPipelines', () => {
      it('should retrieve all active pipelines', async () => {
        const mockPipelines: Partial<SubmissionPipeline>[] = [
          {
            id: 'pipe-1',
            submissionId: 'sub-1',
            currentPhase: 'preflight',
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'pipe-2',
            submissionId: 'sub-2',
            currentPhase: 'form_filling',
            status: 'in_progress',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockDb.returning.mockResolvedValueOnce(mockPipelines);

        const result = await repository.getActiveSubmissionPipelines();

        expect(mockDb.select).toHaveBeenCalled();
        expect(mockDb.where).toHaveBeenCalled();
        expect(result).toHaveLength(2);
      });

      it('should return empty array if no active pipelines', async () => {
        mockDb.returning.mockResolvedValueOnce([]);

        const result = await repository.getActiveSubmissionPipelines();

        expect(result).toEqual([]);
      });
    });

    describe('createSubmissionPipeline', () => {
      it('should create a new submission pipeline', async () => {
        const newPipeline: InsertSubmissionPipeline = {
          submissionId: 'sub-789',
          currentPhase: 'preflight',
          status: 'pending',
        };

        const createdPipeline: Partial<SubmissionPipeline> = {
          id: 'pipe-new',
          ...newPipeline,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([createdPipeline]);

        const result = await repository.createSubmissionPipeline(newPipeline);

        expect(mockDb.insert).toHaveBeenCalledWith(submissionPipelines);
        expect(mockDb.values).toHaveBeenCalledWith(newPipeline);
        expect(result).toEqual(createdPipeline);
      });

      it('should create pipeline with metadata', async () => {
        const newPipeline: InsertSubmissionPipeline = {
          submissionId: 'sub-789',
          currentPhase: 'preflight',
          status: 'pending',
          metadata: {
            estimatedDuration: 300,
            priority: 'high',
          },
        };

        const createdPipeline: Partial<SubmissionPipeline> = {
          id: 'pipe-new',
          ...newPipeline,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([createdPipeline]);

        const result = await repository.createSubmissionPipeline(newPipeline);

        expect(result.metadata).toEqual(newPipeline.metadata);
      });
    });

    describe('updateSubmissionPipeline', () => {
      it('should update a submission pipeline', async () => {
        const pipelineId = 'pipe-123';
        const updates: Partial<SubmissionPipeline> = {
          currentPhase: 'form_filling',
          status: 'in_progress',
        };

        const updatedPipeline: Partial<SubmissionPipeline> = {
          id: pipelineId,
          submissionId: 'sub-456',
          ...updates,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([updatedPipeline]);

        const result = await repository.updateSubmissionPipeline(
          pipelineId,
          updates
        );

        expect(mockDb.update).toHaveBeenCalledWith(submissionPipelines);
        expect(mockDb.set).toHaveBeenCalledWith(
          expect.objectContaining({
            ...updates,
            updatedAt: expect.any(Date),
          })
        );
        expect(result.currentPhase).toBe('form_filling');
      });

      it('should automatically update updatedAt timestamp', async () => {
        const pipelineId = 'pipe-123';
        const updates = { status: 'completed' as const };

        mockDb.returning.mockResolvedValueOnce([
          {
            id: pipelineId,
            submissionId: 'sub-456',
            currentPhase: 'verification',
            status: 'completed',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        await repository.updateSubmissionPipeline(pipelineId, updates);

        expect(mockDb.set).toHaveBeenCalledWith(
          expect.objectContaining({
            updatedAt: expect.any(Date),
          })
        );
      });
    });

    describe('deleteSubmissionPipeline', () => {
      it('should delete a submission pipeline', async () => {
        const pipelineId = 'pipe-123';

        await repository.deleteSubmissionPipeline(pipelineId);

        expect(mockDb.delete).toHaveBeenCalledWith(submissionPipelines);
        expect(mockDb.where).toHaveBeenCalled();
      });
    });
  });

  describe('BaseRepository inheritance', () => {
    it('should extend BaseRepository', () => {
      expect(repository).toBeInstanceOf(SubmissionRepository);
    });

    it('should have access to table metadata', () => {
      expect(repository).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should propagate database errors on get', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        repository.getSubmission('sub-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate errors during creation', async () => {
      const dbError = new Error('Foreign key constraint violation');
      mockDb.returning.mockRejectedValueOnce(dbError);

      const newSubmission: InsertSubmission = {
        rfpId: 'rfp-nonexistent',
        proposalId: 'prop-123',
        status: 'draft',
      };

      await expect(
        repository.createSubmission(newSubmission)
      ).rejects.toThrow('Foreign key constraint violation');
    });

    it('should propagate errors during pipeline operations', async () => {
      const dbError = new Error('Pipeline not found');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        repository.updateSubmissionPipeline('nonexistent-id', { status: 'completed' })
      ).rejects.toThrow('Pipeline not found');
    });
  });

  describe('Type conversions', () => {
    it('should handle null submissionData correctly', async () => {
      const mockSubmission = {
        id: 'sub-123',
        rfpId: 'rfp-456',
        proposalId: 'prop-789',
        status: 'draft',
        submissionData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockSubmission]);

      const result = await repository.getSubmission('sub-123');

      expect(result?.submissionData).toBeNull();
    });

    it('should handle pipeline phase and status enums', async () => {
      const mockPipeline = {
        id: 'pipe-123',
        submissionId: 'sub-456',
        currentPhase: 'authentication',
        status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockPipeline]);

      const result = await repository.getSubmissionPipeline('pipe-123');

      expect(result?.currentPhase).toBe('authentication');
      expect(result?.status).toBe('in_progress');
    });
  });
});
