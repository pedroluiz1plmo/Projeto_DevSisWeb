import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import { createToken } from '../src/services/token_service.js';
import { handleAdminRoute } from '../src/modules/admin/admin.routes.js';

describe('cadastro de despesas administrativas', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('cria uma despesa e registra a ação na auditoria', async () => {
    const calls = [];
    pool.query = async (sql) => {
      if (sql.includes('SELECT is_active FROM users')) {
        return { rowCount: 1, rows: [{ is_active: true }] };
      }
      if (sql.includes('SELECT permission FROM admin_permissions')) {
        return { rowCount: 1, rows: [{ permission: 'expenses.manage' }] };
      }
      throw new Error(`Consulta inesperada fora da transação: ${sql}`);
    };
    pool.connect = async () => ({
      query: async (sql, values = []) => {
        calls.push({ sql, values });
        if (sql.includes('INSERT INTO expenses')) {
          return {
            rowCount: 1,
            rows: [{
              id: 21,
              description: 'Hospedagem',
              category: 'Infraestrutura',
              amount: '25.50',
              currency: 'BRL',
              occurred_on: '2026-11-16',
              status: 'paid',
              notes: '',
              created_by: 7,
              created_at: '2026-11-16T12:00:00.000Z',
              updated_at: '2026-11-16T12:00:00.000Z',
            }],
          };
        }
        return { rowCount: 1, rows: [] };
      },
      release() {},
    });

    const token = createToken({ id: 7, username: 'admin' });
    const result = await handleAdminRoute({
      method: 'POST',
      url: '/api/admin/expenses',
      headers: { authorization: `Bearer ${token}` },
    }, {
      description: 'Hospedagem',
      category: 'Infraestrutura',
      amount: '25.5',
      currency: 'BRL',
      occurredOn: '2026-11-16',
      status: 'paid',
      notes: '',
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.expense.id, '21');
    assert.equal(result.body.expense.amount, '25.50');
    assert.ok(calls.some(({ sql }) => sql.includes('INSERT INTO expenses')));
    assert.ok(calls.some(({ sql }) => sql.includes("INSERT INTO admin_audit_log")));
  });

  it('devolve erro de validação claro sem iniciar uma transação', async () => {
    let connected = false;
    pool.query = async (sql) => {
      if (sql.includes('SELECT is_active FROM users')) {
        return { rowCount: 1, rows: [{ is_active: true }] };
      }
      if (sql.includes('SELECT permission FROM admin_permissions')) {
        return { rowCount: 1, rows: [{ permission: 'expenses.manage' }] };
      }
      throw new Error(`Consulta inesperada: ${sql}`);
    };
    pool.connect = async () => {
      connected = true;
      throw new Error('Uma despesa inválida não deve abrir transação.');
    };

    const token = createToken({ id: 7, username: 'admin' });
    const result = await handleAdminRoute({
      method: 'POST',
      url: '/api/admin/expenses',
      headers: { authorization: `Bearer ${token}` },
    }, {
      description: 'Hospedagem',
      category: 'Infraestrutura',
      amount: '25.50',
      currency: '',
      occurredOn: '2026-11-16',
      status: 'paid',
    });

    assert.equal(result.status, 400);
    assert.match(result.body.message, /moeda/i);
    assert.equal(connected, false);
  });
});
