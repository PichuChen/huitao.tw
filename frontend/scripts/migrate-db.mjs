import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.HUITAO_DATABASE_URL?.trim();

if (!connectionString) {
  console.error('HUITAO_DATABASE_URL is required.');
  process.exit(1);
}

const migrationsDir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
});

const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const name of files) {
    const existing = await client.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [name],
    );
    if (existing.rowCount) {
      console.log(`skip ${name}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, name), 'utf8');
    console.log(`apply ${name}`);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log('database migrations complete');
} finally {
  client.release();
  await pool.end();
}
