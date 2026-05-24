import type { AuthUser } from '../../modules/auth/model/auth.model.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};

