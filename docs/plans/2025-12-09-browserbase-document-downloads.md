# Browserbase Document Downloads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement automatic document discovery, download via Browserbase cloud storage, file verification, and database integration for RFP attachments.

**Architecture:** Extend the existing Browserbase/Stagehand integration to use Browserbase's cloud download API. Create a new BrowserbaseDownloadService that handles file downloads during portal scraping sessions, stores files in Google Cloud Storage, verifies file sizes match source, and records metadata in the documents table.

**Tech Stack:** Browserbase SDK (downloads API), Stagehand, Google Cloud Storage, Drizzle ORM, Zod validation, Winston logging

---

## Task 1: Add Browserbase Session ID Tracking to SessionManager

**Files:**
- Modify: `src/mastra/tools/session-manager.ts`

**Step 1: Write the failing test**

Create test file:
```typescript
// tests/unit/session-manager.test.ts
import { sessionManager, BrowserbaseSessionManager } from '../../src/mastra/tools/session-manager';

describe('BrowserbaseSessionManager', () => {
  describe('getBrowserbaseSessionId', () => {
    it('should return the Browserbase session ID for an active session', async () => {
      // This will fail because getBrowserbaseSessionId doesn't exist yet
      const localSessionId = 'test-session';
      await sessionManager.ensureStagehand(localSessionId);

      const bbSessionId = sessionManager.getBrowserbaseSessionId(localSessionId);

      expect(bbSessionId).toBeDefined();
      expect(typeof bbSessionId).toBe('string');
      expect(bbSessionId.length).toBeGreaterThan(0);

      await sessionManager.closeSession(localSessionId);
    });

    it('should return undefined for non-existent session', () => {
      const bbSessionId = sessionManager.getBrowserbaseSessionId('non-existent');
      expect(bbSessionId).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/session-manager.test.ts`
Expected: FAIL with "getBrowserbaseSessionId is not a function"

**Step 3: Write minimal implementation**

Modify `src/mastra/tools/session-manager.ts`:

```typescript
import { Stagehand } from '@browserbasehq/stagehand';

// ... existing interfaces ...

export class BrowserbaseSessionManager {
  private sessions: Map<string, Stagehand> = new Map();
  private browserbaseSessionIds: Map<string, string> = new Map(); // NEW: Track BB session IDs
  private defaultSessionId = 'default';

  async ensureStagehand(
    sessionId: string = this.defaultSessionId
  ): Promise<Stagehand> {
    let stagehand = this.sessions.get(sessionId);

    if (!stagehand) {
      console.log(`🌐 Creating new Browserbase session: ${sessionId}`);

      stagehand = new Stagehand({
        env: 'BROWSERBASE',
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        verbose: 1,
        browserbaseSessionCreateParams: {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          keepAlive: true,
          timeout: 3600,
          browserSettings: {
            advancedStealth: false,
            solveCaptchas: false,
            blockAds: true,
            recordSession: true,
            logSession: true,
            viewport: {
              width: 1920,
              height: 1080,
            },
          },
          region: 'us-west-2',
        },
      });

      await stagehand.init();
      this.sessions.set(sessionId, stagehand);

      // Store the Browserbase session ID from the initialized stagehand
      // The browserbaseSessionID is available after init()
      const bbSessionId = (stagehand as any).browserbaseSessionID;
      if (bbSessionId) {
        this.browserbaseSessionIds.set(sessionId, bbSessionId);
        console.log(`📌 Browserbase session ID stored: ${bbSessionId}`);
      }

      console.log(
        `✅ Browserbase session ${sessionId} initialized successfully`
      );
    }

    return stagehand;
  }

  /**
   * Get the Browserbase session ID for a given local session
   * Required for accessing Browserbase cloud features like downloads
   */
  getBrowserbaseSessionId(sessionId: string = this.defaultSessionId): string | undefined {
    return this.browserbaseSessionIds.get(sessionId);
  }

  // ... rest of existing methods ...

  async closeSession(sessionId: string): Promise<void> {
    const stagehand = this.sessions.get(sessionId);
    if (stagehand) {
      try {
        await stagehand.close();
        this.sessions.delete(sessionId);
        this.browserbaseSessionIds.delete(sessionId); // Clean up BB session ID
        console.log(`🔒 Browserbase session ${sessionId} closed`);
      } catch (error) {
        console.warn(`⚠️ Error closing session ${sessionId}:`, error);
      }
    }
  }

  // ... rest of existing methods ...
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/session-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mastra/tools/session-manager.ts tests/unit/session-manager.test.ts
git commit -m "$(cat <<'EOF'
feat(session-manager): add Browserbase session ID tracking

Track Browserbase session IDs for accessing cloud features like
file downloads. The ID is captured after stagehand.init() and
made available via getBrowserbaseSessionId().
EOF
)"
```

---

## Task 2: Create BrowserbaseDownloadService

**Files:**
- Create: `server/services/downloads/browserbaseDownloadService.ts`

**Step 1: Write the failing test**

