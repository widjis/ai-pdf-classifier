import { pool } from '../../../core/db/postgres.js';

export const dbRepository = {
  getDbInfo: async () => {
    const res = await pool.query<{ db: string; user: string }>('select current_database() as db, current_user as user');
    const row = res.rows[0];
    if (!row) throw new Error('No database info returned');
    return row;
  },
  ping: async () => {
    const res = await pool.query<{ one: number }>('select 1 as one');
    return res.rows[0]?.one === 1;
  },
};
