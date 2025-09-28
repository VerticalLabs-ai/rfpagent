import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';

/**
 * Request validation middleware factory
 * Validates request body, query parameters, or route parameters against Zod schema
 */
export const validateRequest = (
  schema: ZodSchema,
  target: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      const validatedData = schema.parse(dataToValidate);

      // Replace the original data with validated (and potentially transformed) data
      (req as any)[target] = validatedData;

      next();
    } catch (error) {
      next(error); // Forward to error handler
    }
  };
};

/**
 * Validation schemas for common request patterns
 */
export const commonSchemas = {
  // Pagination parameters
  pagination: z.object({
    limit: z
      .string()
      .transform(val => parseInt(val, 10))
      .pipe(z.number().min(1).max(100))
      .optional()
      .default('50'),
    offset: z
      .string()
      .transform(val => parseInt(val, 10))
      .pipe(z.number().min(0))
      .optional()
      .default('0'),
    page: z
      .string()
      .transform(val => parseInt(val, 10))
      .pipe(z.number().min(1))
      .optional(),
  }),

  // ID parameters
  id: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Search parameters
  search: z.object({
    q: z.string().min(1).max(100).optional(),
    filter: z.string().optional(),
    sort: z.enum(['asc', 'desc']).optional().default('desc'),
    sortBy: z.string().optional(),
  }),

  // Date range parameters
  dateRange: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })
    .refine(
      data => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      {
        message: 'Start date must be before end date',
      }
    ),

  // Status parameters
  status: z.object({
    status: z
      .enum(['active', 'inactive', 'pending', 'completed', 'failed'])
      .optional(),
  }),
};

/**
 * Combine multiple validation schemas
 */
export const combineSchemas = (...schemas: ZodSchema[]) => {
  return schemas.reduce((acc, schema) => acc.merge(schema), z.object({}));
};

/**
 * Validate file upload parameters
 */
export const validateFileUpload = (
  allowedTypes: string[] = ['pdf', 'doc', 'docx', 'txt'],
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return res.status(400).json({
        error: 'No file uploaded',
        details: 'A file is required for this endpoint',
      });
    }

    const file =
      req.file || (Array.isArray(req.files) ? req.files[0] : req.files);

    if (!file) {
      return res.status(400).json({
        error: 'Invalid file upload',
        details: 'File data is missing or corrupted',
      });
    }

    // Check file type
    const fileExtension = file.originalname?.split('.').pop()?.toLowerCase();
    if (fileExtension && !allowedTypes.includes(fileExtension)) {
      return res.status(400).json({
        error: 'Invalid file type',
        details: `Allowed types: ${allowedTypes.join(', ')}`,
        received: fileExtension,
      });
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      return res.status(400).json({
        error: 'File too large',
        details: `Maximum size: ${maxSizeBytes / (1024 * 1024)}MB`,
        received: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      });
    }

    next();
  };
};

/**
 * Sanitize and validate session/request IDs
 */
export const validateSessionId = z.object({
  sessionId: z
    .string()
    .min(10, 'Session ID too short')
    .max(100, 'Session ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Session ID contains invalid characters'),
});

/**
 * Validate portal-specific parameters
 */
export const portalSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    url: z.string().url(),
    type: z.enum(['municipal', 'federal', 'state', 'private']),
    enabled: z.boolean().optional().default(true),
    scanInterval: z.number().min(3600).max(86400).optional(), // 1 hour to 1 day
    config: z.record(z.any()).optional(),
  }),

  update: z.object({
    name: z.string().min(1).max(255).optional(),
    url: z.string().url().optional(),
    type: z.enum(['municipal', 'federal', 'state', 'private']).optional(),
    enabled: z.boolean().optional(),
    scanInterval: z.number().min(3600).max(86400).optional(),
    config: z.record(z.any()).optional(),
  }),
};

/**
 * Validate RFP-specific parameters
 */
export const rfpSchemas = {
  manual: z.object({
    url: z.string().url('Invalid URL format'),
    portalId: z.string().uuid('Invalid portal ID'),
    additionalData: z.record(z.any()).optional(),
  }),

  filters: z.object({
    portal: z.string().optional(),
    status: z.enum(['active', 'closed', 'draft', 'cancelled']).optional(),
    dateRange: commonSchemas.dateRange.optional(),
  }),
};
