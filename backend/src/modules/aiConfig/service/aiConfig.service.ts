import { ApiError } from '../../../core/http/apiError.js';
import { decryptSecret } from '../../../core/crypto/secrets.js';
import type { AiProvider, AiProviderSecretStatus } from '../model/aiConfig.model.js';
import { aiConfigRepository } from '../repository/aiConfig.repository.js';

const validateProviderApiKey = (provider: AiProvider, apiKey: string) => {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid apiKey' });
  }

  if (provider === 'openai') {
    const looksLikeOpenAi = /^sk-(?:proj-)?[A-Za-z0-9_-]{10,}$/.test(trimmed);
    if (!looksLikeOpenAi) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid OpenAI apiKey format' });
    }
  }

  if (provider === 'gemini') {
    const looksLikeGoogleApiKey = /^AIza[0-9A-Za-z\-_]{20,}$/.test(trimmed);
    if (!looksLikeGoogleApiKey) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid Gemini apiKey format' });
    }
  }
};

const isMissingRelationError = (err: unknown): boolean => {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '42P01');
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseProviderErrorMessage = async (res: Response): Promise<string> => {
  const text = await res.text();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      (parsed as { error?: unknown }).error &&
      typeof (parsed as { error?: unknown }).error === 'object' &&
      'message' in ((parsed as { error: { message?: unknown } }).error as { message?: unknown })
    ) {
      const msg = (parsed as { error: { message?: unknown } }).error.message;
      return typeof msg === 'string' ? msg : '';
    }
  } catch {}
  return text.slice(0, 400);
};

const testOpenAiKey = async (apiKey: string): Promise<void> => {
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/models',
    { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
    10_000,
  );

  if (res.ok) return;

  const msg = await parseProviderErrorMessage(res);
  if (res.status === 401 || res.status === 403) {
    throw new ApiError({
      status: 400,
      code: 'BAD_REQUEST',
      message: msg ? `OpenAI rejected the API key: ${msg}` : 'OpenAI rejected the API key',
    });
  }
  throw new ApiError({
    status: 502,
    code: 'INTERNAL_ERROR',
    message: msg ? `OpenAI test failed (${res.status}): ${msg}` : `OpenAI test failed (${res.status})`,
  });
};

const testGeminiKey = async (apiKey: string): Promise<void> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url, { method: 'GET' }, 10_000);

  if (res.ok) return;

  const msg = await parseProviderErrorMessage(res);
  if (res.status === 401 || res.status === 403) {
    throw new ApiError({
      status: 400,
      code: 'BAD_REQUEST',
      message: msg ? `Gemini rejected the API key: ${msg}` : 'Gemini rejected the API key',
    });
  }
  throw new ApiError({
    status: 502,
    code: 'INTERNAL_ERROR',
    message: msg ? `Gemini test failed (${res.status}): ${msg}` : `Gemini test failed (${res.status})`,
  });
};

const mapSecretsConfigError = (err: unknown): ApiError | null => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('Missing SECRETS_ENCRYPTION_KEY_BASE64')) {
    return new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Server is missing SECRETS_ENCRYPTION_KEY_BASE64 (base64 of 32 bytes). Configure it and restart the backend.',
    });
  }
  if (message.includes('Invalid SECRETS_ENCRYPTION_KEY_BASE64')) {
    return new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Server has an invalid SECRETS_ENCRYPTION_KEY_BASE64. It must be base64 that decodes to exactly 32 bytes. Regenerate it and restart the backend.',
    });
  }
  return null;
};

export const aiConfigService = {
  getStatus: async (): Promise<AiProviderSecretStatus[]> => {
    return aiConfigRepository.listStatus();
  },

  setProviderKey: async (provider: AiProvider, apiKey: string): Promise<void> => {
    validateProviderApiKey(provider, apiKey);
    try {
      await aiConfigRepository.upsertKey(provider, apiKey);
    } catch (err) {
      if (isMissingRelationError(err)) {
        throw new ApiError({
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Database is missing ai_provider_secrets table. Run backend migrations and try again.',
        });
      }
      const mapped = mapSecretsConfigError(err);
      if (mapped) throw mapped;
      throw err;
    }
  },

  clearProviderKey: async (provider: AiProvider): Promise<void> => {
    try {
      await aiConfigRepository.clearKey(provider);
    } catch (err) {
      if (isMissingRelationError(err)) {
        throw new ApiError({
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Database is missing ai_provider_secrets table. Run backend migrations and try again.',
        });
      }
      throw err;
    }
  },

  testProviderKey: async (provider: AiProvider): Promise<void> => {
    let encrypted: Buffer | null;
    try {
      encrypted = await aiConfigRepository.getEncryptedKey(provider);
    } catch (err) {
      if (isMissingRelationError(err)) {
        throw new ApiError({
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Database is missing ai_provider_secrets table. Run backend migrations and try again.',
        });
      }
      throw err;
    }

    if (!encrypted) {
      throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'API key is not configured' });
    }

    try {
      const decrypted = decryptSecret(encrypted);
      validateProviderApiKey(provider, decrypted);
      if (provider === 'openai') {
        await testOpenAiKey(decrypted);
      } else {
        await testGeminiKey(decrypted);
      }
    } catch (err) {
      const mapped = mapSecretsConfigError(err);
      if (mapped) throw mapped;
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError({ status: 500, code: 'INTERNAL_ERROR', message });
    }
  },
};
