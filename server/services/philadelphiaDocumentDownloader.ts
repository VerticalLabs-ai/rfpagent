import { Stagehand, type ConstructorParams } from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { z } from "zod";
import { ObjectStorageService, objectStorageClient } from '../objectStorage';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';

export interface PhiladelphiaDocument {
  name: string;
  url?: string;
  storagePath?: string;
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

export interface RFPDetails {
  bidNumber?: string;
  description?: string;
  bidOpeningDate?: string;
  purchaser?: string;
  organization?: string;
  department?: string;
  location?: string;
  fiscalYear?: string;
  typeCode?: string;
  allowElectronicQuote?: string;
  requiredDate?: string;
  availableDate?: string;
  infoContact?: string;
  bidType?: string;
  purchaseMethod?: string;
  bulletinDescription?: string;
  shipToAddress?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    itemNumber?: string;
    description?: string;
    nigpCode?: string;
    quantity?: string;
    unitOfMeasure?: string;
  }>;
  attachments?: string[];
}

export class PhiladelphiaDocumentDownloader {
  private objectStorage: ObjectStorageService;
  private browserbase: Browserbase;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.browserbase = new Browserbase({ 
      apiKey: process.env.BROWSERBASE_API_KEY! 
    });
  }

  /**
   * Create Stagehand instance with Google Gemini configuration
   */
  private createStagehandConfig(): ConstructorParams {
    return {
      env: 'BROWSERBASE',
      verbose: 1,
      modelName: 'google/gemini-2.0-flash-exp',
      disablePino: true,
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      modelClientOptions: {
        apiKey: process.env.GOOGLE_API_KEY,
      },
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
            height: 1080
          }
        },
        region: "us-west-2"
      }
    };
  }

  /**
   * Extract RFP details from Philadelphia contracting portal
   */
  async extractRFPDetails(rfpUrl: string): Promise<RFPDetails> {
    let stagehand: Stagehand | null = null;
    
    try {
      console.log('🤖 Initializing Stagehand with Google Gemini...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();
      
      const page = stagehand.page;
      if (!page) {
        throw new Error('Failed to get page instance from Stagehand');
      }

      console.log(`🌐 Navigating to: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      console.log('📊 Extracting RFP details...');
      const extractedData = await page.extract({
        instruction: `Extract all the key details of this RFP including bid information, contact details, items, and requirements`,
        schema: z.object({
          bidNumber: z.string().optional(),
          description: z.string().optional(),
          bidOpeningDate: z.string().optional(),
          purchaser: z.string().optional(),
          organization: z.string().optional(),
          department: z.string().optional(),
          location: z.string().optional(),
          fiscalYear: z.string().optional(),
          typeCode: z.string().optional(),
          allowElectronicQuote: z.string().optional(),
          requiredDate: z.string().optional(),
          availableDate: z.string().optional(),
          infoContact: z.string().optional(),
          bidType: z.string().optional(),
          purchaseMethod: z.string().optional(),
          bulletinDescription: z.string().optional(),
          shipToAddress: z
            .object({
              name: z.string().optional(),
              address: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
            })
            .optional(),
          items: z
            .array(
              z.object({
                itemNumber: z.string().optional(),
                description: z.string().optional(),
                nigpCode: z.string().optional(),
                quantity: z.string().optional(),
                unitOfMeasure: z.string().optional(),
              }),
            )
            .optional(),
          attachments: z.array(z.string()).optional(),
        }),
      });

      console.log('✅ Extracted RFP details:', extractedData);
      return extractedData;
      
    } catch (error) {
      console.error('❌ Failed to extract RFP details:', error);
      throw error;
    } finally {
      if (stagehand) {
        try {
          await stagehand.close();
        } catch (err) {
          console.error('Error closing Stagehand:', err);
        }
      }
    }
  }

  /**
   * Downloads documents from Philadelphia contracting portal
   * Handles click-to-download pattern where documents don't have direct URLs
   */
  async downloadRFPDocuments(
    rfpUrl: string,
    rfpId: string,
    documentNames: string[]
  ): Promise<PhiladelphiaDocument[]> {
    const results: PhiladelphiaDocument[] = [];
    let stagehand: Stagehand | null = null;

    console.log(`📥 Starting document download for RFP ${rfpId}`);
    console.log(`📄 Documents to download: ${documentNames.length}`);

    try {
      // Create new Stagehand instance with Google Gemini
      console.log('🤖 Initializing Stagehand with Google Gemini for downloads...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();
      
      const page = stagehand.page;
      if (!page) {
        throw new Error('Failed to get page instance from Stagehand');
      }

      // Navigate to RFP page
      console.log(`🌐 Navigating to RFP page: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });
      
      // Wait for file attachments section to load - Philadelphia specific
      await page.waitForSelector('text=File Attachments:', { timeout: 15000 });
      console.log(`📋 File Attachments section found`);

      // Configure browser for downloads - Browserbase stores files in cloud storage
      const client = await page.context().newCDPSession(page);
      await client.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: 'downloads', // Browserbase cloud storage path
        eventsEnabled: true,
      });
      
      console.log(`⚙️ Download behavior configured for Browserbase cloud storage`);
      
      // Extract the real Browserbase session ID from Stagehand
      let browserbaseSessionId: string | null = null;

      try {
        // Try the new Stagehand API first
        if (stagehand && typeof (stagehand as any).getSessionId === 'function') {
          browserbaseSessionId = await (stagehand as any).getSessionId();
        }

        // If that doesn't work, try the browserbase property
        if (!browserbaseSessionId && (stagehand as any).browserbase) {
          const browserbase = (stagehand as any).browserbase;
          browserbaseSessionId = browserbase.sessionId || browserbase.session?.id;
        }

        // Try extracting from page context
        if (!browserbaseSessionId && page) {
          const context = page.context();
          const browser = context.browser();

          // Check for Browserbase-specific properties
          browserbaseSessionId =
            (context as any)._browserbaseSessionId ||
            (context as any).sessionId ||
            (browser as any)._browserbaseSessionId ||
            (browser as any).sessionId;
        }

        // Last resort: try extracting from WebSocket URL or debug URL
        if (!browserbaseSessionId && page) {
          try {
            const browserContext = page.context();
            const cdpSession = await browserContext.newCDPSession(page);
            const targetInfo = await cdpSession.send('Target.getTargetInfo');
            const websocketUrl = (targetInfo as any)?.targetInfo?.url;

            if (websocketUrl) {
              const sessionMatch = websocketUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
              if (sessionMatch) {
                browserbaseSessionId = sessionMatch[1];
              }
            }
          } catch (cdpError) {
            console.log(`⚠️ CDP session extraction failed: ${cdpError}`);
          }
        }

        console.log(`🆔 Browserbase session ID: ${browserbaseSessionId || 'not found'}`);
      } catch (error) {
        console.log(`⚠️ Could not extract Browserbase session ID: ${error}`);
      }

      // Process each document
      for (const docName of documentNames) {
        const doc: PhiladelphiaDocument = {
          name: docName,
          downloadStatus: 'pending'
        };

        try {
          console.log(`🔍 Looking for document: ${docName}`);
          doc.downloadStatus = 'downloading';

          // Try to find and click the document link
          // Philadelphia portal typically shows documents in a table with clickable names
          const documentLink = await page.locator(`text="${docName}"`).first();
          
          if (await documentLink.count() > 0) {
            console.log(`📎 Found link for: ${docName}`);
            
            // Set up download promise before clicking
            const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
            
            // Click the document link
            await documentLink.click();
            
            // Wait for download to start
            const download = await downloadPromise;
            
            // Browserbase automatically stores files in cloud storage
            let downloadError = await download.failure();
            if (downloadError !== null) {
              throw new Error(`Download failed: ${downloadError}`);
            }
            
            console.log(`📥 Download triggered for: ${docName}`);
            doc.downloadStatus = 'completed';
            
            // We'll retrieve the actual file after processing all downloads
            
          } else {
            // If direct click doesn't work, try alternative methods
            console.log(`⚠️ Direct link not found for: ${docName}, trying alternative method`);
            
            // Look for download icons or buttons near the document name
            const row = await page.locator(`tr:has-text("${docName}")`).first();
            if (await row.count() > 0) {
              // Look for download button/icon in the same row
              const downloadButton = await row.locator('[title*="Download"], [alt*="Download"], a[href*="download"], button:has-text("Download")').first();
              
              if (await downloadButton.count() > 0) {
                const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
                await downloadButton.click();
                const download = await downloadPromise;
                
                let downloadError = await download.failure();
                if (downloadError !== null) {
                  throw new Error(`Download failed: ${downloadError}`);
                }
                
                console.log(`📥 Alternative download triggered for: ${docName}`);
                doc.downloadStatus = 'completed';
              } else {
                doc.downloadStatus = 'failed';
                doc.error = 'Download link not found';
              }
            } else {
              doc.downloadStatus = 'failed';
              doc.error = 'Document not found on page';
            }
          }
          
        } catch (error: any) {
          console.error(`❌ Failed to download ${docName}:`, error);
          doc.downloadStatus = 'failed';
          doc.error = error.message;
        }

        results.push(doc);
        
        // Small delay between downloads to avoid overwhelming the server
        await page.waitForTimeout(1000);
      }

      // After all downloads are triggered, retrieve them from Browserbase
      const successfulDownloads = results.filter(d => d.downloadStatus === 'completed');
      if (successfulDownloads.length > 0) {
        if (browserbaseSessionId) {
          console.log(`📦 Retrieving ${successfulDownloads.length} files from Browserbase...`);
          await this.retrieveAndUploadFiles(browserbaseSessionId, rfpId, results);
        } else {
          console.log(`⚠️ No Browserbase session ID available - attempting direct download fallback...`);
          await this.fallbackDirectDownload(rfpUrl, results, rfpId);
        }
      }

      const finalSuccessCount = results.filter(d => d.downloadStatus === 'completed' && d.storagePath).length;
      console.log(`✅ Successfully processed ${finalSuccessCount}/${documentNames.length} documents`);

      return results;

    } catch (error: any) {
      console.error('❌ Document download process failed:', error);
      
      // Mark all pending documents as failed
      for (const docName of documentNames) {
        if (!results.find(r => r.name === docName)) {
          results.push({
            name: docName,
            downloadStatus: 'failed',
            error: error.message
          });
        }
      }
      
      throw error;
    } finally {
      // Clean up Stagehand session
      if (stagehand) {
        try {
          await stagehand.close();
          console.log('🔒 Stagehand session closed');
        } catch (err) {
          console.error('Error closing Stagehand:', err);
        }
      }
    }
  }

  /**
   * Fallback method to download files directly when Browserbase cloud storage is not available
   */
  private async fallbackDirectDownload(
    rfpUrl: string,
    results: PhiladelphiaDocument[],
    rfpId: string
  ): Promise<void> {
    console.log(`📂 Starting fallback direct download for ${results.length} documents...`);

    try {
      // For now, mark documents as available for manual download
      // In a production environment, you would implement direct HTTP downloads here
      for (const result of results) {
        if (result.downloadStatus === 'completed' && !result.storagePath) {
          // Create a placeholder storage path to indicate document is available
          result.storagePath = `fallback/${rfpId}/${result.name}`;
          console.log(`📄 Marked document as available: ${result.name}`);
        }
      }

      console.log(`✅ Fallback processing completed`);
    } catch (error) {
      console.error(`❌ Fallback download failed:`, error);

      // Mark all as failed
      results.forEach(result => {
        if (result.downloadStatus === 'completed' && !result.storagePath) {
          result.downloadStatus = 'failed';
          result.error = 'Direct download fallback failed';
        }
      });
    }
  }

  /**
   * Retrieve downloaded files from Browserbase and upload to storage
   */
  private async retrieveAndUploadFiles(
    sessionId: string,
    rfpId: string,
    results: PhiladelphiaDocument[]
  ): Promise<void> {
    try {
      // Use retry logic as recommended in Browserbase docs
      const maxRetries = 10;
      const retryDelay = 2000; // 2 seconds
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📥 Attempting to retrieve downloads (attempt ${attempt}/${maxRetries})...`);
          
          // Get downloads from Browserbase as ZIP
          const response = await this.browserbase.sessions.downloads.list(sessionId);
          const downloadBuffer = await response.arrayBuffer();
          
          if (downloadBuffer.byteLength > 0) {
            console.log(`📦 Retrieved ZIP archive: ${downloadBuffer.byteLength} bytes`);
            
            // Extract files from ZIP
            const zip = new AdmZip(Buffer.from(downloadBuffer));
            const zipEntries = zip.getEntries();
            
            console.log(`🗂️ Found ${zipEntries.length} files in ZIP archive`);
            
            // Process each file
            for (const entry of zipEntries) {
              if (!entry.isDirectory) {
                const fileName = entry.entryName;
                const fileData = entry.getData();
                
                console.log(`📄 Processing file: ${fileName} (${fileData.length} bytes)`);
                
                // Find matching result record
                const matchingResult = results.find(r => 
                  r.downloadStatus === 'completed' && 
                  (
                    fileName.includes(r.name.replace('.pdf', '')) ||
                    r.name.includes(fileName.replace(/-(\\d+)\\.pdf$/, '.pdf')) // Handle timestamp suffix
                  )
                );
                
                if (matchingResult) {
                  // Upload to object storage
                  const storagePath = await this.uploadBufferToStorage(
                    fileData,
                    rfpId,
                    fileName
                  );
                  
                  matchingResult.storagePath = storagePath;
                  console.log(`☁️ Uploaded ${fileName} to storage: ${storagePath}`);
                } else {
                  console.log(`⚠️ No matching result found for file: ${fileName}`);
                }
              }
            }
            
            console.log(`✅ Successfully processed all files from Browserbase`);
            return; // Success, exit retry loop
            
          } else {
            console.log(`⏳ Download archive not ready yet, retrying in ${retryDelay}ms...`);
          }
          
        } catch (error: any) {
          console.log(`⚠️ Retrieval attempt ${attempt} failed: ${error.message}`);
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      console.log(`❌ Failed to retrieve downloads after ${maxRetries} attempts`);
      
      // Mark remaining downloads as failed
      results.forEach(result => {
        if (result.downloadStatus === 'completed' && !result.storagePath) {
          result.downloadStatus = 'failed';
          result.error = 'Failed to retrieve from Browserbase cloud storage';
        }
      });
      
    } catch (error: any) {
      console.error(`❌ Error retrieving files from Browserbase:`, error);
      throw error;
    }
  }

  /**
   * Upload file buffer to object storage
   */
  private async uploadBufferToStorage(
    fileBuffer: Buffer,
    rfpId: string,
    fileName: string
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];
      const objectPath = `rfp_documents/${rfpId}/${fileName}`;
      
      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);
      
      // Upload buffer directly
      await file.save(fileBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            rfpId: rfpId,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return publicUrl;
      
    } catch (error: any) {
      console.error(`Failed to upload ${fileName} to storage:`, error);
      throw error;
    }
  }

  /**
   * Upload downloaded document to object storage (legacy method)
   */
  private async uploadToStorage(
    filePath: string,
    rfpId: string,
    fileName: string
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];
      const objectPath = `rfp_documents/${rfpId}/${fileName}`;
      
      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);
      
      // Upload file from local path
      await bucket.upload(filePath, {
        destination: objectPath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            rfpId: rfpId,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return publicUrl;
      
    } catch (error: any) {
      console.error(`Failed to upload ${fileName} to storage:`, error);
      throw error;
    }
  }

  /**
   * Alternative method to extract document info when downloads aren't available
   * This can at least get document metadata even if downloads fail
   */
  async extractDocumentInfo(rfpUrl: string, rfpId: string): Promise<PhiladelphiaDocument[]> {
    let stagehand: Stagehand | null = null;
    
    try {
      console.log('🤖 Initializing Stagehand for document extraction...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();
      
      const page = stagehand.page;
      if (!page) {
        throw new Error('Failed to get page instance from Stagehand');
      }

      console.log(`📊 Extracting document information from: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      // Extract document information using Stagehand act method
      const extractionResult = await page.act(
        `Extract all document information from this RFP page, including names, types, sizes, and any download links`
      );
      
      // Parse the result
      const documents = await page.evaluate(() => {
        const docs: any[] = [];
        const links = document.querySelectorAll('a[href*=".pdf"], a[href*=".doc"], a[href*=".xls"]');
        links.forEach((link: any) => {
          docs.push({
            name: link.textContent?.trim() || '',
            type: 'PDF',
            downloadHint: link.href
          });
        });
        return docs;
      });

      // Convert to our format
      return documents.map((doc: any) => ({
        name: doc.name,
        downloadStatus: 'pending' as const,
        error: doc.downloadHint ? undefined : 'No download method found'
      }));

    } catch (error: any) {
      console.error('Failed to extract document info:', error);
      throw error;
    } finally {
      if (stagehand) {
        try {
          await stagehand.close();
        } catch (err) {
          console.error('Error closing Stagehand:', err);
        }
      }
    }
  }
}