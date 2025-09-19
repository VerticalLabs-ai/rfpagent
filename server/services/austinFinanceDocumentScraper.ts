import puppeteer from 'puppeteer';
import { storage as gcpStorage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import type { Document } from '@shared/schema';
import path from 'path';
import fs from 'fs/promises';

interface RFPDocument {
  name: string;
  downloadUrl: string;
  fileType: string;
  category: string; // e.g., 'submittal', 'rfp_package', 'price_form'
}

export class AustinFinanceDocumentScraper {
  private bucketId = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split('/')[1] || 'replit-objstore-8d82d13a-4740-4241-9aba-fbac33f94374';
  private privateDir = process.env.PRIVATE_OBJECT_DIR || '/replit-objstore-8d82d13a-4740-4241-9aba-fbac33f94374/.private';
  
  /**
   * Scrape and download all documents for a specific Austin Finance RFP
   */
  async scrapeRFPDocuments(rfpId: string, solicitationUrl: string): Promise<Document[]> {
    console.log(`📄 Starting document scraping for RFP ${rfpId} from ${solicitationUrl}`);
    
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to the RFP detail page
      console.log(`🌐 Navigating to RFP detail page: ${solicitationUrl}`);
      await page.goto(solicitationUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      // Wait for the attachments section to load
      await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
        console.log('⚠️ Table not found, continuing anyway');
      });
      
      // Extract all document information
      const documents = await this.extractDocumentInfo(page);
      console.log(`📋 Found ${documents.length} documents to download`);
      
      // Download each document and store in object storage
      const savedDocuments: Document[] = [];
      
      for (const doc of documents) {
        try {
          console.log(`⬇️ Downloading: ${doc.name}`);
          
          // Download the document
          const documentBuffer = await this.downloadDocument(page, doc.downloadUrl);
          
          if (documentBuffer) {
            // Save to object storage
            const objectPath = await this.saveToObjectStorage(rfpId, doc.name, documentBuffer);
            
            // Save document record to database
            const savedDoc = await storage.createDocument({
              rfpId: rfpId,
              filename: doc.name,
              fileType: doc.fileType,
              objectPath: objectPath,
              extractedText: null,
              parsedData: {
                category: doc.category,
                downloadUrl: doc.downloadUrl,
                downloadedAt: new Date().toISOString(),
                size: documentBuffer.length,
                needsFillOut: this.determineIfNeedsFillOut(doc.name, doc.category)
              }
            });
            
            savedDocuments.push(savedDoc);
            console.log(`✅ Successfully downloaded and saved: ${doc.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to download ${doc.name}:`, error);
        }
      }
      
      return savedDocuments;
      
    } catch (error) {
      console.error('❌ Error during document scraping:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
  /**
   * Extract document information from the RFP page
   */
  private async extractDocumentInfo(page: puppeteer.Page): Promise<RFPDocument[]> {
    return await page.evaluate(() => {
      // Helper function to categorize documents
      function categorizeDocument(name: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('price') || lowerName.includes('cost')) return 'price_form';
        if (lowerName.includes('submittal') || lowerName.includes('submission')) return 'submittal';
        if (lowerName.includes('insurance')) return 'insurance';
        if (lowerName.includes('reference')) return 'references';
        if (lowerName.includes('wage')) return 'wage_compliance';
        if (lowerName.includes('local') || lowerName.includes('business')) return 'local_business';
        if (lowerName.includes('rfp') || lowerName.includes('package')) return 'rfp_package';
        if (lowerName.includes('attachment')) return 'attachment';
        return 'other';
      }
      
      // Helper function to determine file type
      function getFileType(name: string, url: string): string {
        if (url.includes('.pdf') || name.toLowerCase().includes('.pdf')) return 'pdf';
        if (url.includes('.doc') || name.toLowerCase().includes('.doc')) return 'doc';
        if (url.includes('.xls') || name.toLowerCase().includes('.xls')) return 'xls';
        if (url.includes('.xlsx') || name.toLowerCase().includes('.xlsx')) return 'xlsx';
        if (url.includes('.docx') || name.toLowerCase().includes('.docx')) return 'docx';
        return 'unknown';
      }
      
      const documents: RFPDocument[] = [];
      
      // Find all download links - Austin Finance specific selectors
      const downloadLinks = Array.from(document.querySelectorAll('a[href*="download"], a[href*=".pdf"], a[href*=".doc"], a[href*=".xls"], a[href*=".xlsx"], a[href*=".docx"]'));
      
      // Process direct download links
      downloadLinks.forEach(link => {
        const anchor = link as HTMLAnchorElement;
        if (anchor.href) {
          // Try to get document name from link text or parent text
          let name = anchor.textContent?.trim() || '';
          if (!name || name.toLowerCase() === 'download') {
            // Look for text in parent elements
            const parent = anchor.closest('tr, li, div');
            if (parent) {
              name = parent.textContent?.replace(/download/gi, '').trim() || 'Unknown Document';
            }
          }
          
          documents.push({
            name: name,
            downloadUrl: anchor.href,
            fileType: getFileType(name, anchor.href),
            category: categorizeDocument(name)
          });
        }
      });
      
      // Also look for Austin Finance specific table structure
      const tableRows = Array.from(document.querySelectorAll('table tr'));
      
      tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          // Austin Finance typically has: Type | Description | Download button
          let documentName = '';
          let downloadUrl = '';
          
          // Check each cell for document info
          cells.forEach((cell, index) => {
            const cellText = cell.textContent?.trim() || '';
            
            // Look for document name (usually in first or second cell)
            if (index < 2 && cellText && !cellText.toLowerCase().includes('download')) {
              documentName = documentName || cellText;
            }
            
            // Look for download link
            const downloadLink = cell.querySelector('a[href*="download"], a[href*=".pdf"], a[href*=".doc"], a[href*=".xls"]') as HTMLAnchorElement;
            if (downloadLink && downloadLink.href) {
              downloadUrl = downloadLink.href;
            }
          });
          
          // If we found both name and download URL, add to documents
          if (documentName && downloadUrl) {
            // Check if not already added
            const exists = documents.some(doc => doc.downloadUrl === downloadUrl);
            if (!exists) {
              documents.push({
                name: documentName,
                downloadUrl: downloadUrl,
                fileType: getFileType(documentName, downloadUrl),
                category: categorizeDocument(documentName)
              });
            }
          }
        }
      });
      
      // Remove duplicates based on download URL
      const uniqueDocs = documents.filter((doc, index, self) => 
        index === self.findIndex(d => d.downloadUrl === doc.downloadUrl)
      );
      
      return uniqueDocs;
    });
  }
  
  /**
   * Download a document from the page
   */
  private async downloadDocument(page: puppeteer.Page, downloadUrl: string): Promise<Buffer | null> {
    try {
      // Create a new page for download to avoid navigation issues
      const downloadPage = await page.browser().newPage();
      
      // Set up download handling
      const client = await downloadPage.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: '/tmp'
      });
      
      // Navigate to download URL
      const response = await downloadPage.goto(downloadUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (response && response.ok()) {
        const buffer = await response.buffer();
        await downloadPage.close();
        return buffer;
      }
      
      await downloadPage.close();
      return null;
      
    } catch (error) {
      console.error(`Failed to download from ${downloadUrl}:`, error);
      return null;
    }
  }
  
  /**
   * Save document to object storage
   */
  private async saveToObjectStorage(rfpId: string, filename: string, buffer: Buffer): Promise<string> {
    // Clean filename for storage
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${cleanFilename}`;
    
    // Create path in private directory for RFP documents
    const objectPath = `${this.privateDir}/rfp_documents/${rfpId}/${uniqueFilename}`;
    
    // Save to local file system (Replit object storage)
    const localPath = path.join(process.cwd(), 'attached_assets', 'rfp_documents', rfpId, uniqueFilename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    
    // Write file
    await fs.writeFile(localPath, buffer);
    
    console.log(`💾 Saved document to: ${localPath}`);
    
    return objectPath;
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
      'worksheet'
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
      'package'
    ];
    
    // Check if it's likely a fillable document
    const isFillable = fillablePatterns.some(pattern => lowerName.includes(pattern));
    const isReadOnly = readOnlyPatterns.some(pattern => lowerName.includes(pattern));
    
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
      summary
    };
  }
}

// Export singleton instance
export const austinFinanceDocumentScraper = new AustinFinanceDocumentScraper();