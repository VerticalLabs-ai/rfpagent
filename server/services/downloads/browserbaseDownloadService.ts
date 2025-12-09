import { Browserbase } from '@browserbasehq/sdk';
import { logger } from '../../utils/logger';
import AdmZip from 'adm-zip';

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
