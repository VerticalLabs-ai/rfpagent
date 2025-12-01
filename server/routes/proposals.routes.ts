import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertProposalSchema } from '@shared/schema';
import { enhancedProposalService } from '../services/proposals/enhancedProposalService';
import { proposalGenerationOrchestrator } from '../services/orchestrators/proposalGenerationOrchestrator';
import { submissionMaterialsService } from '../services/processing/submissionMaterialsService';
import { progressTracker } from '../services/monitoring/progressTracker';
import {
  claudeProposalService,
  type ProposalQualityLevel,
} from '../services/proposals/claude-proposal-service';
import { validateRequest } from '../middleware/validation';
import { handleAsyncError } from '../middleware/errorHandling';
import {
  aiOperationLimiter,
  heavyOperationLimiter,
} from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/zodValidation';

const router = express.Router();

// Validation schemas

// Quality level options for Claude-based generation
const proposalQualityLevelSchema = z.enum([
  'fast',
  'standard',
  'enhanced',
  'premium',
  'maximum',
]);

const enhancedProposalGenerationSchema = z.object({
  rfpId: z.string().uuid('RFP ID must be a valid UUID'),
  companyProfileId: z
    .string()
    .uuid('Company Profile ID must be a valid UUID')
    .optional(),
  sessionId: z.string().optional(),
  options: z
    .object({
      qualityLevel: proposalQualityLevelSchema.optional(),
      enableThinking: z.boolean().optional(),
      customBudgetTokens: z.number().min(1000).max(32000).optional(),
      generatePricing: z.boolean().optional(),
      generateCompliance: z.boolean().optional(),
    })
    .optional(),
});

// Schema for direct Claude proposal generation
const claudeProposalGenerationSchema = z.object({
  rfpId: z.string().uuid('RFP ID must be a valid UUID'),
  companyProfileId: z
    .string()
    .uuid('Company Profile ID must be a valid UUID')
    .optional(),
  qualityLevel: proposalQualityLevelSchema.default('standard'),
  enableThinking: z.boolean().default(true),
  customBudgetTokens: z.number().min(1000).max(32000).optional(),
  sections: z.array(z.string()).optional(),
});

const pipelineProposalGenerationSchema = z.object({
  rfpIds: z.array(z.string().uuid()).min(1, 'At least one RFP ID is required'),
  companyProfileId: z.string().uuid('Company Profile ID must be a valid UUID'),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  parallelExecution: z.boolean().default(true),
  options: z
    .object({
      generatePricing: z.boolean().default(true),
      generateCompliance: z.boolean().default(true),
      proposalType: z.string().optional(),
      qualityThreshold: z.coerce.number().min(0).max(1).optional(),
      autoSubmit: z.boolean().default(false),
    })
    .optional()
    .default({
      generatePricing: true,
      generateCompliance: true,
      autoSubmit: false,
    }),
});

/**
 * Proposal Management Routes
 */

/**
 * Get proposals for specific RFP
 * GET /api/proposals/rfp/:rfpId
 */
router.get(
  '/rfp/:rfpId',
  handleAsyncError(async (req, res) => {
    const proposal = await storage.getProposalByRFP(req.params.rfpId);
    // Return as array to match the expected format
    const proposals = proposal ? [proposal] : [];
    res.json(proposals);
  })
);

/**
 * Delete a specific proposal
 * DELETE /api/proposals/:id
 */
router.delete(
  '/:id',
  handleAsyncError(async (req, res) => {
    const proposalId = req.params.id;

    // Check if proposal exists
    const proposal = await storage.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Delete the proposal
    await storage.deleteProposal(proposalId);

    res.json({ success: true, message: 'Proposal deleted successfully' });
  })
);

/**
 * Get available quality levels for Claude proposal generation
 * GET /api/proposals/claude/quality-levels
 */
router.get(
  '/claude/quality-levels',
  handleAsyncError(async (req, res) => {
    const qualityLevels = claudeProposalService.getQualityLevels();
    res.json({
      success: true,
      qualityLevels,
      description:
        'Quality levels for Claude-based proposal generation with extended thinking',
    });
  })
);

