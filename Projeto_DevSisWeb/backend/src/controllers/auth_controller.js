import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool } from '../config/database.js';
import { createToken } from '../services/token_service.js';
import { getAdminPermissions, getPlanAccess } from '../services/plan_access_service.js';
import {
  isSmtpConfigured,
  sendPasswordRecoveryEmail,
  sendWelcomeEmail,
} from '../services/email_service.js';

const safeUser = (user) => ({ id: user.id, name: user.name, username: user.username, email: user.email });
const normalize = (value) => value.trim().toLowerCase();
const validPassword = (password) => typeof password === 'string' && password.length >= 8;
const validEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

const recoveryAccepted = {
  status: 202,
  body: {
    success: true,
    message: 'Se houver uma conta ativa com este e-mail, as instruções serão enviadas.',
  },
};

export const register = async (
  body,
  {
    emailConfigured = isSmtpConfigured,
    sendEmail = sendWelcomeEmail,
  } = {},
) => {
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
      'INSERT INTO users (name, username, email, password_hash, last_login_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, username, email',
      [name, username, email, passwordHash],
    );
    const user = result.rows[0];

    if (emailConfigured()) {
      try {
        await sendEmail({ email: user.email, name: user.name });
      } catch (error) {
        const code = typeof error?.code === 'string' ? error.code : 'unknown';
        console.error(`Falha no envio de e-mail de boas-vindas (${code}).`);
      }
    }

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
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  return { status: 200, body: { success: true, message: 'Login realizado com sucesso.', user: safeUser(user), token: createToken(user) } };
};

export const me = async (token) => {
  const result = await pool.query('SELECT id, name, username, email FROM users WHERE id = $1 AND is_active = TRUE', [token.sub]);
  if (!result.rowCount) return { status: 401, body: { authenticated: false } };
  const [adminPermissions, planAccess] = await Promise.all([
    getAdminPermissions(token.sub),
    getPlanAccess(token.sub),
  ]);
  return {
    status: 200,
    body: {
      authenticated: true,
      user: safeUser(result.rows[0]),
      adminPermissions,
      planAccess,
    },
  };
};

export const requestPasswordRecovery = async (
  body,
  {
    emailConfigured = isSmtpConfigured,
    sendEmail = sendPasswordRecoveryEmail,
  } = {},
) => {
  const email = typeof body.email === 'string' ? normalize(body.email) : '';
  if (!validEmail(email)) {
    return { status: 400, body: { success: false, message: 'Informe um e-mail válido.' } };
  }
  if (!emailConfigured()) {
    return {
      status: 503,
      body: {
        success: false,
        message: 'A recuperação de senha está temporariamente indisponível.',
      },
    };
  }

  const userResult = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND is_active = TRUE',
    [email],
  );
  if (!userResult.rowCount) return recoveryAccepted;

  const userId = userResult.rows[0].id;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const activeUser = await client.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [userId],
    );
    if (!activeUser.rowCount) {
      await client.query('ROLLBACK');
      return recoveryAccepted;
    }
    const recentRequests = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM password_recovery_tokens
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '1 hour'`,
      [userId],
    );
    if (recentRequests.rows[0].count >= 3) {
      await client.query('ROLLBACK');
      return recoveryAccepted;
    }
    await client.query(
      'UPDATE password_recovery_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [userId],
    );
    await client.query(
      `INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
      [userId, tokenHash],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  try {
    await sendEmail({ email, token });
  } catch (error) {
    // Keep responses non-enumerating while invalidating a code that was not delivered.
    const tokenFailure = await pool.query(
      'UPDATE password_recovery_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL',
      [tokenHash],
    );
    const code = typeof error?.code === 'string' ? error.code : 'unknown';
    console.error(`Falha no envio de e-mail de recuperação (${code}).`);
    if (!tokenFailure.rowCount) {
      console.error('Não foi possível invalidar um código de recuperação não enviado.');
    }
  }
  return recoveryAccepted;
};

export const confirmPasswordRecovery = async (body) => {
  const email = typeof body.email === 'string' ? normalize(body.email) : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!validEmail(email) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return {
      status: 400,
      body: { success: false, message: 'Código inválido ou expirado.' },
    };
  }
  if (!validPassword(body.newPassword)) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'A nova senha precisa ter ao menos 8 caracteres.',
      },
    };
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT recovery.id, recovery.user_id
       FROM password_recovery_tokens recovery
       JOIN users ON users.id = recovery.user_id
       WHERE users.email = $1
         AND users.is_active = TRUE
         AND recovery.token_hash = $2
         AND recovery.used_at IS NULL
         AND recovery.expires_at > NOW()
         AND recovery.attempts < 5
       FOR UPDATE OF recovery`,
      [email, tokenHash],
    );

    if (!result.rowCount) {
      await client.query(
        `UPDATE password_recovery_tokens recovery
         SET attempts = LEAST(recovery.attempts + 1, 5)
         FROM users
         WHERE users.id = recovery.user_id
           AND users.email = $1
           AND recovery.used_at IS NULL
           AND recovery.expires_at > NOW()
           AND recovery.attempts < 5`,
        [email],
      );
      await client.query('COMMIT');
      return {
        status: 400,
        body: { success: false, message: 'Código inválido ou expirado.' },
      };
    }

    const recovery = result.rows[0];
    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, recovery.user_id],
    );
    await client.query(
      'UPDATE password_recovery_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [recovery.user_id],
    );
    await client.query('COMMIT');
    return {
      status: 200,
      body: { success: true, message: 'Senha redefinida com sucesso.' },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
