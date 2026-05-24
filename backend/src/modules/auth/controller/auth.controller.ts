import type { Request, Response } from 'express';
import { ApiError } from '../../../core/http/apiError.js';
import { parseLoginDTO } from '../dto/login.dto.js';
import { authService } from '../service/auth.service.js';

const getBearerToken = (req: Request): string | null => {
  const raw = req.header('authorization');
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
};

export const authController = {
  login: async (req: Request, res: Response) => {
    const dto = parseLoginDTO(req.body);
    const result = await authService.loginWithEmail({ email: dto.email, password: dto.password, method: dto.method });
    res.json(result);
  },

  me: async (req: Request, res: Response) => {
    const token = getBearerToken(req);
    if (!token) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Missing token' });
    const user = await authService.getUserFromToken(token);
    res.json({ user });
  },
};
