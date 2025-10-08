import { Router } from 'express';
import { healthCheckService } from '../services/healthCheckService';
import { circuitBreakerManager } from '../utils/circuitBreaker';
import { ApiResponse } from '../utils/apiResponse';
import { handleAsyncError } from './middleware/errorHandling';

const router = Router();

/**
 * Quick health check endpoint
 * GET /api/health
 */
router.get(
  '/',
  handleAsyncError(async (req, res) => {
    const health = await healthCheckService.quickCheck();
    return ApiResponse.success(res, health, {
      message: 'Service is healthy',
    });
  })
);

/**
 * Comprehensive health check
 * GET /api/health/detailed
 */
router.get(
  '/detailed',
  handleAsyncError(async (req, res) => {
    const health = await healthCheckService.checkHealth();

    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 200
          : 503;

    return res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health,
      message: `System is ${health.status}`,
    });
  })
);

/**
 * Circuit breaker status
 * GET /api/health/circuit-breakers
 */
router.get(
  '/circuit-breakers',
  handleAsyncError(async (req, res) => {
    const stats = circuitBreakerManager.getAllStats();
    return ApiResponse.success(res, stats, {
      message: 'Circuit breaker statistics',
    });
  })
);

/**
 * Readiness probe for Kubernetes/Docker
 * GET /api/health/ready
 */
router.get(
  '/ready',
  handleAsyncError(async (req, res) => {
    const health = await healthCheckService.checkHealth();

    if (health.status === 'unhealthy') {
      return res.status(503).json({
        ready: false,
        reason: 'Service is unhealthy',
      });
    }

    return res.status(200).json({
      ready: true,
      status: health.status,
    });
  })
);

/**
 * Liveness probe for Kubernetes/Docker
 * GET /api/health/live
 */
router.get('/live', (req, res) => {
  return res.status(200).json({
    alive: true,
    uptime: process.uptime(),
  });
});

/**
 * Clear health check cache
 * POST /api/health/cache/clear
 */
router.post(
  '/cache/clear',
  handleAsyncError(async (req, res) => {
    healthCheckService.clearCache();
    return ApiResponse.success(res, null, {
      message: 'Health check cache cleared',
    });
  })
);

export default router;
