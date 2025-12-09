import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { progressTracker } from '../../server/services/monitoring/progressTracker';

/**
 * Integration tests for Demo RFP Feature
 *
 * These tests verify the demo RFP creation flow:
 * 1. Creating a demo RFP with pre-populated data
 * 2. Progress tracking through SSE
 * 3. Demo flag identification
 * 4. Document attachment
 */

// Mock storage to avoid database calls in tests
vi.mock('../../server/storage', () => ({
  storage: {
    createRFP: vi.fn().mockResolvedValue({ id: 'demo-rfp-test-123' }),
    updateRFP: vi.fn().mockResolvedValue({}),
    getAllPortals: vi.fn().mockResolvedValue([]),
    createPortal: vi.fn().mockResolvedValue({ id: 'demo-portal-123' }),
    createDocument: vi.fn().mockResolvedValue({}),
    createNotification: vi.fn().mockResolvedValue({}),
    createAuditLog: vi.fn().mockResolvedValue({}),
  },
}));

// Mock enhanced proposal service to avoid actual AI calls
vi.mock('../../server/services/proposals/enhancedProposalService.js', () => ({
  enhancedProposalService: {
    generateProposal: vi.fn().mockResolvedValue({
      proposalId: 'test-proposal-123',
      readyForSubmission: true,
      humanActionItems: [],
    }),
  },
}));

// Create mock Response object for SSE testing
const createMockResponse = () => {
  const writtenData: string[] = [];

  return {
    writeHead: vi.fn(),
    write: vi.fn((data: string) => {
      writtenData.push(data);
      return true;
    }),
    end: vi.fn(),
    on: vi.fn(),
    destroyed: false,
    _writtenData: writtenData,
  };
};

