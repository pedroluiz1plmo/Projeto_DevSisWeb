import bcrypt from 'bcrypt';
import { pool } from '../config/database.js';
import { createToken } from '../services/token_service.js';

const safeUser = (user) => ({ id: user.id, name: user.name, username: user.username, email: user.email });
const normalize = (value) => value.trim().toLowerCase();
const validPassword = (password) => typeof password === 'string' && password.length >= 8;

export const register = async (body) => {
  const name = body.name?.trim();
  const username = normalize(body.username || '');
  const email = normalize(body.email || '');
  if (!name || !username || !email || !validPassword(body.password)) {
    return { status: 400, body: { success: false, message: 'Informe nome, usuário, e-mail e uma senha com ao menos 8 caracteres.' } };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { status: 400, body: { success: false, message: 'Informe um e-mail válido.' } };
  if (!/^[a-z0-9_.-]{3,50}$/.test(username)) return { status: 400, body: { success: false, message: 'O usuário deve ter entre 3 e 50 caracteres válidos.' } };

  const duplicate = await pool.query('SELECT 1 FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]);
  if (duplicate.rowCount) return { status: 409, body: { success: false, message: 'E-mail ou usuário já cadastrado.' } };

  try {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, username, email',
      [name, username, email, passwordHash],
    );
    const user = result.rows[0];
    return { status: 201, body: { success: true, message: 'Cadastro realizado com sucesso.', user: safeUser(user), token: createToken(user) } };
  } catch (error) {
    if (error.code === '23505') return { status: 409, body: { success: false, message: 'E-mail ou usuário já cadastrado.' } };
    throw error;
  }
};

export const login = async (body) => {
  const identifier = normalize(body.identifier || '');
  if (!identifier || typeof body.password !== 'string') return { status: 400, body: { success: false, message: 'Informe usuário/e-mail e senha.' } };
  const result = await pool.query('SELECT id, name, username, email, password_hash, is_active FROM users WHERE email = $1 OR username = $1 LIMIT 1', [identifier]);
  const user = result.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(body.password, user.password_hash))) {
    return { status: 401, body: { success: false, message: 'Usuário/e-mail ou senha inválidos.' } };
  }
  return { status: 200, body: { success: true, message: 'Login realizado com sucesso.', user: safeUser(user), token: createToken(user) } };
};

export const me = async (token) => {
  const result = await pool.query('SELECT id, name, username, email FROM users WHERE id = $1 AND is_active = TRUE', [token.sub]);
  if (!result.rowCount) return { status: 401, body: { authenticated: false } };
  return { status: 200, body: { authenticated: true, user: safeUser(result.rows[0]) } };
};
