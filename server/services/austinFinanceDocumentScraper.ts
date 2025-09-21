import { storage } from '../storage';
import type { Document } from '@shared/schema';
import path from 'path';
import fs from 'fs/promises';
import { portalManager } from '../../src/mastra/agents/portal-manager';
import { documentProcessor } from '../../src/mastra/agents/document-processor';
import { portalScanner } from '../../src/mastra/agents/portal-scanner';
import { sharedMemory } from '../../src/mastra/tools/shared-memory-provider';
import { nanoid } from 'nanoid';

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
   * Generate a unique session ID for agent coordination
   */
  private generateSessionId(rfpId: string): string {
    return `austin_finance_${rfpId}_${nanoid(8)}`;
  }
  
  /**
   * Scrape and download all documents for a specific Austin Finance RFP using Mastra agents
   */
  async scrapeRFPDocuments(rfpId: string, solicitationUrl: string): Promise<Document[]> {
    console.log(`📄 Starting agent-based document scraping for RFP ${rfpId} from ${solicitationUrl}`);
    
    // Generate session ID for agent coordination
    const sessionId = this.generateSessionId(rfpId);
    
    try {
      // Step 1: Store scraping context in shared memory
      await sharedMemory.store(sessionId, [{
        role: 'system',
        content: JSON.stringify({
          task: 'austin_finance_document_scraping',
          rfpId: rfpId,
          solicitationUrl: solicitationUrl,
          timestamp: new Date().toISOString(),
          phase: 'initialization'
        })
      }]);
      
      // Step 2: Use Portal Manager to navigate to Austin Finance RFP page
      console.log(`🤖 Portal Manager: Navigating to Austin Finance RFP page`);
      const navigationResult = await portalManager.run(`Navigate to Austin Finance RFP page at ${solicitationUrl} and authenticate if needed. Set up page for document extraction. Wait for page to load completely including any dynamic content or tables.`, {
        sessionId: sessionId
      });
      
      if (!navigationResult.success) {
        throw new Error(`Portal Manager navigation failed: ${navigationResult.error}`);
      }
      
      // Step 3: Use Portal Scanner to extract document information
      console.log(`🤖 Portal Scanner: Extracting document information`);
      const extractionResult = await portalScanner.run(`Extract all document information from the Austin Finance RFP page. Look for:
      - Document names and titles
      - Download URLs for PDF, DOC, XLS, XLSX files
      - Document categories (submittal forms, price forms, RFP packages, etc.)
      - File types
      Return structured data for each document found.`, {
        sessionId: sessionId
      });
      
      if (!extractionResult.success) {
        throw new Error(`Portal Scanner extraction failed: ${extractionResult.error}`);
      }
      
      // Parse extracted document information
      const extractedDocuments = this.parseExtractedDocuments(extractionResult.output);
      console.log(`📋 Found ${extractedDocuments.length} documents to download`);
      
      // Step 4: Download and process each document
      const savedDocuments: Document[] = [];
      
      for (const doc of extractedDocuments) {
        try {
          console.log(`⬇️ Processing document: ${doc.name}`);
          
          // Use Portal Scanner to download the document
          const downloadResult = await portalScanner.run(`Download the document from URL: ${doc.downloadUrl}. Return the document content as base64 encoded data.`, {
            sessionId: sessionId
          });
          
          if (downloadResult.success && downloadResult.output) {
            // Convert downloaded content to buffer
            const documentBuffer = this.processDownloadedContent(downloadResult.output);
            
            if (documentBuffer) {
              // Save to object storage
              const objectPath = await this.saveToObjectStorage(rfpId, doc.name, documentBuffer);
              
              // Use Document Processor to analyze the document
              const analysisResult = await documentProcessor.run(`Analyze document "${doc.name}" (category: ${doc.category}, type: ${doc.fileType}). Determine:
              - If this document needs to be filled out
              - Document category refinement
              - Any special handling requirements
              Return analysis as JSON.`, {
                sessionId: sessionId
              });
              
              const analysis = this.parseDocumentAnalysis(analysisResult.output, doc);
              
              // Save document record to database
              const savedDoc = await storage.createDocument({
                rfpId: rfpId,
                filename: doc.name,
                fileType: doc.fileType,
                objectPath: objectPath,
                extractedText: null,
                parsedData: {
                  category: analysis.category,
                  downloadUrl: doc.downloadUrl,
                  downloadedAt: new Date().toISOString(),
                  size: documentBuffer.length,
                  needsFillOut: analysis.needsFillOut,
                  agentAnalysis: analysis.analysis,
                  sessionId: sessionId
                }
              });
              
              savedDocuments.push(savedDoc);
              console.log(`✅ Successfully processed and saved: ${doc.name}`);
            }
          } else {
            console.error(`❌ Failed to download ${doc.name}: ${downloadResult.error}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${doc.name}:`, error);
        }
      }
      
      // Step 5: Store final results in shared memory
      await sharedMemory.store(sessionId, [{
        role: 'system',
        content: JSON.stringify({
          task: 'austin_finance_document_scraping',
          phase: 'completed',
          documentsProcessed: savedDocuments.length,
          results: savedDocuments.map(d => ({
            filename: d.filename,
            category: (d.parsedData as any)?.category,
            needsFillOut: (d.parsedData as any)?.needsFillOut
          }))
        })
      }]);
      
      return savedDocuments;
      
    } catch (error) {
      console.error('❌ Error during agent-based document scraping:', error);
      
      // Store error in shared memory for debugging
      await sharedMemory.store(sessionId, [{
        role: 'system',
        content: JSON.stringify({
          task: 'austin_finance_document_scraping',
          phase: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }]);
      
      throw error;
    }
  }
  
  /**
   * Parse extracted document information from agent output
   */
  private parseExtractedDocuments(agentOutput: string): RFPDocument[] {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(agentOutput);
      if (Array.isArray(parsed)) {
        return parsed.map(doc => ({
          name: doc.name || 'Unknown Document',
          downloadUrl: doc.downloadUrl || doc.url || '',
          fileType: this.determineFileType(doc.name || '', doc.downloadUrl || ''),
          category: this.categorizeDocument(doc.name || '')
        }));
      }
    } catch (e) {
      // If JSON parsing fails, try to extract from text
      console.log('📋 Parsing agent output as text...');
    }
    
    // Fallback: parse as text with patterns
    const documents: RFPDocument[] = [];
    const lines = agentOutput.split('\n');
    
    for (const line of lines) {
      // Look for URL patterns
      const urlMatch = line.match(/(https?:\/\/[^\s]+\.(?:pdf|doc|docx|xls|xlsx))/i);
      if (urlMatch) {
        const url = urlMatch[1];
        const name = line.replace(url, '').trim() || this.extractFilenameFromUrl(url);
        
        documents.push({
          name: name,
          downloadUrl: url,
          fileType: this.determineFileType(name, url),
          category: this.categorizeDocument(name)
        });
      }
    }
    
    return documents;
  }
  
  /**
   * Process downloaded content from agent output
   */
  private processDownloadedContent(agentOutput: string): Buffer | null {
    try {
      // Try to parse as JSON with base64 content
      const parsed = JSON.parse(agentOutput);
      if (parsed.content && parsed.encoding === 'base64') {
        return Buffer.from(parsed.content, 'base64');
      }
      if (parsed.data) {
        return Buffer.from(parsed.data, 'base64');
      }
    } catch (e) {
      // Try direct base64 decode
      try {
        return Buffer.from(agentOutput, 'base64');
      } catch (e2) {
        console.error('Failed to process downloaded content:', e2);
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Parse document analysis from agent output
   */
  private parseDocumentAnalysis(agentOutput: string, originalDoc: RFPDocument): {
    category: string;
    needsFillOut: boolean;
    analysis: any;
  } {
    try {
      const parsed = JSON.parse(agentOutput);
      return {
        category: parsed.category || originalDoc.category,
        needsFillOut: parsed.needsFillOut ?? this.determineIfNeedsFillOut(originalDoc.name, originalDoc.category),
        analysis: parsed
      };
    } catch (e) {
      // Fallback to text analysis
      const needsFillOut = agentOutput.toLowerCase().includes('needs to be filled') || 
                          agentOutput.toLowerCase().includes('fillable') ||
                          this.determineIfNeedsFillOut(originalDoc.name, originalDoc.category);
      
      return {
        category: originalDoc.category,
        needsFillOut: needsFillOut,
        analysis: { textAnalysis: agentOutput, source: 'text_fallback' }
      };
    }
  }
  
  /**
   * Helper: Extract filename from URL
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'document';
      return decodeURIComponent(filename);
    } catch (e) {
      return 'document';
    }
  }
  
  /**
   * Helper: Determine file type from name and URL
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
   * Helper: Categorize document by name
   */
  private categorizeDocument(name: string): string {
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