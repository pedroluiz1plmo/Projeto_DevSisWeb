import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import { createToken } from '../src/services/token_service.js';
import { handleAdminRoute } from '../src/modules/admin/admin.routes.js';

describe('cancelamento de renovação pelo assinante', () => {
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.connect = originalConnect;
  });

  it('mantém o acesso até o fim do período e registra o cancelamento', async () => {
    const endDate = '2099-01-01T10:00:00.000Z';
    const statements = [];
    pool.connect = async () => ({
      query: async (query, values = []) => {
        statements.push(query);
        if (query.includes('SELECT * FROM subscriptions')) {
          assert.equal(values[0], '17');
          assert.equal(values[1], '42');
          return {
            rowCount: 1,
            rows: [{
              id: '17', user_id: '42', plan_id: '8', status: 'active',
              starts_at: '2098-12-01T10:00:00.000Z', renews_at: endDate,
              ends_at: null, contracted_price: '9.99', currency: 'BRL',
              billing_period: 'monthly', created_at: '2098-12-01T10:00:00.000Z',
              cancel_at_period_end: false,
            }],
          };
        }
        if (query.includes('UPDATE subscriptions')) {
          assert.match(query, /ends_at = CASE/);
          assert.match(query, /starts_at \+ CASE billing_period/);
          assert.match(query, /status IN \('pending', 'active', 'past_due'\)/);
          return {
            rowCount: 1,
            rows: [{
              id: '17', user_id: '42', plan_id: '8', status: 'canceled',
              starts_at: '2098-12-01T10:00:00.000Z', renews_at: endDate,
              ends_at: endDate, contracted_price: '9.99', currency: 'BRL',
              billing_period: 'monthly', created_at: '2098-12-01T10:00:00.000Z',
              cancel_at_period_end: true,
            }],
          };
        }
        if (query.includes('INSERT INTO subscription_history')) {
          assert.equal(values[1], '42');
          assert.equal(values[2], 'cancel_at_period_end');
          return { rowCount: 1, rows: [] };
        }
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'POST',
      url: '/api/subscriptions/17/cancel',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.subscription.status, 'canceled');
    assert.equal(response.body.subscription.cancelAtPeriodEnd, true);
    assert.equal(response.body.subscription.endsAt, endDate);
    assert.equal(statements.some((query) => query.includes("status = 'canceled'")), true);
  });

  it('cancela contratos pendentes e também cancela o pagamento pendente', async () => {
    const updated = [];
    pool.connect = async () => ({
      query: async (query, values = []) => {
        if (query.includes('SELECT * FROM subscriptions')) {
          return {
            rowCount: 1,
            rows: [{
              id: '18', user_id: '42', plan_id: '8', status: 'pending',
              starts_at: null, renews_at: null, ends_at: null,
              contracted_price: '9.99', currency: 'BRL', billing_period: 'monthly',
              created_at: '2098-12-01T10:00:00.000Z', cancel_at_period_end: false,
            }],
          };
        }
        if (query.includes('UPDATE subscriptions')) {
          updated.push('subscription');
          return {
            rowCount: 1,
            rows: [{
              id: '18', user_id: '42', plan_id: '8', status: 'canceled',
              starts_at: null, renews_at: null, ends_at: '2098-12-02T10:00:00.000Z',
              contracted_price: '9.99', currency: 'BRL', billing_period: 'monthly',
              created_at: '2098-12-01T10:00:00.000Z', cancel_at_period_end: false,
            }],
          };
        }
        if (query.includes('UPDATE payments')) {
          assert.equal(values[0], '18');
          updated.push('payment');
          return { rowCount: 1, rows: [] };
        }
        if (query.includes('INSERT INTO subscription_history')) {
          assert.equal(values[2], 'canceled');
          return { rowCount: 1, rows: [] };
        }
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'POST',
      url: '/api/subscriptions/18/cancel',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(updated, ['subscription', 'payment']);
    assert.match(response.body.message, /não haverá novas cobranças/i);
  });

  it('não permite cancelar uma assinatura pertencente a outro usuário', async () => {
    pool.connect = async () => ({
      query: async (query) => {
        if (query.includes('SELECT * FROM subscriptions')) return { rowCount: 0, rows: [] };
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'POST',
      url: '/api/subscriptions/17/cancel',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 404);
  });
});
