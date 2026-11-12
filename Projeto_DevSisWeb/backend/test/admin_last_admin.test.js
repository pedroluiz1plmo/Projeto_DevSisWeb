import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import {
  changePermission,
  listExpenses,
  listPayments,
  listSubscriptions,
  listUsers,
  setUserActive,
} from '../src/modules/admin/admin.service.js';

describe('preservação de administrador ativo', () => {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;

  afterEach(() => {
    pool.connect = originalConnect;
    pool.query = originalQuery;
  });

  it('impede o bloqueio do último administrador ativo sob lock transacional', async () => {
    const calls = [];
    pool.connect = async () => ({
      query: async (sql) => {
        calls.push(sql);
        if (sql.includes('SELECT id, name, username, email, is_active FROM users')) {
          return { rowCount: 1, rows: [{ id: 7, is_active: true }] };
        }
        if (sql.includes('SELECT 1 FROM admin_permissions')) {
          return { rowCount: 1, rows: [{ '?column?': 1 }] };
        }
        if (sql.includes('COUNT(DISTINCT u.id)')) {
          return { rowCount: 1, rows: [{ total: 1 }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    });

    const result = await setUserActive(9, '7', false);

    assert.equal(result.status, 409);
    assert.match(result.body.message, /último administrador ativo/i);
    assert.ok(calls.indexOf('SELECT pg_advisory_xact_lock(137438, 1)') < calls.findIndex(
      (sql) => sql.includes('SELECT id, name, username, email, is_active FROM users'),
    ));
    assert.equal(calls.some((sql) => sql.includes('UPDATE users SET is_active')), false);
  });

  it('impede revogar a última permissão do último administrador ativo', async () => {
    const calls = [];
    pool.connect = async () => ({
      query: async (sql) => {
        calls.push(sql);
        if (sql.includes('SELECT id, is_active FROM users')) {
          return { rowCount: 1, rows: [{ id: 7, is_active: true }] };
        }
        if (sql.includes('SELECT permission FROM admin_permissions')) {
          return { rowCount: 1, rows: [{ permission: 'users.read' }] };
        }
        if (sql.includes('COUNT(DISTINCT u.id)')) {
          return { rowCount: 1, rows: [{ total: 1 }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    });

    const result = await changePermission(9, '7', 'users.read', false);

    assert.equal(result.status, 409);
    assert.match(result.body.message, /última permissão/i);
    assert.equal(calls.some((sql) => sql.startsWith('DELETE FROM admin_permissions')), false);
  });

  it('permite revogar uma permissão quando outro administrador permanece ativo', async () => {
    const calls = [];
    pool.connect = async () => ({
      query: async (sql) => {
        calls.push(sql);
        if (sql.includes('SELECT id, is_active FROM users')) {
          return { rowCount: 1, rows: [{ id: 7, is_active: true }] };
        }
        if (sql.includes('SELECT permission FROM admin_permissions')) {
          return { rowCount: 1, rows: [{ permission: 'users.read' }] };
        }
        if (sql.includes('COUNT(DISTINCT u.id)')) {
          return { rowCount: 1, rows: [{ total: 2 }] };
        }
        if (sql.startsWith('DELETE FROM admin_permissions')) {
          return { rowCount: 1, rows: [{ user_id: 7 }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    });

    const result = await changePermission(9, '7', 'users.read', false);

    assert.equal(result.status, 200);
    assert.equal(result.body.changed, true);
    assert.ok(calls.some((sql) => sql.includes('INSERT INTO admin_audit_log')));
  });

  it('não registra auditoria quando a permissão já está no estado solicitado', async () => {
    const calls = [];
    pool.connect = async () => ({
      query: async (sql) => {
        calls.push(sql);
        if (sql.includes('SELECT id, is_active FROM users')) {
          return { rowCount: 1, rows: [{ id: 7, is_active: true }] };
        }
        if (sql.includes('SELECT permission FROM admin_permissions')) {
          return { rowCount: 1, rows: [{ permission: 'users.read' }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    });

    const result = await changePermission(9, '7', 'users.read', true);

    assert.equal(result.status, 200);
    assert.equal(result.body.changed, false);
    assert.equal(calls.some((sql) => sql.includes('INSERT INTO admin_audit_log')), false);
  });

  it('inclui permissões na lista de usuários somente para gestores de permissões', async () => {
    const values = [];
    pool.query = async (sql, params) => {
      values.push(params);
      if (sql.includes('COUNT(*)::int AS total FROM users')) {
        return { rowCount: 1, rows: [{ total: 1 }] };
      }
      return {
        rowCount: 1,
        rows: [{
          id: 7,
          name: 'Admin',
          username: 'admin',
          email: 'admin@example.test',
          is_active: true,
          permissions: ['users.read'],
        }],
      };
    };

    const privileged = await listUsers({}, true);
    const readOnly = await listUsers({}, false);

    assert.deepEqual(privileged.body.users[0].permissions, ['users.read']);
    assert.equal(Object.hasOwn(readOnly.body.users[0], 'permissions'), false);
    assert.equal(values[0][3], true);
    assert.equal(values[2][3], false);
  });

  it('aplica filtros validados de pagamento e despesa na consulta', async () => {
    const queries = [];
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      return { rowCount: 0, rows: [] };
    };

    const payments = await listPayments({
      from: '2025-01-01',
      to: '2025-01-31',
      status: 'paid',
      userId: '7',
      currency: 'brl',
    });
    const expenses = await listExpenses({
      from: '2025-01-01',
      to: '2025-01-31',
      status: 'void',
      currency: 'brl',
      search: 'hosting',
    });

    it('retorna o histórico interno existente das assinaturas', async () => {
      pool.query = async () => ({
        rowCount: 1,
        rows: [{
          id: 12,
          user_id: 7,
          plan_id: 3,
          plan_name: 'Plano',
          billing_period: 'monthly',
          contracted_price: '25.00',
          currency: 'BRL',
          status: 'active',
          effective_status: 'active',
          starts_at: '2025-01-01T00:00:00.000Z',
          renews_at: null,
          ends_at: null,
          created_at: '2025-01-01T00:00:00.000Z',
          user_name: 'Admin',
          username: 'admin',
          email: 'admin@example.test',
          plan_slug: 'plano',
          history: [{ action: 'created' }],
        }],
      });

      const result = await listSubscriptions({ status: 'active' });

      assert.equal(result.status, 200);
      assert.deepEqual(result.body.subscriptions[0].history, [
        { action: 'created' },
      ]);
    });

    assert.equal(payments.status, 200);
    assert.deepEqual(queries[0].params, [
      '2025-01-01',
      '2025-01-31',
      'paid',
      '7',
      'BRL',
    ]);
    assert.equal(expenses.status, 200);
    assert.deepEqual(queries[1].params, [
      '2025-01-01',
      '2025-01-31',
      'void',
      'BRL',
      'hosting',
    ]);
    assert.match(queries[1].sql, /description ILIKE/);
    assert.match(queries[1].sql, /category ILIKE/);
  });

  it('rejeita filtros de status ou moeda fora dos contratos', async () => {
    let queries = 0;
    pool.query = async () => {
      queries++;
      return { rowCount: 0, rows: [] };
    };

    assert.equal((await listPayments({ status: 'settled' })).status, 400);
    assert.equal((await listExpenses({ currency: 'BRLx' })).status, 400);
    assert.equal((await listUsers({ status: 'deleted' })).status, 400);
    assert.equal(queries, 0);
  });
});
