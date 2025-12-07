import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { agentTrackingService } from '../services/agents/agentTrackingService';
import { ApiResponse } from '../utils/apiResponse';
import { handleAsyncError } from '../middleware/errorHandling';
import { rateLimiter } from '../middleware/rateLimiting';
import type { AgentQueueItem } from '@shared/api/agentTracking';

const router = Router();

// Validation schemas
const updatePrioritySchema = z.object({
  priority: z.number().int().min(1).max(10),
});

const rfpIdsSchema = z.object({
  rfpIds: z.array(z.string()),
});

// GET /api/agent-work/active - Get all active work sessions
router.get(
  '/agent-work/active',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const sessions = agentTrackingService.getAllActiveSessions();
    return ApiResponse.success(res, { sessions });
  })
);

// GET /api/rfps/:rfpId/agent-work - Get active and completed sessions for an RFP
router.get(
  '/rfps/:rfpId/agent-work',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const { rfpId } = req.params;
    const activeSessions = agentTrackingService.getActiveSessionsForRfp(rfpId);
    const completedSessions =
      agentTrackingService.getCompletedSessionsForRfp(rfpId);
    const summary = agentTrackingService.getRfpWorkSummary(rfpId);

    return ApiResponse.success(res, {
      activeSessions,
      completedSessions,
      summary,
    });
  })
);

// POST /api/agent-work/summaries - Get summaries for multiple RFPs
router.post(
  '/agent-work/summaries',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const { rfpIds } = rfpIdsSchema.parse(req.body);

    const summaries = rfpIds
      .map(rfpId => agentTrackingService.getRfpWorkSummary(rfpId))
      .filter(Boolean);

    return ApiResponse.success(res, { summaries });
  })
);

// GET /api/agent-queues - Get all agent queues
router.get(
  '/agent-queues',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const queues: Record<string, AgentQueueItem[]> = {};
    for (const [agentId, queue] of agentTrackingService.getAllQueues()) {
      queues[agentId] = queue;
    }
    return ApiResponse.success(res, { queues });
  })
);

// GET /api/agent-queues/:agentId - Get queue for specific agent
router.get(
  '/agent-queues/:agentId',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const queue = agentTrackingService.getAgentQueue(agentId);
    return ApiResponse.success(res, { queue });
  })
);

// PUT /api/agent-queues/:queueItemId/priority - Update queue priority
router.put(
  '/agent-queues/:queueItemId/priority',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const { queueItemId } = req.params;
    const { priority } = updatePrioritySchema.parse(req.body);

    agentTrackingService.updateQueuePriority(queueItemId, priority);
    return ApiResponse.success(res, { message: 'Priority updated' });
  })
);

// GET /api/agent-resources - Get resource allocation
router.get(
  '/agent-resources',
  rateLimiter,
  handleAsyncError(async (req: Request, res: Response) => {
    const allocations = agentTrackingService.getResourceAllocation();
    return ApiResponse.success(res, { allocations });
  })
);

// GET /api/agent-work/stream - SSE endpoint for real-time updates
router.get('/agent-work/stream', (req: Request, res: Response) => {
  try {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial state
    const initialData = {
      activeSessions: agentTrackingService.getAllActiveSessions(),
      allocations: agentTrackingService.getResourceAllocation(),
    };
    res.write(`data: ${JSON.stringify({ type: 'init', payload: initialData })}\n\n`);

    // Listen for updates from the tracking service
    const onMessage = (message: unknown) => {
      try {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch {
        // Client disconnected, will be cleaned up
      }
    };

    agentTrackingService.on('message', onMessage);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      if (!res.writable) {
        clearInterval(heartbeat);
        return;
      }
      res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on client disconnect
    req.on('close', () => {
      agentTrackingService.off('message', onMessage);
      clearInterval(heartbeat);
    });
  } catch (error) {
    console.error('SSE initialization error:', error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

export default router;
