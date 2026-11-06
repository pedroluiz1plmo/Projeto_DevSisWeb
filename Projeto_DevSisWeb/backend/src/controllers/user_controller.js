import bcrypt from 'bcrypt';
import { pool } from '../config/database.js';

const normalize = (value) => value.trim().toLowerCase();
const safeUser = (user) => ({ id: user.id, name: user.name, username: user.username, email: user.email });
const validPassword = (password) => typeof password === 'string' && password.length >= 8;

export const updateProfile = async (userId, body) => {
  const name = body.name?.trim();
  const username = normalize(body.username || '');
  const email = normalize(body.email || '');

  if (!name || !username || !email) {
    return { status: 400, body: { success: false, message: 'Informe nome, usuário e e-mail.' } };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { status: 400, body: { success: false, message: 'Informe um e-mail válido.' } };
  if (!/^[a-z0-9_.-]{3,50}$/.test(username)) return { status: 400, body: { success: false, message: 'O usuário deve ter entre 3 e 50 caracteres válidos.' } };

  const duplicate = await pool.query(
    'SELECT 1 FROM users WHERE (email = $1 OR username = $2) AND id != $3 LIMIT 1',
    [email, username, userId]
  );
  if (duplicate.rowCount) return { status: 409, body: { success: false, message: 'E-mail ou usuário já estão em uso por outra conta.' } };

  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, username = $2, email = $3, updated_at = NOW() WHERE id = $4 AND is_active = TRUE RETURNING id, name, username, email',
      [name, username, email, userId]
    );
    if (!result.rowCount) return { status: 404, body: { success: false, message: 'Usuário não encontrado.' } };
    
    return { status: 200, body: { success: true, message: 'Perfil atualizado com sucesso.', user: safeUser(result.rows[0]) } };
  } catch (error) {
    if (error.code === '23505') return { status: 409, body: { success: false, message: 'E-mail ou usuário já cadastrado.' } };
    throw error;
  }
};

export const updatePassword = async (userId, body) => {
  if (!body.currentPassword || !validPassword(body.newPassword)) {
    return { status: 400, body: { success: false, message: 'Informe a senha atual e uma nova senha com pelo menos 8 caracteres.' } };
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND is_active = TRUE', [userId]);
  if (!result.rowCount) return { status: 404, body: { success: false, message: 'Usuário não encontrado.' } };

  const user = result.rows[0];
  if (!(await bcrypt.compare(body.currentPassword, user.password_hash))) {
    return { status: 401, body: { success: false, message: 'A senha atual está incorreta.' } };
  }

  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);

  return { status: 200, body: { success: true, message: 'Senha alterada com sucesso.' } };
};
