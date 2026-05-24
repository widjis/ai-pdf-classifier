import { pool } from '../../../core/db/postgres.js';
import type { AppUser } from '../model/user.model.js';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

const mapUser = (r: UserRow): AppUser => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  role: r.role as AppUser['role'],
  isActive: r.is_active,
  createdAt: r.created_at,
});

export const usersRepository = {
  list: async (): Promise<AppUser[]> => {
    const res = await pool.query<UserRow>(
      'select id, email, display_name, role, is_active, created_at from app_users order by created_at desc',
    );
    return res.rows.map(mapUser);
  },

  getById: async (id: string): Promise<AppUser | null> => {
    const res = await pool.query<UserRow>(
      'select id, email, display_name, role, is_active, created_at from app_users where id = $1',
      [id],
    );
    const row = res.rows[0];
    return row ? mapUser(row) : null;
  },

  getByEmail: async (email: string): Promise<AppUser | null> => {
    const res = await pool.query<UserRow>(
      'select id, email, display_name, role, is_active, created_at from app_users where email = $1',
      [email],
    );
    const row = res.rows[0];
    return row ? mapUser(row) : null;
  },

  create: async (args: { email: string; displayName: string; role: AppUser['role'] }): Promise<AppUser> => {
    const res = await pool.query<UserRow>(
      'insert into app_users (email, display_name, role) values ($1, $2, $3) returning id, email, display_name, role, is_active, created_at',
      [args.email, args.displayName, args.role],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create user');
    return mapUser(row);
  },

  existsByEmail: async (email: string): Promise<boolean> => {
    const res = await pool.query<{ exists: boolean }>('select exists(select 1 from app_users where email = $1) as exists', [
      email,
    ]);
    return res.rows[0]?.exists === true;
  },
};
