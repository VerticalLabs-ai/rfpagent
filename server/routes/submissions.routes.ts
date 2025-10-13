import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { submissionService } from '../services/core/submissionService';

const router = Router();

// Submission Pipeline Validation Schemas
const SubmissionPipelineStartRequestSchema = z.object({
  submissionId: z.string().uuid('Submission ID must be a valid UUID'),
  sessionId: z.string().optional(),
  portalCredentials: z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
      mfaMethod: z.string().optional(),
    })
    .optional(),
  priority: z.number().int().min(1).max(10).optional(),
  deadline: z
    .string()
    .refine(
      str => {
        const date = new Date(str);
        return !isNaN(date.getTime());
      },
      {
        message: 'Invalid deadline date format',
      }
    )
    .transform(str => new Date(str))
    .optional(),
  retryOptions: z
    .object({
      maxRetries: z.number().int().min(1).max(10).optional(),
      retryDelay: z.number().int().min(1000).max(300000).optional(),
    })
    .optional(),
  browserOptions: z
    .object({
      headless: z.boolean().optional(),
      timeout: z.number().int().min(30000).max(600000).optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

const SubmissionPipelineStatusParamsSchema = z.object({
  pipelineId: z.string().uuid('Pipeline ID must be a valid UUID'),
});

const SubmissionPipelineWorkflowsQuerySchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled'])
    .optional(),
  submissionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const SubmissionRetryRequestSchema = z.object({
  submissionId: z.string().uuid('Submission ID must be a valid UUID'),
  sessionId: z.string().optional(),
  retryOptions: z
    .object({
      maxRetries: z.number().int().min(1).max(10).optional(),
      retryDelay: z.number().int().min(1000).max(300000).optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Start automated submission pipeline for a proposal
 */
router.post('/pipeline/start', async (req, res) => {
  try {
    // Validate request body with Zod
    const validationResult = SubmissionPipelineStartRequestSchema.safeParse(
      req.body
    );

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', '),
      });
    }

    const {
      submissionId,
      sessionId,
      portalCredentials,
      priority = 5,
      deadline,
      retryOptions,
      browserOptions,
      metadata,
    } = validationResult.data;

    // Verify submission exists
    const submission = await storage.getSubmission(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    console.log(
      `🚀 Starting automated submission pipeline for submission: ${submissionId}`
    );

    // Start submission pipeline through the submission service
    const result = await submissionService.submitProposal(submissionId, {
      sessionId,
      portalCredentials,
      priority,
      deadline,
      retryOptions,
      browserOptions,
      metadata,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to start submission pipeline',
      });
    }

    res.json({
      success: true,
      data: {
        submissionId: result.submissionId,
        pipelineId: result.pipelineId,
        message: 'Submission pipeline started successfully',
      },
    });
  } catch (error) {
    console.error('❌ Submission pipeline start error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to start submission pipeline',
    });
  }
});

/**
 * Get submission pipeline status
 */
router.get('/pipeline/status/:pipelineId', async (req, res) => {
  try {
    // Validate path parameters with Zod
    const validationResult = SubmissionPipelineStatusParamsSchema.safeParse(
      req.params
    );

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pipeline ID',
        details: validationResult.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', '),
      });
    }

    const { pipelineId } = validationResult.data;

    // Import submission orchestrator to get status
    const { submissionOrchestrator } = await import(
      '../services/orchestrators/submissionOrchestrator'
    );
    const status = await submissionOrchestrator.getPipelineStatus(pipelineId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found',
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('❌ Submission pipeline status error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get pipeline status',
    });
  }
});

/**
 * Get submission status by submission ID
 */
router.get('/:submissionId/status', async (req, res) => {
  try {
    const { submissionId } = req.params;

    // Validate submission ID
    if (!submissionId) {
      return res.status(400).json({
        success: false,
        error: 'Submission ID is required',
      });
    }

    const status = await submissionService.getSubmissionStatus(submissionId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('❌ Get submission status error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get submission status',
    });
  }
});

/**
 * Cancel submission pipeline
 */
