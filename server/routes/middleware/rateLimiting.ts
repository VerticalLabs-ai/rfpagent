import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate limiting middleware configurations
 */

// Default rate limiter for most API endpoints
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    details: 'Rate limit exceeded. Please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      details: 'Rate limit exceeded. Please try again later.',
      retryAfter:
        Math.ceil(req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000 ||
        900,
    });
  },
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: 'Rate limit exceeded for sensitive operation',
    details: 'This endpoint has stricter rate limits. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Heavy operation rate limiter (for resource-intensive endpoints)
export const heavyOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    error: 'Rate limit exceeded for heavy operation',
    details:
      'This resource-intensive operation has strict limits. Please try again later.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI operation rate limiter
export const aiOperationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // Limit each IP to 50 AI requests per 10 minutes
  message: {
    error: 'AI operation rate limit exceeded',
    details: 'Too many AI requests. Please try again later.',
    retryAfter: 10 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 uploads per 15 minutes
  message: {
    error: 'Upload rate limit exceeded',
    details: 'Too many file uploads. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Portal scanning rate limiter
export const scanLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 5, // Limit each IP to 5 scan requests per 30 minutes
  message: {
    error: 'Portal scan rate limit exceeded',
    details: 'Portal scanning is resource intensive. Please try again later.',
    retryAfter: 30 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Create dynamic rate limiter based on operation type
export const createDynamicLimiter = (config: {
  windowMs: number;
  max: number;
  operation: string;
}) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: `${config.operation} rate limit exceeded`,
      details: `Too many ${config.operation.toLowerCase()} requests. Please try again later.`,
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Skip rate limiting for certain conditions
export const skipRateLimit = (req: Request): boolean => {
  // Skip for health checks
  if (req.path.includes('/health') || req.path.includes('/status')) {
    return true;
  }

  // Skip for internal services (if using API keys)
  if (req.headers['x-internal-service'] === process.env.INTERNAL_SERVICE_KEY) {
    return true;
  }

  // Skip for localhost in development
  if (
    process.env.NODE_ENV === 'development' &&
    (req.ip === '127.0.0.1' ||
      req.ip === '::1' ||
      req.ip?.startsWith('192.168.'))
  ) {
    return true;
  }

  return false;
};

// Rate limiter with skip function
export const smartRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: skipRateLimit,
  message: {
    error: 'Too many requests',
    details: 'Rate limit exceeded. Please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
