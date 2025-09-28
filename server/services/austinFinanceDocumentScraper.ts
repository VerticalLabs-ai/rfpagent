import { z } from 'zod';
import { storage } from '../storage';
import type { Document } from '@shared/schema';
import { performWebExtraction } from './stagehandTools';
import { downloadFile } from './fileDownloadService';
import { ObjectStorageService } from '../objectStorage';
import { sessionManager } from '../../src/mastra/tools/session-manager';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// Domain allowlist for security
const ALLOWED_DOMAINS = [
  'austintexas.gov',
  'austinfinance.gov',
  'ci.austin.tx.us',
  'cityofaustin.gov',
];

// Schema for document extraction (allows relative URLs)
const documentExtractionSchema = z.object({
  documents: z
    .array(
      z.object({
        name: z.string().describe('Document name or title'),
        downloadUrl: z
          .string()
          .min(1)
          .describe('Download URL (absolute or relative)'),
        category: z
          .string()
          .optional()
          .describe('Document category (submittal, price_form, etc.)'),
        fileType: z
          .string()
          .optional()
          .describe('File type (pdf, doc, xls, etc.)'),
      })
    )
    .describe('Array of available documents for download'),
});

type DocumentExtractionData = z.infer<typeof documentExtractionSchema>;

export class AustinFinanceDocumentScraper {
  private objectStorage: ObjectStorageService;
  private sessionId: string;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.sessionId = `austin-finance-${randomUUID()}`;
  }

  /**
   * Validate URL is from allowed Austin domains (strict subdomain matching)
   */
  private validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return ALLOWED_DOMAINS.some(
        domain => hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  /**
   * Resolve relative URLs against base URL and validate
   */
  private resolveAndValidateUrl(url: string, baseUrl: string): string | null {
    try {
      const resolvedUrl = new URL(url, baseUrl);
      return this.validateUrl(resolvedUrl.href) ? resolvedUrl.href : null;
    } catch {
      return null;
    }
  }

  /**
   * Scrape and download all documents for a specific Austin Finance RFP
   */
  async scrapeRFPDocuments(
    rfpId: string,
    solicitationUrl: string
  ): Promise<Document[]> {
    console.log(
      `📄 Starting document scraping for RFP ${rfpId} from ${solicitationUrl}`
    );

    // Security: Validate URL is from allowed domains
    if (!this.validateUrl(solicitationUrl)) {
      throw new Error(
        `URL not from allowed Austin domains: ${solicitationUrl}`
      );
    }

    try {
      // Step 1: Extract document information using performWebExtraction
      console.log(
        `📊 Extracting document information from Austin Finance page`
      );
      const extractionResult = await performWebExtraction(
        solicitationUrl,
        `Find all downloadable documents on this Austin Finance RFP page. Look for:
        - PDF, DOC, DOCX, XLS, XLSX files
        - Download links in tables or document lists
        - Document names and titles
        - Categorize documents (submittal forms, price forms, RFP packages, etc.)
        Return all available documents with their download URLs.`,
        documentExtractionSchema,
        this.sessionId
      );

      const extractedData = extractionResult.data as DocumentExtractionData;
      const documents = extractedData?.documents ?? [];
      console.log(`📋 Found ${documents.length} documents to download`);

      if (documents.length === 0) {
        console.warn('⚠️ No documents found on the page');
        return [];
      }

      // Step 2: Download and store each document
      const savedDocuments: Document[] = [];

      for (const docInfo of documents) {
        try {
          // Resolve and validate download URL (handles relative URLs)
          const resolvedUrl = this.resolveAndValidateUrl(
            docInfo.downloadUrl,
            solicitationUrl
          );
          if (!resolvedUrl) {
            console.warn(
              `⚠️ Skipping document with invalid URL: ${docInfo.downloadUrl}`
            );
            continue;
          }

          console.log(`⬇️ Downloading: ${docInfo.name}`);

          // Create temporary file path
          const tempDir = '/tmp/rfp_downloads';
          await fs.mkdir(tempDir, { recursive: true });
          const tempFilePath = path.join(
            tempDir,
            `${rfpId}_${Date.now()}_${this.sanitizeFilename(docInfo.name)}`
          );

          // Download file using fileDownloadService
          await downloadFile(resolvedUrl, tempFilePath);

          // Read file buffer
          const documentBuffer = await fs.readFile(tempFilePath);

          // Upload to object storage
          const objectPath = await this.saveToObjectStorage(
            rfpId,
            docInfo.name,
            documentBuffer
          );

          // Determine document properties using resolved URL
          const fileType = this.determineFileType(docInfo.name, resolvedUrl);
          const category = this.categorizeDocument(docInfo.name);
          const needsFillOut = this.determineIfNeedsFillOut(
            docInfo.name,
            category
          );

          // Save document record to database
          const savedDoc = await storage.createDocument({
            rfpId: rfpId,
            filename: docInfo.name,
            fileType: fileType,
            objectPath: objectPath,
            extractedText: null,
            parsedData: {
              category: category,
              downloadUrl: resolvedUrl,
              downloadedAt: new Date().toISOString(),
              size: documentBuffer.length,
              needsFillOut: needsFillOut,
              extractionMethod: 'stagehand_extraction',
              sessionId: this.sessionId,
            },
          });

          savedDocuments.push(savedDoc);
          console.log(`✅ Successfully downloaded and saved: ${docInfo.name}`);

          // Clean up temp file
          await fs.unlink(tempFilePath).catch(() => {}); // Ignore cleanup errors
        } catch (error) {
          console.error(`❌ Failed to download ${docInfo.name}:`, error);
        }
      }

      return savedDocuments;
    } catch (error) {
      console.error('❌ Error during document scraping:', error);
      throw error;
    } finally {
      // Clean up browser session to prevent resource leaks
      try {
        await sessionManager.cleanup(this.sessionId);
        console.log(`🧹 Cleaned up session: ${this.sessionId}`);
      } catch (cleanupError) {
        console.warn('⚠️ Session cleanup warning:', cleanupError);
      }
    }
  }

  /**
   * Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
  }

  /**
   * Save document to object storage
   */
  private async saveToObjectStorage(
    rfpId: string,
    filename: string,
    buffer: Buffer
  ): Promise<string> {
    try {
      const cleanFilename = this.sanitizeFilename(filename);
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${cleanFilename}`;

      // Use private directory for RFP documents
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const objectPath = `${privateDir}/rfp_documents/${rfpId}/${uniqueFilename}`;

      // Upload to object storage
      const contentType = this.getContentType(filename);
      const uploadUrl = await this.objectStorage.getUploadUrl(objectPath, {
        'Content-Type': contentType,
      });

      // Upload the file with matching headers
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: buffer,
        headers: {
          'Content-Type': contentType,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      console.log(`💾 Saved document to object storage: ${objectPath}`);
      return objectPath;
    } catch (error) {
      console.error('Failed to save to object storage:', error);
      // Fallback to local storage
      return await this.saveToLocalStorage(rfpId, filename, buffer);
    }
  }

  /**
   * Fallback: save to local storage if object storage fails
   */
  private async saveToLocalStorage(
    rfpId: string,
    filename: string,
    buffer: Buffer
  ): Promise<string> {
    const cleanFilename = this.sanitizeFilename(filename);
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${cleanFilename}`;

    const localPath = path.join(
      process.cwd(),
      'attached_assets',
      'rfp_documents',
      rfpId,
      uniqueFilename
    );

    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);

    console.log(`💾 Saved document locally: ${localPath}`);
    return localPath;
  }

  /**
   * Get content type for file upload
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.doc':
        return 'application/msword';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Determine file type from name and URL
   */
  private determineFileType(name: string, url: string): string {
    const combined = (name + ' ' + url).toLowerCase();
    if (combined.includes('.pdf')) return 'pdf';
    if (combined.includes('.docx')) return 'docx';
    if (combined.includes('.doc')) return 'doc';
    if (combined.includes('.xlsx')) return 'xlsx';
    if (combined.includes('.xls')) return 'xls';
    return 'unknown';
  }

  /**
   * Categorize document by name
   */
  private categorizeDocument(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('price') || lowerName.includes('cost'))
      return 'price_form';
    if (lowerName.includes('submittal') || lowerName.includes('submission'))
      return 'submittal';
    if (lowerName.includes('insurance')) return 'insurance';
    if (lowerName.includes('reference')) return 'references';
    if (lowerName.includes('wage')) return 'wage_compliance';
    if (lowerName.includes('local') || lowerName.includes('business'))
      return 'local_business';
    if (lowerName.includes('rfp') || lowerName.includes('package'))
      return 'rfp_package';
    if (lowerName.includes('attachment')) return 'attachment';
    return 'other';
  }

  /**
   * Determine if a document needs to be filled out
   */
  private determineIfNeedsFillOut(filename: string, category: string): boolean {
    const lowerName = filename.toLowerCase();

    // Documents that typically need to be filled out
    const fillablePatterns = [
      'submittal',
      'form',
      'price',
      'cost',
      'proposal',
      'response',
      'questionnaire',
      'certification',
      'affidavit',
      'worksheet',
    ];

    // Documents that are typically read-only
    const readOnlyPatterns = [
      'instructions',
      'terms',
      'conditions',
      'scope',
      'specifications',
      'requirements',
      'cover',
      'package',
    ];

    const isFillable = fillablePatterns.some(pattern =>
      lowerName.includes(pattern)
    );
    const isReadOnly = readOnlyPatterns.some(pattern =>
      lowerName.includes(pattern)
    );

    return isFillable && !isReadOnly;
  }

  /**
   * Analyze documents to identify what needs to be filled out
   */
  async analyzeDocumentsForFillOut(rfpId: string): Promise<{
    fillableDocuments: Document[];
    readOnlyDocuments: Document[];
    summary: string;
  }> {
    const documents = await storage.getDocumentsByRFP(rfpId);

    const fillableDocuments: Document[] = [];
    const readOnlyDocuments: Document[] = [];

    for (const doc of documents) {
      const needsFillOut = (doc.parsedData as any)?.needsFillOut || false;
      if (needsFillOut) {
        fillableDocuments.push(doc);
      } else {
        readOnlyDocuments.push(doc);
      }
    }

    const summary = `Found ${fillableDocuments.length} documents that need to be filled out and ${readOnlyDocuments.length} reference documents.
    
Fillable Documents:
${fillableDocuments.map(d => `- ${d.filename} (${d.fileType.toUpperCase()})`).join('\n')}

Reference Documents:
${readOnlyDocuments.map(d => `- ${d.filename} (${d.fileType.toUpperCase()})`).join('\n')}`;

    return {
      fillableDocuments,
      readOnlyDocuments,
      summary,
    };
  }
}

// Export singleton instance
export const austinFinanceDocumentScraper = new AustinFinanceDocumentScraper();
