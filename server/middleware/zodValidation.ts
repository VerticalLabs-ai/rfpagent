import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

/**
 * Enhanced Zod validation middleware with detailed error messages
 * Returns field-specific validation errors for better API usability
 */
export function validateSchema(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse the request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors into a user-friendly structure
        const formattedErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          expected: 'expected' in err ? (err as any).expected : undefined,
          received: 'received' in err ? (err as any).received : undefined,
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
          // Include a summary message for easier debugging
          summary: `${formattedErrors.length} validation error(s) found`,
        });
      }

      // Handle other types of errors
      console.error('Validation error:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.query);
      req.query = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: formattedErrors,
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
      });
    }
  };
}

/**
 * Validate route parameters with Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.params);
      req.params = parsed as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return res.status(400).json({
          success: false,
          error: 'Invalid route parameters',
          details: formattedErrors,
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid route parameters',
      });
    }
  };
}