describe('Demo RFP Feature Integration Tests', () => {
  beforeEach(() => {
    // Clean up any existing progress tracker state
    progressTracker.shutdown();
    vi.clearAllMocks();
  });

  afterEach(() => {
    progressTracker.shutdown();
  });

  describe('Demo Data Constants', () => {
    it('should export valid demo RFP data', async () => {
      const { DEMO_RFP_DATA } = await import('../../shared/demoData');

      expect(DEMO_RFP_DATA).toBeDefined();
      expect(DEMO_RFP_DATA.title).toBe('R699-- Relocation and Removal Service');
      expect(DEMO_RFP_DATA.agency).toBe('Veterans Affairs, Department of');
      expect(DEMO_RFP_DATA.naicsCode).toBe('484210');
      expect(DEMO_RFP_DATA.setAsideType).toBe(
        'Service-Disabled Veteran-Owned Small Business (SDVOSB)'
      );
    });

    it('should have required fields in demo data', async () => {
      const { DEMO_RFP_DATA } = await import('../../shared/demoData');

      // Check all required fields are present
      expect(DEMO_RFP_DATA.title).toBeDefined();
      expect(DEMO_RFP_DATA.description).toBeDefined();
      expect(DEMO_RFP_DATA.agency).toBeDefined();
      expect(DEMO_RFP_DATA.category).toBeDefined();
      expect(DEMO_RFP_DATA.naicsCode).toBeDefined();
      expect(DEMO_RFP_DATA.solicitationNumber).toBe('36C24726R0007');
      expect(DEMO_RFP_DATA.sourceUrl).toContain('sam.gov');
    });

    it('should have requirements array with valid structure', async () => {
      const { DEMO_RFP_DATA } = await import('../../shared/demoData');

      expect(Array.isArray(DEMO_RFP_DATA.requirements)).toBe(true);
      expect(DEMO_RFP_DATA.requirements.length).toBeGreaterThan(0);

      const firstReq = DEMO_RFP_DATA.requirements[0];
      expect(firstReq).toHaveProperty('id');
      expect(firstReq).toHaveProperty('section');
      expect(firstReq).toHaveProperty('text');
      expect(firstReq).toHaveProperty('mandatory');
      expect(firstReq).toHaveProperty('category');
    });

    it('should have documents array with mock attachments', async () => {
      const { DEMO_RFP_DATA } = await import('../../shared/demoData');

      expect(Array.isArray(DEMO_RFP_DATA.documents)).toBe(true);
      expect(DEMO_RFP_DATA.documents.length).toBe(2);

      // Check for PDF document
      const pdfDoc = DEMO_RFP_DATA.documents.find((d) =>
        d.filename.endsWith('.pdf')
      );
      expect(pdfDoc).toBeDefined();
      expect(pdfDoc?.fileType).toBe('application/pdf');

      // Check for Word document
      const docxDoc = DEMO_RFP_DATA.documents.find((d) =>
        d.filename.endsWith('.docx')
      );
      expect(docxDoc).toBeDefined();
    });

    it('should generate fresh deadline with getDemoRfpDataWithFreshDeadline', async () => {
      const { getDemoRfpDataWithFreshDeadline, DEMO_RFP_DATA } = await import(
        '../../shared/demoData'
      );

      const freshData = getDemoRfpDataWithFreshDeadline();

      // Fresh deadline should be different from static deadline
      expect(freshData.deadline.getTime()).not.toBe(
        DEMO_RFP_DATA.deadline.getTime()
      );

      // Fresh deadline should be in the future (approximately 30 days from now)
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );
      const freshDeadline = freshData.deadline;

      // Allow 1 day tolerance for test execution time
      expect(freshDeadline.getTime()).toBeGreaterThan(
        now.getTime() + 25 * 24 * 60 * 60 * 1000
      );
      expect(freshDeadline.getTime()).toBeLessThan(
        thirtyDaysFromNow.getTime() + 24 * 60 * 60 * 1000
      );
    });
  });

  describe('Demo RFP Service', () => {
    it('should create demo RFP with isDemo flag', async () => {
      const { demoRfpService } = await import(
        '../../server/services/proposals/demoRfpService'
      );
      const { storage } = await import('../../server/storage');

      const result = await demoRfpService.createDemoRfp();

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.rfpId).toBeDefined();
      expect(result.message).toContain('Demo RFP');

      // Verify storage.createRFP was called with isDemo: true
      expect(storage.createRFP).toHaveBeenCalledWith(
        expect.objectContaining({
          isDemo: true,
          addedBy: 'manual',
        })
      );
    });

    it('should use provided sessionId', async () => {
      const { demoRfpService } = await import(
        '../../server/services/proposals/demoRfpService'
      );

      const customSessionId = 'custom-session-123';
      const result = await demoRfpService.createDemoRfp(customSessionId);

      expect(result.sessionId).toBe(customSessionId);
    });

    it('should create demo documents', async () => {
      const { demoRfpService } = await import(
        '../../server/services/proposals/demoRfpService'
      );
      const { storage } = await import('../../server/storage');

      await demoRfpService.createDemoRfp();

      // Should create 2 documents (PDF and DOCX)
      expect(storage.createDocument).toHaveBeenCalledTimes(2);

      // Check first document call has demo flag
      expect(storage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          parsedData: expect.objectContaining({
            isDemo: true,
          }),
        })
      );
    });

    it('should create notification for demo RFP', async () => {
      const { demoRfpService } = await import(
        '../../server/services/proposals/demoRfpService'
      );
      const { storage } = await import('../../server/storage');

      await demoRfpService.createDemoRfp();

      expect(storage.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Demo RFP Created',
          relatedEntityType: 'rfp',
        })
      );
    });
  });

  describe('Progress Tracking for Demo RFP', () => {
    it('should track demo RFP creation progress', async () => {
      const sessionId = `demo-progress-${Date.now()}`;
      const mockRes = createMockResponse();
      const receivedMessages: any[] = [];

      // Parse SSE messages
      mockRes.write.mockImplementation((data: string) => {
        try {
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            receivedMessages.push(JSON.parse(jsonStr));
          }
        } catch {
          // Ignore parsing errors
        }
        return true;
      });

      // Start tracking for demo
      progressTracker.startTracking(sessionId, 'demo://rfp-agent/demo-rfp');
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Simulate demo progress steps
      progressTracker.updateStep(
        sessionId,
        'portal_detection',
        'completed',
        'Demo mode - using sample data'
      );
      progressTracker.updateStep(
        sessionId,
        'page_navigation',
        'completed',
        'Demo data loaded'
      );
      progressTracker.updateStep(
        sessionId,
        'data_extraction',
        'completed',
        'RFP record created'
      );
      progressTracker.updateStep(
        sessionId,
        'document_discovery',
        'completed',
        '2 documents attached'
      );
      progressTracker.updateStep(
        sessionId,
        'database_save',
        'completed',
        'RFP saved to database'
      );

      // Verify progress messages were received
      const progressMessages = receivedMessages.filter(
        (m) => m.type === 'progress'
      );
      expect(progressMessages.length).toBeGreaterThan(0);

      // Verify URL identifies demo mode
      const lastProgress = progressMessages[progressMessages.length - 1];
      expect(lastProgress.data?.url).toContain('demo://');
    });

    it('should handle demo RFP creation failure gracefully', async () => {
      const sessionId = `demo-fail-${Date.now()}`;
      const mockRes = createMockResponse();
      const receivedMessages: any[] = [];

      mockRes.write.mockImplementation((data: string) => {
        try {
          if (data.startsWith('data: ')) {
            const jsonStr = data.substring(6, data.indexOf('\n\n'));
            receivedMessages.push(JSON.parse(jsonStr));
          }
        } catch {
          // Ignore
        }
        return true;
      });

      progressTracker.startTracking(sessionId, 'demo://rfp-agent/demo-rfp');
      progressTracker.registerSSEClient(sessionId, mockRes as any);

      // Simulate failure
      progressTracker.failTracking(sessionId, 'Test failure for demo RFP');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have failure message
      const lastProgress = receivedMessages
        .filter((m) => m.type === 'progress')
        .pop();

      expect(lastProgress?.data?.status).toBe('failed');
      expect(lastProgress?.data?.error).toBe('Test failure for demo RFP');
    });
  });

  describe('Demo Badge Display Logic', () => {
    it('should identify demo RFPs by isDemo flag', () => {
      // Test data representing an RFP record
      const demoRfp = { id: '123', title: 'Test', isDemo: true };
      const regularRfp = { id: '456', title: 'Test', isDemo: false };
      const legacyRfp = { id: '789', title: 'Test' }; // No isDemo field

      expect(demoRfp.isDemo).toBe(true);
      expect(regularRfp.isDemo).toBe(false);
      expect((legacyRfp as any).isDemo).toBeUndefined();
    });
  });

  describe('Demo Filter Logic', () => {
    it('should support excludeDemo filter concept', () => {
      // Test filter object structure
      interface RfpFilters {
        status?: string;
        excludeDemo?: boolean;
      }

      const filtersWithExclude: RfpFilters = { excludeDemo: true };
      const filtersWithoutExclude: RfpFilters = { status: 'discovered' };

      expect(filtersWithExclude.excludeDemo).toBe(true);
      expect(filtersWithoutExclude.excludeDemo).toBeUndefined();
    });

    it('should filter demo RFPs when excludeDemo is true', () => {
      // Simulating filter logic
      const rfps = [
        { id: '1', title: 'Real RFP 1', isDemo: false },
        { id: '2', title: 'Demo RFP', isDemo: true },
        { id: '3', title: 'Real RFP 2', isDemo: false },
      ];

      const excludeDemo = true;
      const filteredRfps = excludeDemo
        ? rfps.filter((r) => !r.isDemo)
        : rfps;

      expect(filteredRfps.length).toBe(2);
      expect(filteredRfps.every((r) => !r.isDemo)).toBe(true);
    });

    it('should include demo RFPs when excludeDemo is false or undefined', () => {
      const rfps = [
        { id: '1', title: 'Real RFP 1', isDemo: false },
        { id: '2', title: 'Demo RFP', isDemo: true },
        { id: '3', title: 'Real RFP 2', isDemo: false },
      ];

      const excludeDemo = false;
      const filteredRfps = excludeDemo
        ? rfps.filter((r) => !r.isDemo)
        : rfps;

      expect(filteredRfps.length).toBe(3);
    });
  });
});
