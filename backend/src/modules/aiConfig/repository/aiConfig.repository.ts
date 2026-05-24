import { pool } from '../../../core/db/postgres.js';
import { encryptSecret } from '../../../core/crypto/secrets.js';
import type { AiProvider, AiProviderSecretStatus } from '../model/aiConfig.model.js';

type SecretRow = {
  provider: AiProvider;
  updated_at: string;
};

type KeyRow = {
  api_key_encrypted: Buffer;
};

const isMissingRelationError = (err: unknown): boolean => {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '42P01');
};

export const aiConfigRepository = {
  listStatus: async (): Promise<AiProviderSecretStatus[]> => {
    let res: { rows: SecretRow[] };
    try {
      res = await pool.query<SecretRow>('select provider, updated_at from ai_provider_secrets');
    } catch (err) {
      if (isMissingRelationError(err)) {
        const providers: AiProvider[] = ['gemini', 'openai'];
        return providers.map((provider) => ({ provider, hasKey: false, updatedAt: null }));
      }
      throw err;
    }
    const map = new Map<AiProvider, string>();
    for (const row of res.rows) {
      map.set(row.provider, row.updated_at);
    }
    const providers: AiProvider[] = ['gemini', 'openai'];
    return providers.map((provider) => {
      const updatedAt = map.get(provider) ?? null;
      return { provider, hasKey: updatedAt !== null, updatedAt };
    });
  },

  getEncryptedKey: async (provider: AiProvider): Promise<Buffer | null> => {
    let res: { rows: KeyRow[] };
    try {
      res = await pool.query<KeyRow>('select api_key_encrypted from ai_provider_secrets where provider = $1', [provider]);
    } catch (err) {
      if (isMissingRelationError(err)) return null;
      throw err;
    }
    const row = res.rows[0];
    return row?.api_key_encrypted ?? null;
  },

  upsertKey: async (provider: AiProvider, apiKey: string): Promise<void> => {
    const encrypted = encryptSecret(apiKey);
    await pool.query(
      `insert into ai_provider_secrets (provider, api_key_encrypted, updated_at)
       values ($1, $2, now())
       on conflict (provider)
       do update set api_key_encrypted = excluded.api_key_encrypted, updated_at = now()`,
      [provider, encrypted],
    );
  },

  clearKey: async (provider: AiProvider): Promise<boolean> => {
    const res = await pool.query('delete from ai_provider_secrets where provider = $1', [provider]);
    return (res.rowCount ?? 0) > 0;
  },
};
