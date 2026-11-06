import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../config/database.js';

const directory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(directory, 'migrations');
const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();

try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for (const file of files) {
    const client = await pool.connect();
    try {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (applied.rowCount) continue;
      const sql = await readFile(join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migration aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
