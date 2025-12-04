import { rfps } from '@shared/schema';
import { isValid, parse } from 'date-fns';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { createWriteStream } from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import type { z } from 'zod';
import { db } from '../../db';
import { storage } from '../../storage';
import { performWebExtraction } from '../core/stagehandTools';
import { PhiladelphiaDocumentDownloader } from './philadelphiaDocumentDownloader';

// Schema for extracted RFP data
const rfpExtractionSchema = z.object({
  title: z.string().describe('RFP title or project name'),
  agency: z.string().describe('Issuing agency or organization'),
  description: z
    .string()
    .optional()
    .describe('RFP description or scope of work'),
  deadline: z
    .string()
    .optional()
    .describe('Submission deadline date and time (Due Date)'),
  estimatedValue: z
    .string()
    .optional()
    .describe('Contract value, budget, or estimated amount'),
  contactName: z.string().optional().describe('Contact person name'),
  contactEmail: z.string().optional().describe('Contact email address'),
  contactPhone: z.string().optional().describe('Contact phone number'),
  solicitation_number: z
    .string()
    .optional()
    .describe('RFP/Solicitation number or ID'),
  questions_due_date: z
    .string()
    .optional()
    .describe('Date by which questions must be submitted (Questions Due)'),
  conference_date: z
    .string()
    .optional()
    .describe('Pre-bid conference or meeting date (Conference Date)'),
  pre_bid_meeting: z
    .string()
    .optional()
    .describe('Pre-bid meeting date/time if applicable (legacy field)'),
  documents: z
    .array(
      z.object({
        name: z.string().describe('Document name or title'),
        url: z
          .string()
          .optional()
          .describe('Document download URL (if available)'),
        type: z.string().optional().describe('Document type (PDF, DOCX, etc.)'),
      })
    )
    .optional()
    .describe('List of downloadable documents'),
});

type RFPExtractionData = z.infer<typeof rfpExtractionSchema>;

export class RFPScrapingService {
  private sessionId: string;
  private philadelphiaDownloader: PhiladelphiaDocumentDownloader;

  constructor() {
    // Use a consistent session name for this service instead of UUID
    // The session manager will handle browser sessions internally
    this.sessionId = 'rfp-scraping-session';
    this.philadelphiaDownloader = new PhiladelphiaDocumentDownloader();
  }

