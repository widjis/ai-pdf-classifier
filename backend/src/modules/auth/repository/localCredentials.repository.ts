import { pool } from '../../../core/db/postgres.js';
import type { ScryptParams } from '../../../core/auth/password.js';

type Row = {
  user_id: string;
  password_hash: string;
  salt: string;
  scrypt_params: ScryptParams;
  updated_at: string;
};

export type LocalCredentials = {
  userId: string;
  passwordHash: string;
  salt: string;
  params: ScryptParams;
  updatedAt: string;
};

const mapRow = (r: Row): LocalCredentials => ({
  userId: r.user_id,
  passwordHash: r.password_hash,
  salt: r.salt,
  params: r.scrypt_params,
  updatedAt: r.updated_at,
});

export const localCredentialsRepository = {
  getByUserId: async (userId: string): Promise<LocalCredentials | null> => {
    const res = await pool.query<Row>(
      'select user_id, password_hash, salt, scrypt_params, updated_at from auth_local_credentials where user_id = $1',
      [userId],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  },

  upsert: async (args: {
    userId: string;
    passwordHash: string;
    salt: string;
    params: ScryptParams;
  }): Promise<void> => {
    await pool.query(
      `insert into auth_local_credentials (user_id, password_hash, salt, scrypt_params, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (user_id)
       do update set password_hash = excluded.password_hash,
                    salt = excluded.salt,
                    scrypt_params = excluded.scrypt_params,
                    updated_at = now()`,
      [args.userId, args.passwordHash, args.salt, args.params],
    );
  },
};
