/**
 * Applies migrations/*.sql in order, once each, tracked in schema_migrations.
 * Uses the DIRECT connection (DATABASE_URL_UNPOOLED) — migrations must not go through PgBouncer.
 *   npm run db:migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { loadEnv, ROOT } from '../server/env.mjs';
import { pgUrl } from '../server/api.mjs';

loadEnv();
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL_UNPOOLED is not set — run `neon deploy` or `neon env pull` first');
  process.exit(1);
}
const client = new pg.Client({ connectionString: pgUrl(url) });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const dir = path.join(ROOT, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${f}`);
      applied++;
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`${f}: ${e.message}`);
    }
  }
  console.log(`[migrate] done — ${applied} applied, ${files.length - applied} already up to date`);
} finally {
  await client.end();
}
