/**
 * Stall Detection Routes
 *
 * API endpoints for monitoring and managing stalled RFP proposal generations.
 * Provides manual intervention capabilities and monitoring status.
 */

import { Router } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { handleAsyncError } from '../middleware/errorHandling';
import { stallDetectionService } from '../services/monitoring/stallDetectionService';

const router = Router();

/**
 * Get list of currently stalled RFPs
 * GET /api/stall-detection/stalled
 */
router.get(
  '/stalled',
  handleAsyncError(async (req, res) => {
    const stalledRFPs = await stallDetectionService.detectStalledRFPs();

    return ApiResponse.success(res, stalledRFPs, {
      message:
        stalledRFPs.length > 0
          ? `Found ${stalledRFPs.length} stalled RFP(s)`
          : 'No stalled RFPs detected',
    });
  })
);

/**
 * Manually trigger stall check
 * POST /api/stall-detection/run-check
 */
router.post(
  '/run-check',
  handleAsyncError(async (req, res) => {
    const results = await stallDetectionService.runStallCheck();

    return ApiResponse.success(res, results, {
      message:
        results.length > 0
          ? `Processed ${results.length} stalled RFP(s)`
          : 'No stalled RFPs found',
    });
  })
);

/**
 * Restart proposal generation for an RFP
 * POST /api/stall-detection/rfp/:rfpId/restart
 */
router.post(
  '/rfp/:rfpId/restart',
  handleAsyncError(async (req, res) => {
    const { rfpId } = req.params;

    const result = await stallDetectionService.restartGeneration(rfpId);

    if (result.error) {
      return ApiResponse.error(
        res,
        {
          code: 'RESTART_FAILED',
          message: result.error,
        },
        400
      );
    }

    return ApiResponse.success(res, result, {
      message: 'Proposal generation restarted successfully',
    });
  })
);

/**
 * Cancel stalled proposal generation
 * POST /api/stall-detection/rfp/:rfpId/cancel
 */
router.post(
  '/rfp/:rfpId/cancel',
  handleAsyncError(async (req, res) => {
    const { rfpId } = req.params;
    const { reason } = req.body;

    const result = await stallDetectionService.cancelStalledGeneration(
      rfpId,
      reason
    );

    if (result.error) {
      return ApiResponse.error(
        res,
        {
          code: 'CANCEL_FAILED',
          message: result.error,
        },
        400
      );
    }

    return ApiResponse.success(res, result, {
      message: 'Proposal generation cancelled successfully',
    });
  })
);

/**
 * Get stall detection monitoring status
 * GET /api/stall-detection/status
 */
router.get(
  '/status',
  handleAsyncError(async (req, res) => {
    const isMonitoring = stallDetectionService.isMonitoring();
    const checkIntervalMs = stallDetectionService.getCheckIntervalMs();

    return ApiResponse.success(
      res,
      {
        isMonitoring,
        checkIntervalMs,
        checkIntervalMinutes: checkIntervalMs / 1000 / 60,
      },
      {
        message: isMonitoring
          ? 'Stall detection monitoring is active'
          : 'Stall detection monitoring is stopped',
      }
    );
  })
);

/**
 * Start stall detection monitoring
 * POST /api/stall-detection/monitoring/start
 */
router.post(
  '/monitoring/start',
  handleAsyncError(async (req, res) => {
    stallDetectionService.startMonitoring();

    return ApiResponse.success(
      res,
      {
        isMonitoring: true,
        checkIntervalMs: stallDetectionService.getCheckIntervalMs(),
      },
      {
        message: 'Stall detection monitoring started',
      }
    );
  })
);

/**
 * Stop stall detection monitoring
 * POST /api/stall-detection/monitoring/stop
 */
router.post(
  '/monitoring/stop',
  handleAsyncError(async (req, res) => {
    stallDetectionService.stopMonitoring();

    return ApiResponse.success(
      res,
      {
        isMonitoring: false,
      },
      {
        message: 'Stall detection monitoring stopped',
      }
    );
  })
);

export default router;
