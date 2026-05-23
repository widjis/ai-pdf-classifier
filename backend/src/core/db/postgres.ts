import { Pool } from 'pg';
import { env } from '../config/env.js';

type PoolFactoryOptions = {
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean };
};

const poolOptions: PoolFactoryOptions = {
  connectionString: env.postgresUrl,
  ssl: env.postgresSsl ? { rejectUnauthorized: env.postgresSslRejectUnauthorized } : false,
};

export const pool = new Pool(poolOptions);

export const postgres = {
  ping: async () => {
    const res = await pool.query<{ one: number }>('select 1 as one');
    return res.rows[0]?.one === 1;
  },
};
