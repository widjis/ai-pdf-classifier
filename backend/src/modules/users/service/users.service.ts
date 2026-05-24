import { ApiError } from '../../../core/http/apiError.js';
import { hashPassword } from '../../../core/auth/password.js';
import { auditService } from '../../audit/service/audit.service.js';
import { localCredentialsRepository } from '../../auth/repository/localCredentials.repository.js';
import { usersRepository } from '../repository/users.repository.js';
import type { AppUser } from '../model/user.model.js';

export const usersService = {
  list: async (): Promise<AppUser[]> => usersRepository.list(),

  create: async (args: { email: string; displayName: string; role: AppUser['role'] }): Promise<AppUser> => {
    const exists = await usersRepository.existsByEmail(args.email);
    if (exists) throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Email already exists' });
    return usersRepository.create(args);
  },

  update: async (
    id: string,
    args: { displayName?: string; role?: AppUser['role']; isActive?: boolean },
  ): Promise<AppUser> => {
    const existing = await usersRepository.getById(id);
    if (!existing) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'User not found' });

    const nextRole = args.role ?? existing.role;
    const nextIsActive = args.isActive ?? existing.isActive;

    const wouldRemoveAdmin =
      existing.role === 'admin' && existing.isActive && (nextRole !== 'admin' || nextIsActive !== true);

    if (wouldRemoveAdmin) {
      const activeAdmins = await usersRepository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Cannot remove the last active admin' });
      }
    }

    const updated = await usersRepository.updateById(id, args);
    if (!updated) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'User not found' });
    return updated;
  },

  resetLocalAdminPassword: async (args: {
    userId: string;
    newPassword: string;
    actorUserId: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> => {
    const user = await usersRepository.getById(args.userId);
    if (!user) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'User not found' });
    if (user.role !== 'admin') throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Local password reset is restricted to admin users' });
    if (!user.email.toLowerCase().endsWith('@local')) {
      throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Local password reset is restricted to @local identities' });
    }

    const hashed = await hashPassword(args.newPassword);
    await localCredentialsRepository.upsert({
      userId: user.id,
      passwordHash: hashed.passwordHash,
      salt: hashed.salt,
      params: hashed.params,
    });

    await auditService.log({
      actorUserId: args.actorUserId,
      targetUserId: user.id,
      action: 'users.reset_local_password',
      before: null,
      after: { userId: user.id, email: user.email },
      ip: args.ip,
      userAgent: args.userAgent,
    });
  },
};