/**
 * Generate proposal using Claude with extended thinking
 * POST /api/proposals/claude/generate
 *
 * This endpoint uses Claude Sonnet 4.5 or Opus 4.5 with extended thinking
 * for more comprehensive and thoughtful proposal generation.
 */
router.post(
  '/claude/generate',
  heavyOperationLimiter,
  validateSchema(claudeProposalGenerationSchema),
  handleAsyncError(async (req, res) => {
    const {
      rfpId,
      companyProfileId,
      qualityLevel,
      enableThinking,
      customBudgetTokens,
      sections,
    } = req.body;

    // Get RFP details
    const rfp = await storage.getRFP(rfpId);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Get company profile if provided, otherwise use default
    let companyMapping;
    if (companyProfileId) {
      const companyProfile = await storage.getCompanyProfile(companyProfileId);
      if (!companyProfile) {
        return res.status(404).json({ error: 'Company profile not found' });
      }

      // Get related company data
      const [certifications, insurances, contacts, identifiers, addresses] =
        await Promise.all([
          storage.getCompanyCertifications(companyProfileId),
          storage.getCompanyInsurance(companyProfileId),
          storage.getCompanyContacts(companyProfileId),
          storage.getCompanyIdentifiers(companyProfileId),
          storage.getCompanyAddresses(companyProfileId),
        ]);

      // Import ai-proposal-service to use the mapping function
      const { aiProposalService } = await import(
        '../services/proposals/ai-proposal-service'
      );

      // First analyze the RFP
      const rfpText =
        (rfp.description || '') +
        '\n\n' +
        (rfp.analysis ? JSON.stringify(rfp.analysis) : '');
      const analysis = await aiProposalService.analyzeRFPDocument(
        rfpText.slice(0, 50000)
      );

      // Map company data
      companyMapping = await aiProposalService.mapCompanyDataToRequirements(
        analysis,
        companyProfile,
        certifications,
        insurances,
        contacts,
        identifiers,
        addresses.map(addr => ({
          type: addr.addressType,
          line1: addr.addressLine1,
          line2: addr.addressLine2 || undefined,
          city: addr.city,
          state: addr.state,
          zipCode: addr.zipCode,
        }))
      );

      // Generate proposal with Claude
      const proposalContent =
        await claudeProposalService.generateProposalContent(
          analysis,
          companyMapping,
          rfpText,
          {
            qualityLevel,
            enableThinking,
            customBudgetTokens,
            sections,
          }
        );

      // Save or update proposal
      const existingProposal = await storage.getProposalByRFP(rfpId);

      const proposalData = {
        rfpId,
        content: proposalContent,
        status: 'review' as const,
        proposalData: {
          ...proposalContent,
          generatedWith: 'claude',
          qualityLevel,
          thinkingEnabled: enableThinking,
        },
      };

      let savedProposal;
      if (existingProposal) {
        savedProposal = await storage.updateProposal(
          existingProposal.id,
          proposalData
        );
      } else {
        savedProposal = await storage.createProposal(proposalData);
      }

      // Create notification
      await storage.createNotification({
        type: 'success',
        title: 'Proposal Generated with Claude',
        message: `Proposal generated using Claude ${qualityLevel === 'premium' || qualityLevel === 'maximum' ? 'Opus 4.5' : 'Sonnet 4.5'} with ${enableThinking ? 'extended thinking' : 'standard mode'}`,
        relatedEntityType: 'proposal',
        relatedEntityId: savedProposal?.id,
        isRead: false,
      });

      res.json({
        success: true,
        proposal: savedProposal,
        metadata: proposalContent.metadata,
        message: `Proposal generated successfully with Claude ${proposalContent.metadata.model}`,
      });
    } else {
      // Use default company mapping
      const { createDefaultCompanyMapping } = await import(
        '../config/defaultCompanyMapping'
      );
      const defaultMapping = createDefaultCompanyMapping();

      // Import ai-proposal-service to analyze RFP
      const { aiProposalService } = await import(
        '../services/proposals/ai-proposal-service'
      );

      const rfpText =
        (rfp.description || '') +
        '\n\n' +
        (rfp.analysis ? JSON.stringify(rfp.analysis) : '');
      const analysis = await aiProposalService.analyzeRFPDocument(
        rfpText.slice(0, 50000)
      );

      // Generate proposal with Claude
      const proposalContent =
        await claudeProposalService.generateProposalContent(
          analysis,
          defaultMapping,
          rfpText,
          {
            qualityLevel,
            enableThinking,
            customBudgetTokens,
            sections,
          }
        );

      // Save or update proposal
      const existingProposal = await storage.getProposalByRFP(rfpId);

      const proposalData = {
        rfpId,
        content: proposalContent,
        status: 'review' as const,
        proposalData: {
          ...proposalContent,
          generatedWith: 'claude',
          qualityLevel,
          thinkingEnabled: enableThinking,
        },
      };

      let savedProposal;
      if (existingProposal) {
        savedProposal = await storage.updateProposal(
          existingProposal.id,
          proposalData
        );
      } else {
        savedProposal = await storage.createProposal(proposalData);
      }

      // Create notification
      await storage.createNotification({
        type: 'success',
        title: 'Proposal Generated with Claude',
        message: `Proposal generated using Claude ${qualityLevel === 'premium' || qualityLevel === 'maximum' ? 'Opus 4.5' : 'Sonnet 4.5'} with ${enableThinking ? 'extended thinking' : 'standard mode'}`,
        relatedEntityType: 'proposal',
        relatedEntityId: savedProposal?.id,
        isRead: false,
      });

      res.json({
        success: true,
        proposal: savedProposal,
        metadata: proposalContent.metadata,
        message: `Proposal generated successfully with Claude ${proposalContent.metadata.model}`,
      });
    }
  })
);

