import bcrypt from 'bcrypt';
import { pool } from '../config/database.js';
import {
  isSmtpConfigured,
  sendAccountDeletionEmail,
} from '../services/email_service.js';

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
    return { status: 403, body: { success: false, message: 'A senha atual está incorreta.' } };
  }

  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);

  return { status: 200, body: { success: true, message: 'Senha alterada com sucesso.' } };
};

export const deleteAccount = async (
  userId,
  body,
  {
    emailConfigured = isSmtpConfigured,
    sendEmail = sendAccountDeletionEmail,
  } = {},
) => {
  if (typeof body.currentPassword !== 'string' || !body.currentPassword) {
    return {
      status: 400,
      body: { success: false, message: 'Informe sua senha atual para excluir a conta.' },
    };
  }

  const client = await pool.connect();
  let transactionStarted = false;
  let account;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const accountResult = await client.query(
      'SELECT name, email, password_hash FROM users WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [userId],
    );
    if (!accountResult.rowCount) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return { status: 404, body: { success: false, message: 'Conta não encontrada.' } };
    }

    account = accountResult.rows[0];
    if (!(await bcrypt.compare(body.currentPassword, account.password_hash))) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return { status: 403, body: { success: false, message: 'A senha atual está incorreta.' } };
    }

    const dependencies = await client.query(
      `SELECT
         EXISTS (SELECT 1 FROM subscriptions WHERE user_id = $1)
         OR EXISTS (SELECT 1 FROM payments WHERE user_id = $1)
         OR EXISTS (SELECT 1 FROM expenses WHERE created_by = $1) AS blocked`,
      [userId],
    );
    if (dependencies.rows[0].blocked) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return {
        status: 409,
        body: {
          success: false,
          message: 'A conta possui registros financeiros associados e não pode ser excluída.',
        },
      };
    }

    const deleted = await client.query(
      'DELETE FROM users WHERE id = $1 AND is_active = TRUE',
      [userId],
    );
    if (!deleted.rowCount) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return { status: 404, body: { success: false, message: 'Conta não encontrada.' } };
    }
    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    if (error.code === '23503') {
      return {
        status: 409,
        body: {
          success: false,
          message: 'A conta possui registros associados e não pode ser excluída.',
        },
      };
    }
    throw error;
  } finally {
    client.release();
  }

  try {
    if (emailConfigured()) {
      await sendEmail({ email: account.email, name: account.name });
    } else {
      console.error('Falha no envio de e-mail de confirmação de exclusão (SMTP não configurado).');
    }
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'unknown';
    console.error(`Falha no envio de e-mail de confirmação de exclusão (${code}).`);
  }

  return {
    status: 200,
    body: { success: true, message: 'Conta excluída permanentemente.' },
  };
};
