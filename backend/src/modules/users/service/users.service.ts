import { ApiError } from '../../../core/http/apiError.js';
import { usersRepository } from '../repository/users.repository.js';
import type { AppUser } from '../model/user.model.js';

export const usersService = {
  list: async (): Promise<AppUser[]> => usersRepository.list(),

  create: async (args: { email: string; displayName: string; role: AppUser['role'] }): Promise<AppUser> => {
    const exists = await usersRepository.existsByEmail(args.email);
    if (exists) throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Email already exists' });
    return usersRepository.create(args);
  },
};

