import { db } from '../../db';
import { documents } from '@shared/schema';
import { logger } from '../../utils/logger';
import {
  browserbaseDownloadService,
  DownloadedFile,
} from './browserbaseDownloadService';
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
  success: boolean;
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
  async processRfpDocuments(
    input: ProcessDocumentsInput,
  ): Promise<ProcessDocumentsResult> {
    const {
      rfpId,
      browserbaseSessionId,
      expectedDocuments = [],
      retryForSeconds = 30,
    } = input;
    const log = this.log.child({ rfpId, browserbaseSessionId });

    log.info('Starting document download orchestration', {
      expectedCount: expectedDocuments.length,
    });

    const processed: ProcessedDocument[] = [];
    const failed: FailedDocument[] = [];

    try {
      // Step 1: Retrieve downloads from Browserbase
      const downloadResult =
        await browserbaseDownloadService.retrieveDownloads(
          browserbaseSessionId,
          retryForSeconds,
        );

      if (!downloadResult.success) {
        log.warn('No downloads retrieved from Browserbase', {
          error: downloadResult.error,
        });
        return {
          rfpId,
          processed: [],
          failed: expectedDocuments.map((doc) => ({
            filename: doc.name,
            error: downloadResult.error || 'No downloads available',
            downloadStatus: 'failed' as const,
          })),
          totalDownloaded: 0,
          totalFailed: expectedDocuments.length,
          processedAt: new Date().toISOString(),
          success: false,
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
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          log.error('Failed to process file', error as Error, {
            filename: file.name,
          });
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
          (p) =>
            this.normalizeFilename(p.filename) ===
            this.normalizeFilename(expected.name),
        );
        const wasFailed = failed.some(
          (f) =>
            this.normalizeFilename(f.filename) ===
            this.normalizeFilename(expected.name),
        );

        if (!wasProcessed && !wasFailed) {
          log.warn('Expected document not found in downloads', {
            filename: expected.name,
          });
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
        success: true,
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
    expectedDocuments: ExpectedDocument[],
  ): Promise<ProcessedDocument> {
    const log = this.log.child({ rfpId, filename: file.originalName });

    // Find matching expected document for size verification
    const expected = expectedDocuments.find(
      (e) =>
        this.normalizeFilename(e.name) ===
        this.normalizeFilename(file.originalName),
    );

    // Step 1: Verify file size if expected size is known
    let verificationPassed = true;
    if (expected?.expectedSize) {
      const verification = browserbaseDownloadService.verifyFileSize(
        file.size,
        expected.expectedSize,
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
    const [record] = await db
      .insert(documents)
      .values({
        rfpId,
        filename: file.originalName,
        fileType: file.mimeType,
        objectPath: storagePath,
        sourceUrl: expected?.sourceUrl,
        sourceSize: expected?.expectedSize,
        downloadedSize: file.size,
        downloadStatus: verificationPassed ? 'verified' : 'completed',
        verificationStatus: expected?.expectedSize
          ? verificationPassed
            ? 'passed'
            : 'failed'
          : 'skipped',
        downloadedAt: new Date(),
      })
      .returning();

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
  private async uploadToStorage(
    rfpId: string,
    file: DownloadedFile,
  ): Promise<string> {
    const privateDir = this.objectStorage.getPrivateObjectDir();
    const bucketName = privateDir.split('/')[0];

    const safeFileName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const objectPath = `rfp_documents/${rfpId}/${timestamp}-${safeFileName}`;

    await this.objectStorage.uploadPrivateObject({
      objectPath,
      data: file.buffer,
      contentType: file.mimeType,
    });

    return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
  }

  /**
   * Normalize filename for comparison
   */
  private normalizeFilename(filename: string): string {
    return filename.toLowerCase().replace(/[^a-z0-9.]/g, '');
  }
}

export const documentDownloadOrchestrator =
  new DocumentDownloadOrchestrator();
