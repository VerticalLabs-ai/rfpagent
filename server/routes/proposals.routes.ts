import express from 'express';
import { storage } from '../storage';
import { insertProposalSchema } from '@shared/schema';
import { aiProposalService } from '../services/ai-proposal-service';
import { enhancedProposalService } from '../services/enhancedProposalService';
import { proposalGenerationOrchestrator } from '../services/proposalGenerationOrchestrator';
import { submissionMaterialsService } from '../services/submissionMaterialsService';
import { progressTracker } from '../services/progressTracker';
import { validateRequest } from './middleware/validation';
import { handleAsyncError } from './middleware/errorHandling';
import {
  aiOperationLimiter,
  heavyOperationLimiter,
} from './middleware/rateLimiting';

const router = express.Router();

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
  handleAsyncError(async (req, res) => {
    const { rfpId, companyProfileId, options = {} } = req.body;

    if (!rfpId) {
      return res.status(400).json({
        error: 'RFP ID is required',
      });
    }

    const sessionId = `enhanced_${rfpId}_${Date.now()}`;

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
  handleAsyncError(async (req, res) => {
    const {
      rfpIds,
      companyProfileId,
      priority = 5,
      parallelExecution = true,
    } = req.body;

    if (!rfpIds || !Array.isArray(rfpIds) || rfpIds.length === 0) {
      return res.status(400).json({
        error: 'RFP IDs array is required',
      });
    }

    if (!companyProfileId) {
      return res.status(400).json({
        error: 'Company profile ID is required',
      });
    }

    const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start pipeline generation
    proposalGenerationOrchestrator
      .startPipeline({
        pipelineId,
        rfpIds,
        companyProfileId,
        priority,
        parallelExecution,
      })
      .catch(error => {
        console.error('Pipeline generation failed:', error);
      });

    res.json({
      success: true,
      pipelineId,
      rfpCount: rfpIds.length,
      message: 'Proposal pipeline started',
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

    // Start AI proposal generation
    const sessionId = `proposal_gen_${proposalId}_${Date.now()}`;

    aiProposalService
      .generateProposal({
        proposalId,
        companyProfileId,
        sessionId,
        options,
      })
      .catch(error => {
        console.error('Proposal generation failed:', error);
      });

    res.json({
      success: true,
      sessionId,
      message: 'Proposal generation started',
    });
  })
);

/**
 * Update proposal
 * PUT /api/proposals/:id
 */
router.put(
  '/:id',
  validateRequest(insertProposalSchema.partial()),
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

    const updatedProposal = await storage.updateProposal(proposalId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      approvalNotes: notes,
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

export default router;
