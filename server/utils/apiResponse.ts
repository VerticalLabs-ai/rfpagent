import type { Response } from 'express';

/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all endpoints
 */

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMetadata;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    timestamp: string;
  };
  requestId?: string;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class ApiResponse {
  /**
   * Send successful response
   */
  static success<T>(
    res: Response,
    data: T,
    options?: {
      message?: string;
      statusCode?: number;
      metadata?: Record<string, any>;
    }
  ): Response {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      message: options?.message,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId,
        ...options?.metadata,
      },
    };

    return res.status(options?.statusCode || 200).json(response);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    options?: {
      message?: string;
      metadata?: Record<string, any>;
    }
  ): Response {
    const totalPages = Math.ceil(pagination.total / pagination.limit);

    const paginationMeta: PaginationMetadata = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    };

    return this.success(res, data, {
      ...options,
      metadata: {
        pagination: paginationMeta,
        ...options?.metadata,
      },
    });
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    error: {
      code: string;
      message: string;
      details?: any;
      field?: string;
    },
    statusCode: number = 500
  ): Response {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        ...error,
        timestamp: new Date().toISOString(),
      },
      requestId: res.locals.requestId,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(
    res: Response,
    errors: Array<{ field: string; message: string }>
  ): Response {
    return this.error(
      res,
      {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors,
      },
      400
    );
  }

  /**
   * Send not found response
   */
  static notFound(res: Response, resource: string = 'Resource'): Response {
    return this.error(
      res,
      {
        code: 'NOT_FOUND',
        message: `${resource} not found`,
      },
      404
    );
  }

  /**
   * Send unauthorized response
   */
  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ): Response {
    return this.error(
      res,
      {
        code: 'UNAUTHORIZED',
        message,
      },
      401
    );
  }

  /**
   * Send forbidden response
   */
  static forbidden(res: Response, message: string = 'Forbidden'): Response {
    return this.error(
      res,
      {
        code: 'FORBIDDEN',
        message,
      },
      403
    );
  }

  /**
   * Send conflict response
   */
  static conflict(
    res: Response,
    message: string = 'Resource already exists'
  ): Response {
    return this.error(
      res,
      {
        code: 'CONFLICT',
        message,
      },
      409
    );
  }

  /**
   * Send rate limit response
   */
  static rateLimit(res: Response, retryAfter?: number): Response {
    return this.error(
      res,
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: retryAfter ? { retryAfter } : undefined,
      },
      429
    );
  }

  /**
   * Send service unavailable response
   */
  static serviceUnavailable(
    res: Response,
    message: string = 'Service temporarily unavailable'
  ): Response {
    return this.error(
      res,
      {
        code: 'SERVICE_UNAVAILABLE',
        message,
      },
      503
    );
  }

  /**
   * Send internal server error response
   */
  static internalError(
    res: Response,
    message: string = 'Internal server error',
    details?: any
  ): Response {
    return this.error(
      res,
      {
        code: 'INTERNAL_ERROR',
        message,
        details: process.env.NODE_ENV === 'development' ? details : undefined,
      },
      500
    );
  }

  /**
   * Send created response
   */
  static created<T>(res: Response, data: T, message?: string): Response {
    return this.success(res, data, { statusCode: 201, message });
  }

  /**
   * Send accepted response (async operation started)
   */
  static accepted<T>(res: Response, data: T, message?: string): Response {
    return this.success(res, data, { statusCode: 202, message });
  }

  /**
   * Send no content response
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }
}
