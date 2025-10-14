import mammoth from 'mammoth';
import { ObjectStorageService } from '../../objectStorage';
import { storage } from '../../storage';
import { AIService } from '../core/aiService';

export class DocumentParsingService {
  private objectStorageService = new ObjectStorageService();
  private aiService = new AIService();

  async parseDocument(documentId: string): Promise<void> {
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      console.log(`Starting to parse document: ${document.filename}`);

      // Get file from object storage
      const file = await this.objectStorageService.getObjectEntityFile(
        document.objectPath
      );
      const buffer = await this.downloadFileAsBuffer(file);

      let extractedText = '';

      // Parse based on file type
      switch (document.fileType.toLowerCase()) {
        case 'application/pdf':
        case 'pdf':
          extractedText = await this.parsePDF(buffer);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'docx':
          extractedText = await this.parseDocx(buffer);
          break;
        case 'text/plain':
        case 'txt':
          extractedText = buffer.toString('utf-8');
          break;
        default:
          console.warn(`Unsupported file type: ${document.fileType}`);
          return;
      }

      // Update document with extracted text
      await storage.updateDocument(documentId, {
        extractedText,
      });

      // Get RFP for context
      const rfp = await storage.getRFP(document.rfpId);
      if (!rfp) {
        throw new Error('RFP not found');
      }

      // Use AI to analyze compliance
      const compliance = await this.aiService.analyzeDocumentCompliance(
        extractedText,
        rfp
      );

      // Update RFP with compliance analysis
      await storage.updateRFP(document.rfpId, {
        requirements: compliance.requirements,
        complianceItems: compliance.mandatoryFields,
        riskFlags: compliance.riskFlags,
        status: 'parsing',
        progress: 40,
      });

      // Update document with parsed data
      await storage.updateDocument(documentId, {
        parsedData: compliance,
      });

      // Check for high-risk items and create notifications
      const highRiskFlags =
        compliance.riskFlags?.filter((flag: any) => flag.type === 'high') || [];

      for (const flag of highRiskFlags) {
        await storage.createNotification({
          type: 'compliance',
          title: 'High Risk Compliance Item',
          message: `${flag.category}: ${flag.description}`,
          relatedEntityType: 'rfp',
          relatedEntityId: document.rfpId,
        });
      }

      // Create audit log
      await storage.createAuditLog({
        entityType: 'document',
        entityId: documentId,
        action: 'parsed',
        details: {
          fileType: document.fileType,
          textLength: extractedText.length,
          riskFlags: highRiskFlags.length,
        },
      });

      console.log(`Successfully parsed document: ${document.filename}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error');

      console.error(`Error parsing document ${documentId}:`, error);

      // Create notification about parsing error
      const document = await storage.getDocument(documentId);
      if (document) {
        await storage.createNotification({
          type: 'compliance',
          title: 'Document Parsing Failed',
          message: `Failed to parse ${document.filename}: ${message}`,
          relatedEntityType: 'document',
          relatedEntityId: documentId,
        });
      }
    }
  }

  private async downloadFileAsBuffer(file: any): Promise<Buffer> {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const stream = file.createReadStream();

      const cleanup = () => {
        stream.removeAllListeners();
        stream.destroy();
      };

      stream.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > MAX_FILE_SIZE) {
          cleanup();
          reject(new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`));
          return;
        }

        chunks.push(chunk);
      });

      stream.on('end', () => {
        cleanup();
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (error: Error) => {
        cleanup();
        reject(error);
      });
    });
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const PDFParse = (await import('pdf-parse')).default;
      const data = await PDFParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF document');
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw new Error('Failed to parse DOCX document');
    }
  }

  async parseWebContent(url: string, rfpId: string): Promise<void> {
    try {
      // This would be used for parsing web-based RFP content
      // Implementation depends on specific portal structures

      console.log(`Parsing web content for RFP ${rfpId} from ${url}`);

      // Create audit log
      await storage.createAuditLog({
        entityType: 'rfp',
        entityId: rfpId,
        action: 'web_content_parsed',
        details: { sourceUrl: url },
      });
    } catch (error) {
      console.error('Error parsing web content:', error);
      throw error;
    }
  }
}
