import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

/**
 * Authentication middleware
 */

// Extend Request type to include user information
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
      };
      apiKey?: {
        id: string;
        name: string;
        permissions: string[];
      };
    }
  }
}

/**
 * JWT authentication middleware
 */
export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      details: 'Access token is missing',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload | string;
    const payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;

    if (
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      throw new Error('Invalid token payload');
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      permissions: Array.isArray(payload.permissions)
        ? (payload.permissions as string[])
        : [],
    };

    next();
  } catch (error) {
    return res.status(403).json({
      error: 'Invalid token',
      details:
        error instanceof Error
          ? error.message
          : 'The provided token is invalid or expired',
    });
  }
};

/**
 * Optional JWT authentication (allows both authenticated and unauthenticated requests)
 */
export const optionalJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(); // Continue without authentication if not configured
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload | string;
    const payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;

    if (
      typeof payload.id !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      throw new Error('Invalid token payload');
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      permissions: Array.isArray(payload.permissions)
        ? (payload.permissions as string[])
        : [],
    };
  } catch (error) {
    // Invalid token, but continue without authentication
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Invalid JWT token provided:', message);
  }

  next();
};

/**
 * API Key authentication middleware
 */
export const authenticateAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      details: 'X-API-Key header is missing',
    });
  }

  // In a real implementation, you would validate the API key against a database
  // For now, we'll use environment variables for internal services
  const validApiKeys = {
    [process.env.INTERNAL_SERVICE_KEY || '']: {
      id: 'internal-service',
      name: 'Internal Service',
      permissions: ['*'],
    },
    [process.env.WEBHOOK_API_KEY || '']: {
      id: 'webhook-service',
      name: 'Webhook Service',
      permissions: ['webhooks:receive', 'portals:update'],
    },
  };

  const keyData = validApiKeys[apiKey];
  if (!keyData) {
    return res.status(403).json({
      error: 'Invalid API key',
      details: 'The provided API key is not valid',
    });
  }

  req.apiKey = keyData;
  next();
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        details: 'User authentication is required for this endpoint',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        details: `This endpoint requires one of the following roles: ${allowedRoles.join(', ')}`,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check user permissions
    if (req.user && req.user.permissions.includes(permission)) {
      return next();
    }

    // Check API key permissions
    if (
      req.apiKey &&
      (req.apiKey.permissions.includes('*') ||
        req.apiKey.permissions.includes(permission))
    ) {
      return next();
    }

    return res.status(403).json({
      error: 'Insufficient permissions',
      details: `This endpoint requires the '${permission}' permission`,
      userPermissions: req.user?.permissions || [],
      apiKeyPermissions: req.apiKey?.permissions || [],
    });
  };
};

/**
 * Internal service authentication (for service-to-service communication)
 */
export const authenticateInternalService = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const internalKey = req.headers['x-internal-service'] as string;

  if (!internalKey || internalKey !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({
      error: 'Internal service authentication failed',
      details: 'Invalid or missing internal service key',
    });
  }

  // Set a special user context for internal services
  req.user = {
    id: 'internal-service',
    email: 'internal@service.local',
    role: 'internal',
    permissions: ['*'],
  };

  next();
};

/**
 * Development-only authentication bypass
 */
export const devAuthBypass = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  if (req.headers['x-dev-bypass'] === 'true') {
    req.user = {
      id: 'dev-user',
      email: 'dev@example.com',
      role: 'admin',
      permissions: ['*'],
    };
  }

  next();
};
