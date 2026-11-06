import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Configuração do banco incompleta. Defina: ${missing.join(', ')}.`);

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (error) => console.error('Erro inesperado no pool PostgreSQL:', error.message));
