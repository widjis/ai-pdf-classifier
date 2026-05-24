export type AiProvider = 'gemini' | 'openai';

export type AiProviderSecretStatus = {
  provider: AiProvider;
  hasKey: boolean;
  updatedAt: string | null;
};
