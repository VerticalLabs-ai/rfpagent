/**
 * Correlation ID Middleware
 * Adds unique correlation IDs to all requests for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to all requests
 * - Checks for existing X-Correlation-ID header
 * - Generates new ID if not present
 * - Adds ID to request object and response headers
 * - Sets logger context for all subsequent logs in this request
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const existingId = req.headers['x-correlation-id'] as string | undefined;

  const correlationId = existingId || `corr_${nanoid(16)}`;

  req.correlationId = correlationId;

  res.setHeader('X-Correlation-ID', correlationId);

  const requestLogger = logger.child({
    correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
  });

  (req as any).logger = requestLogger;

  requestLogger.info('Incoming request', {
    query: req.query,
    ip: req.ip,
  });

  next();
}

/**
 * Helper to get correlation ID from request
 */
export function getCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}

/**
 * Helper to get request-scoped logger
 */
export function getRequestLogger(req: Request): typeof logger {
  return (req as any).logger || logger;
}