router.delete('/pipeline/:pipelineId', async (req, res) => {
  try {
    // Validate path parameters with Zod
    const validationResult = SubmissionPipelineStatusParamsSchema.safeParse(
      req.params
    );

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pipeline ID',
        details: validationResult.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', '),
      });
    }

    const { pipelineId } = validationResult.data;

    // Import submission orchestrator to cancel pipeline
    const { submissionOrchestrator } = await import(
      '../services/orchestrators/submissionOrchestrator'
    );
    const cancelResult =
      await submissionOrchestrator.cancelPipeline(pipelineId);

    if (!cancelResult) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel pipeline',
      });
    }

    res.json({
      success: true,
      data: {
        pipelineId,
        cancelled: true,
        message: 'Pipeline cancelled successfully',
      },
    });
  } catch (error) {
    console.error('❌ Submission pipeline cancellation error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to cancel pipeline',
    });
  }
});

/**
 * Cancel submission by submission ID
 */
router.delete('/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;

    // Validate submission ID
    if (!submissionId) {
      return res.status(400).json({
        success: false,
        error: 'Submission ID is required',
      });
    }

    const cancelResult = await submissionService.cancelSubmission(submissionId);

    if (!cancelResult) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel submission',
      });
    }

    res.json({
      success: true,
      data: {
        submissionId,
        cancelled: true,
        message: 'Submission cancelled successfully',
      },
    });
  } catch (error) {
    console.error('❌ Cancel submission error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to cancel submission',
    });
  }
});

/**
 * Retry failed submission
 */
router.post('/retry', async (req, res) => {
  try {
    // Validate request body with Zod
    const validationResult = SubmissionRetryRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', '),
      });
    }

    const { submissionId, sessionId, retryOptions, metadata } =
      validationResult.data;

    console.log(
      `🔄 Retrying submission pipeline for submission: ${submissionId}`
    );

    const result = await submissionService.retrySubmission(submissionId, {
      sessionId,
      retryOptions,
      metadata,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to retry submission',
      });
    }

    res.json({
      success: true,
      data: {
        submissionId: result.submissionId,
        pipelineId: result.pipelineId,
        message: 'Submission retry initiated successfully',
      },
    });
  } catch (error) {
    console.error('❌ Submission retry error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to retry submission',
    });
  }
});

/**
 * Get all active submission workflows
 */
router.get('/pipeline/workflows', async (req, res) => {
  try {
    // Validate query parameters with Zod
    const validationResult = SubmissionPipelineWorkflowsQuerySchema.safeParse(
      req.query
    );

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validationResult.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', '),
      });
    }

    const {
      status,
      submissionId,
      limit = 50,
      offset = 0,
    } = validationResult.data;

    // Get active submissions from submission service
    const activeSubmissions = submissionService.getActiveSubmissions();

    // Filter by status if provided
    let filteredSubmissions = activeSubmissions;
    if (status) {
      filteredSubmissions = activeSubmissions.filter(s => s.status === status);
    }

    // Filter by submission ID if provided
    if (submissionId) {
      filteredSubmissions = filteredSubmissions.filter(
        s => s.submissionId === submissionId
      );
    }

    // Apply pagination
    const paginatedSubmissions = filteredSubmissions.slice(
      offset,
      offset + limit
    );

    res.json({
      success: true,
      data: {
        workflows: paginatedSubmissions,
        total: filteredSubmissions.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('❌ Get submission workflows error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get submission workflows',
    });
  }
});

/**
 * Get submission metrics and analytics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { timeframe = 'week' } = req.query;

    const metrics = await submissionService.getSubmissionMetrics(
      timeframe as 'day' | 'week' | 'month'
    );

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('❌ Get submission metrics error:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get submission metrics',
    });
  }
});

/**
 * Submit proposal
 */
router.post('/:proposalId/submit', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await storage.getProposal(proposalId);

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const rfp = await storage.getRFP(proposal.rfpId);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Create submission record
    const submission = await storage.createSubmission({
      rfpId: rfp.id,
      proposalId,
      portalId: rfp.portalId || '', // Handle null portalId
      status: 'pending',
    });

    // Start submission process asynchronously
    submissionService.submitProposal(submission.id).catch(console.error);

    res.status(201).json(submission);
  } catch (error) {
    console.error('Error starting submission:', error);
    res.status(500).json({ error: 'Failed to start submission' });
  }
});

export default router;
