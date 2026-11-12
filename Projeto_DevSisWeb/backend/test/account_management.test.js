import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/database.js';
import {
  confirmPasswordRecovery,
  register,
  requestPasswordRecovery,
} from '../src/controllers/auth_controller.js';
import { handleUserRoute } from '../src/routes/user_routes.js';
import { createToken } from '../src/services/token_service.js';

describe('gerenciamento de conta', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('envia e-mail de boas-vindas após o cadastro concluído', async () => {
    let insertCallCount = 0;
    pool.query = async (query, values = []) => {
      if (query.includes('SELECT 1 FROM users WHERE email = $1 OR username = $2 LIMIT 1')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.includes('INSERT INTO users')) {
        insertCallCount += 1;
        return {
          rowCount: 1,
          rows: [{ id: 42, name: 'Alice', username: 'alice', email: 'alice@example.test' }],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    let welcomeEmail;
    const result = await register(
      { name: 'Alice', username: 'alice', email: 'alice@example.test', password: 'valid-password' },
      {
        emailConfigured: () => true,
        sendEmail: async ({ email, name }) => {
          welcomeEmail = { email, name };
        },
      },
    );

    assert.equal(insertCallCount, 1);
    assert.deepEqual(welcomeEmail, { email: 'alice@example.test', name: 'Alice' });
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
  });

  it('mantém o cadastro válido quando o envio do e-mail de boas-vindas falha', async () => {
    pool.query = async (query, values = []) => {
      if (query.includes('SELECT 1 FROM users WHERE email = $1 OR username = $2 LIMIT 1')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.includes('INSERT INTO users')) {
        return {
          rowCount: 1,
          rows: [{ id: 42, name: 'Alice', username: 'alice', email: 'alice@example.test' }],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const result = await register(
        { name: 'Alice', username: 'alice', email: 'alice@example.test', password: 'valid-password' },
        {
          emailConfigured: () => true,
          sendEmail: async () => {
            throw Object.assign(new Error('SMTP unavailable.'), { code: 'ECONNRESET' });
          },
        },
      );

      assert.equal(result.status, 201);
      assert.equal(result.body.success, true);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('responde sem revelar se o e-mail possui cadastro', async () => {
    const responses = [];
    pool.query = async (_query, [email]) => ({
      rowCount: email === 'alice@example.test' ? 1 : 0,
      rows: email === 'alice@example.test' ? [{ id: 21 }] : [],
    });
    pool.connect = async () => ({
      query: async (query, values) => {
        responses.push({ query, values });
        if (query.includes('COUNT(*)::int AS count')) {
          return { rowCount: 1, rows: [{ count: 0 }] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });

    const sendEmail = async ({ email, token }) => {
      assert.equal(email, 'alice@example.test');
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    };
    const known = await requestPasswordRecovery(
      { email: 'alice@example.test' },
      { emailConfigured: () => true, sendEmail },
    );
    const unknown = await requestPasswordRecovery(
      { email: 'unknown@example.test' },
      { emailConfigured: () => true, sendEmail },
    );

    assert.deepEqual(known, unknown);
    assert.equal(known.status, 202);
    const insert = responses.find(({ query }) =>
      query.includes('INSERT INTO password_recovery_tokens'));
    assert.ok(insert);
    assert.notEqual(insert.values[1], 'alice@example.test');
    assert.match(insert.values[1], /^[a-f0-9]{64}$/);
  });

  it('não inicia recuperação se o SMTP não estiver configurado', async () => {
    let queried = false;
    pool.query = async () => {
      queried = true;
      return { rowCount: 0, rows: [] };
    };

    const result = await requestPasswordRecovery(
      { email: 'alice@example.test' },
      { emailConfigured: () => false },
    );

    assert.equal(result.status, 503);
    assert.equal(queried, false);
  });

  it('mantém resposta genérica e invalida o código se a entrega falhar', async () => {
    const invalidations = [];
    pool.query = async (query, values = []) => {
      if (query.includes('SELECT id FROM users WHERE email')) {
        const [email] = values;
        return {
          rowCount: email === 'alice@example.test' ? 1 : 0,
          rows: email === 'alice@example.test' ? [{ id: 21 }] : [],
        };
      }
      invalidations.push(query);
      return { rowCount: 1, rows: [] };
    };
    pool.connect = async () => ({
      query: async (query) => query.includes('COUNT(*)::int AS count')
        ? { rowCount: 1, rows: [{ count: 0 }] }
        : { rowCount: 1, rows: [] },
      release: () => {},
    });

    const originalConsoleError = console.error;
    console.error = () => {};
    let deliveryFailure;
    try {
      deliveryFailure = await requestPasswordRecovery(
        { email: 'alice@example.test' },
        {
          emailConfigured: () => true,
          sendEmail: async () => {
            throw Object.assign(new Error('SMTP unavailable.'), {
              code: 'ECONNREFUSED',
            });
          },
        },
      );
    } finally {
      console.error = originalConsoleError;
    }
    const unknownAccount = await requestPasswordRecovery(
      { email: 'unknown@example.test' },
      { emailConfigured: () => true },
    );

    assert.deepEqual(deliveryFailure, unknownAccount);
    assert.ok(
      invalidations.some((query) =>
        query.includes('UPDATE password_recovery_tokens SET used_at')),
    );
  });

  it('armazena senha redefinida com hash e consome o token em transação', async () => {
    const token = randomBytes(32).toString('base64url');
    const queries = [];
    pool.connect = async () => ({
      query: async (query, values = []) => {
        queries.push({ query, values });
        if (query.includes('SELECT recovery.id')) {
          return { rowCount: 1, rows: [{ id: 8, user_id: 21 }] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });

    const result = await confirmPasswordRecovery({
      email: 'alice@example.test',
      token,
      newPassword: 'new-password-123',
    });

    assert.equal(result.status, 200);
    const lookup = queries.find(({ query }) => query.includes('SELECT recovery.id'));
    assert.equal(
      lookup.values[1],
      createHash('sha256').update(token).digest('hex'),
    );
    const passwordUpdate = queries.find(({ query }) =>
      query.includes('UPDATE users SET password_hash'));
    assert.ok(passwordUpdate);
    assert.notEqual(passwordUpdate.values[0], 'new-password-123');
    assert.equal(
      await bcrypt.compare('new-password-123', passwordUpdate.values[0]),
      true,
    );
    assert.ok(queries.some(({ query }) => query === 'COMMIT'));
  });

  it('exclui somente a conta autenticada e exige a senha atual', async () => {
    const passwordHash = await bcrypt.hash('current-password', 4);
    const queries = [];
    let deletionEmail;
    pool.connect = async () => ({
      query: async (query, values = []) => {
        queries.push({ query, values });
        if (query.includes('SELECT name, email, password_hash')) {
          return {
            rowCount: 1,
            rows: [{
              name: 'Alice',
              email: 'alice@example.test',
              password_hash: passwordHash,
            }],
          };
        }
        if (query.includes('AS blocked')) {
          return { rowCount: 1, rows: [{ blocked: false }] };
        }
        if (query.startsWith('DELETE FROM users')) {
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });
    const token = createToken({ id: 21, username: 'alice' });

    const result = await handleUserRoute(
      {
        method: 'DELETE',
        url: '/api/users/me',
        headers: { authorization: `Bearer ${token}` },
      },
      { currentPassword: 'current-password', userId: 99 },
      {
        emailConfigured: () => true,
        sendEmail: async ({ email, name }) => {
          assert.ok(queries.some(({ query }) => query === 'COMMIT'));
          deletionEmail = { email, name };
        },
      },
    );

    assert.equal(result.status, 200);
    const deletion = queries.find(({ query }) =>
      query.startsWith('DELETE FROM users'));
    assert.deepEqual(deletion.values, ['21']);
    assert.deepEqual(deletionEmail, {
      email: 'alice@example.test',
      name: 'Alice',
    });
    assert.equal(
      queries.some(({ query }) => query.includes('userId =')),
      false,
    );
  });

  it('bloqueia exclusão quando existem relações financeiras restritivas', async () => {
    const passwordHash = await bcrypt.hash('current-password', 4);
    let deleted = false;
    let emailSent = false;
    pool.connect = async () => ({
      query: async (query) => {
        if (query.includes('SELECT name, email, password_hash')) {
          return {
            rowCount: 1,
            rows: [{
              name: 'Alice',
              email: 'alice@example.test',
              password_hash: passwordHash,
            }],
          };
        }
        if (query.includes('AS blocked')) {
          return { rowCount: 1, rows: [{ blocked: true }] };
        }
        if (query.startsWith('DELETE FROM users')) deleted = true;
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });

    const result = await handleUserRoute(
      {
        method: 'DELETE',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${createToken({ id: 21, username: 'alice' })}`,
        },
      },
      { currentPassword: 'current-password' },
      {
        emailConfigured: () => true,
        sendEmail: async () => {
          emailSent = true;
        },
      },
    );

    assert.equal(result.status, 409);
    assert.equal(deleted, false);
    assert.equal(emailSent, false);
  });

  it('rejeita senha de reautenticação incorreta sem invalidar a sessão', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    let deleted = false;
    let emailSent = false;
    pool.connect = async () => ({
      query: async (query) => {
        if (query.includes('SELECT name, email, password_hash')) {
          return {
            rowCount: 1,
            rows: [{
              name: 'Alice',
              email: 'alice@example.test',
              password_hash: passwordHash,
            }],
          };
        }
        if (query.startsWith('DELETE FROM users')) deleted = true;
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });

    const result = await handleUserRoute(
      {
        method: 'DELETE',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${createToken({ id: 21, username: 'alice' })}`,
        },
      },
      { currentPassword: 'wrong-password' },
      {
        emailConfigured: () => true,
        sendEmail: async () => {
          emailSent = true;
        },
      },
    );

    assert.equal(result.status, 403);
    assert.equal(deleted, false);
    assert.equal(emailSent, false);
  });

  it('mantém a exclusão confirmada quando o envio do e-mail falha', async () => {
    const passwordHash = await bcrypt.hash('current-password', 4);
    const queries = [];
    const logs = [];
    pool.connect = async () => ({
      query: async (query, values = []) => {
        queries.push({ query, values });
        if (query.includes('SELECT name, email, password_hash')) {
          return {
            rowCount: 1,
            rows: [{
              name: 'Alice',
              email: 'alice@example.test',
              password_hash: passwordHash,
            }],
          };
        }
        if (query.includes('AS blocked')) {
          return { rowCount: 1, rows: [{ blocked: false }] };
        }
        if (query.startsWith('DELETE FROM users')) {
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });
    const originalConsoleError = console.error;
    console.error = (message) => logs.push(message);
    try {
      const result = await handleUserRoute(
        {
          method: 'DELETE',
          url: '/api/users/me',
          headers: {
            authorization: `Bearer ${createToken({ id: 21, username: 'alice' })}`,
          },
        },
        { currentPassword: 'current-password' },
        {
          emailConfigured: () => true,
          sendEmail: async () => {
            assert.ok(queries.some(({ query }) => query === 'COMMIT'));
            throw Object.assign(new Error('private SMTP details'), {
              code: 'ECONNRESET',
            });
          },
        },
      );

      assert.equal(result.status, 200);
      assert.equal(result.body.success, true);
      assert.ok(logs.some((message) => message.includes('ECONNRESET')));
      assert.equal(logs.join(' ').includes('private SMTP details'), false);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('não envia e-mail quando a transação de exclusão não confirma o commit', async () => {
    const passwordHash = await bcrypt.hash('current-password', 4);
    const queries = [];
    let deletionPending = false;
    let commitAttempted = false;
    let emailSent = false;
    pool.connect = async () => ({
      query: async (query, values = []) => {
        queries.push({ query, values });
        if (query.includes('SELECT name, email, password_hash')) {
          return {
            rowCount: 1,
            rows: [{
              name: 'Alice',
              email: 'alice@example.test',
              password_hash: passwordHash,
            }],
          };
        }
        if (query.includes('AS blocked')) {
          return { rowCount: 1, rows: [{ blocked: false }] };
        }
        if (query.startsWith('DELETE FROM users')) {
          deletionPending = true;
          return { rowCount: 1, rows: [] };
        }
        if (query === 'COMMIT') {
          commitAttempted = true;
          throw new Error('commit failed');
        }
        if (query === 'ROLLBACK') {
          deletionPending = false;
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
      release: () => {},
    });

    await assert.rejects(
      handleUserRoute(
        {
          method: 'DELETE',
          url: '/api/users/me',
          headers: {
            authorization: `Bearer ${createToken({ id: 21, username: 'alice' })}`,
          },
        },
        { currentPassword: 'current-password' },
        {
          emailConfigured: () => true,
          sendEmail: async () => {
            emailSent = true;
          },
        },
      ),
      /commit failed/,
    );

    assert.equal(commitAttempted, true);
    assert.equal(deletionPending, false);
    assert.equal(emailSent, false);
    assert.ok(queries.some(({ query }) => query === 'ROLLBACK'));
  });

  it('recusa exclusão sem autenticação', async () => {
    const result = await handleUserRoute(
      {
        method: 'DELETE',
        url: '/api/users/me',
        headers: {},
      },
      { currentPassword: 'current-password' },
    );

    assert.equal(result.status, 401);
  });
});