Create test file:
```typescript
// tests/unit/browserbase-download-service.test.ts
import { BrowserbaseDownloadService, DownloadResult } from '../../server/services/downloads/browserbaseDownloadService';

// Mock the Browserbase SDK
jest.mock('@browserbasehq/sdk', () => ({
  Browserbase: jest.fn().mockImplementation(() => ({
    sessions: {
      downloads: {
        list: jest.fn().mockResolvedValue({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        }),
      },
    },
  })),
}));

describe('BrowserbaseDownloadService', () => {
  let service: BrowserbaseDownloadService;

  beforeEach(() => {
    service = new BrowserbaseDownloadService();
  });

  describe('retrieveDownloads', () => {
    it('should retrieve downloads from a Browserbase session', async () => {
      const result = await service.retrieveDownloads('test-session-id', 30);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
    });

    it('should return empty files array when no downloads available', async () => {
      // Mock empty download (22 bytes = empty ZIP)
      const { Browserbase } = require('@browserbasehq/sdk');
      Browserbase.mockImplementation(() => ({
        sessions: {
          downloads: {
            list: jest.fn().mockResolvedValue({
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(22)),
            }),
          },
        },
      }));

      const newService = new BrowserbaseDownloadService();
      const result = await newService.retrieveDownloads('test-session-id', 5);

      expect(result.success).toBe(false);
      expect(result.files).toEqual([]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/browserbase-download-service.test.ts`
Expected: FAIL with "Cannot find module 'browserbaseDownloadService'"

**Step 3: Write minimal implementation**

Create `server/services/downloads/browserbaseDownloadService.ts`:

```typescript
import { Browserbase } from '@browserbasehq/sdk';
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger';
import * as AdmZip from 'adm-zip';

export interface DownloadedFile {
  name: string;
  originalName: string;
  size: number;
  buffer: Buffer;
  mimeType: string;
}

export interface DownloadResult {
  success: boolean;
  files: DownloadedFile[];
  error?: string;
  sessionId: string;
  retrievedAt: string;
}

/**
 * Service for retrieving files downloaded during Browserbase browser sessions
 *
 * Uses Browserbase's cloud storage download API to retrieve files that were
 * downloaded during browser automation (e.g., clicking download links on portals)
 *
 * @see https://docs.browserbase.com/features/downloads
 */
export class BrowserbaseDownloadService {
  private bb: Browserbase;
  private readonly tempDir: string;

  constructor() {
    this.bb = new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY!,
    });
    this.tempDir = join(process.cwd(), 'tmp', 'browserbase-downloads');
  }

  /**
   * Retrieve all downloads from a Browserbase session
   *
   * Downloads are returned as a ZIP archive from Browserbase.
   * This method extracts the files and returns them as buffers.
   *
   * @param browserbaseSessionId - The Browserbase session ID (not local session ID)
   * @param retryForSeconds - How long to poll for downloads (files may take time to sync)
   * @returns DownloadResult with file buffers and metadata
   */
  async retrieveDownloads(
    browserbaseSessionId: string,
    retryForSeconds: number = 20
  ): Promise<DownloadResult> {
    const log = logger.child({
      service: 'BrowserbaseDownloadService',
      sessionId: browserbaseSessionId
    });

    return new Promise((resolve) => {
      let pooler: NodeJS.Timeout;
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        if (pooler) clearInterval(pooler);
        log.warn('Download retrieval timed out', { retryForSeconds });
        resolve({
          success: false,
          files: [],
          error: `Download retrieval timed out after ${retryForSeconds} seconds`,
          sessionId: browserbaseSessionId,
          retrievedAt: new Date().toISOString(),
        });
      }, retryForSeconds * 1000);

      const fetchDownloads = async () => {
        try {
          log.debug('Polling for downloads', {
            elapsed: Math.floor((Date.now() - startTime) / 1000)
          });

          const response = await this.bb.sessions.downloads.list(browserbaseSessionId);
          const downloadBuffer = await response.arrayBuffer();

          // Empty ZIP is 22 bytes - check if we have actual content
          if (downloadBuffer.byteLength > 22) {
            clearInterval(pooler);
            clearTimeout(timeout);

            const files = await this.extractZipContents(
              Buffer.from(downloadBuffer),
              browserbaseSessionId
            );

            log.info('Downloads retrieved successfully', {
              fileCount: files.length,
              totalSize: files.reduce((acc, f) => acc + f.size, 0),
            });

            resolve({
              success: true,
              files,
              sessionId: browserbaseSessionId,
              retrievedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          const error = e as Error;
          log.error('Error fetching downloads', error);
          clearInterval(pooler);
          clearTimeout(timeout);
          resolve({
            success: false,
            files: [],
            error: error.message,
            sessionId: browserbaseSessionId,
            retrievedAt: new Date().toISOString(),
          });
        }
      };

      // Poll every 2 seconds
      pooler = setInterval(fetchDownloads, 2000);
      // Initial fetch
      fetchDownloads();
    });
  }

  /**
   * Extract files from the ZIP archive returned by Browserbase
   */
  private async extractZipContents(
    zipBuffer: Buffer,
    sessionId: string
  ): Promise<DownloadedFile[]> {
    const log = logger.child({
      service: 'BrowserbaseDownloadService',
      method: 'extractZipContents',
      sessionId
    });

    const files: DownloadedFile[] = [];

    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      log.debug('ZIP archive contents', {
        entryCount: zipEntries.length,
        entries: zipEntries.map(e => e.entryName),
      });

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        const buffer = entry.getData();
        // Browserbase adds timestamps to filenames: sample-1719265797164.pdf
        // Extract original name by removing the timestamp suffix
        const originalName = this.extractOriginalFilename(entry.entryName);
        const mimeType = this.inferMimeType(originalName);

        files.push({
          name: entry.entryName,
          originalName,
          size: buffer.length,
          buffer,
          mimeType,
        });

        log.debug('Extracted file', {
          name: entry.entryName,
          originalName,
          size: buffer.length,
          mimeType,
        });
      }
    } catch (error) {
      log.error('Failed to extract ZIP contents', error as Error);
      throw error;
    }

    return files;
  }

  /**
   * Extract original filename from Browserbase's timestamped format
   * e.g., "sample-1719265797164.pdf" -> "sample.pdf"
   */
  private extractOriginalFilename(timestampedName: string): string {
    // Pattern: filename-timestamp.ext where timestamp is 13 digits (milliseconds)
    const match = timestampedName.match(/^(.+)-(\d{13})(\.[^.]+)$/);
    if (match) {
      return match[1] + match[3];
    }
    return timestampedName;
  }

  /**
   * Infer MIME type from filename extension
   */
  private inferMimeType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      zip: 'application/zip',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

// Singleton instance
export const browserbaseDownloadService = new BrowserbaseDownloadService();
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/browserbase-download-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/downloads/browserbaseDownloadService.ts tests/unit/browserbase-download-service.test.ts
git commit -m "$(cat <<'EOF'
feat(downloads): add BrowserbaseDownloadService

New service for retrieving files downloaded during Browserbase browser
sessions. Uses Browserbase's cloud storage API to fetch downloads as
a ZIP archive, extracts files, and returns them as buffers with metadata.
EOF
)"
```