/**
 * Enhanced proposal generation (moved before parameterized routes)
 * POST /api/proposals/enhanced/generate
 */
router.post(
  '/enhanced/generate',
  heavyOperationLimiter,
  validateSchema(enhancedProposalGenerationSchema),
  handleAsyncError(async (req, res) => {
    const {
      rfpId,
      companyProfileId,
      sessionId: providedSessionId,
      options,
    } = req.body;

    const sessionId = providedSessionId || `enhanced_${rfpId}_${Date.now()}`;

    // Start enhanced proposal generation with quality level options
    enhancedProposalService
      .generateEnhancedProposal({
        rfpId,
        companyProfileId,
        sessionId,
        options: {
          ...options,
          qualityLevel: options?.qualityLevel || 'standard',
          enableThinking: options?.enableThinking ?? true,
        },
      })
      .catch(error => {
        console.error('Enhanced proposal generation failed:', error);
      });

    res.json({
      success: true,
      sessionId,
      message: 'Enhanced proposal generation started',
      qualityLevel: options?.qualityLevel || 'standard',
      thinkingEnabled: options?.enableThinking ?? true,
    });
  })
);

/**
 * Pipeline proposal generation (moved before parameterized routes)
 * POST /api/proposals/pipeline/generate
 */
router.post(
  '/pipeline/generate',
  heavyOperationLimiter,
  validateSchema(pipelineProposalGenerationSchema),
  handleAsyncError(async (req, res) => {
    const { rfpIds, companyProfileId, priority, parallelExecution, options } =
      req.body;

    const pipelineResults = await Promise.all(
      rfpIds.map((rfpId: string) =>
        proposalGenerationOrchestrator.createProposalGenerationPipeline({
          rfpId,
          companyProfileId,
          generatePricing: options?.generatePricing ?? true,
          generateCompliance: options?.generateCompliance ?? true,
          proposalType: options?.proposalType,
          qualityThreshold: options?.qualityThreshold,
          autoSubmit: options?.autoSubmit ?? false,
        })
      )
    );

    const successfulPipelines = pipelineResults.filter(
      result => result.success
    );

    res.json({
      success: successfulPipelines.length === pipelineResults.length,
      pipelines: pipelineResults,
      rfpCount: rfpIds.length,
      parallelExecution,
      message: `Started ${successfulPipelines.length} of ${pipelineResults.length} proposal pipelines`,
    });
  })
);

