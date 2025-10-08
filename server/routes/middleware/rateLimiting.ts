import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    rateLimit?: {
      limit: number;
      current: number;
      remaining: number;
      resetTime?: Date;
    };
  }
}

/**
 * Rate limiting middleware configurations
 */

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

  // Skip for localhost in development - check multiple IP formats
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === undefined
  ) {
    const clientIP = req.ip || req.socket.remoteAddress || '';

    // Check for localhost, IPv4 loopback, IPv6 loopback
    if (
      clientIP === '127.0.0.1' ||
      clientIP === '::1' ||
      clientIP === '::ffff:127.0.0.1' ||
      clientIP === 'localhost'
    ) {
      return true;
    }

    // Check for RFC1918 private networks
    // 10.0.0.0/8
    if (clientIP.startsWith('10.')) {
      return true;
    }

    // 192.168.0.0/16
    if (clientIP.startsWith('192.168.')) {
      return true;
    }

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (clientIP.startsWith('172.')) {
      const octets = clientIP.split('.');
      if (octets.length >= 2) {
        const secondOctet = parseInt(octets[1], 10);
        if (!isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
          return true;
        }
      }
    }
  }

  return false;
};

// Default rate limiter for most API endpoints
// More permissive limits for development, stricter for production
const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Higher limit for development
  skip: skipRateLimit, // Skip for localhost in development
  message: {
    error: 'Too many requests',
    details: 'Rate limit exceeded. Please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    const retryAfterSeconds = (req as any).rateLimit?.resetTime
      ? Math.max(
          0,
          Math.ceil(
            ((req as any).rateLimit.resetTime.getTime() - Date.now()) / 1000
          )
        )
      : 900;
    res.status(429).json({
      error: 'Too many requests',
      details: 'Rate limit exceeded. Please try again later.',
      retryAfter: retryAfterSeconds,
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
