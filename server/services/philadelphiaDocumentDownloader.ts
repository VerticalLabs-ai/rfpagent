import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { ObjectStorageService, objectStorageClient } from '../objectStorage';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { sessionManager } from "../../src/mastra/tools/session-manager";

export interface PhiladelphiaDocument {
  name: string;
  url?: string;
  storagePath?: string;
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

export class PhiladelphiaDocumentDownloader {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
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
      
      // Wait for document table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Set download behavior to save files
      const client = await page.context().newCDPSession(page);
      const downloadPath = path.join(process.cwd(), 'temp_downloads', rfpId);
      
      // Create temp download directory
      await fs.mkdir(downloadPath, { recursive: true });
      
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
      });

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
            
            // Get suggested filename
            const suggestedFilename = download.suggestedFilename();
            const localPath = path.join(downloadPath, suggestedFilename);
            
            // Save the download
            await download.saveAs(localPath);
            
            console.log(`💾 Downloaded to: ${localPath}`);
            
            // Upload to object storage
            const storagePath = await this.uploadToStorage(localPath, rfpId, suggestedFilename);
            
            doc.storagePath = storagePath;
            doc.downloadStatus = 'completed';
            console.log(`☁️ Uploaded to storage: ${storagePath}`);
            
            // Clean up local file
            await fs.unlink(localPath).catch(() => {});
            
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
                
                const suggestedFilename = download.suggestedFilename() || docName;
                const localPath = path.join(downloadPath, suggestedFilename);
                await download.saveAs(localPath);
                
                const storagePath = await this.uploadToStorage(localPath, rfpId, suggestedFilename);
                doc.storagePath = storagePath;
                doc.downloadStatus = 'completed';
                
                await fs.unlink(localPath).catch(() => {});
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

      // Clean up temp directory
      await fs.rm(downloadPath, { recursive: true, force: true }).catch(() => {});
      
      // Close session
      await sessionManager.closeSession(sessionId);

      const successCount = results.filter(d => d.downloadStatus === 'completed').length;
      console.log(`✅ Downloaded ${successCount}/${documentNames.length} documents successfully`);

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
   * Upload downloaded document to object storage
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