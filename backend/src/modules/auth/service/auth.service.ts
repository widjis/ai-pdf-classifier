import { ApiError } from '../../../core/http/apiError.js';
import { signAuthToken, verifyAuthToken } from '../../../core/auth/token.js';
import { authenticateWithLdap } from '../../../integrations/ldap/ldap.js';
import { usersRepository } from '../../users/repository/users.repository.js';
import type { AppUser } from '../../users/model/user.model.js';
import type { AuthUser, LoginResponse } from '../model/auth.model.js';

const toAuthUser = (user: AppUser): AuthUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
});

export const authService = {
  loginWithEmail: async (email: string, password: string): Promise<LoginResponse> => {
    const ldapUser = await authenticateWithLdap(email, password);
    if (!ldapUser) {
      throw new ApiError({ status: 401, code: 'BAD_REQUEST', message: 'Invalid email or password' });
    }

    const existing = await usersRepository.getByEmail(ldapUser.email);
    const user =
      existing ??
      (await usersRepository.create({
        email: ldapUser.email,
        displayName: ldapUser.displayName,
        role: 'operator',
      }));

    if (!user.isActive) {
      throw new ApiError({ status: 403, code: 'BAD_REQUEST', message: 'User is disabled' });
    }

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
