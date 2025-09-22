import { z } from 'zod';
import { performWebExtraction, performWebObservation, performWebAction } from './stagehandTools';
import { sessionManager } from '../../src/mastra/tools/session-manager';
import { db } from '../db';
import { rfps, documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { randomUUID } from 'crypto';
import { storage } from '../storage';
import * as path from 'path';
import * as fs from 'fs';
import { PhiladelphiaDocumentDownloader } from './philadelphiaDocumentDownloader';

// Schema for extracted RFP data
const rfpExtractionSchema = z.object({
  title: z.string().describe('RFP title or project name'),
  agency: z.string().describe('Issuing agency or organization'),
  description: z.string().optional().describe('RFP description or scope of work'),
  deadline: z.string().optional().describe('Submission deadline date and time'),
  estimatedValue: z.string().optional().describe('Contract value, budget, or estimated amount'),
  contactName: z.string().optional().describe('Contact person name'),
  contactEmail: z.string().optional().describe('Contact email address'),
  contactPhone: z.string().optional().describe('Contact phone number'),
  solicitation_number: z.string().optional().describe('RFP/Solicitation number or ID'),
  pre_bid_meeting: z.string().optional().describe('Pre-bid meeting date/time if applicable'),
  documents: z.array(z.object({
    name: z.string().describe('Document name or title'),
    url: z.string().optional().describe('Document download URL (if available)'),
    type: z.string().optional().describe('Document type (PDF, DOCX, etc.)')
  })).optional().describe('List of downloadable documents')
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
  async scrapeRFP(url: string, userId: string = 'manual'): Promise<{
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
      
      // Parse deadline if present
      let deadlineDate = null;
      if (extractedData.deadline) {
        try {
          // Try various date formats
          deadlineDate = new Date(extractedData.deadline);
          if (isNaN(deadlineDate.getTime())) {
            // Try parsing with specific formats
            const dateFormats = [
              /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
              /(\d{4})-(\d{2})-(\d{2})/,
              /(\w+)\s+(\d{1,2}),?\s+(\d{4})/
            ];
            
            for (const format of dateFormats) {
              const match = extractedData.deadline.match(format);
              if (match) {
                deadlineDate = new Date(extractedData.deadline);
                if (!isNaN(deadlineDate.getTime())) break;
              }
            }
            
            if (isNaN(deadlineDate.getTime())) {
              deadlineDate = null;
              errors.push(`Could not parse deadline date: ${extractedData.deadline}`);
            }
          }
        } catch (e) {
          console.error('Error parsing deadline:', e);
          errors.push(`Error parsing deadline: ${extractedData.deadline}`);
        }
      }

      // Parse estimated value if present
      let estimatedValueNum = null;
      if (extractedData.estimatedValue) {
        const valueStr = extractedData.estimatedValue.replace(/[$,]/g, '');
        const parsed = parseFloat(valueStr);
        if (!isNaN(parsed)) {
          estimatedValueNum = parsed;
        } else {
          errors.push(`Could not parse estimated value: ${extractedData.estimatedValue}`);
        }
      }

      // Check if RFP already exists
      const existingRFP = await db.query.rfps.findFirst({
        where: (rfpsTable, { eq }) => eq(rfpsTable.sourceUrl, url),
      });

      let rfpId: string;
      
      if (existingRFP) {
        console.log(`📋 Updating existing RFP: ${existingRFP.id}`);
        // Update existing RFP
        await db.update(rfps)
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
              pre_bid_meeting: extractedData.pre_bid_meeting,
              contact: {
                name: extractedData.contactName,
                email: extractedData.contactEmail,
                phone: extractedData.contactPhone
              }
            }
          })
          .where(eq(rfps.id, existingRFP.id));
        
        rfpId = existingRFP.id;
      } else {
        console.log(`✨ Creating new RFP entry`);
        // Create new RFP
        const newRfp = await db.insert(rfps)
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
              pre_bid_meeting: extractedData.pre_bid_meeting,
              contact: {
                name: extractedData.contactName,
                email: extractedData.contactEmail,
                phone: extractedData.contactPhone
              }
            }
          })
          .returning();
        
        rfpId = newRfp[0].id;
      }

      // Download and save documents
      const savedDocuments = [];
      if (extractedData.documents && extractedData.documents.length > 0) {
        console.log(`📄 Found ${extractedData.documents.length} documents to download`);
        
        // Check if this is a Philadelphia RFP
        if (url.includes('phlcontracts.phila.gov')) {
          console.log(`🏛️ Using Philadelphia-specific document downloader`);
          const documentNames = extractedData.documents.map(doc => doc.name);
          
          try {
            const downloadResults = await this.philadelphiaDownloader.downloadRFPDocuments(
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
                    source: 'philadelphia_downloader'
                  }
                });

                savedDocuments.push(newDoc);
                console.log(`✅ Saved document: ${result.name}`);
              } else {
                // Create a document record even for failed downloads to show in UI
                const failedDoc = await storage.createDocument({
                  rfpId,
                  filename: result.name,
                  fileType: 'pdf', // Default assumption
                  objectPath: '',  // Empty path for failed downloads
                  extractedText: null,
                  parsedData: {
                    downloadUrl: url,
                    downloadStatus: result.downloadStatus,
                    downloadError: result.error,
                    attemptedAt: new Date().toISOString(),
                    source: 'philadelphia_downloader'
                  }
                });

                savedDocuments.push(failedDoc);
                console.log(`📝 Saved document metadata for failed download: ${result.name}`);

                if (result.error) {
                  console.error(`Failed to download ${result.name}: ${result.error}`);
                  errors.push(`Failed to download document: ${result.name} - ${result.error}`);
                }
              }
            }
          } catch (error) {
            console.error(`Error downloading Philadelphia documents:`, error);
            errors.push(`Failed to download Philadelphia documents: ${error}`);
          }
        } else {
          // Use standard download for other portals
          for (const doc of extractedData.documents) {
            try {
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
                    source: 'manual_scraping'
                  }
                });
                
                savedDocuments.push(newDoc);
                console.log(`✅ Saved document: ${doc.name}`);
              }
            } catch (docError) {
              console.error(`Error downloading document ${doc.name}:`, docError);
              errors.push(`Failed to download document: ${doc.name}`);
            }
          }
        }
      }

      // Get the final RFP data
      const finalRfp = await db.query.rfps.findFirst({
        where: (rfpsTable, { eq }) => eq(rfpsTable.id, rfpId),
      });

      console.log(`✅ RFP scraping completed for: ${extractedData.title}`);
      
      return {
        rfp: finalRfp,
        documents: savedDocuments,
        errors: errors.length > 0 ? errors : undefined
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
      `Extract all RFP details including: title, agency, description, deadline, estimated value, contact information, solicitation number, pre-bid meeting date, and all downloadable document links with their names`,
      rfpExtractionSchema,
      this.sessionId
    );
  }

  /**
   * Special extraction for Philadelphia RFPs
   */
  private async extractPhiladelphiaRFPData(url: string) {
    console.log(`🏛️ Using Philadelphia RFP extraction logic`);
    
    try {
      // Use the PhiladelphiaDocumentDownloader's extraction method
      const philadelphiaData = await this.philadelphiaDownloader.extractRFPDetails(url);
      
      // Convert attachments array from Philadelphia data to document list
      const documentList = (philadelphiaData.attachments || []).map(name => ({
        name,
        url: '', // Philadelphia documents don't have direct URLs
        type: 'pdf'
      }));
      
      // Convert Philadelphia format to our standard format
      // Return in WebExtractionResult format with 'data' property
      return {
        data: {
          title: philadelphiaData.description || philadelphiaData.bulletinDescription || 'Philadelphia RFP',
          agency: philadelphiaData.organization || philadelphiaData.department || 'City of Philadelphia',
          description: philadelphiaData.bulletinDescription || philadelphiaData.description || '',
          deadline: philadelphiaData.bidOpeningDate || philadelphiaData.requiredDate || null,
          estimatedValue: philadelphiaData.fiscalYear ? `FY ${philadelphiaData.fiscalYear}` : null,
          contactName: philadelphiaData.infoContact || philadelphiaData.purchaser || null,
          contactEmail: philadelphiaData.shipToAddress?.email || null,
          contactPhone: philadelphiaData.shipToAddress?.phone || null,
          solicitation_number: philadelphiaData.bidNumber || null,
          pre_bid_meeting: null, // Philadelphia format doesn't include this
          documents: documentList
        },
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Error extracting Philadelphia RFP data:', error);
      console.error('Error details:', error.message || error);
      console.error('Error stack:', error.stack);
      
      // Fall back to generic extraction
      return performWebExtraction(
        url,
        `Extract RFP details from this Philadelphia contracting portal page. Look for bid information, attachments, and all relevant details.`,
        rfpExtractionSchema,
        this.sessionId
      );
    }
  }

  /**
   * Special extraction for Austin Texas RFPs
   */
  private async extractAustinRFPData(url: string) {
    console.log(`🏛️ Using Austin Texas RFP extraction logic`);
    
    // Extract the data with specific instructions for Austin portal
    // The performWebExtraction will navigate to the URL automatically
    return performWebExtraction(
      url,
      `Extract RFP details from this Austin Texas solicitation page. Look for:
      - Solicitation title (usually at the top of the page)
      - Solicitation number
      - Department/Agency name
      - Description or scope of work
      - Due date/deadline (look for "Due Date" or "Closing Date")
      - Estimated value or budget (may be in description or separate field)
      - Contact person details (name, email, phone)
      - Pre-bid meeting information if available
      - All downloadable documents (look for PDF links, attachments section, or document table)`,
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
      const extension = docType.toLowerCase().startsWith('.') ? docType : `.${docType}`;
      const filename = sanitizedName.endsWith(extension) ? sanitizedName : `${sanitizedName}${extension}`;
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
   * Simple file download implementation
   */
  private async simpleDownloadFile(url: string, filepath: string): Promise<void> {
    try {
      console.log(`⬇️ Downloading from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filepath, buffer);
      
      console.log(`✅ Downloaded successfully: ${path.basename(filepath)}`);
    } catch (error) {
      console.error(`❌ Download failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Clean up the browser session
   */
  private async cleanup() {
    try {
      // Session will be cleaned up automatically after inactivity
      console.log('Session cleanup scheduled');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Export a function for easier use in routes
export async function scrapeRFPFromUrl(url: string, userId: string = 'manual') {
  const scraper = new RFPScrapingService();
  return scraper.scrapeRFP(url, userId);
}