/**
 * Generate proposal using AI
 * POST /api/proposals/:id/generate
 */
router.post(
  '/:id/generate',
  aiOperationLimiter,
  handleAsyncError(async (req, res) => {
    const proposalId = req.params.id;
    const { companyProfileId, options = {} } = req.body;

    const proposal = await storage.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const pipelineResult =
      await proposalGenerationOrchestrator.createProposalGenerationPipeline({
        rfpId: proposal.rfpId,
        companyProfileId,
        proposalType: options?.proposalType,
        qualityThreshold: options?.qualityThreshold,
        autoSubmit: options?.autoSubmit ?? false,
        generatePricing: options?.generatePricing ?? true,
        generateCompliance: options?.generateCompliance ?? true,
      });

    if (!pipelineResult.success) {
      return res.status(500).json({
        success: false,
        error: pipelineResult.error ?? 'Failed to start proposal pipeline',
      });
    }

    res.json({
      success: true,
      pipelineId: pipelineResult.pipelineId,
      message: 'Proposal generation pipeline started',
      metadata: pipelineResult,
    });
  })
);

/**
 * Update proposal
 * PUT /api/proposals/:id
 */
router.put(
  '/:id',
  validateRequest(insertProposalSchema.partial() as any),
  handleAsyncError(async (req, res) => {
    const updatedProposal = await storage.updateProposal(
      req.params.id,
      req.body
    );

    if (!updatedProposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(updatedProposal);
  })
);

/**
 * Approve proposal for submission
 * POST /api/proposals/:id/approve
 */
router.post(
  '/:id/approve',
  handleAsyncError(async (req, res) => {
    const proposalId = req.params.id;
    const { approvedBy, notes } = req.body;

    const proposal = await storage.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const approvalMetadata = {
      ...(proposal.proposalData ?? {}),
      approval: {
        approvedBy: approvedBy ?? 'unknown',
        notes: notes ?? null,
        approvedAt: new Date().toISOString(),
      },
    };

    const updatedProposal = await storage.updateProposal(proposalId, {
      status: 'approved',
      proposalData: approvalMetadata,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      proposal: updatedProposal,
      message: 'Proposal approved successfully',
    });
  })
);

/**
 * Get enhanced proposal status
 * GET /api/proposals/enhanced/status/:rfpId
 */
router.get(
  '/enhanced/status/:rfpId',
  handleAsyncError(async (req, res) => {
    const progress = await enhancedProposalService.getGenerationStatus(
      req.params.rfpId
    );

    if (!progress) {
      return res.status(404).json({
        error: 'No generation process found for this RFP',
      });
    }

    res.json(progress);
  })
);

/**
 * Get pipeline status
 * GET /api/proposals/pipeline/status/:pipelineId
 */
router.get(
  '/pipeline/status/:pipelineId',
  handleAsyncError(async (req, res) => {
    const status = await proposalGenerationOrchestrator.getPipelineStatus(
      req.params.pipelineId
    );

    if (!status) {
      return res.status(404).json({
        error: 'Pipeline not found',
      });
    }

    res.json(status);
  })
);

/**
 * Delete pipeline
 * DELETE /api/proposals/pipeline/:pipelineId
 */
router.delete(
  '/pipeline/:pipelineId',
  handleAsyncError(async (req, res) => {
    const success = await proposalGenerationOrchestrator.cancelPipeline(
      req.params.pipelineId
    );

    if (!success) {
      return res.status(404).json({
        error: 'Pipeline not found or cannot be cancelled',
      });
    }

    res.json({
      success: true,
      message: 'Pipeline cancelled successfully',
    });
  })
);

/**
 * Get pipeline workflows
 * GET /api/proposals/pipeline/workflows
 */
router.get(
  '/pipeline/workflows',
  handleAsyncError(async (req, res) => {
    const workflows = await proposalGenerationOrchestrator.getActiveWorkflows();
    res.json(workflows);
  })
);

/**
 * Generate submission materials
 * POST /api/proposals/:id/submission-materials
 * Note: :id can be either proposalId or rfpId - we try both
 */
router.post(
  '/:id/submission-materials',
  heavyOperationLimiter,
  handleAsyncError(async (req, res) => {
    const id = req.params.id;
    const {
      materialTypes = ['cover_letter', 'technical_proposal', 'cost_proposal'],
      options = {},
    } = req.body;

    // Try to get proposal by ID first, then by RFP ID
    let proposal = await storage.getProposal(id);
    if (!proposal) {
      proposal = await storage.getProposalByRFP(id);
    }

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const sessionId = `materials_${proposal.id}_${Date.now()}`;

    // Start submission materials generation in background
    submissionMaterialsService
      .generateSubmissionMaterials({
        rfpId: proposal.rfpId,
        sessionId, // Pass the sessionId to ensure consistency
        ...options,
      })
      .catch(error => {
        console.error('Submission materials generation failed:', error);
      });

    // Return immediate response with sessionId for tracking
    res.json({
      success: true,
      data: {
        sessionId,
        proposalId: proposal.id,
        materialTypes,
      },
      message: 'Submission materials generation started',
    });
  })
);

/**
 * Get submission materials progress (JSON response)
 * GET /api/proposals/submission-materials/progress/:sessionId
 */
router.get('/submission-materials/progress/:sessionId', (req, res) => {
  const progress = progressTracker.getProgress(req.params.sessionId);

  if (!progress) {
    return res.status(404).json({
      error: 'Session not found',
    });
  }

  res.json(progress);
});

/**
 * Stream submission materials progress (SSE)
 * GET /api/proposals/submission-materials/stream/:sessionId
 */
router.get('/submission-materials/stream/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(
      `📡 SSE connection established for submission materials session: ${sessionId}`
    );

    // Register SSE client for the session
    progressTracker.registerSSEClient(sessionId, res);

    // Handle client disconnect
    req.on('close', () => {
      console.log(
        `📡 SSE connection closed for submission materials session: ${sessionId}`
      );
    });
  } catch (error) {
    console.error(
      'Error setting up SSE connection for submission materials:',
      error
    );
    res.status(500).json({ error: 'Failed to establish progress stream' });
  }
});

