import { Router } from 'express';
import { healthCheckService } from '../services/monitoring/healthCheckService';
import { circuitBreakerManager } from '../services/core/circuitBreaker';
import { aiService } from '../services/core/aiService';
import { ApiResponse } from '../utils/apiResponse';
import { handleAsyncError } from '../middleware/errorHandling';

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
 * Circuit breaker status (all circuits)
 * GET /api/health/circuit-breakers
 */
router.get(
  '/circuit-breakers',
  handleAsyncError(async (req, res) => {
    const allMetrics = circuitBreakerManager.getAllMetrics();
    const healthStatus = circuitBreakerManager.getHealthStatus();

    return ApiResponse.success(
      res,
      {
        timestamp: new Date().toISOString(),
        circuits: allMetrics,
        summary: healthStatus,
        hasOpenCircuits: circuitBreakerManager.hasOpenCircuits(),
      },
      {
        message: 'Circuit breaker statistics',
      }
    );
  })
);

/**
 * AI Service circuit breaker health
 * GET /api/health/ai-circuits
 */
router.get(
  '/ai-circuits',
  handleAsyncError(async (req, res) => {
    const aiHealth = aiService.getCircuitBreakerHealth();

    const statusCode = aiHealth.overall === 'unhealthy' ? 503 : 200;

    return res.status(statusCode).json({
      success: aiHealth.overall !== 'unhealthy',
      data: {
        timestamp: new Date().toISOString(),
        overall: aiHealth.overall,
        circuits: {
          conversation: aiHealth.conversationCircuit,
          analysis: aiHealth.analysisCircuit,
          generation: aiHealth.generationCircuit,
        },
      },
      message: `AI services are ${aiHealth.overall}`,
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
 * Portal monitoring health status
 * GET /api/health/portals
 */
router.get(
  '/portals',
  handleAsyncError(async (req, res) => {
    const { storage } = await import('../storage');
    const portals = await storage.getActivePortals();

    const now = new Date();
    const staleDays = 7; // Consider stale if not scanned in 7 days
    const staleThreshold = new Date(
      now.getTime() - staleDays * 24 * 60 * 60 * 1000
    );

    const portalHealth = await Promise.all(
      portals.map(async portal => {
        const lastScanned = portal.lastScanned
          ? new Date(portal.lastScanned)
          : null;
        const isStale = !lastScanned || lastScanned < staleThreshold;
        const daysSinceLastScan = lastScanned
          ? Math.floor(
              (now.getTime() - lastScanned.getTime()) / (24 * 60 * 60 * 1000)
            )
          : null;

        return {
          id: portal.id,
          name: portal.name,
          url: portal.url,
          status: portal.status,
          isActive: portal.isActive,
          monitoringEnabled: portal.monitoringEnabled,
          lastScanned: portal.lastScanned,
          daysSinceLastScan,
          isStale,
          errorCount: portal.errorCount || 0,
          lastError: portal.lastError,
          scanFrequency: portal.scanFrequency,
          health: isStale
            ? 'unhealthy'
            : portal.status === 'error'
              ? 'degraded'
              : 'healthy',
        };
      })
    );

    const healthyCount = portalHealth.filter(
      p => p.health === 'healthy'
    ).length;
    const degradedCount = portalHealth.filter(
      p => p.health === 'degraded'
    ).length;
    const unhealthyCount = portalHealth.filter(
      p => p.health === 'unhealthy'
    ).length;

    res.json({
      status:
        unhealthyCount > 0
          ? 'unhealthy'
          : degradedCount > 0
            ? 'degraded'
            : 'healthy',
      summary: {
        total: portals.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        staleThresholdDays: staleDays,
      },
      portals: portalHealth,
      timestamp: now.toISOString(),
    });
  })
);

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
