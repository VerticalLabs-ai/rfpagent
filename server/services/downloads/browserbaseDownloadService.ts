import { Browserbase } from '@browserbasehq/sdk';
import { logger } from '../../utils/logger';
import AdmZip from 'adm-zip';

/**
 * Error codes for download operations
 * Used for categorizing and handling download failures
 */
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
 * Structured error class for download operations
 * Provides error categorization, retryability info, and additional context
 */
export class DownloadError extends Error {
  readonly code: DownloadErrorCode;
  readonly isRetryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: DownloadErrorCode,
    isRetryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.details = details;

    // Ensure prototype chain is properly set
    Object.setPrototypeOf(this, DownloadError.prototype);
  }

  /**
   * Create a DownloadError from an HTTP status code
   * Maps common HTTP errors to appropriate error codes
   */
  static fromHttpStatus(
    status: number,
    message?: string,
    details?: Record<string, unknown>,
  ): DownloadError {
    const defaultMessages: Record<number, string> = {
      400: 'Bad request - invalid download parameters',
      401: 'Authentication required to download file',
      403: 'Access denied - insufficient permissions to download',
      404: 'File not found - download link may have expired',
      408: 'Request timeout - server took too long to respond',
      429: 'Too many requests - rate limited by server',
      500: 'Server error - portal download service unavailable',
      502: 'Bad gateway - upstream server error',
      503: 'Service unavailable - portal temporarily down',
      504: 'Gateway timeout - portal did not respond',
    };

    const errorMessage = message || defaultMessages[status] || `HTTP error ${status}`;

    // Determine error code and retryability based on status
    let code: DownloadErrorCode;
    let isRetryable: boolean;

    switch (status) {
      case 400:
        code = 'UNKNOWN_ERROR';
        isRetryable = false;
        break;
      case 401:
      case 403:
        code = 'ACCESS_DENIED';
        isRetryable = false;
        break;
      case 404:
        code = 'NOT_FOUND';
        isRetryable = false;
        break;
      case 408:
      case 504:
        code = 'TIMEOUT_ERROR';
        isRetryable = true;
        break;
      case 429:
      case 500:
      case 502:
      case 503:
        code = 'NETWORK_ERROR';
        isRetryable = true;
        break;
      default:
        code = status >= 500 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR';
        isRetryable = status >= 500;
    }

    return new DownloadError(errorMessage, code, isRetryable, {
      httpStatus: status,
      ...details,
    });
  }

  /**
   * Create a DownloadError for file size mismatch
   */
  static sizeMismatch(
    actualSize: number,
    expectedSize: number,
    filename?: string,
  ): DownloadError {
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const difference = ((actualSize - expectedSize) / expectedSize * 100).toFixed(2);
    const message = `File size mismatch${filename ? ` for ${filename}` : ''}: got ${formatSize(actualSize)}, expected ${formatSize(expectedSize)} (${difference}% difference)`;

    return new DownloadError(message, 'SIZE_MISMATCH', false, {
      actualSize,
      expectedSize,
      difference: parseFloat(difference),
      filename,
    });
  }

  /**
   * Create a DownloadError for corrupt file
   */
  static corruptFile(
    filename: string,
    reason: string,
    details?: Record<string, unknown>,
  ): DownloadError {
    const message = `File ${filename} is corrupt or unreadable: ${reason}`;

    return new DownloadError(message, 'CORRUPT_FILE', false, {
      filename,
      reason,
      ...details,
    });
  }

  /**
   * Create a DownloadError for storage failures
   */
  static storageError(
    operation: 'upload' | 'download' | 'delete',
    message: string,
    details?: Record<string, unknown>,
  ): DownloadError {
    return new DownloadError(
      `Storage ${operation} failed: ${message}`,
      'STORAGE_ERROR',
      true, // Storage errors are often transient
      { operation, ...details },
    );
  }

  /**
   * Create a DownloadError for timeout
   */
  static timeout(
    operation: string,
    timeoutMs: number,
    details?: Record<string, unknown>,
  ): DownloadError {
    return new DownloadError(
      `Operation ${operation} timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      true,
      { operation, timeoutMs, ...details },
    );
  }

  /**
   * Create a DownloadError from a generic Error
   */
  static fromError(
    error: Error,
    defaultCode: DownloadErrorCode = 'UNKNOWN_ERROR',
    isRetryable: boolean = false,
  ): DownloadError {
    // Check if it's already a DownloadError
    if (error instanceof DownloadError) {
      return error;
    }

    // Check for common error patterns
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return new DownloadError(error.message, 'TIMEOUT_ERROR', true, {
        originalError: error.name,
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('econnrefused') ||
        errorMessage.includes('econnreset') || errorMessage.includes('socket')) {
      return new DownloadError(error.message, 'NETWORK_ERROR', true, {
        originalError: error.name,
      });
    }

    if (errorMessage.includes('permission') || errorMessage.includes('forbidden') ||
        errorMessage.includes('access denied')) {
      return new DownloadError(error.message, 'ACCESS_DENIED', false, {
        originalError: error.name,
      });
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return new DownloadError(error.message, 'NOT_FOUND', false, {
        originalError: error.name,
      });
    }

    return new DownloadError(error.message, defaultCode, isRetryable, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  /**
   * Serialize error for logging or API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      isRetryable: this.isRetryable,
      details: this.details,
    };
  }
}

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

export interface FileSizeVerification {
  valid: boolean;
  actualSize: number;
  expectedSize: number;
  difference: number; // percentage difference (negative = smaller, positive = larger)
  message: string;
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
    this.tempDir = '/tmp/browserbase-downloads';
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
    retryForSeconds: number = 20,
  ): Promise<DownloadResult> {
    const log = logger.child({
      service: 'BrowserbaseDownloadService',
      sessionId: browserbaseSessionId,
    });

    return new Promise((resolve) => {
      let pooler: NodeJS.Timeout;
      const startTime = Date.now();
      const timeoutMs = retryForSeconds * 1000;

      const timeout = setTimeout(() => {
        if (pooler) clearInterval(pooler);
        const timeoutError = DownloadError.timeout('retrieveDownloads', timeoutMs, {
          sessionId: browserbaseSessionId,
          elapsedSeconds: retryForSeconds,
        });
        log.warn('Download retrieval timed out', { retryForSeconds, error: timeoutError.toJSON() });
        resolve({
          success: false,
          files: [],
          error: timeoutError.message,
          sessionId: browserbaseSessionId,
          retrievedAt: new Date().toISOString(),
        });
      }, timeoutMs);

      const fetchDownloads = async () => {
        try {
          log.debug('Polling for downloads', {
            elapsed: Math.floor((Date.now() - startTime) / 1000),
          });

          const response =
            await this.bb.sessions.downloads.list(browserbaseSessionId);
          const downloadBuffer = await response.arrayBuffer();

          // Empty ZIP is 22 bytes - check if we have actual content
          if (downloadBuffer.byteLength > 22) {
            clearInterval(pooler);
            clearTimeout(timeout);

            const files = await this.extractZipContents(
              Buffer.from(downloadBuffer),
              browserbaseSessionId,
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
          const rawError = e as Error;
          const downloadError = DownloadError.fromError(rawError, 'NETWORK_ERROR', true);
          log.error('Error fetching downloads', downloadError, { errorDetails: downloadError.toJSON() });
          clearInterval(pooler);
          clearTimeout(timeout);
          resolve({
            success: false,
            files: [],
            error: downloadError.message,
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
    sessionId: string,
  ): Promise<DownloadedFile[]> {
    const log = logger.child({
      service: 'BrowserbaseDownloadService',
      method: 'extractZipContents',
      sessionId,
    });

    const files: DownloadedFile[] = [];

    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      log.debug('ZIP archive contents', {
        entryCount: zipEntries.length,
        entries: zipEntries.map((e) => e.entryName),
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
      const rawError = error as Error;
      log.error('Failed to extract ZIP contents', rawError);
      throw DownloadError.corruptFile(
        'browserbase-downloads.zip',
        rawError.message,
        { sessionId, zipSize: zipBuffer.length },
      );
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
    tolerance: number = 0.05,
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
}

// Singleton instance
export const browserbaseDownloadService = new BrowserbaseDownloadService();
