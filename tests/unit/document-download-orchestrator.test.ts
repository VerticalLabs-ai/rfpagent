import { DocumentDownloadOrchestrator } from '../../server/services/downloads/documentDownloadOrchestrator';
import { browserbaseDownloadService } from '../../server/services/downloads/browserbaseDownloadService';
import { ObjectStorageService } from '../../server/objectStorage';
import { db } from '../../server/db';

// Mock dependencies
jest.mock('../../server/services/downloads/browserbaseDownloadService');
jest.mock('../../server/objectStorage');
jest.mock('../../server/db');

describe('DocumentDownloadOrchestrator', () => {
  let orchestrator: DocumentDownloadOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new DocumentDownloadOrchestrator();
  });

  describe('processRfpDocuments', () => {
    it('should orchestrate document discovery, download, and verification', async () => {
      // Mock browserbaseDownloadService.retrieveDownloads
      const mockFiles = [
        {
          name: 'test-1234567890123.pdf',
          originalName: 'test.pdf',
          size: 1024,
          buffer: Buffer.from('fake pdf content'),
          mimeType: 'application/pdf',
        },
      ];

      (browserbaseDownloadService.retrieveDownloads as jest.Mock).mockResolvedValue({
        success: true,
        files: mockFiles,
        sessionId: 'bb-session-456',
        retrievedAt: new Date().toISOString(),
      });

      // Mock verifyFileSize
      (browserbaseDownloadService.verifyFileSize as jest.Mock).mockReturnValue({
        valid: true,
        actualSize: 1024,
        expectedSize: 1024,
        difference: 0,
        message: 'File size verified',
      });

      // Mock ObjectStorageService instance methods
      const mockUploadPrivateObject = jest.fn().mockResolvedValue(undefined);
      const mockGetPrivateObjectDir = jest.fn().mockReturnValue('test-bucket/private');

      // Mock the constructor to return our mocked methods
      (ObjectStorageService as jest.MockedClass<typeof ObjectStorageService>).mockImplementation(() => ({
        uploadPrivateObject: mockUploadPrivateObject,
        getPrivateObjectDir: mockGetPrivateObjectDir,
      } as any));

      // Mock db.insert with proper chaining
      const mockReturning = jest.fn().mockResolvedValue([
        {
          id: 'doc-123',
          rfpId: 'test-rfp-123',
          filename: 'test.pdf',
          objectPath: 'https://storage.googleapis.com/test-bucket/rfp_documents/test-rfp-123/123-test.pdf',
          downloadedSize: 1024,
        },
      ]);

      const mockValues = jest.fn().mockReturnValue({
        returning: mockReturning,
      });

      const mockDbInsert = jest.fn().mockReturnValue({
        values: mockValues,
      });

      (db as any).insert = mockDbInsert;

      // Re-create orchestrator after mocks are set
      orchestrator = new DocumentDownloadOrchestrator();

      const result = await orchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'bb-session-456',
        expectedDocuments: [{ name: 'test.pdf', expectedSize: 1024 }],
      });

      expect(result).toBeDefined();
      expect(result.rfpId).toBe('test-rfp-123');
      expect(result.processed).toBeDefined();
      expect(result.processed.length).toBe(1);
      expect(result.failed).toBeDefined();
      expect(result.totalDownloaded).toBe(1);
      expect(result.totalFailed).toBe(0);

      // Verify browserbaseDownloadService was called
      expect(browserbaseDownloadService.retrieveDownloads).toHaveBeenCalledWith(
        'bb-session-456',
        30,
      );

      // Verify upload was called
      expect(mockUploadPrivateObject).toHaveBeenCalled();

      // Verify database insert was called
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('should handle no downloads available', async () => {
      // Mock browserbaseDownloadService.retrieveDownloads - no downloads
      (browserbaseDownloadService.retrieveDownloads as jest.Mock).mockResolvedValue({
        success: false,
        files: [],
        error: 'No downloads available',
        sessionId: 'bb-session-456',
        retrievedAt: new Date().toISOString(),
      });

      const result = await orchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'bb-session-456',
        expectedDocuments: [{ name: 'test.pdf' }],
      });

      expect(result.success).toBe(false);
      expect(result.totalDownloaded).toBe(0);
      expect(result.totalFailed).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].filename).toBe('test.pdf');
    });

    it('should verify file sizes against expected values', async () => {
      const mockFiles = [
        {
          name: 'document-1234567890123.pdf',
          originalName: 'document.pdf',
          size: 100000, // Much smaller than expected
          buffer: Buffer.from('small file'),
          mimeType: 'application/pdf',
        },
      ];

      (browserbaseDownloadService.retrieveDownloads as jest.Mock).mockResolvedValue({
        success: true,
        files: mockFiles,
        sessionId: 'bb-session-456',
        retrievedAt: new Date().toISOString(),
      });

      // Mock verifyFileSize to return invalid
      (browserbaseDownloadService.verifyFileSize as jest.Mock).mockReturnValue({
        valid: false,
        actualSize: 100000,
        expectedSize: 279930,
        difference: -0.64,
        message: 'File size mismatch',
      });

      const mockObjectStorage = {
        uploadPrivateObject: jest.fn().mockResolvedValue(undefined),
        getPrivateObjectDir: jest.fn().mockReturnValue('test-bucket/private'),
      };
      (ObjectStorageService as jest.MockedClass<typeof ObjectStorageService>).mockImplementation(
        () => mockObjectStorage as any,
      );

      const mockDbInsert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'doc-123',
              verificationStatus: 'failed',
            },
          ]),
        }),
      });
      (db as any).insert = mockDbInsert;

      const result = await orchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'bb-session-456',
        expectedDocuments: [{ name: 'document.pdf', expectedSize: 279930 }],
      });

      expect(result.processed.length).toBe(1);
      expect(result.processed[0].verificationPassed).toBe(false);

      // Verify verifyFileSize was called
      expect(browserbaseDownloadService.verifyFileSize).toHaveBeenCalledWith(100000, 279930);
    });

    it('should track expected documents that were not downloaded', async () => {
      const mockFiles = [
        {
          name: 'document1-1234567890123.pdf',
          originalName: 'document1.pdf',
          size: 1024,
          buffer: Buffer.from('content'),
          mimeType: 'application/pdf',
        },
      ];

      (browserbaseDownloadService.retrieveDownloads as jest.Mock).mockResolvedValue({
        success: true,
        files: mockFiles,
        sessionId: 'bb-session-456',
        retrievedAt: new Date().toISOString(),
      });

      const mockObjectStorage = {
        uploadPrivateObject: jest.fn().mockResolvedValue(undefined),
        getPrivateObjectDir: jest.fn().mockReturnValue('test-bucket/private'),
      };
      (ObjectStorageService as jest.MockedClass<typeof ObjectStorageService>).mockImplementation(
        () => mockObjectStorage as any,
      );

      const mockDbInsert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'doc-123' }]),
        }),
      });
      (db as any).insert = mockDbInsert;

      const result = await orchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'bb-session-456',
        expectedDocuments: [
          { name: 'document1.pdf' },
          { name: 'document2.pdf' }, // This one is not in downloads
          { name: 'document3.pdf' }, // This one is also missing
        ],
      });

      expect(result.processed.length).toBe(1);
      expect(result.failed.length).toBe(2);
      expect(result.failed[0].filename).toBe('document2.pdf');
      expect(result.failed[1].filename).toBe('document3.pdf');
      expect(result.failed[0].error).toContain('not found');
    });
  });
});
