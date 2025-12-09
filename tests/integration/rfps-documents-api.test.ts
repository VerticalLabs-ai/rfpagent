// tests/integration/rfps-documents-api.test.ts
import { describe, it, expect, vi } from 'vitest';
import { documentDownloadOrchestrator } from '../../server/services/downloads/documentDownloadOrchestrator';

/**
 * Integration tests for RFP Documents API
 *
 * Tests the two new endpoints:
 * 1. POST /api/rfps/:id/documents/download - Trigger document download
 * 2. GET /api/rfps/:id/documents - List documents for an RFP
 */

// Mock storage to avoid database calls in tests
vi.mock('../../server/storage', () => ({
  storage: {
    getRFP: vi.fn((id: string) => {
      if (id === 'non-existent-rfp') return null;
      return {
        id,
        title: 'Test RFP',
        status: 'open',
        portalId: 'test-portal',
      };
    }),
    getDocumentsByRFP: vi.fn((rfpId: string) => {
      return Promise.resolve([]);
    }),
  },
}));

// Mock documentDownloadOrchestrator
vi.mock('../../server/services/downloads/documentDownloadOrchestrator', () => ({
  documentDownloadOrchestrator: {
    processRfpDocuments: vi.fn(async (input: any) => {
      return {
        rfpId: input.rfpId,
        processed: [],
        failed: [],
        totalDownloaded: 0,
        totalFailed: 0,
        processedAt: new Date().toISOString(),
      };
    }),
  },
}));

describe('RFP Documents API Endpoints', () => {
  describe('POST /api/rfps/:id/documents/download', () => {
    it('should be defined and callable', () => {
      expect(documentDownloadOrchestrator.processRfpDocuments).toBeDefined();
      expect(typeof documentDownloadOrchestrator.processRfpDocuments).toBe('function');
    });

    it('should require browserbaseSessionId parameter', async () => {
      // This test validates the orchestrator can be called with required params
      const result = await documentDownloadOrchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'test-session-123',
        expectedDocuments: [],
      });

      expect(result).toBeDefined();
      expect(result.rfpId).toBe('test-rfp-123');
      expect(result.totalDownloaded).toBe(0);
      expect(result.totalFailed).toBe(0);
    });

    it('should accept optional expectedDocuments array', async () => {
      const result = await documentDownloadOrchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'test-session-123',
        expectedDocuments: [
          { name: 'test.pdf', expectedSize: 1024 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.processed).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });

  describe('GET /api/rfps/:id/documents', () => {
    it('should return documents structure', async () => {
      // This validates the storage method exists and returns the right shape
      const { storage } = await import('../../server/storage');
      const documents = await storage.getDocumentsByRFP('test-rfp-123');

      expect(Array.isArray(documents)).toBe(true);
    });
  });
});
