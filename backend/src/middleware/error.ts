import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  const status = (err as any)?.statusCode || 500;
  const message = (err as any)?.message || 'Internal server error';

  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
  }

  res.status(status).json({ success: false, error: message });
}