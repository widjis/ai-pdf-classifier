import { ApiError } from '../../../core/http/apiError.js';
import { hashPassword, verifyPassword } from '../../../core/auth/password.js';
import { signAuthToken, verifyAuthToken } from '../../../core/auth/token.js';
import { env } from '../../../core/config/env.js';
import { authenticateWithLdap } from '../../../integrations/ldap/ldap.js';
import { usersRepository } from '../../users/repository/users.repository.js';
import type { AppUser } from '../../users/model/user.model.js';
import type { AuthUser, LoginResponse } from '../model/auth.model.js';
import { localCredentialsRepository } from '../repository/localCredentials.repository.js';

const toAuthUser = (user: AppUser): AuthUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
});

const normalizeLocalIdentity = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@local`;
};

export const authService = {
  ensureLocalAdmin: async (): Promise<void> => {
    if (!env.localAdminEmail || !env.localAdminPassword) return;

    const email = normalizeLocalIdentity(env.localAdminEmail);
    const existing = await usersRepository.getByEmail(email);
    const user =
      existing ??
      (await usersRepository.create({
        email,
        displayName: env.localAdminDisplayName,
        role: 'admin',
      }));

    const creds = await localCredentialsRepository.getByUserId(user.id);
    if (creds) return;

    const hashed = await hashPassword(env.localAdminPassword);
    await localCredentialsRepository.upsert({
      userId: user.id,
      passwordHash: hashed.passwordHash,
      salt: hashed.salt,
      params: hashed.params,
    });
  },

  loginWithEmail: async (args: { email: string; password: string; method: 'ldap' | 'local' }): Promise<LoginResponse> => {
    if (args.method === 'local') {
      await authService.ensureLocalAdmin();
      const user = await usersRepository.getByEmail(normalizeLocalIdentity(args.email));
      if (!user) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Invalid email or password' });
      if (!user.isActive) throw new ApiError({ status: 403, code: 'BAD_REQUEST', message: 'User is disabled' });
      if (user.role !== 'admin') throw new ApiError({ status: 403, code: 'BAD_REQUEST', message: 'Local login is restricted to admins' });

      const creds = await localCredentialsRepository.getByUserId(user.id);
      if (!creds) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Invalid email or password' });
      const ok = await verifyPassword({
        password: args.password,
        salt: creds.salt,
        passwordHash: creds.passwordHash,
        params: creds.params,
      });
      if (!ok) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Invalid email or password' });

      const token = signAuthToken({ sub: user.id, email: user.email }, 60 * 60 * 12);
      return { token, user: toAuthUser(user) };
    }

    const ldapUser = await authenticateWithLdap(args.email, args.password);
    if (!ldapUser) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Invalid email or password' });

    const existing = await usersRepository.getByEmail(ldapUser.email);
    const user =
      existing ??
      (await usersRepository.create({
        email: ldapUser.email,
        displayName: ldapUser.displayName,
        role: 'operator',
      }));

    if (!user.isActive) throw new ApiError({ status: 403, code: 'BAD_REQUEST', message: 'User is disabled' });

    const token = signAuthToken({ sub: user.id, email: user.email }, 60 * 60 * 12);
    return { token, user: toAuthUser(user) };
  },

  getUserFromToken: async (token: string): Promise<AuthUser> => {
    const payload = verifyAuthToken(token);
    const user = await usersRepository.getById(payload.sub);
    if (!user) throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Invalid token' });
    if (!user.isActive) throw new ApiError({ status: 403, code: 'BAD_REQUEST', message: 'User is disabled' });
    return toAuthUser(user);
  },
};
