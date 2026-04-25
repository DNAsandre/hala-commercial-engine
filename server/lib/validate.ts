/**
 * Request validation helpers.
 * Uses Zod (already in project dependencies).
 * 
 * Provides a middleware factory that validates request body
 * against a Zod schema and returns clear error messages.
 */

import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

/**
 * Express middleware factory — validates req.body against a Zod schema.
 * Returns 400 with structured errors if validation fails.
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    // Attach validated data to req for downstream use
    (req as any).validatedBody = result.data;
    next();
  };
}

/**
 * Reject empty request body for PATCH/POST routes.
 */
export function rejectEmptyBody(req: Request, res: Response, next: NextFunction) {
  if (!req.body || Object.keys(req.body).length === 0) {
    res.status(400).json({
      error: 'Request body cannot be empty',
      code: 'EMPTY_BODY',
    });
    return;
  }
  next();
}

/**
 * Strip dangerous fields that should never be set by the client.
 * Returns a sanitised copy of the object.
 */
export function stripDangerousFields(
  data: Record<string, any>,
  deny: string[] = ['id', 'created_at', 'created_by']
): Record<string, any> {
  const clean = { ...data };
  for (const field of deny) {
    delete clean[field];
  }
  return clean;
}
