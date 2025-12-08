import axios from 'axios';
import { logger } from '../../utils/logger';
import { ObjectStorageService, objectStorageClient } from '../../objectStorage';

/**
 * SAM.gov Document Download Result
 */
export interface SAMGovDocument {
  name: string;
  url?: string;
  storagePath?: string;
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
  fileType?: string;
  size?: number;
}

/**
 * SAM.gov Document Downloader
 *
 * Downloads documents from SAM.gov opportunities using the API
 * Documents are accessed via the SAM.gov API attachment endpoints
 *
 * @see https://open.gsa.gov/api/opportunities-api/
 */
export class SAMGovDocumentDownloader {
  private readonly SAM_BASE_URL = 'https://api.sam.gov/opportunities/v2';
  private objectStorage: ObjectStorageService;
  private apiKey: string;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.validateEnvironment();
    this.apiKey = process.env.SAM_GOV_API_KEY as string;
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    if (!process.env.SAM_GOV_API_KEY) {
      throw new Error(
        'SAM_GOV_API_KEY is required. Please set it in your .env file. ' +
          'Get an API key from https://open.gsa.gov/api/opportunities-api/'
      );
    }
  }

  /**
   * Get API key (allows override for testing)
   */
  private getApiKey(overrideKey?: string): string {
    return overrideKey || this.apiKey;
  }

  /**
   * Download RFP documents from SAM.gov
   *
   * @param noticeId - The SAM.gov notice ID (e.g., "abc123")
   * @param rfpId - Internal RFP ID for storage organization
   * @param apiKey - Optional API key override
   * @returns Array of document download results
   */
  async downloadRFPDocuments(
    noticeId: string,
    rfpId: string,
    apiKey?: string
  ): Promise<SAMGovDocument[]> {
    const results: SAMGovDocument[] = [];
    const effectiveApiKey = this.getApiKey(apiKey);

    try {
      logger.info('Starting SAM.gov document download', {
        noticeId,
        rfpId,
      });

      // Step 1: Fetch opportunity details to get attachments list
      const attachments = await this.getOpportunityAttachments(
        noticeId,
        effectiveApiKey
      );

      if (attachments.length === 0) {
        logger.info('No attachments found for opportunity', { noticeId });
        return [];
      }

      logger.info('Found attachments for opportunity', {
        noticeId,
        count: attachments.length,
      });

      // Step 2: Download each attachment
      for (const attachment of attachments) {
        const doc: SAMGovDocument = {
          name: attachment.name,
          url: attachment.url,
          fileType: attachment.fileType,
          size: attachment.size,
          downloadStatus: 'pending',
        };

        results.push(doc);

        try {
          logger.info('Downloading attachment', {
            name: attachment.name,
            url: attachment.url,
          });

          doc.downloadStatus = 'downloading';

          // Download the file
          const fileBuffer = await this.downloadFile(
            attachment.url,
            effectiveApiKey
          );

          // Upload to object storage
          const storagePath = await this.uploadBufferToStorage(
            fileBuffer,
            rfpId,
            attachment.name,
            attachment.fileType
          );

          // Verify upload
          const verified = await this.verifyFileExists(storagePath);

          if (verified) {
            doc.storagePath = storagePath;
            doc.downloadStatus = 'completed';

            logger.info('Successfully downloaded and stored attachment', {
              name: attachment.name,
              size: fileBuffer.length,
              storagePath,
            });
          } else {
            throw new Error('Upload verification failed');
          }
        } catch (error: any) {
          logger.error('Failed to download attachment', error, {
            name: attachment.name,
            url: attachment.url,
          });

          doc.downloadStatus = 'failed';
          doc.error = error.message || 'Download failed';
        }
      }

      const successCount = results.filter(
        d => d.downloadStatus === 'completed'
      ).length;

      logger.info('Completed SAM.gov document download', {
        noticeId,
        rfpId,
        total: results.length,
        success: successCount,
        failed: results.length - successCount,
      });

      return results;
    } catch (error: any) {
      logger.error('SAM.gov document download process failed', error, {
        noticeId,
        rfpId,
      });
      throw error;
    }
  }

  /**
   * Get attachments for a SAM.gov opportunity
   *
   * @param noticeId - The SAM.gov notice ID
   * @param apiKey - SAM.gov API key
   * @returns Array of attachment metadata
   */
  private async getOpportunityAttachments(
    noticeId: string,
    apiKey: string
  ): Promise<
    Array<{
      name: string;
      url: string;
      fileType: string;
      size: number;
      resourceId?: string;
    }>
  > {
    try {
      logger.info('Fetching SAM.gov opportunity attachments', { noticeId });

      // Fetch opportunity details
      const response = await axios.get(`${this.SAM_BASE_URL}/search`, {
        params: {
          noticeId,
          limit: 1,
        },
        headers: {
          'X-Api-Key': apiKey,
          'User-Agent':
            'RFPAgent/2.0 (Government RFP Management System; Contact: support@rfpagent.com)',
          Accept: 'application/json',
        },
        timeout: 30000,
      });

      if (response.status !== 200) {
        throw new Error(
          `SAM.gov API returned status ${response.status}: ${response.statusText}`
        );
      }

      logger.debug('SAM.gov attachments API response', {
        noticeId,
        status: response.status,
        totalRecords: response.data?.totalRecords,
        opportunitiesCount: response.data?.opportunitiesData?.length,
      });

      const opportunities = response.data?.opportunitiesData || [];

      if (opportunities.length === 0) {
        logger.warn('No opportunity found for notice ID', {
          noticeId,
          apiResponse: response.data,
        });
        return [];
      }

      const opportunity = opportunities[0];

      logger.debug('SAM.gov opportunity structure', {
        noticeId,
        hasAttachments: !!opportunity.attachments,
        hasLinks: !!opportunity.links,
        hasResourceLinks: !!opportunity.resourceLinks,
        attachmentsCount: opportunity.attachments?.length,
        linksCount: opportunity.links?.length,
        resourceLinksCount: opportunity.resourceLinks?.length,
      });

      const attachments: Array<{
        name: string;
        url: string;
        fileType: string;
        size: number;
        resourceId?: string;
      }> = [];

      // SAM.gov API v2 structure for attachments
      // attachments may be in: opportunity.attachments, opportunity.links, or opportunity.resourceLinks
      const rawAttachments =
        opportunity.attachments ||
        opportunity.links ||
        opportunity.resourceLinks ||
        [];

      for (const att of rawAttachments) {
        const name = att.name || att.fileName || att.description || 'document';
        const url =
          att.url ||
          att.link ||
          att.resourceLink ||
          `${this.SAM_BASE_URL}/resources/${att.resourceId}/download`;
        const fileType = this.inferFileType(name, att.fileType);
        const size = att.size || att.fileSize || 0;

        if (url) {
          attachments.push({
            name,
            url,
            fileType,
            size,
            resourceId: att.resourceId,
          });
        }
      }

      return attachments;
    } catch (error: any) {
      logger.error('Failed to get opportunity attachments', error, {
        noticeId,
        endpoint: `${this.SAM_BASE_URL}/search`,
      });
      throw new Error(
        `Failed to fetch attachments: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Download file from URL
   *
   * @param url - File download URL
   * @param apiKey - SAM.gov API key
   * @returns File buffer
   */
  private async downloadFile(url: string, apiKey: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        headers: {
          'X-Api-Key': apiKey,
          'User-Agent':
            'RFPAgent/2.0 (Government RFP Management System; Contact: support@rfpagent.com)',
        },
        responseType: 'arraybuffer',
        timeout: 60000, // 60 seconds for file download
        maxContentLength: 100 * 1024 * 1024, // 100MB max
      });

      if (response.status !== 200) {
        throw new Error(
          `Failed to download file: ${response.status} ${response.statusText}`
        );
      }

      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `HTTP ${error.response.status}: ${error.response.statusText || 'Download failed'}`
        );
      } else if (error.request) {
        throw new Error('Network error: Unable to reach SAM.gov servers');
      } else {
        throw new Error(`Download error: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Upload file buffer to object storage
   *
   * @param fileBuffer - File data
   * @param rfpId - RFP ID for organization
   * @param fileName - Original filename
   * @param contentType - MIME type
   * @returns Storage path (public URL)
   */
  private async uploadBufferToStorage(
    fileBuffer: Buffer,
    rfpId: string,
    fileName: string,
    contentType: string = 'application/pdf'
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];

      // Sanitize filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}-${safeFileName}`;
      const objectPath = `rfp_documents/${rfpId}/${uniqueFileName}`;

      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);

      // Fallback for missing/unknown MIME types
      const safeContentType = contentType || 'application/octet-stream';

      // Upload buffer directly
      await file.save(fileBuffer, {
        metadata: {
          contentType: safeContentType,
          metadata: {
            rfpId: rfpId,
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
            source: 'sam.gov',
          },
        },
      });

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

      logger.info('Uploaded file to object storage', {
        fileName: safeFileName,
        size: fileBuffer.length,
        contentType: safeContentType,
        storagePath: publicUrl,
      });

      return publicUrl;
    } catch (error: any) {
      logger.error('Failed to upload file to storage', error, {
        fileName,
        size: fileBuffer.length,
      });
      throw new Error(
        `Storage upload failed: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Verify file exists in object storage
   *
   * @param storagePath - Storage URL
   * @returns True if file exists
   */
  private async verifyFileExists(storagePath: string): Promise<boolean> {
    try {
      // Extract bucket and object path from storage URL
      const urlParts = storagePath
        .replace('https://storage.googleapis.com/', '')
        .split('/');
      const bucketName = urlParts[0];
      const objectPath = urlParts.slice(1).join('/');

      // Check if file exists
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);
      const [exists] = await file.exists();

      return exists;
    } catch (error: any) {
      logger.error('Failed to verify file existence', error, {
        storagePath,
      });
      return false;
    }
  }

  /**
   * Infer file type from filename or explicit type
   *
   * @param fileName - Original filename
   * @param explicitType - Explicit MIME type if provided
   * @returns MIME type
   */
  private inferFileType(fileName: string, explicitType?: string): string {
    if (explicitType) {
      return explicitType;
    }

    const extension = fileName.toLowerCase().split('.').pop();

    const typeMap: Record<string, string> = {
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

    return typeMap[extension || ''] || 'application/octet-stream';
  }

  /**
   * Get document information without downloading
   * Useful for previewing available documents
   *
   * @param noticeId - SAM.gov notice ID
   * @param apiKey - Optional API key override
   * @returns Array of document metadata
   */
  async getDocumentInfo(
    noticeId: string,
    apiKey?: string
  ): Promise<SAMGovDocument[]> {
    const effectiveApiKey = this.getApiKey(apiKey);

    try {
      const attachments = await this.getOpportunityAttachments(
        noticeId,
        effectiveApiKey
      );

      return attachments.map(att => ({
        name: att.name,
        url: att.url,
        fileType: att.fileType,
        size: att.size,
        downloadStatus: 'pending' as const,
      }));
    } catch (error: any) {
      logger.error('Failed to get document info', error, { noticeId });
      throw error;
    }
  }
}
