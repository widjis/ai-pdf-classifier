import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './apiError.js';

type ErrorResponse = {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
};

export const notFoundMiddleware = (_req: Request, res: Response<ErrorResponse>) => {
  res.status(404).json({ error: { message: 'Not Found', code: 'NOT_FOUND' } });
};

export const errorMiddleware = (err: unknown, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error';
  res.status(500).json({ error: { message, code: 'INTERNAL_ERROR' } });
};

