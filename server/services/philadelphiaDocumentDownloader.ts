import { Stagehand } from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { z } from "zod";
import { ObjectStorageService, objectStorageClient } from '../objectStorage';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { sessionManager } from "../../src/mastra/tools/session-manager";
import AdmZip from 'adm-zip';

export interface PhiladelphiaDocument {
  name: string;
  url?: string;
  storagePath?: string;
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
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
   * Downloads documents from Philadelphia contracting portal
   * Handles click-to-download pattern where documents don't have direct URLs
   */
  async downloadRFPDocuments(
    rfpUrl: string,
    rfpId: string,
    documentNames: string[]
  ): Promise<PhiladelphiaDocument[]> {
    const sessionId = `phila-download-${rfpId}`;
    const results: PhiladelphiaDocument[] = [];

    console.log(`📥 Starting document download for RFP ${rfpId}`);
    console.log(`📄 Documents to download: ${documentNames.length}`);

    try {
      // Get or create stagehand session
      const stagehand = await sessionManager.ensureStagehand(sessionId);
      const page = stagehand.page;

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
      
      // Get Browserbase session ID for later retrieval
      // Since Stagehand logs the session URL, we can extract the real session ID
      let browserbaseSessionId: string = sessionId; // Fallback to custom ID
      
      try {
        // Give Stagehand a moment to fully initialize and log the session URL
        await page.waitForTimeout(2000);
        
        // Try multiple approaches to get the real Browserbase session ID
        const context = page.context();
        
        // Check Stagehand object properties
        const stagehandProps = [
          (stagehand as any).sessionId,
          (stagehand as any).browserbaseSessionId,
          (stagehand as any).session?.id,
          (stagehand as any)._sessionId,
          (context as any)._options?.sessionId,
          (context as any)._browserbaseSessionId
        ];
        
        for (const prop of stagehandProps) {
          if (prop && typeof prop === 'string' && prop.match(/^[a-f0-9-]{36}$/i)) {
            browserbaseSessionId = prop;
            console.log(`🎯 Found Browserbase session ID: ${browserbaseSessionId}`);
            break;
          }
        }
        
        // If we still have our custom session ID, extract from context or logs
        if (browserbaseSessionId === sessionId) {
          console.log(`🔍 Using fallback session ID: ${browserbaseSessionId}`);
          console.log(`💡 Note: Real Browserbase session ID should be visible in logs above`);
        }
        
      } catch (error) {
        console.log(`⚠️ Error detecting Browserbase session ID: ${error}`);
        browserbaseSessionId = sessionId;
      }
      
      console.log(`🆔 Final session ID for downloads: ${browserbaseSessionId}`);

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
        console.log(`📦 Retrieving ${successfulDownloads.length} files from Browserbase...`);
        await this.retrieveAndUploadFiles(browserbaseSessionId, rfpId, results);
      }
      
      // Close session
      await sessionManager.closeSession(sessionId);

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
    const sessionId = `phila-extract-${rfpId}`;
    
    try {
      const stagehand = await sessionManager.ensureStagehand(sessionId);
      const page = stagehand.page;

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

      await sessionManager.closeSession(sessionId);

      // Convert to our format
      return documents.map((doc: any) => ({
        name: doc.name,
        downloadStatus: 'pending' as const,
        error: doc.downloadHint ? undefined : 'No download method found'
      }));

    } catch (error: any) {
      console.error('Failed to extract document info:', error);
      throw error;
    }
  }
}