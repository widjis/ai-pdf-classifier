import { pool } from './postgres.js';

type Row = {
  users: string;
  profiles: string;
  rules: string;
};

const run = async () => {
  const res = await pool.query<Row>(
    'select (select count(*)::text from app_users) as users, (select count(*)::text from mapping_profiles) as profiles, (select count(*)::text from mapping_rules) as rules',
  );
  const row = res.rows[0];
  process.stdout.write(JSON.stringify(row ?? null) + '\n');
  await pool.end();
};

run().catch(async (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});

