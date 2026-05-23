import { ApiError } from '../../../core/http/apiError.js';
import { userPreferencesRepository } from '../repository/userPreferences.repository.js';
import type { UserPreferences } from '../model/userPreferences.model.js';

export const userPreferencesService = {
  getByUserId: async (userId: string): Promise<UserPreferences | null> => {
    return userPreferencesRepository.getByUserId(userId);
  },

  upsert: async (
    userId: string,
    patch: { defaultMappingProfileId?: string; defaultAiProvider?: 'gemini' | 'openai'; defaultAiModel?: string },
  ): Promise<UserPreferences> => {
    const existing = await userPreferencesRepository.getByUserId(userId);
    if (!existing) {
      if (!patch.defaultMappingProfileId && !patch.defaultAiProvider && !patch.defaultAiModel) {
        throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'No fields to update' });
      }
      return userPreferencesRepository.insert({ userId, ...patch });
    }
    return userPreferencesRepository.update(userId, patch);
  },
};

