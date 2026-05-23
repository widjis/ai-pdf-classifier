export type UserPreferences = {
  userId: string;
  defaultMappingProfileId: string | null;
  defaultAiProvider: 'gemini' | 'openai' | null;
  defaultAiModel: string | null;
  createdAt: string;
  updatedAt: string;
};