/**
 * Record proposal outcome (win/loss/rejected)
 * POST /api/proposals/:id/outcome
 *
 * This enables SAFLA learning system to track win rates and improve strategies
 */
router.post(
  '/:id/outcome',
  handleAsyncError(async (req, res) => {
    const proposalId = req.params.id;
    const { status, details } = req.body;

    // Validate status
    const validStatuses = ['awarded', 'lost', 'rejected', 'withdrawn'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const proposal = await storage.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Import outcome tracker dynamically
    const { ProposalOutcomeTracker } = await import(
      '../services/monitoring/proposalOutcomeTracker'
    );
    const tracker = ProposalOutcomeTracker.getInstance();

    // Record outcome for SAFLA learning
    await tracker.recordProposalOutcome({
      proposalId,
      rfpId: proposal.rfpId,
      status,
      outcomeDetails: details || {},
      learningData: {
        strategiesUsed: (proposal as any).strategies || {},
        marketConditions: {},
        competitiveFactors: details?.competitorInfo || {},
        internalFactors: {},
      },
      timestamp: new Date(),
    });

    // Update proposal status in database
    await storage.updateProposal(proposalId, {
      status: status === 'awarded' ? 'awarded' : 'rejected',
      updatedAt: new Date(),
    });

    // Create notification
    await storage.createNotification({
      type: status === 'awarded' ? 'success' : 'info',
      title: `Proposal ${status === 'awarded' ? 'Won' : 'Outcome Recorded'}`,
      message: `Outcome recorded for proposal. Status: ${status}`,
      relatedEntityType: 'proposal',
      relatedEntityId: proposalId,
      isRead: false,
    });

    res.json({
      success: true,
      message: `Proposal outcome recorded: ${status}`,
      proposalId,
      status,
    });
  })
);

export default router;
