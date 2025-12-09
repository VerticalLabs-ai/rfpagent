/**
 * Integration Test for Full Document Download Flow
 *
 * Tests the complete document download pipeline:
 * 1. Session Manager → Browserbase session ID tracking
 * 2. BrowserbaseDownloadService → File retrieval and verification
 * 3. DocumentDownloadOrchestrator → Complete workflow coordination
 *
 * Note: Tests requiring Browserbase credentials are conditionally skipped
 */

import {
  BrowserbaseDownloadService,
  DownloadedFile,
  DownloadError,
} from '../../server/services/downloads/browserbaseDownloadService';
import { BrowserbaseSessionManager } from '../../src/mastra/tools/session-manager';
import {
  DocumentDownloadOrchestrator,
  ExpectedDocument,
} from '../../server/services/downloads/documentDownloadOrchestrator';

// Check if credentials are available
const hasBrowserbaseCredentials = !!(
  process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID
);

describe('Full Document Download Flow Integration', () => {
  describe('Component Integration', () => {
    describe('SessionManager and DownloadService Integration', () => {
      it('should be able to pass session IDs between components', () => {
        const sessionManager = new BrowserbaseSessionManager();
        const downloadService = new BrowserbaseDownloadService();

        // Verify the interfaces are compatible
        expect(sessionManager.getBrowserbaseSessionId).toBeDefined();
        expect(downloadService.retrieveDownloads).toBeDefined();

        // The session manager returns session IDs that can be used by download service
        const sessionId = sessionManager.getBrowserbaseSessionId('test');
        // For non-initialized sessions, returns undefined
        expect(sessionId).toBeUndefined();
      });

      it('should have consistent error handling between components', () => {
        // DownloadError can be used across all download-related components
        const error = DownloadError.fromHttpStatus(404, 'Document not found');

        expect(error.code).toBe('NOT_FOUND');
        expect(error.isRetryable).toBe(false);
        expect(error.toJSON()).toMatchObject({
          name: 'DownloadError',
          code: 'NOT_FOUND',
          isRetryable: false,
        });
      });
    });

    describe('File Size Verification Flow', () => {
      let downloadService: BrowserbaseDownloadService;

      beforeEach(() => {
        downloadService = new BrowserbaseDownloadService();
      });

      it('should verify files within tolerance', () => {
        // 279.93 KB = 286,649 bytes (from the example RFP document)
        const expectedSize = 286649;
        const actualSize = 286700; // Slightly larger

        const result = downloadService.verifyFileSize(actualSize, expectedSize, 0.05);

        expect(result.valid).toBe(true);
        expect(result.actualSize).toBe(actualSize);
        expect(result.expectedSize).toBe(expectedSize);
        expect(Math.abs(result.difference)).toBeLessThan(0.05);
      });

      it('should reject files outside tolerance', () => {
        const expectedSize = 286649;
        const actualSize = 100000; // Much smaller - corrupt/partial download

        const result = downloadService.verifyFileSize(actualSize, expectedSize, 0.05);

        expect(result.valid).toBe(false);
        expect(result.message).toContain('mismatch');
      });

      it('should handle edge cases', () => {
        // Zero expected size
        const zeroResult = downloadService.verifyFileSize(1000, 0);
        expect(zeroResult.valid).toBe(false);

        // Exact match
        const exactResult = downloadService.verifyFileSize(1000, 1000);
        expect(exactResult.valid).toBe(true);
        expect(exactResult.difference).toBe(0);
      });
    });

    describe('Download Error Handling Flow', () => {
      it('should create appropriate errors for different failure scenarios', () => {
        // Network timeout during download
        const timeoutError = DownloadError.timeout('fileDownload', 30000, {
          filename: 'RFP-document.pdf',
        });
        expect(timeoutError.code).toBe('TIMEOUT_ERROR');
        expect(timeoutError.isRetryable).toBe(true);

        // Access denied (authentication required)
        const accessError = DownloadError.fromHttpStatus(403, undefined, {
          portal: 'bonfirehub.com',
        });
        expect(accessError.code).toBe('ACCESS_DENIED');
        expect(accessError.isRetryable).toBe(false);

        // Size mismatch (possible corruption)
        const sizeError = DownloadError.sizeMismatch(100000, 286649, 'RFP.docx');
        expect(sizeError.code).toBe('SIZE_MISMATCH');
        expect(sizeError.isRetryable).toBe(false);
        expect(sizeError.details?.filename).toBe('RFP.docx');

        // Corrupt file (ZIP extraction failed)
        const corruptError = DownloadError.corruptFile(
          'downloads.zip',
          'Invalid ZIP header',
        );
        expect(corruptError.code).toBe('CORRUPT_FILE');

        // Storage failure (GCS upload failed)
        const storageError = DownloadError.storageError(
          'upload',
          'Bucket not accessible',
          { bucket: 'rfp-documents' },
        );
        expect(storageError.code).toBe('STORAGE_ERROR');
        expect(storageError.isRetryable).toBe(true);
      });

      it('should convert generic errors to structured errors', () => {
        const genericErrors = [
          { error: new Error('Connection timed out'), expectedCode: 'TIMEOUT_ERROR' },
          { error: new Error('ECONNREFUSED'), expectedCode: 'NETWORK_ERROR' },
          { error: new Error('Permission denied'), expectedCode: 'ACCESS_DENIED' },
          { error: new Error('File not found'), expectedCode: 'NOT_FOUND' },
        ];

        for (const { error, expectedCode } of genericErrors) {
          const downloadError = DownloadError.fromError(error);
          expect(downloadError.code).toBe(expectedCode);
        }
      });
    });

    describe('Document Orchestrator Interface', () => {
      it('should have correct interface for expected documents', () => {
        // Verify the ExpectedDocument interface matches what portals provide
        const expectedDoc: ExpectedDocument = {
          name: '36C24726R0007 Relocation Services 1225.docx',
          sourceUrl: 'https://sam.gov/downloads/36C24726R0007.docx',
          expectedSize: 286649, // ~279.93 KB
        };

        expect(expectedDoc.name).toBeDefined();
        expect(expectedDoc.sourceUrl).toBeDefined();
        expect(expectedDoc.expectedSize).toBeDefined();
      });

      it('should instantiate without error', () => {
        const orchestrator = new DocumentDownloadOrchestrator();
        expect(orchestrator).toBeDefined();
        expect(orchestrator.processRfpDocuments).toBeDefined();
      });
    });
  });

  // Conditional tests that require Browserbase credentials
  const describeWithCredentials = hasBrowserbaseCredentials ? describe : describe.skip;

  describeWithCredentials('Live Browserbase Integration', () => {
    let sessionManager: BrowserbaseSessionManager;

    beforeEach(() => {
      sessionManager = new BrowserbaseSessionManager();
    });

    afterEach(async () => {
      await sessionManager.cleanup();
    });

    it(
      'should create session and get Browserbase session ID',
      async () => {
        const localSessionId = `integration-test-${Date.now()}`;

        // Create a new session
        await sessionManager.ensureStagehand(localSessionId);

        // Get the Browserbase session ID
        const bbSessionId = sessionManager.getBrowserbaseSessionId(localSessionId);

        expect(bbSessionId).toBeDefined();
        expect(typeof bbSessionId).toBe('string');
        expect(bbSessionId!.length).toBeGreaterThan(0);

        // Clean up
        await sessionManager.closeSession(localSessionId);

        // After closing, ID should be removed
        const idAfterClose = sessionManager.getBrowserbaseSessionId(localSessionId);
        expect(idAfterClose).toBeUndefined();
      },
      120000,
    ); // 2 minute timeout for browser operations

    it(
      'should enable download behavior during session initialization',
      async () => {
        const localSessionId = `download-enabled-${Date.now()}`;

        // The ensureStagehand method should enable download behavior automatically
        const stagehand = await sessionManager.ensureStagehand(localSessionId);

        expect(stagehand).toBeDefined();
        expect(stagehand.context).toBeDefined();

        // Verify we have a page
        const pages = await stagehand.context.pages();
        expect(pages.length).toBeGreaterThan(0);

        await sessionManager.closeSession(localSessionId);
      },
      120000,
    );
  });

  describe('Mock Download Flow', () => {
    it('should handle the complete mock download scenario', async () => {
      // This tests the flow logic without actually hitting Browserbase
      const mockDownloadedFiles: DownloadedFile[] = [
        {
          name: 'RFP-Document-1702345678901.pdf',
          originalName: 'RFP-Document.pdf',
          size: 1024 * 100, // 100 KB
          buffer: Buffer.alloc(1024 * 100),
          mimeType: 'application/pdf',
        },
        {
          name: 'Addendum-1702345678902.docx',
          originalName: 'Addendum.docx',
          size: 1024 * 50, // 50 KB
          buffer: Buffer.alloc(1024 * 50),
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ];

      const expectedDocuments: ExpectedDocument[] = [
        {
          name: 'RFP-Document.pdf',
          sourceUrl: 'https://portal.gov/rfp.pdf',
          expectedSize: 1024 * 100,
        },
        {
          name: 'Addendum.docx',
          sourceUrl: 'https://portal.gov/addendum.docx',
          expectedSize: 1024 * 50,
        },
      ];

      // Simulate matching downloaded files to expected documents
      const matchedFiles: Array<{
        expected: ExpectedDocument;
        downloaded: DownloadedFile | undefined;
        verified: boolean;
      }> = [];

      const downloadService = new BrowserbaseDownloadService();

      for (const expected of expectedDocuments) {
        const downloaded = mockDownloadedFiles.find(
          (f) =>
            f.originalName.toLowerCase() === expected.name.toLowerCase() ||
            f.originalName.toLowerCase().includes(expected.name.split('.')[0].toLowerCase()),
        );

        let verified = false;
        if (downloaded && expected.expectedSize) {
          const verification = downloadService.verifyFileSize(
            downloaded.size,
            expected.expectedSize,
          );
          verified = verification.valid;
        }

        matchedFiles.push({ expected, downloaded, verified });
      }

      // Verify all files were matched
      expect(matchedFiles.length).toBe(2);
      expect(matchedFiles.every((m) => m.downloaded)).toBe(true);
      expect(matchedFiles.every((m) => m.verified)).toBe(true);
    });

    it('should detect mismatched file sizes in mock scenario', async () => {
      const downloadService = new BrowserbaseDownloadService();

      // Simulate a partial download (corruption scenario)
      const mockPartialFile: DownloadedFile = {
        name: 'RFP-partial.pdf',
        originalName: 'RFP.pdf',
        size: 50000, // Only 50 KB received
        buffer: Buffer.alloc(50000),
        mimeType: 'application/pdf',
      };

      const expectedSize = 286649; // ~279.93 KB expected

      const verification = downloadService.verifyFileSize(
        mockPartialFile.size,
        expectedSize,
      );

      expect(verification.valid).toBe(false);
      expect(verification.message).toContain('mismatch');

      // This should generate a SIZE_MISMATCH error
      const error = DownloadError.sizeMismatch(
        mockPartialFile.size,
        expectedSize,
        mockPartialFile.originalName,
      );
      expect(error.code).toBe('SIZE_MISMATCH');
    });
  });
});