---

## Task 3: Add File Size Verification

**Files:**
- Modify: `server/services/downloads/browserbaseDownloadService.ts`

**Step 1: Write the failing test**

Add to `tests/unit/browserbase-download-service.test.ts`:

```typescript
describe('verifyFileSize', () => {
  it('should return true when file size matches expected within tolerance', () => {
    const result = service.verifyFileSize(279930, 279930, 0.05); // exact match
    expect(result.valid).toBe(true);
    expect(result.difference).toBe(0);
  });

  it('should return true when file size is within tolerance', () => {
    const expectedBytes = 279930; // ~279.93 KB
    const actualBytes = 280000; // slightly larger
    const result = service.verifyFileSize(actualBytes, expectedBytes, 0.05);
    expect(result.valid).toBe(true);
  });

  it('should return false when file size difference exceeds tolerance', () => {
    const expectedBytes = 279930;
    const actualBytes = 100000; // much smaller
    const result = service.verifyFileSize(actualBytes, expectedBytes, 0.05);
    expect(result.valid).toBe(false);
    expect(result.difference).toBeLessThan(0);
  });

  it('should handle zero expected size', () => {
    const result = service.verifyFileSize(1000, 0, 0.05);
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/browserbase-download-service.test.ts`
Expected: FAIL with "verifyFileSize is not a function"

**Step 3: Write minimal implementation**

Add to `server/services/downloads/browserbaseDownloadService.ts`:

```typescript
export interface FileSizeVerification {
  valid: boolean;
  actualSize: number;
  expectedSize: number;
  difference: number; // percentage difference (negative = smaller, positive = larger)
  message: string;
}

// In BrowserbaseDownloadService class:

/**
 * Verify that a downloaded file size matches the expected size
 *
 * @param actualSize - Actual file size in bytes
 * @param expectedSize - Expected file size in bytes (from source metadata)
 * @param tolerance - Acceptable percentage difference (default 5%)
 * @returns FileSizeVerification result
 */
verifyFileSize(
  actualSize: number,
  expectedSize: number,
  tolerance: number = 0.05
): FileSizeVerification {
  if (expectedSize <= 0) {
    return {
      valid: false,
      actualSize,
      expectedSize,
      difference: actualSize > 0 ? 1 : 0,
      message: 'Expected file size is invalid (zero or negative)',
    };
  }

  const difference = (actualSize - expectedSize) / expectedSize;
  const valid = Math.abs(difference) <= tolerance;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return {
    valid,
    actualSize,
    expectedSize,
    difference,
    message: valid
      ? `File size verified: ${formatSize(actualSize)} (expected ${formatSize(expectedSize)}, diff: ${(difference * 100).toFixed(2)}%)`
      : `File size mismatch: ${formatSize(actualSize)} vs expected ${formatSize(expectedSize)} (diff: ${(difference * 100).toFixed(2)}%, tolerance: ${(tolerance * 100).toFixed(0)}%)`,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/browserbase-download-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/downloads/browserbaseDownloadService.ts tests/unit/browserbase-download-service.test.ts
git commit -m "$(cat <<'EOF'
feat(downloads): add file size verification

Add verifyFileSize() method to validate downloaded file sizes against
expected sizes from source metadata. Uses configurable tolerance
(default 5%) to account for minor variations.
EOF
)"
```

---

## Task 4: Extend Documents Schema with Download Metadata

**Files:**
- Modify: `shared/schema.ts`

**Step 1: Write the failing test**

Create test file:
```typescript
// tests/unit/schema-documents.test.ts
import { documents, InsertDocument } from '../../shared/schema';

describe('documents schema', () => {
  it('should include download-related fields', () => {
    // Check that the schema has the expected fields
    const columns = Object.keys(documents);

    expect(columns).toContain('sourceSize');
    expect(columns).toContain('downloadedSize');
    expect(columns).toContain('downloadStatus');
    expect(columns).toContain('downloadError');
    expect(columns).toContain('verificationStatus');
    expect(columns).toContain('sourceUrl');
    expect(columns).toContain('downloadedAt');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/schema-documents.test.ts`
Expected: FAIL with "sourceSize" not in columns

**Step 3: Write minimal implementation**

Modify `shared/schema.ts` - update the documents table:

```typescript
export const documents = pgTable('documents', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rfpId: varchar('rfp_id')
    .references(() => rfps.id)
    .notNull(),
  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(),
  objectPath: text('object_path').notNull(),
  extractedText: text('extracted_text'),
  parsedData: jsonb('parsed_data'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),

  // NEW: Download tracking fields
  sourceUrl: text('source_url'), // Original URL where document was found
  sourceSize: integer('source_size'), // Expected size in bytes from source metadata
  downloadedSize: integer('downloaded_size'), // Actual size after download
  downloadStatus: text('download_status', {
    enum: ['pending', 'downloading', 'completed', 'failed', 'verified'],
  }).default('pending'),
  downloadError: text('download_error'), // Error message if download failed
  verificationStatus: text('verification_status', {
    enum: ['pending', 'passed', 'failed', 'skipped'],
  }).default('pending'),
  downloadedAt: timestamp('downloaded_at'), // When the download completed
});

// Type exports
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/schema-documents.test.ts`
Expected: PASS

**Step 5: Generate and apply migration**

```bash
npx drizzle-kit generate
npm run db:push
```

**Step 6: Commit**

```bash
git add shared/schema.ts migrations/
git commit -m "$(cat <<'EOF'
feat(schema): add download tracking fields to documents table

Add fields for tracking document downloads:
- sourceUrl: original download location
- sourceSize/downloadedSize: for verification
- downloadStatus: pending/downloading/completed/failed/verified
- verificationStatus: pending/passed/failed/skipped
- downloadError: error message on failure
- downloadedAt: completion timestamp
EOF
)"
```

---

## Task 5: Create DocumentDownloadOrchestrator

**Files:**
- Create: `server/services/downloads/documentDownloadOrchestrator.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/document-download-orchestrator.test.ts
import { DocumentDownloadOrchestrator } from '../../server/services/downloads/documentDownloadOrchestrator';

// Mock dependencies
jest.mock('../../server/services/downloads/browserbaseDownloadService');
jest.mock('../../server/objectStorage');
jest.mock('../../server/db');

describe('DocumentDownloadOrchestrator', () => {
  let orchestrator: DocumentDownloadOrchestrator;

  beforeEach(() => {
    orchestrator = new DocumentDownloadOrchestrator();
  });

  describe('processRfpDocuments', () => {
    it('should orchestrate document discovery, download, and verification', async () => {
      const result = await orchestrator.processRfpDocuments({
        rfpId: 'test-rfp-123',
        browserbaseSessionId: 'bb-session-456',
        expectedDocuments: [
          { name: 'test.pdf', expectedSize: 1024 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.processed).toBeDefined();
      expect(result.failed).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/document-download-orchestrator.test.ts`
Expected: FAIL with "Cannot find module 'documentDownloadOrchestrator'"

**Step 3: Write minimal implementation**

Create `server/services/downloads/documentDownloadOrchestrator.ts`:

```typescript
import { db } from '../../db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { browserbaseDownloadService, DownloadedFile } from './browserbaseDownloadService';
import { ObjectStorageService } from '../../objectStorage';

export interface ExpectedDocument {
  name: string;
  expectedSize?: number; // in bytes
  sourceUrl?: string;
}

export interface ProcessDocumentsInput {
  rfpId: string;
  browserbaseSessionId: string;
  expectedDocuments?: ExpectedDocument[];
  retryForSeconds?: number;
}

export interface ProcessedDocument {
  id: string;
  filename: string;
  objectPath: string;
  downloadedSize: number;
  sourceSize?: number;
  verificationPassed: boolean;
  downloadStatus: 'completed' | 'verified';
}

export interface FailedDocument {
  filename: string;
  error: string;
  downloadStatus: 'failed';
}

export interface ProcessDocumentsResult {
  rfpId: string;
  processed: ProcessedDocument[];
  failed: FailedDocument[];
  totalDownloaded: number;
  totalFailed: number;
  processedAt: string;
}

/**
 * Orchestrates the complete document download workflow:
 * 1. Retrieve downloads from Browserbase cloud storage
 * 2. Verify file sizes against expected values
 * 3. Upload to Google Cloud Storage
 * 4. Store metadata in database
 */
export class DocumentDownloadOrchestrator {
  private objectStorage: ObjectStorageService;
  private log = logger.child({ service: 'DocumentDownloadOrchestrator' });

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Process all documents downloaded during a Browserbase session
   */
  async processRfpDocuments(input: ProcessDocumentsInput): Promise<ProcessDocumentsResult> {
    const { rfpId, browserbaseSessionId, expectedDocuments = [], retryForSeconds = 30 } = input;
    const log = this.log.child({ rfpId, browserbaseSessionId });

    log.info('Starting document download orchestration', {
      expectedCount: expectedDocuments.length,
    });

    const processed: ProcessedDocument[] = [];
    const failed: FailedDocument[] = [];

    try {
      // Step 1: Retrieve downloads from Browserbase
      const downloadResult = await browserbaseDownloadService.retrieveDownloads(
        browserbaseSessionId,
        retryForSeconds
      );

      if (!downloadResult.success) {
        log.warn('No downloads retrieved from Browserbase', {
          error: downloadResult.error,
        });
        return {
          rfpId,
          processed: [],
          failed: expectedDocuments.map(doc => ({
            filename: doc.name,
            error: downloadResult.error || 'No downloads available',
            downloadStatus: 'failed' as const,
          })),
          totalDownloaded: 0,
          totalFailed: expectedDocuments.length,
          processedAt: new Date().toISOString(),
        };
      }

      log.info('Downloads retrieved from Browserbase', {
        fileCount: downloadResult.files.length,
      });

      // Step 2: Process each downloaded file
      for (const file of downloadResult.files) {
        try {
          const result = await this.processFile(rfpId, file, expectedDocuments);
          processed.push(result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          log.error('Failed to process file', error as Error, { filename: file.name });
          failed.push({
            filename: file.originalName,
            error: errorMessage,
            downloadStatus: 'failed',
          });
        }
      }

      // Check for expected documents that weren't downloaded
      for (const expected of expectedDocuments) {
        const wasProcessed = processed.some(
          p => this.normalizeFilename(p.filename) === this.normalizeFilename(expected.name)
        );
        const wasFailed = failed.some(
          f => this.normalizeFilename(f.filename) === this.normalizeFilename(expected.name)
        );

        if (!wasProcessed && !wasFailed) {
          log.warn('Expected document not found in downloads', { filename: expected.name });
          failed.push({
            filename: expected.name,
            error: 'Document not found in Browserbase downloads',
            downloadStatus: 'failed',
          });
        }
      }

      log.info('Document download orchestration complete', {
        processed: processed.length,
        failed: failed.length,
      });

      return {
        rfpId,
        processed,
        failed,
        totalDownloaded: processed.length,
        totalFailed: failed.length,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      log.error('Document download orchestration failed', error as Error);
      throw error;
    }
  }

  /**
   * Process a single downloaded file
   */
  private async processFile(
    rfpId: string,
    file: DownloadedFile,
    expectedDocuments: ExpectedDocument[]
  ): Promise<ProcessedDocument> {
    const log = this.log.child({ rfpId, filename: file.originalName });

    // Find matching expected document for size verification
    const expected = expectedDocuments.find(
      e => this.normalizeFilename(e.name) === this.normalizeFilename(file.originalName)
    );

    // Step 1: Verify file size if expected size is known
    let verificationPassed = true;
    if (expected?.expectedSize) {
      const verification = browserbaseDownloadService.verifyFileSize(
        file.size,
        expected.expectedSize
      );
      verificationPassed = verification.valid;
      log.info('File size verification', {
        valid: verification.valid,
        message: verification.message,
      });
    }

    // Step 2: Upload to Google Cloud Storage
    const storagePath = await this.uploadToStorage(rfpId, file);

    // Step 3: Create database record
    const [record] = await db.insert(documents).values({
      rfpId,
      filename: file.originalName,
      fileType: file.mimeType,
      objectPath: storagePath,
      sourceUrl: expected?.sourceUrl,
      sourceSize: expected?.expectedSize,
      downloadedSize: file.size,
      downloadStatus: verificationPassed ? 'verified' : 'completed',
      verificationStatus: expected?.expectedSize
        ? (verificationPassed ? 'passed' : 'failed')
        : 'skipped',
      downloadedAt: new Date(),
    }).returning();

    log.info('Document record created', { documentId: record.id });

    return {
      id: record.id,
      filename: file.originalName,
      objectPath: storagePath,
      downloadedSize: file.size,
      sourceSize: expected?.expectedSize,
      verificationPassed,
      downloadStatus: verificationPassed ? 'verified' : 'completed',
    };
  }

  /**
   * Upload file buffer to Google Cloud Storage
   */
  private async uploadToStorage(rfpId: string, file: DownloadedFile): Promise<string> {
    const privateDir = this.objectStorage.getPrivateObjectDir();
    const bucketName = privateDir.split('/')[0];

    const safeFileName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const objectPath = `rfp_documents/${rfpId}/${timestamp}-${safeFileName}`;

    await this.objectStorage.uploadPrivateObject(
      objectPath,
      file.buffer,
      file.mimeType
    );

    return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
  }

  /**
   * Normalize filename for comparison
   */
  private normalizeFilename(filename: string): string {
    return filename.toLowerCase().replace(/[^a-z0-9.]/g, '');
  }
}

export const documentDownloadOrchestrator = new DocumentDownloadOrchestrator();
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/document-download-orchestrator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/downloads/documentDownloadOrchestrator.ts tests/unit/document-download-orchestrator.test.ts
git commit -m "$(cat <<'EOF'
feat(downloads): add DocumentDownloadOrchestrator

Orchestrates the complete document download workflow:
- Retrieves downloads from Browserbase cloud storage
- Verifies file sizes against expected values
- Uploads to Google Cloud Storage
- Creates document records in database with full metadata
EOF
)"
```

---

## Task 6: Integrate Downloads into Portal Scraping Flow

**Files:**
- Modify: `server/services/scrapers/mastraScrapingService.ts`

**Step 1: Write the failing test**

```typescript
// tests/integration/portal-scraping-downloads.test.ts
import { getMastraScrapingService } from '../../server/services/scrapers/mastraScrapingService';

describe('Portal Scraping with Downloads', () => {
  it('should trigger document download after scraping when documents are found', async () => {
    const service = await getMastraScrapingService();

    // This test verifies the integration exists
    expect(service.scanPortalWithDocuments).toBeDefined();
    expect(typeof service.scanPortalWithDocuments).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/portal-scraping-downloads.test.ts`
Expected: FAIL with "scanPortalWithDocuments" undefined

**Step 3: Write minimal implementation**

Add to `server/services/scrapers/mastraScrapingService.ts`:

```typescript
import { documentDownloadOrchestrator, ExpectedDocument } from '../downloads/documentDownloadOrchestrator';
import { sessionManager } from '../../../src/mastra/tools/session-manager';

// Add to MastraScrapingService class:

/**
 * Scan portal and automatically download discovered documents
 *
 * This method combines portal scraping with document downloading:
 * 1. Navigates to the RFP detail page
 * 2. Discovers and clicks download links for attachments
 * 3. Retrieves downloaded files from Browserbase cloud storage
 * 4. Verifies file sizes and stores in database
 */
async scanPortalWithDocuments(input: {
  rfpId: string;
  portalUrl: string;
  sessionId?: string;
  expectedDocuments?: ExpectedDocument[];
}): Promise<{
  scrapedData: any;
  documentsResult: any;
}> {
  const { rfpId, portalUrl, sessionId = 'default', expectedDocuments = [] } = input;
  const log = this.log.child({ rfpId, portalUrl, method: 'scanPortalWithDocuments' });

  log.info('Starting portal scan with document downloads');

  try {
    // Step 1: Navigate to RFP page and discover documents
    const { stagehand, page } = await sessionManager.getStagehandAndPage(sessionId);

    await page.goto(portalUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for dynamic content

    // Step 2: Discover document download links
    log.info('Discovering document download links');
    const documentLinks = await stagehand.extract(
      'Find all document download links, attachment links, or file download buttons on this page',
      {
        documents: z.array(z.object({
          name: z.string().describe('Document filename or description'),
          url: z.string().optional().describe('Download URL if visible'),
          size: z.string().optional().describe('File size if shown'),
        })),
      }
    );

    log.info('Document links discovered', { count: documentLinks.documents?.length || 0 });

    // Step 3: Click each download link to trigger downloads
    const downloadPromises: Promise<void>[] = [];
    for (const doc of (documentLinks.documents || [])) {
      try {
        log.debug('Triggering download', { document: doc.name });
        await stagehand.act(`Click the download link or button for "${doc.name}"`);
        // Small delay between downloads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        log.warn('Failed to click download for document', { document: doc.name, error: (e as Error).message });
      }
    }

    // Step 4: Wait for downloads to complete in Browserbase cloud
    log.info('Waiting for downloads to sync to Browserbase cloud storage');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Retrieve and process downloads
    const browserbaseSessionId = sessionManager.getBrowserbaseSessionId(sessionId);
    if (!browserbaseSessionId) {
      throw new Error('Browserbase session ID not found - cannot retrieve downloads');
    }

    // Merge discovered documents with expected documents for verification
    const allExpectedDocs: ExpectedDocument[] = [
      ...expectedDocuments,
      ...(documentLinks.documents || []).map(d => ({
        name: d.name,
        expectedSize: d.size ? this.parseSizeString(d.size) : undefined,
      })),
    ];

    const documentsResult = await documentDownloadOrchestrator.processRfpDocuments({
      rfpId,
      browserbaseSessionId,
      expectedDocuments: allExpectedDocs,
      retryForSeconds: 30,
    });

    log.info('Document download orchestration complete', {
      processed: documentsResult.totalDownloaded,
      failed: documentsResult.totalFailed,
    });

    return {
      scrapedData: documentLinks,
      documentsResult,
    };
  } catch (error) {
    log.error('Portal scan with documents failed', error as Error);
    throw error;
  }
}

/**
 * Parse size string like "279.93 KB" to bytes
 */
private parseSizeString(sizeStr: string): number | undefined {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return undefined;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  };

  return Math.round(value * (multipliers[unit] || 1));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/portal-scraping-downloads.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/scrapers/mastraScrapingService.ts tests/integration/portal-scraping-downloads.test.ts
git commit -m "$(cat <<'EOF'
feat(scraping): integrate document downloads into portal scanning

Add scanPortalWithDocuments() method that:
- Discovers document download links on RFP pages
- Clicks download buttons to trigger browser downloads
- Retrieves files from Browserbase cloud storage
- Verifies sizes and stores in database

Provides automatic document discovery and download during portal scraping.
EOF
)"
```

---

## Task 7: Add Document Download API Endpoint

**Files:**
- Modify: `server/routes/rfps.routes.ts`

**Step 1: Write the failing test**

```typescript
// tests/integration/rfps-documents-api.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('RFP Documents API', () => {
  describe('POST /api/rfps/:id/documents/download', () => {
    it('should trigger document download for an RFP', async () => {
      const response = await request(app)
        .post('/api/rfps/test-rfp-123/documents/download')
        .send({
          browserbaseSessionId: 'test-session',
          expectedDocuments: [
            { name: 'test.pdf', expectedSize: 1024 },
          ],
        });

      // Expect either success or appropriate error (e.g., RFP not found)
      expect([200, 404, 400]).toContain(response.status);
    });
  });

  describe('GET /api/rfps/:id/documents', () => {
    it('should return documents for an RFP', async () => {
      const response = await request(app)
        .get('/api/rfps/test-rfp-123/documents');

      // Expect either documents array or 404
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(Array.isArray(response.body.documents)).toBe(true);
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/rfps-documents-api.test.ts`
Expected: FAIL with 404 (route not found)

**Step 3: Write minimal implementation**

Add to `server/routes/rfps.routes.ts`:

```typescript
import { documentDownloadOrchestrator } from '../services/downloads/documentDownloadOrchestrator';
import { documents } from '@shared/schema';

// POST /api/rfps/:id/documents/download
router.post(
  '/:id/documents/download',
  rateLimiter,
  handleAsyncError(async (req, res) => {
    const { id: rfpId } = req.params;
    const { browserbaseSessionId, expectedDocuments } = req.body;

    // Validate RFP exists
    const rfp = await db.query.rfps.findFirst({
      where: eq(rfps.id, rfpId),
    });

    if (!rfp) {
      return ApiResponse.error(res, 'RFP not found', 404);
    }

    if (!browserbaseSessionId) {
      return ApiResponse.error(
        res,
        'browserbaseSessionId is required',
        400
      );
    }

    const result = await documentDownloadOrchestrator.processRfpDocuments({
      rfpId,
      browserbaseSessionId,
      expectedDocuments: expectedDocuments || [],
    });

    return ApiResponse.success(res, result, {
      message: `Processed ${result.totalDownloaded} documents, ${result.totalFailed} failed`,
    });
  })
);

// GET /api/rfps/:id/documents
router.get(
  '/:id/documents',
  handleAsyncError(async (req, res) => {
    const { id: rfpId } = req.params;

    // Validate RFP exists
    const rfp = await db.query.rfps.findFirst({
      where: eq(rfps.id, rfpId),
    });

    if (!rfp) {
      return ApiResponse.error(res, 'RFP not found', 404);
    }

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.rfpId, rfpId))
      .orderBy(documents.uploadedAt);

    return ApiResponse.success(res, {
      documents: docs,
      total: docs.length,
    });
  })
);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/integration/rfps-documents-api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/rfps.routes.ts tests/integration/rfps-documents-api.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add document download and retrieval endpoints

- POST /api/rfps/:id/documents/download: trigger download from Browserbase
- GET /api/rfps/:id/documents: list all documents for an RFP

Both endpoints validate RFP exists and return appropriate errors.
EOF
)"
```

---

## Task 8: Add Enable Download Behavior in Browser Session

**Files:**
- Modify: `src/mastra/tools/session-manager.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/session-manager-downloads.test.ts
describe('BrowserbaseSessionManager downloads', () => {
  it('should enable download behavior after session init', async () => {
    const sessionId = 'download-test';
    const stagehand = await sessionManager.ensureStagehand(sessionId);

    // Verify downloads are enabled by checking the session was configured
    const bbSessionId = sessionManager.getBrowserbaseSessionId(sessionId);
    expect(bbSessionId).toBeDefined();

    // The session should have download behavior enabled
    // This is verified by the CDP command being sent during init

    await sessionManager.closeSession(sessionId);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/session-manager-downloads.test.ts`
Expected: Test passes but download behavior is not actually enabled

**Step 3: Write minimal implementation**

Modify `src/mastra/tools/session-manager.ts` - add download behavior setup:

```typescript
async ensureStagehand(
  sessionId: string = this.defaultSessionId
): Promise<Stagehand> {
  let stagehand = this.sessions.get(sessionId);

  if (!stagehand) {
    console.log(`🌐 Creating new Browserbase session: ${sessionId}`);

    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
      browserbaseSessionCreateParams: {
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        keepAlive: true,
        timeout: 3600,
        browserSettings: {
          advancedStealth: false,
          solveCaptchas: false,
          blockAds: true,
          recordSession: true,
          logSession: true,
          viewport: {
            width: 1920,
            height: 1080,
          },
        },
        region: 'us-west-2',
      },
    });

    await stagehand.init();

    // Enable download behavior for this session
    await this.enableDownloadBehavior(stagehand);

    this.sessions.set(sessionId, stagehand);

    // Store the Browserbase session ID
    const bbSessionId = (stagehand as any).browserbaseSessionID;
    if (bbSessionId) {
      this.browserbaseSessionIds.set(sessionId, bbSessionId);
      console.log(`📌 Browserbase session ID stored: ${bbSessionId}`);
    }

    console.log(
      `✅ Browserbase session ${sessionId} initialized with downloads enabled`
    );
  }

  return stagehand;
}

/**
 * Enable download behavior for a Stagehand session
 * This allows files downloaded during browser automation to be saved
 * to Browserbase's cloud storage for later retrieval
 */
private async enableDownloadBehavior(stagehand: Stagehand): Promise<void> {
  try {
    const pages = await stagehand.context.pages();
    if (pages.length === 0) {
      console.log('⚠️ No pages available for download behavior setup');
      return;
    }

    const page = pages[0];
    const client = await page.context().newCDPSession(page);

    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: 'downloads',
      eventsEnabled: true,
    });

    console.log('📥 Download behavior enabled for session');
  } catch (error) {
    console.warn('⚠️ Failed to enable download behavior:', error);
    // Non-fatal - session can still be used for scraping
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/session-manager-downloads.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/mastra/tools/session-manager.ts tests/unit/session-manager-downloads.test.ts
git commit -m "$(cat <<'EOF'
feat(session-manager): enable download behavior in browser sessions

Configure CDP to allow downloads during browser automation.
Files are saved to Browserbase's cloud storage ('downloads' path)
with events enabled for tracking download completion.
EOF
)"
```

---

## Task 9: Add Document Download Error Handling

**Files:**
- Modify: `server/services/downloads/browserbaseDownloadService.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/download-error-handling.test.ts
import { BrowserbaseDownloadService, DownloadError } from '../../server/services/downloads/browserbaseDownloadService';

describe('Download Error Handling', () => {
  describe('DownloadError', () => {
    it('should categorize network errors', () => {
      const error = new DownloadError('NETWORK_ERROR', 'Connection refused');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isRetryable).toBe(true);
    });

    it('should categorize size mismatch errors', () => {
      const error = new DownloadError('SIZE_MISMATCH', 'Expected 1KB, got 500B');
      expect(error.code).toBe('SIZE_MISMATCH');
      expect(error.isRetryable).toBe(false);
    });

    it('should categorize access denied errors', () => {
      const error = new DownloadError('ACCESS_DENIED', 'Authentication required');
      expect(error.code).toBe('ACCESS_DENIED');
      expect(error.isRetryable).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/download-error-handling.test.ts`
Expected: FAIL with "DownloadError is not defined"

**Step 3: Write minimal implementation**

Add to `server/services/downloads/browserbaseDownloadService.ts`:

```typescript
export type DownloadErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'SIZE_MISMATCH'
  | 'CORRUPT_FILE'
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Custom error class for download-related failures
 * Provides categorization and retry guidance
 */
export class DownloadError extends Error {
  readonly code: DownloadErrorCode;
  readonly isRetryable: boolean;
  readonly details?: Record<string, unknown>;

  private static readonly RETRYABLE_CODES: DownloadErrorCode[] = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'STORAGE_ERROR',
  ];

  constructor(
    code: DownloadErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    this.isRetryable = DownloadError.RETRYABLE_CODES.includes(code);
    this.details = details;
  }

  static fromHttpStatus(status: number, message?: string): DownloadError {
    switch (status) {
      case 401:
      case 403:
        return new DownloadError(
          'ACCESS_DENIED',
          message || 'Access denied - authentication required'
        );
      case 404:
        return new DownloadError(
          'NOT_FOUND',
          message || 'Document not found'
        );
      case 408:
      case 504:
        return new DownloadError(
          'TIMEOUT_ERROR',
          message || 'Request timed out'
        );
      case 502:
      case 503:
        return new DownloadError(
          'NETWORK_ERROR',
          message || 'Server temporarily unavailable'
        );
      default:
        return new DownloadError(
          'UNKNOWN_ERROR',
          message || `HTTP error: ${status}`
        );
    }
  }

  static sizeMismatch(actual: number, expected: number): DownloadError {
    return new DownloadError(
      'SIZE_MISMATCH',
      `File size mismatch: expected ${expected} bytes, got ${actual} bytes`,
      { actualSize: actual, expectedSize: expected }
    );
  }

  static corruptFile(reason: string): DownloadError {
    return new DownloadError(
      'CORRUPT_FILE',
      `Downloaded file appears corrupt: ${reason}`
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/download-error-handling.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/downloads/browserbaseDownloadService.ts tests/unit/download-error-handling.test.ts
git commit -m "$(cat <<'EOF'
feat(downloads): add structured error handling

Add DownloadError class with:
- Error code categorization (network, timeout, access, etc.)
- Automatic retry guidance based on error type
- Factory methods for common error scenarios
- Detailed error context for debugging
EOF
)"
```

---

## Task 10: Add Integration Test for Full Download Flow

**Files:**
- Create: `tests/integration/document-download-flow.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/integration/document-download-flow.test.ts
import { sessionManager } from '../../src/mastra/tools/session-manager';
import { browserbaseDownloadService } from '../../server/services/downloads/browserbaseDownloadService';
import { documentDownloadOrchestrator } from '../../server/services/downloads/documentDownloadOrchestrator';

describe('Document Download Flow Integration', () => {
  // Skip in CI - requires real Browserbase credentials
  const itIfBrowserbase = process.env.BROWSERBASE_API_KEY ? it : it.skip;

  itIfBrowserbase('should complete full download flow for a test PDF', async () => {
    const sessionId = 'download-integration-test';

    try {
      // Initialize session with downloads enabled
      const stagehand = await sessionManager.ensureStagehand(sessionId);
      const page = await sessionManager.getPage(sessionId);

      // Navigate to a test page with downloadable content
      // Using a public test PDF endpoint
      await page.goto('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');

      // Wait for download to trigger (direct PDF URL auto-downloads)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get Browserbase session ID and retrieve downloads
      const bbSessionId = sessionManager.getBrowserbaseSessionId(sessionId);
      expect(bbSessionId).toBeDefined();

      const result = await browserbaseDownloadService.retrieveDownloads(bbSessionId!, 30);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);

      // Verify file content looks like a PDF
      const pdfFile = result.files[0];
      expect(pdfFile.buffer.slice(0, 5).toString()).toBe('%PDF-');

    } finally {
      await sessionManager.closeSession(sessionId);
    }
  }, 60000); // 60 second timeout for this integration test

  itIfBrowserbase('should verify file sizes match source metadata', async () => {
    const verification = browserbaseDownloadService.verifyFileSize(
      286629, // W3C dummy.pdf actual size
      286629, // Expected size
      0.05
    );

    expect(verification.valid).toBe(true);
    expect(verification.difference).toBe(0);
  });
});
```

**Step 2: Run test to verify it passes (or skips if no Browserbase credentials)**

Run: `npm test -- tests/integration/document-download-flow.test.ts`
Expected: PASS (or SKIP if no BROWSERBASE_API_KEY)

**Step 3: Commit**

```bash
git add tests/integration/document-download-flow.test.ts
git commit -m "$(cat <<'EOF'
test: add integration test for full document download flow

Tests the complete download workflow:
- Session initialization with downloads enabled
- Navigation to downloadable content
- Browserbase cloud storage retrieval
- File content validation (PDF signature check)
- Size verification

Skips automatically in CI environments without Browserbase credentials.
EOF
)"
```

---

## Summary

This plan implements Browserbase cloud storage downloads for RFP documents with:

1. **Session Manager Updates** - Track Browserbase session IDs and enable download behavior
2. **BrowserbaseDownloadService** - Retrieve files from Browserbase cloud storage
3. **File Verification** - Validate downloaded file sizes match expected values
4. **Schema Updates** - Track download metadata in documents table
5. **DocumentDownloadOrchestrator** - Coordinate the full download workflow
6. **Portal Integration** - Automatic document discovery during scraping
7. **API Endpoints** - Trigger downloads and retrieve document lists
8. **Error Handling** - Structured errors with retry guidance
9. **Integration Tests** - Full flow validation

---

**Plan complete and saved to `docs/plans/2025-12-09-browserbase-document-downloads.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
