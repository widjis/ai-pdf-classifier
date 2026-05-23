import { pool } from '../../../core/db/postgres.js';
import type { UserPreferences } from '../model/userPreferences.model.js';

type PrefRow = {
  user_id: string;
  default_mapping_profile_id: string | null;
  default_ai_provider: 'gemini' | 'openai' | null;
  default_ai_model: string | null;
  created_at: string;
  updated_at: string;
};

const mapPref = (r: PrefRow): UserPreferences => ({
  userId: r.user_id,
  defaultMappingProfileId: r.default_mapping_profile_id,
  defaultAiProvider: r.default_ai_provider,
  defaultAiModel: r.default_ai_model,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const userPreferencesRepository = {
  getByUserId: async (userId: string): Promise<UserPreferences | null> => {
    const res = await pool.query<PrefRow>(
      'select user_id, default_mapping_profile_id, default_ai_provider, default_ai_model, created_at, updated_at from user_preferences where user_id = $1',
      [userId],
    );
    const row = res.rows[0];
    return row ? mapPref(row) : null;
  },

  insert: async (args: {
    userId: string;
    defaultMappingProfileId?: string;
    defaultAiProvider?: 'gemini' | 'openai';
    defaultAiModel?: string;
  }): Promise<UserPreferences> => {
    const res = await pool.query<PrefRow>(
      `insert into user_preferences (user_id, default_mapping_profile_id, default_ai_provider, default_ai_model)
       values ($1, $2, $3, $4)
       returning user_id, default_mapping_profile_id, default_ai_provider, default_ai_model, created_at, updated_at`,
      [args.userId, args.defaultMappingProfileId ?? null, args.defaultAiProvider ?? null, args.defaultAiModel ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to insert preferences');
    return mapPref(row);
  },

  update: async (
    userId: string,
    patch: { defaultMappingProfileId?: string; defaultAiProvider?: 'gemini' | 'openai'; defaultAiModel?: string },
  ): Promise<UserPreferences> => {
    const current = await userPreferencesRepository.getByUserId(userId);
    const next = {
      defaultMappingProfileId: patch.defaultMappingProfileId ?? current?.defaultMappingProfileId ?? null,
      defaultAiProvider: patch.defaultAiProvider ?? current?.defaultAiProvider ?? null,
      defaultAiModel: patch.defaultAiModel ?? current?.defaultAiModel ?? null,
    };

    const res = await pool.query<PrefRow>(
      `update user_preferences
       set default_mapping_profile_id = $2,
           default_ai_provider = $3,
           default_ai_model = $4,
           updated_at = now()
       where user_id = $1
       returning user_id, default_mapping_profile_id, default_ai_provider, default_ai_model, created_at, updated_at`,
      [userId, next.defaultMappingProfileId, next.defaultAiProvider, next.defaultAiModel],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to update preferences');
    return mapPref(row);
  },
};

