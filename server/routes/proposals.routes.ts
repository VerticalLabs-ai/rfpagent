import express from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertProposalSchema } from '@shared/schema';
import { enhancedProposalService } from '../services/proposals/enhancedProposalService';
import { proposalGenerationOrchestrator } from '../services/orchestrators/proposalGenerationOrchestrator';
import { submissionMaterialsService } from '../services/processing/submissionMaterialsService';
import { progressTracker } from '../services/monitoring/progressTracker';
import { validateRequest } from './middleware/validation';
import { handleAsyncError } from './middleware/errorHandling';
import {
  aiOperationLimiter,
  heavyOperationLimiter,
} from './middleware/rateLimiting';
import { validateSchema } from './middleware/zodValidation';

const router = express.Router();

// Validation schemas
const enhancedProposalGenerationSchema = z.object({
  rfpId: z.string().uuid('RFP ID must be a valid UUID'),
  companyProfileId: z.string().uuid('Company Profile ID must be a valid UUID').optional(),
  sessionId: z.string().optional(),
  options: z.record(z.any()).default({}),
});

const pipelineProposalGenerationSchema = z.object({
  rfpIds: z.array(z.string().uuid()).min(1, 'At least one RFP ID is required'),
  companyProfileId: z.string().uuid('Company Profile ID must be a valid UUID'),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  parallelExecution: z.boolean().default(true),
  options: z.object({
    generatePricing: z.boolean().default(true),
    generateCompliance: z.boolean().default(true),
    proposalType: z.string().optional(),
    qualityThreshold: z.coerce.number().min(0).max(1).optional(),
    autoSubmit: z.boolean().default(false),
  }).default({}),
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
 * Enhanced proposal generation (moved before parameterized routes)
 * POST /api/proposals/enhanced/generate
 */
router.post(
  '/enhanced/generate',
  heavyOperationLimiter,
  validateSchema(enhancedProposalGenerationSchema),
  handleAsyncError(async (req, res) => {
    const { rfpId, companyProfileId, sessionId: providedSessionId, options } = req.body;

    const sessionId = providedSessionId || `enhanced_${rfpId}_${Date.now()}`;

    // Start enhanced proposal generation
    enhancedProposalService
      .generateEnhancedProposal({
        rfpId,
        companyProfileId,
        sessionId,
        options,
      })
      .catch(error => {
        console.error('Enhanced proposal generation failed:', error);
      });

    res.json({
      success: true,
      sessionId,
      message: 'Enhanced proposal generation started',
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
    const {
      rfpIds,
      companyProfileId,
      priority,
      parallelExecution,
      options,
    } = req.body;

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
