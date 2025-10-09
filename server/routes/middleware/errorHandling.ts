import type { Request, Response, NextFunction } from 'express';
import { captureException, withScope } from '@sentry/node';
import { ZodError } from 'zod';

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch and forward errors
 */
export const handleAsyncError = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log to console for development
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // Determine if this is a client error (4xx) or server error (5xx)
  const isClientError =
    error.status && error.status >= 400 && error.status < 500;
  const isValidationError = error instanceof ZodError;

  // Capture to Sentry for server errors and validation errors
  if (!isClientError || isValidationError) {
    withScope(scope => {
      // Add request context
      scope.setContext('request', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: req.query,
        params: req.params,
      });

      // Add error metadata
      scope.setTag('error_type', error.name || 'Unknown');
      scope.setTag('status_code', error.status || 500);
      scope.setTag('route', req.route?.path || req.path);

      // Add user context if available
      if (req.user) {
        scope.setUser({
          id: (req.user as any).id,
          username: (req.user as any).username,
          email: (req.user as any).email,
        });
      }

      // Capture the exception
      captureException(error);
    });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    });
  }

  // Database constraint errors
  if (error.code === '23505') {
    // Unique constraint violation
    return res.status(409).json({
      error: 'Resource already exists',
      details: 'A record with this identifier already exists',
    });
  }

  if (error.code === '23503') {
    // Foreign key constraint violation
    return res.status(400).json({
      error: 'Invalid reference',
      details: 'Referenced resource does not exist',
    });
  }

  // Custom application errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: error.message,
    });
  }

  if (error.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Resource not found',
      details: error.message,
    });
  }

  if (error.name === 'AuthorizationError') {
    return res.status(403).json({
      error: 'Access denied',
      details: error.message,
    });
  }

  // Authentication errors
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Authentication required',
      details: 'Valid authentication credentials are required',
    });
  }

  // Rate limiting errors
  if (error.name === 'TooManyRequestsError') {
    return res.status(429).json({
      error: 'Too many requests',
      details: 'Rate limit exceeded. Please try again later.',
      retryAfter: error.retryAfter || 60,
    });
  }

  // External service errors
  if (error.name === 'ServiceUnavailableError') {
    return res.status(503).json({
      error: 'Service unavailable',
      details: 'External service is temporarily unavailable',
    });
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    details:
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred',
    requestId: req.headers['x-request-id'] || 'unknown',
  });
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    details: `The requested endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: '/api/system/config', // Could be dynamically generated
  });
};

/**
 * Request timeout middleware
 */
export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          details: `Request exceeded ${timeoutMs}ms timeout limit`,
        });
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
};