  /**
   * Scrape an RFP from a given URL
   */
  async scrapeRFP(
    url: string,
    userId: string = 'manual'
  ): Promise<{
    rfp: any;
    documents: any[];
    errors?: string[];
  }> {
    console.log(`🔍 Starting RFP scrape for URL: ${url}`);
    const errors: string[] = [];

    try {
      // Extract main RFP data
      const extractionResult = await this.extractRFPData(url);

      if (!extractionResult.data) {
        throw new Error('Failed to extract RFP data');
      }

      const extractedData = extractionResult.data as RFPExtractionData;

      // Helper function to parse dates
      const parseDate = (dateString: string | undefined): Date | null => {
        if (!dateString) return null;

        try {
          // Try various date formats using date-fns parse
          const dateFormats = [
            'MM/dd/yyyy', // 12/31/2024
            'M/d/yyyy', // 1/5/2024
            'yyyy-MM-dd', // 2024-12-31
            'MMMM d, yyyy', // October 5, 2024
            'MMM d, yyyy', // Jan 5, 2024
            'MMMM dd, yyyy', // October 05, 2024
            'MMM dd, yyyy', // Jan 05, 2024
            'dd/MM/yyyy', // 31/12/2024
            'd/M/yyyy', // 5/1/2024
            'MM-dd-yyyy', // 12-31-2024
            'M-d-yyyy', // 1-5-2024
          ];

          // First try native Date parsing
          const nativeDate = new Date(dateString);
          if (!isNaN(nativeDate.getTime())) {
            return nativeDate;
          }

          // Try each format with date-fns
          for (const format of dateFormats) {
            const parsedDate = parse(dateString, format, new Date());
            if (isValid(parsedDate)) {
              return parsedDate;
            }
          }

          errors.push(`Could not parse date: ${dateString}`);
          return null;
        } catch (e) {
          console.error('Error parsing date:', e);
          errors.push(`Error parsing date: ${dateString}`);
          return null;
        }
      };

      // Parse all date fields
      const deadlineDate = parseDate(extractedData.deadline);
      const questionsDueDate = parseDate(extractedData.questions_due_date);
      const conferenceDate = parseDate(extractedData.conference_date);
      const preBidMeetingDate = parseDate(extractedData.pre_bid_meeting);

      // Parse estimated value if present
      let estimatedValueNum = null;
      if (extractedData.estimatedValue) {
        const valueStr = extractedData.estimatedValue.replace(/[$,]/g, '');
        const parsed = parseFloat(valueStr);
        if (!isNaN(parsed)) {
          estimatedValueNum = parsed;
        } else {
          errors.push(
            `Could not parse estimated value: ${extractedData.estimatedValue}`
          );
        }
      }

      // Check if RFP already exists
      const [existingRFP] = await db
        .select()
        .from(rfps)
        .where(eq(rfps.sourceUrl, url))
        .limit(1);

      let rfpId: string;

      if (existingRFP) {
        console.log(`📋 Updating existing RFP: ${existingRFP.id}`);
        // Update existing RFP
        await db
          .update(rfps)
          .set({
            title: extractedData.title,
            description: extractedData.description || null,
            agency: extractedData.agency,
            deadline: deadlineDate,
            estimatedValue: estimatedValueNum?.toString() || null,
            status: 'parsing',
            progress: 25,
            updatedAt: new Date(),
            requirements: {
              solicitation_number: extractedData.solicitation_number,
              questions_due_date:
                questionsDueDate?.toISOString() ||
                extractedData.questions_due_date,
              conference_date:
                conferenceDate?.toISOString() || extractedData.conference_date,
              pre_bid_meeting:
                preBidMeetingDate?.toISOString() ||
                extractedData.pre_bid_meeting,
              contact: {
                name: extractedData.contactName,
                email: extractedData.contactEmail,
                phone: extractedData.contactPhone,
              },
            },
          })
          .where(eq(rfps.id, existingRFP.id));

        rfpId = existingRFP.id;
      } else {
        console.log('✨ Creating new RFP entry');
        // Create new RFP
        const newRfp = await db
          .insert(rfps)
          .values({
            title: extractedData.title,
            description: extractedData.description || null,
            agency: extractedData.agency,
            sourceUrl: url,
            deadline: deadlineDate,
            estimatedValue: estimatedValueNum?.toString() || null,
            status: 'parsing',
            progress: 25,
            addedBy: userId,
            manuallyAddedAt: userId === 'manual' ? new Date() : null,
            requirements: {
              solicitation_number: extractedData.solicitation_number,
              questions_due_date:
                questionsDueDate?.toISOString() ||
                extractedData.questions_due_date,
              conference_date:
                conferenceDate?.toISOString() || extractedData.conference_date,
              pre_bid_meeting:
                preBidMeetingDate?.toISOString() ||
                extractedData.pre_bid_meeting,
              contact: {
                name: extractedData.contactName,
                email: extractedData.contactEmail,
                phone: extractedData.contactPhone,
              },
            },
          })
          .returning();

        rfpId = newRfp[0].id;
      }

      // Download and save documents
      const savedDocuments = [];
      if (extractedData.documents && extractedData.documents.length > 0) {
        console.log(
          `📄 Found ${extractedData.documents.length} documents to download`
        );

        // Check if this is a Philadelphia RFP
        if (url.includes('phlcontracts.phila.gov')) {
          console.log('🏛️ Using Philadelphia-specific document downloader');
          const documentNames = extractedData.documents.map(doc => doc.name);

          try {
            const downloadResults =
              await this.philadelphiaDownloader.downloadRFPDocuments(
                url,
                rfpId,
                documentNames
              );

            // Process each downloaded document
            for (const result of downloadResults) {
              if (result.downloadStatus === 'completed' && result.storagePath) {
                // Save document record to database using storage interface
                const newDoc = await storage.createDocument({
                  rfpId,
                  filename: result.name,
                  fileType: result.storagePath.split('.').pop() || 'pdf',
                  objectPath: result.storagePath,
                  extractedText: null,
                  parsedData: {
                    downloadUrl: url,
                    downloadedAt: new Date().toISOString(),
                    source: 'philadelphia_downloader',
                  },
                });

                savedDocuments.push(newDoc);
                console.log(`✅ Saved document: ${result.name}`);
              } else {
                // Create a document record even for failed downloads to show in UI
                const failedDoc = await storage.createDocument({
                  rfpId,
                  filename: result.name,
                  fileType: 'pdf', // Default assumption
                  objectPath: '', // Empty path for failed downloads
                  extractedText: null,
                  parsedData: {
                    downloadUrl: url,
                    downloadStatus: result.downloadStatus,
                    downloadError: result.error,
                    attemptedAt: new Date().toISOString(),
                    source: 'philadelphia_downloader',
                  },
                });

                savedDocuments.push(failedDoc);
                console.log(
                  `📝 Saved document metadata for failed download: ${result.name}`
                );

                if (result.error) {
                  console.error(
                    `Failed to download ${result.name}: ${result.error}`
                  );
                  errors.push(
                    `Failed to download document: ${result.name} - ${result.error}`
                  );
                }
              }
            }
          } catch (error) {
            console.error('Error downloading Philadelphia documents:', error);
            errors.push(`Failed to download Philadelphia documents: ${error}`);
          }
        } else {
          // Use standard download for other portals
          for (const doc of extractedData.documents) {
            try {
              // Validate document URL
              if (
                !doc.url ||
                typeof doc.url !== 'string' ||
                doc.url.trim() === ''
              ) {
                errors.push(`Invalid or missing URL for document: ${doc.name}`);
                console.warn(
                  `⚠️ Skipping document with invalid URL: ${doc.name}`
                );
                continue;
              }

              // Validate URL format
              let validUrl: URL;
              try {
                validUrl = new URL(doc.url);
                // Ensure it's an absolute URL with http/https protocol
                if (!validUrl.protocol.startsWith('http')) {
                  throw new Error('URL must use http or https protocol');
                }
              } catch {
                errors.push(
                  `Invalid URL format for document: ${doc.name} - ${doc.url}`
                );
                console.warn(
                  `⚠️ Skipping document with malformed URL: ${doc.name}`
                );
                continue;
              }

              const documentPath = await this.downloadRFPDocument(
                rfpId,
                doc.url,
                doc.name,
                doc.type || 'pdf'
              );

              if (documentPath) {
                // Save document record to database using storage interface
                const newDoc = await storage.createDocument({
                  rfpId,
                  filename: doc.name,
                  fileType: doc.type || 'pdf',
                  objectPath: documentPath,
                  extractedText: null,
                  parsedData: {
                    downloadUrl: doc.url,
                    downloadedAt: new Date().toISOString(),
                    source: 'manual_scraping',
                  },
                });

                savedDocuments.push(newDoc);
                console.log(`✅ Saved document: ${doc.name}`);
              }
            } catch (docError) {
              console.error(
                `Error downloading document ${doc.name}:`,
                docError
              );
              errors.push(`Failed to download document: ${doc.name}`);
            }
          }
        }
      }

      // Get the final RFP data
      const [finalRfp] = await db
        .select()
        .from(rfps)
        .where(eq(rfps.id, rfpId))
        .limit(1);

      console.log(`✅ RFP scraping completed for: ${extractedData.title}`);

      return {
        rfp: finalRfp,
        documents: savedDocuments,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error('❌ RFP scraping failed:', error);
      throw error;
    } finally {
      // Clean up session
      await this.cleanup();
    }
  }

  /**
   * Extract RFP data from the page
   */
  private async extractRFPData(url: string) {
    console.log(`📊 Extracting RFP data from: ${url}`);

    // Special handling for Philadelphia RFPs
    if (url.includes('phlcontracts.phila.gov')) {
      return this.extractPhiladelphiaRFPData(url);
    }

    // Special handling for Austin Texas RFPs
    if (url.includes('austintexas.gov')) {
      return this.extractAustinRFPData(url);
    }

    // Generic extraction for other portals
    return performWebExtraction(
      url,
      'Extract all RFP details including: title, agency, description, deadline (Due Date), questions due date (Questions Due), conference date (Conference Date or Pre-Bid Meeting), estimated value, contact information, solicitation number, and all downloadable document links with their names. Pay special attention to dates - look for "Due Date", "Questions Due", and "Conference Date" labels.',
      rfpExtractionSchema,
      this.sessionId
    );
  }

  /**
   * Special extraction for Philadelphia RFPs
   */
  private async extractPhiladelphiaRFPData(url: string) {
    console.log('🏛️ Using Philadelphia RFP extraction logic');

    try {
      // Use the PhiladelphiaDocumentDownloader's extraction method
      const philadelphiaData =
        await this.philadelphiaDownloader.extractRFPDetails(url);

      // Convert attachments array from Philadelphia data to document list
      const documentList = (philadelphiaData.attachments || []).map(name => ({
        name,
        url: '', // Philadelphia documents don't have direct URLs
        type: 'pdf',
      }));

      // Convert Philadelphia format to our standard format
      // Return in WebExtractionResult format with 'data' property
      return {
        data: {
          title:
            philadelphiaData.description ||
            philadelphiaData.bulletinDescription ||
            'Philadelphia RFP',
          agency:
            philadelphiaData.organization ||
            philadelphiaData.department ||
            'City of Philadelphia',
          description:
            philadelphiaData.bulletinDescription ||
            philadelphiaData.description ||
            '',
          deadline:
            philadelphiaData.bidOpeningDate ||
            philadelphiaData.requiredDate ||
            null,
          estimatedValue: philadelphiaData.fiscalYear
            ? `FY ${philadelphiaData.fiscalYear}`
            : null,
          contactName:
            philadelphiaData.infoContact || philadelphiaData.purchaser || null,
          contactEmail: philadelphiaData.shipToAddress?.email || null,
          contactPhone: philadelphiaData.shipToAddress?.phone || null,
          solicitation_number: philadelphiaData.bidNumber || null,
          pre_bid_meeting: null, // Philadelphia format doesn't include this
          documents: documentList,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error extracting Philadelphia RFP data:', error);

      // Fall back to generic extraction
      return performWebExtraction(
        url,
        'Extract RFP details from this Philadelphia contracting portal page. Look for bid information, attachments, and all relevant details.',
        rfpExtractionSchema,
        this.sessionId
      );
    }
  }

  /**
   * Special extraction for Austin Texas RFPs
   */
  private async extractAustinRFPData(url: string) {
    console.log('🏛️ Using Austin Texas RFP extraction logic');

    // Extract the data with specific instructions for Austin portal
    // The performWebExtraction will navigate to the URL automatically
    return performWebExtraction(
      url,
      `Extract RFP details from this Austin Texas solicitation page. Look for:
      - Solicitation title (usually at the top of the page)
      - Solicitation number (Reference No.)
      - Department/Agency name
      - Description or scope of work
      - Due Date (labeled as "Due Date" - this is the submission deadline)
      - Questions Due date (labeled as "Questions Due" - when questions must be submitted by)
      - Conference Date (labeled as "Conference Date" - pre-bid meeting date)
      - Estimated value or budget (may be in description or separate field)
      - Contact person details (name, email, phone)
      - All downloadable documents (look for PDF links, attachments section, or document table)

      IMPORTANT: These are three separate date fields:
      1. deadline = Due Date (submission deadline)
      2. questions_due_date = Questions Due
      3. conference_date = Conference Date (pre-bid meeting)`,
      rfpExtractionSchema,
      this.sessionId
    );
  }

  /**
   * Download an RFP document
   */
  private async downloadRFPDocument(
    rfpId: string,
    docUrl: string,
    docName: string,
    docType: string
  ): Promise<string | null> {
    try {
      console.log(`⬇️ Downloading document: ${docName}`);

      // Create documents directory if it doesn't exist
      const docsDir = path.join(process.cwd(), 'rfp_documents', rfpId);
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      // Sanitize filename
      const sanitizedName = docName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const extension = docType.toLowerCase().startsWith('.')
        ? docType
        : `.${docType}`;
      const filename = sanitizedName.endsWith(extension)
        ? sanitizedName
        : `${sanitizedName}${extension}`;
      const filepath = path.join(docsDir, filename);

      // Download the file
      await this.simpleDownloadFile(docUrl, filepath);

      // Return relative path for storage
      return path.relative(process.cwd(), filepath);
    } catch (error) {
      console.error(`Failed to download document ${docName}:`, error);
      return null;
    }
  }

  /**
   * Simple file download implementation with timeout and streaming
   */
  private async simpleDownloadFile(
    url: string,
    filepath: string,
    timeoutMs: number = 60000 // 60 second default timeout
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`⬇️ Downloading from: ${url}`);

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(
          `Failed to download: ${response.status} ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Stream response to file
      const fileStream = createWriteStream(filepath);

      try {
        // @ts-expect-error - Node.js ReadableStream type compatibility with pipeline
        await pipeline(response.body, fileStream);
        console.log(`✅ Downloaded successfully: ${path.basename(filepath)}`);
      } catch (pipelineError) {
        // Clean up partial file on error
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        throw pipelineError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`❌ Download timeout (${timeoutMs}ms) for ${url}`);
        throw new Error(`Download timeout after ${timeoutMs}ms`);
      }
      console.error(`❌ Download failed for ${url}:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Clean up the browser session
   * Note: Sessions are managed by the session manager and cleaned up automatically after inactivity
   */
  private async cleanup() {
    // Sessions are managed by the session manager (Stagehand/Browserbase)
    // No manual cleanup needed as sessions auto-expire after inactivity
    // This method is kept for API consistency but performs no operation
  }
}

// Export a function for easier use in routes
export async function scrapeRFPFromUrl(url: string, userId: string = 'manual') {
  const scraper = new RFPScrapingService();
  return scraper.scrapeRFP(url, userId);
}
