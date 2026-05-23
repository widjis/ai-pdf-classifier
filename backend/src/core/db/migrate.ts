import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pool } from './postgres.js';

type MigrationRow = { version: string };

const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : undefined;

    if (ch === "'" && !inDouble) {
      if (inSingle && next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === ';' && !inSingle && !inDouble) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
};

const getAppliedVersions = async (): Promise<Set<string>> => {
  await pool.query(
    `create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )`,
  );
  const res = await pool.query<MigrationRow>('select version from schema_migrations');
  return new Set(res.rows.map((r) => r.version));
};

const applySqlFile = async (filePath: string) => {
  const sql = await fs.readFile(filePath, 'utf8');
  const statements = splitSqlStatements(sql);
  await pool.query('begin');
  try {
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    await pool.query('commit');
  } catch (err) {
    await pool.query('rollback');
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Migration failed (${path.basename(filePath)}): ${message}`);
  }
};

const applyMigration = async (version: string, filePath: string) => {
  await applySqlFile(filePath);
  await pool.query('insert into schema_migrations (version) values ($1) on conflict do nothing', [version]);
};

const run = async () => {
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const applied = await getAppliedVersions();

  for (const file of files) {
    const version = file.replace(/\.sql$/i, '');
    if (applied.has(version)) continue;
    const fullPath = path.join(migrationsDir, file);
    await applyMigration(version, fullPath);
    process.stdout.write(`applied ${version}\n`);
  }

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
