import { createStep, createWorkflow } from '@mastra/core/workflows';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { assembleProposalPDF, PDFSection } from '../utils/pdf-processor';
import { storage } from '../../../server/storage';
import { logger } from '../../../server/utils/logger';
import { ObjectStorageService } from '../../../server/objectStorage';

// Step 1: Gather proposal content from database
const gatherProposalContentStep = createStep({
  id: 'gather-proposal-content',
  description: 'Gather all proposal content sections from database',
  inputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
    rfpTitle: z.string(),
    companyName: z.string(),
    sections: z.array(
      z.object({
        heading: z.string(),
        content: z.string(),
        order: z.number(),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, proposalId } = inputData;

    logger.info(`Gathering proposal content for RFP ${rfpId}, Proposal ${proposalId}`);

    try {
      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get proposal sections
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      // Parse proposal content from JSON field
      const proposalContent = typeof proposal.content === 'string'
        ? JSON.parse(proposal.content)
        : (proposal.content || {});

      // Build sections array from proposal content
      const sections = [];

      // Executive Summary
      if (proposalContent.executiveSummary) {
        sections.push({
          heading: 'Executive Summary',
          content: proposalContent.executiveSummary,
          order: 1,
        });
      }

      // Technical Approach
      if (proposalContent.technicalApproach) {
        sections.push({
          heading: 'Technical Approach',
          content: proposalContent.technicalApproach,
          order: 2,
        });
      }

      // Project Timeline
      if (proposalContent.timeline) {
        sections.push({
          heading: 'Project Timeline',
          content: proposalContent.timeline,
          order: 3,
        });
      }

      // Budget
      if (proposalContent.budget) {
        sections.push({
          heading: 'Budget and Pricing',
          content: proposalContent.budget,
          order: 4,
        });
      }

      // Team Qualifications (check both possible keys)
      if (proposalContent.teamQualifications || proposalContent.projectTeam) {
        sections.push({
          heading: 'Team Qualifications',
          content: proposalContent.teamQualifications || proposalContent.projectTeam,
          order: 5,
        });
      }

      // Risk Management
      if (proposalContent.riskManagement) {
        sections.push({
          heading: 'Risk Management',
          content: proposalContent.riskManagement,
          order: 6,
        });
      }

      // Sort sections by order
      sections.sort((a, b) => a.order - b.order);

      logger.info(`Gathered ${sections.length} proposal sections`);

      return {
        rfpId,
        proposalId,
        rfpTitle: rfp.title,
        companyName: 'Your Company Name', // TODO: Get from configuration
        sections,
      };
    } catch (error) {
      logger.error('Failed to gather proposal content:', error as Error);
      throw error;
    }
  },
});

// Step 2: Assemble PDF document
const assemblePDFStep = createStep({
  id: 'assemble-pdf',
  description: 'Assemble proposal content into PDF document',
  inputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
    rfpTitle: z.string(),
    companyName: z.string(),
    sections: z.array(
      z.object({
        heading: z.string(),
        content: z.string(),
        order: z.number(),
      })
    ),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
    pdfPath: z.string(),
    pageCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, proposalId, rfpTitle, companyName, sections } = inputData;

    logger.info(`Assembling PDF for proposal ${proposalId}`);

    try {
      // Create temp directory for PDF
      const tempDir = path.join(process.cwd(), 'temp', 'proposals');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `proposal_${proposalId}_${Date.now()}.pdf`;
      const pdfPath = path.join(tempDir, fileName);

      // Convert sections to PDF sections format
      const pdfSections: PDFSection[] = sections.map((section, index) => ({
        heading: section.heading,
        content: section.content,
        fontSize: 14,
        includePageBreak: index > 0, // Page break before each section except first
      }));

      // Assemble PDF
      const result = await assembleProposalPDF(pdfPath, {
        title: `Proposal for ${rfpTitle}`,
        author: companyName,
        subject: `RFP Response for ${rfpTitle}`,
        keywords: ['proposal', 'rfp', rfpTitle],
        sections: pdfSections,
      });

      logger.info(`Successfully assembled PDF at ${pdfPath}`, {
        pages: result.pages,
      });

      return {
        rfpId,
        proposalId,
        pdfPath,
        pageCount: result.pages,
      };
    } catch (error) {
      logger.error('Failed to assemble PDF:', error as Error);
      throw error;
    }
  },
});

