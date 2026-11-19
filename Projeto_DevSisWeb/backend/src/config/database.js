
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

let pool;

if (connectionString) {
  // Conexão com Neon usando DATABASE_URL
  pool = new Pool({
    connectionString,
    max: 5,
  });
} else {
  // Conexão usando variáveis individuais
  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Configuração do banco incompleta. Defina DATABASE_URL ou: ${missing.join(', ')}.`
    );
  }

  pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
    max: 5,
  });
}

pool.on('error', (error) => {
  console.error('Erro inesperado no pool PostgreSQL:', error.message);
});

export { pool };
