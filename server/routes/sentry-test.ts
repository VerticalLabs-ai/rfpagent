/**
 * Sentry Test Routes
 *
 * These routes are for testing Sentry error tracking and performance monitoring.
 * Remove or disable in production after verification.
 */

import {
  addBreadcrumb,
  captureException,
  captureMessage,
  setTag,
  setUser,
  startSpan,
} from '@sentry/node';
import { Request, Response, Router } from 'express';

const router = Router();

/**
 * Test error capture
 * GET /api/sentry/test-error
 */
router.get('/test-error', () => {
  throw new Error('Test error from Sentry test route - this is expected!');
});

/**
 * Test custom error capture with context
 * GET /api/sentry/test-custom-error
 */
router.get('/test-custom-error', (req: Request) => {
  try {
    // Simulate an error with context
    const userId = req.query.userId || 'test-user-123';

    setUser({
      id: userId.toString(),
      username: 'test-user',
    });

    setTag('test', 'custom-error');

    addBreadcrumb({
      category: 'test',
      message: 'User triggered custom error test',
      level: 'info',
    });

    throw new Error('Custom error with context - this is expected!');
  } catch (error) {
    captureException(error, {
      tags: {
        test: 'true',
        route: 'test-custom-error',
      },
      extra: {
        query: req.query,
        timestamp: new Date().toISOString(),
      },
    });
    throw error;
  }
});

/**
 * Test performance transaction
 * GET /api/sentry/test-performance
 */
router.get('/test-performance', async (_req: Request, res: Response) => {
  await startSpan(
    {
      op: 'test.performance',
      name: 'Sentry Performance Test',
    },
    async () => {
      // Simulate some work with nested spans
      await startSpan(
        {
          op: 'test.step1',
          name: 'First test step',
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      );

      await startSpan(
        {
          op: 'test.step2',
          name: 'Second test step',
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      );

      res.json({
        success: true,
        message: 'Performance test completed',
      });
    }
  );
});

/**
 * Test message capture (info level)
 * GET /api/sentry/test-message
 */
router.get('/test-message', (_req: Request, res: Response) => {
  captureMessage('Test message from Sentry test route', {
    level: 'info',
    tags: {
      test: 'true',
      route: 'test-message',
    },
    extra: {
      timestamp: new Date().toISOString(),
    },
  });

  res.json({
    success: true,
    message: 'Test message sent to Sentry',
  });
});

/**
 * Test successful operation (no error)
 * GET /api/sentry/test-success
 */
router.get('/test-success', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'This route succeeds without errors',
    sentry: {
      configured: !!process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
    },
  });
});

export default router;
