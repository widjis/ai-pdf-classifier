import type { RequestHandler } from 'express';
import { ApiError } from './apiError.js';
import { authService } from '../../modules/auth/service/auth.service.js';

const getBearerToken = (req: { header: (name: string) => string | undefined }): string | null => {
  const raw = req.header('authorization');
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = getBearerToken(req);
    if (!token) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const user = await authService.getUserFromToken(token);
    req.authUser = user;
  })()
    .then(() => next())
    .catch(next);
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = getBearerToken(req);
    if (!token) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const user = await authService.getUserFromToken(token);
    req.authUser = user;
    if (user.role !== 'admin') throw new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Admin access required' });
  })()
    .then(() => next())
    .catch(next);
};

