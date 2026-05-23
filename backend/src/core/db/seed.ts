import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pool } from './postgres.js';

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

const applySqlFile = async (filePath: string) => {
  const sql = await fs.readFile(filePath, 'utf8');
  const statements = splitSqlStatements(sql);
  await pool.query('begin');
  try {
    for (let i = 0; i < statements.length; i += 1) {
      const stmt = statements[i];
      if (stmt === undefined) continue;
      try {
        await pool.query(stmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const snippet = stmt.slice(0, 240).replace(/\s+/g, ' ');
        throw new Error(`Statement ${i + 1} failed: ${message}. snippet=${snippet}`);
      }
    }
    await pool.query('commit');
  } catch (err) {
    await pool.query('rollback');
    const message = err instanceof Error ? err.message : String(err);
    const preview = statements
      .map((s, idx) => `${idx + 1}:${s.slice(0, 120).replace(/\s+/g, ' ')}`)
      .slice(0, 6)
      .join(' | ');
    throw new Error(`Seed failed (${path.basename(filePath)}): ${message}. statements=${statements.length}. preview=${preview}`);
  }
};

const run = async () => {
  const seedsDir = path.join(process.cwd(), 'db', 'seeds');
  const files = (await fs.readdir(seedsDir))
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const fullPath = path.join(seedsDir, file);
    await applySqlFile(fullPath);
    process.stdout.write(`seeded ${file}\n`);
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
