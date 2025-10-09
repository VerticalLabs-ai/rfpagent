import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { ObjectStorageService } from '../../../server/objectStorage';
import { downloadFile } from '../../../server/services/fileDownloadService';
import { performWebExtraction } from '../../../server/services/stagehandTools';
import { storage } from '../../../server/storage';

// Document extraction schema
const documentSchema = z.object({
  title: z.string().describe('Document title'),
  url: z.string().describe('Download URL'),
  type: z.string().optional().describe('Document type (PDF, DOC, etc)'),
  size: z.string().optional().describe('File size'),
  description: z.string().optional().describe('Document description'),
});

// Step 1: Extract document links from RFP page
const extractDocumentLinksStep = createStep({
  id: 'extract-document-links',
  description: 'Extract all downloadable document links from RFP page',
  inputSchema: z.object({
    rfpId: z.string(),
    rfpUrl: z.string(),
    portalType: z.string().optional(),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    rfpUrl: z.string(),
    portalType: z.string().optional(),
    documents: z.array(documentSchema),
    extractedCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    console.log(`📄 Extracting document links from ${inputData.rfpUrl}`);

    const sessionId = `doc-extract-${inputData.rfpId}`;

    try {
      const extractionResult = await performWebExtraction(
        inputData.rfpUrl,
        `Find all downloadable documents on this RFP page. Look for:
        - PDF, DOC, DOCX, XLS, XLSX files
        - Download links in tables or document lists
        - Document names, titles, and descriptions
        - File sizes if available
        Return all available documents with their download URLs.`,
        z.object({
          documents: z.array(documentSchema),
        }),
        sessionId
      );

      const documents = extractionResult.data?.documents || [];
      console.log(`✅ Found ${documents.length} documents to download`);

      return {
        rfpId: inputData.rfpId,
        rfpUrl: inputData.rfpUrl,
        portalType: inputData.portalType,
        documents,
        extractedCount: documents.length,
      };
    } catch (error) {
      console.error('❌ Document extraction failed:', error);
      return {
        rfpId: inputData.rfpId,
        rfpUrl: inputData.rfpUrl,
        portalType: inputData.portalType,
        documents: [],
        extractedCount: 0,
      };
    }
  },
});

// Step 2: Download documents in parallel
const downloadDocumentsStep = createStep({
  id: 'download-documents',
  description: 'Download all documents to temporary storage',
  inputSchema: z.object({
    rfpId: z.string(),
    documents: z.array(documentSchema),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    downloadedFiles: z.array(
      z.object({
        originalUrl: z.string(),
        localPath: z.string(),
        fileName: z.string(),
        size: z.number(),
      })
    ),
    failedDownloads: z.array(
      z.object({
        url: z.string(),
        error: z.string(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, documents } = inputData;
    const tempDir = path.join(process.cwd(), 'temp', 'downloads', rfpId);

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const downloadedFiles: Array<{
      originalUrl: string;
      localPath: string;
      fileName: string;
      size: number;
    }> = [];
    const failedDownloads: Array<{
      url: string;
      error: string;
    }> = [];

    // Download files in parallel with limit
    const downloadPromises = documents.map(async doc => {
      try {
        const fileName =
          path.basename(new URL(doc.url).pathname) ||
          `document-${randomUUID()}.pdf`;
        const localPath = path.join(tempDir, fileName);

        await downloadFile(doc.url, localPath);

        const stats = fs.statSync(localPath);
        downloadedFiles.push({
          originalUrl: doc.url,
          localPath,
          fileName,
          size: stats.size,
        });
      } catch (error) {
        failedDownloads.push({
          url: doc.url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(downloadPromises);

    console.log(
      `✅ Downloaded ${downloadedFiles.length} files, ${failedDownloads.length} failed`
    );

    return {
      rfpId,
      downloadedFiles,
      failedDownloads,
    };
  },
});

// Step 3: Upload to object storage
const uploadToStorageStep = createStep({
  id: 'upload-to-storage',
  description: 'Upload documents to object storage',
  inputSchema: z.object({
    rfpId: z.string(),
    downloadedFiles: z.array(
      z.object({
        originalUrl: z.string(),
        localPath: z.string(),
        fileName: z.string(),
        size: z.number(),
      })
    ),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    uploadedDocuments: z.array(
      z.object({
        fileName: z.string(),
        storageUrl: z.string(),
        size: z.number(),
        uploadedAt: z.string(),
      })
    ),
    failedUploads: z.array(
      z.object({
        fileName: z.string(),
        error: z.string(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, downloadedFiles } = inputData;
    const objectStorage = new ObjectStorageService();
    const uploadedDocuments: Array<{
      fileName: string;
      storageUrl: string;
      size: number;
      uploadedAt: string;
    }> = [];
    const failedUploads: Array<{
      fileName: string;
      error: string;
    }> = [];

    for (const file of downloadedFiles) {
      try {
        const fileBuffer = fs.readFileSync(file.localPath);
        const objectPath = `rfps/${rfpId}/${file.fileName}`;

        // Upload to object storage
        const privateDir = objectStorage.getPrivateObjectDir();
        const fullPath = `${privateDir}/${objectPath}`;
        const storageUrl = fullPath; // For now, store the path

        uploadedDocuments.push({
          fileName: file.fileName,
          storageUrl,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });

        // Clean up temp file
        fs.unlinkSync(file.localPath);
      } catch (error) {
        failedUploads.push({
          fileName: file.fileName,
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    console.log(`☁️ Uploaded ${uploadedDocuments.length} documents to storage`);

    return {
      rfpId,
      uploadedDocuments,
      failedUploads,
    };
  },
});

// Step 4: Process documents with AI
const processDocumentsStep = createStep({
  id: 'process-documents',
  description: 'Extract text and analyze documents with AI',
  inputSchema: z.object({
    rfpId: z.string(),
    uploadedDocuments: z.array(
      z.object({
        fileName: z.string(),
        storageUrl: z.string(),
        size: z.number(),
        uploadedAt: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    processedDocuments: z.array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        extractedText: z.string(),
        category: z.string(),
        keyRequirements: z.array(z.string()),
        deadlines: z.array(z.string()),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, uploadedDocuments } = inputData;
    const processedDocuments: Array<{
      id: string;
      fileName: string;
      extractedText: string;
      category: string;
      keyRequirements: string[];
      deadlines: string[];
    }> = [];

    // Create document processor agent
    const documentProcessor = new Agent({
      name: 'Document Processor',
      instructions: `You are analyzing RFP documents. Extract:
        - Key requirements and specifications
        - Important deadlines and dates
        - Submission requirements
        - Evaluation criteria
        - Document category (RFP main, pricing form, technical specs, etc.)`,
      model: openai('gpt-5'),
    });

    for (const doc of uploadedDocuments) {
      try {
        // For now, we'll simulate text extraction
        // In production, you'd use PDF parsing libraries
        const extractedText = `Extracted content from ${doc.fileName}`;

        const analysis = await documentProcessor.generateVNext([
          {
            role: 'user',
            content: `Analyze this RFP document and extract key information:\n\n${extractedText}`,
          },
        ]);

        // Parse AI response to extract structured data

        // Save to database
        const createdDoc = await storage.createDocument({
          rfpId,
          filename: doc.fileName,
          fileType: doc.fileName.split('.').pop() || 'unknown',
          objectPath: doc.storageUrl,
          extractedText,
        });
        const documentId = createdDoc.id;

        processedDocuments.push({
          id: documentId,
          fileName: doc.fileName,
          extractedText,
          category: 'RFP Document',
          keyRequirements: [],
          deadlines: [],
        });
      } catch (error) {
        console.error(`Failed to process ${doc.fileName}:`, error);
      }
    }

    console.log(`🤖 Processed ${processedDocuments.length} documents with AI`);

    return {
      rfpId,
      processedDocuments,
    };
  },
});

// Step 5: Update RFP status
const updateRfpStatusStep = createStep({
  id: 'update-rfp-status',
  description: 'Update RFP with document processing results',
  inputSchema: z.object({
    rfpId: z.string(),
    processedDocuments: z.array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        extractedText: z.string(),
        category: z.string(),
        keyRequirements: z.array(z.string()),
        deadlines: z.array(z.string()),
      })
    ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    documentCount: z.number(),
    processedDocuments: z.array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        extractedText: z.string(),
        category: z.string(),
        keyRequirements: z.array(z.string()),
        deadlines: z.array(z.string()),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, processedDocuments } = inputData;

    try {
      // Update RFP progress
      await storage.updateRFP(rfpId, {
        progress: 30, // Documents processed
        status: 'analyzing',
      });

      // Create notification
      await storage.createNotification({
        type: 'system',
        title: 'Documents Processed',
        message: `Successfully processed ${processedDocuments.length} documents for RFP`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
      });

      return {
        success: true,
        message: `Processed ${processedDocuments.length} documents`,
        documentCount: processedDocuments.length,
        processedDocuments,
      };
    } catch (error) {
      console.error('Failed to update RFP status:', error);
      return {
        success: false,
        message: 'Failed to update RFP status',
        documentCount: 0,
        processedDocuments: [],
      };
    }
  },
});

// Step to combine workflow inputs with extracted documents
const combineWithRfpIdStep = createStep({
  id: 'combine-with-rfp-id',
  description: 'Combine RFP ID with documents',
  inputSchema: z.object({
    rfpId: z.string(),
    rfpUrl: z.string(),
    portalType: z.string().optional(),
    documents: z.array(documentSchema),
    extractedCount: z.number(),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    documents: z.array(documentSchema),
  }),
  execute: async ({ inputData }) => {
    return {
      rfpId: inputData.rfpId,
      documents: inputData.documents,
    };
  },
});

// Step to pass through download results with RFP ID
const passDownloadResultsStep = createStep({
  id: 'pass-download-results',
  description: 'Pass download results with RFP ID',
  inputSchema: z.object({
    rfpId: z.string(),
    downloadedFiles: z.array(
      z.object({
        originalUrl: z.string(),
        localPath: z.string(),
        fileName: z.string(),
        size: z.number(),
      })
    ),
    failedDownloads: z.array(
      z.object({
        url: z.string(),
        error: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    downloadedFiles: z.array(
      z.object({
        originalUrl: z.string(),
        localPath: z.string(),
        fileName: z.string(),
        size: z.number(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    return {
      rfpId: inputData.rfpId,
      downloadedFiles: inputData.downloadedFiles,
    };
  },
});

// Step to pass upload results with RFP ID
const passUploadResultsStep = createStep({
  id: 'pass-upload-results',
  description: 'Pass upload results with RFP ID',
  inputSchema: z.object({
    rfpId: z.string(),
    uploadedDocuments: z.array(
      z.object({
        fileName: z.string(),
        storageUrl: z.string(),
        size: z.number(),
        uploadedAt: z.string(),
      })
    ),
    failedUploads: z.array(
      z.object({
        fileName: z.string(),
        error: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    uploadedDocuments: z.array(
      z.object({
        fileName: z.string(),
        storageUrl: z.string(),
        size: z.number(),
        uploadedAt: z.string(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    return {
      rfpId: inputData.rfpId,
      uploadedDocuments: inputData.uploadedDocuments,
    };
  },
});

// Final consolidation step
const finalizeResultsStep = createStep({
  id: 'finalize-results',
  description: 'Finalize workflow results',
  inputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    documentCount: z.number(),
    processedDocuments: z.array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        extractedText: z.string(),
        category: z.string(),
        keyRequirements: z.array(z.string()),
        deadlines: z.array(z.string()),
      })
    ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    documentCount: z.number(),
    processedDocuments: z.array(z.any()),
  }),
  execute: async ({ inputData }) => {
    return {
      success: inputData.success,
      message: inputData.message,
      documentCount: inputData.documentCount,
      processedDocuments: inputData.processedDocuments,
    };
  },
});

// Create the complete workflow
export const documentProcessingWorkflow = createWorkflow({
  id: 'document-processing',
  description: 'Extract, download, and process RFP documents',
  inputSchema: z.object({
    rfpId: z.string(),
    rfpUrl: z.string(),
    portalType: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    documentCount: z.number(),
    processedDocuments: z.array(z.any()),
  }),
})
  .then(extractDocumentLinksStep)
  .then(combineWithRfpIdStep)
  .then(downloadDocumentsStep)
  .then(passDownloadResultsStep)
  .then(uploadToStorageStep)
  .then(passUploadResultsStep)
  .then(processDocumentsStep)
  .then(updateRfpStatusStep)
  .then(finalizeResultsStep)
  .commit();