// Step 3: Upload PDF to storage
const uploadPDFToStorageStep = createStep({
  id: 'upload-pdf-to-storage',
  description: 'Upload assembled PDF to object storage',
  inputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
    pdfPath: z.string(),
    pageCount: z.number(),
  }),
  outputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
    storageUrl: z.string(),
    pageCount: z.number(),
    fileSize: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, proposalId, pdfPath, pageCount } = inputData;

    logger.info(`Uploading PDF to storage for proposal ${proposalId}`);

    try {
      const objectStorage = new ObjectStorageService();
      const fileName = path.basename(pdfPath);
      const objectPath = `proposals/${rfpId}/${fileName}`;

      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      const fileSize = pdfBuffer.length;

      // Upload to storage
      const privateDir = objectStorage.getPrivateObjectDir();
      const fullPath = `${privateDir}/${objectPath}`;

      // Ensure directory exists
      const directory = path.dirname(fullPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Copy file to storage
      fs.writeFileSync(fullPath, pdfBuffer);

      // Clean up temp file
      fs.unlinkSync(pdfPath);

      logger.info(`Successfully uploaded PDF to ${fullPath}`, {
        fileSize,
        pageCount,
      });

      return {
        rfpId,
        proposalId,
        storageUrl: fullPath,
        pageCount,
        fileSize,
      };
    } catch (error) {
      logger.error('Failed to upload PDF to storage:', error as Error);
      throw error;
    }
  },
});

// Step 4: Update proposal with PDF information
const updateProposalStep = createStep({
  id: 'update-proposal',
  description: 'Update proposal record with PDF information',
  inputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
    storageUrl: z.string(),
    pageCount: z.number(),
    fileSize: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    proposalId: z.string(),
    pdfUrl: z.string(),
    pageCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { rfpId, proposalId, storageUrl, pageCount, fileSize } = inputData;

    logger.info(`Updating proposal ${proposalId} with PDF information`);

    try {
      // Get existing proposal to merge metadata
      const existingProposal = await storage.getProposal(proposalId);
      const existingMetadata = existingProposal?.proposalData
        ? (typeof existingProposal.proposalData === 'string'
          ? JSON.parse(existingProposal.proposalData)
          : existingProposal.proposalData)
        : {};

      // Update proposal with PDF path in metadata
      await storage.updateProposal(proposalId, {
        proposalData: JSON.stringify({
          ...existingMetadata,
          pdfPath: storageUrl,
          pdfGenerated: true,
          pdfGeneratedAt: new Date().toISOString(),
          pdfPageCount: pageCount,
          pdfFileSize: fileSize,
        }) as any,
        status: 'generated' as any,
        generatedAt: new Date(),
      });

      // Create notification
      await storage.createNotification({
        type: 'system',
        title: 'Proposal PDF Generated',
        message: `PDF proposal has been generated with ${pageCount} pages (${(fileSize / 1024).toFixed(2)} KB)`,
        relatedEntityType: 'proposal',
        relatedEntityId: proposalId,
      });

      logger.info(`Successfully updated proposal ${proposalId}`);

      return {
        success: true,
        message: `Proposal PDF generated successfully with ${pageCount} pages`,
        proposalId,
        pdfUrl: storageUrl,
        pageCount,
      };
    } catch (error) {
      logger.error('Failed to update proposal:', error as Error);
      return {
        success: false,
        message: `Failed to update proposal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        proposalId,
        pdfUrl: '',
        pageCount: 0,
      };
    }
  },
});

// Create the proposal PDF assembly workflow
export const proposalPDFAssemblyWorkflow = createWorkflow({
  id: 'proposal-pdf-assembly',
  description: 'Assemble proposal content into a polished PDF document',
  inputSchema: z.object({
    rfpId: z.string(),
    proposalId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    proposalId: z.string(),
    pdfUrl: z.string(),
    pageCount: z.number(),
  }),
})
  .then(gatherProposalContentStep)
  .then(assemblePDFStep)
  .then(uploadPDFToStorageStep)
  .then(updateProposalStep)
  .commit();
