import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../config/database.js';

const directory = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(directory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();

try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (applied.rowCount) continue;
    const sql = await readFile(join(directory, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Migration aplicada: ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await pool.end();
}
