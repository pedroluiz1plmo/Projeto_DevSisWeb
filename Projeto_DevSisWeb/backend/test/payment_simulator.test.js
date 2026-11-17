import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import { createToken } from '../src/services/token_service.js';
import { handleAdminRoute } from '../src/modules/admin/admin.routes.js';
import { getReports } from '../src/modules/admin/admin.service.js';

describe('simulador de pagamentos', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSimulatorFlag = process.env.PAYMENT_SIMULATOR_ENABLED;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSimulatorFlag === undefined) delete process.env.PAYMENT_SIMULATOR_ENABLED;
    else process.env.PAYMENT_SIMULATOR_ENABLED = originalSimulatorFlag;
  });

  it('não disponibiliza o simulador em produção mesmo com a opção ativada', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'GET',
      url: '/api/payment-simulator/status',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.enabled, false);
  });

  it('cria checkout e pagamento de teste pendentes sem chamar o provedor real', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    pool.query = async (query) => query.includes('SELECT id, status, billing_period, price, currency FROM plans')
      ? {
        rowCount: 1,
        rows: [{ id: '5', status: 'active', billing_period: 'monthly', price: '10.00', currency: 'BRL' }],
      }
      : (() => { throw new Error(`Consulta inesperada: ${query}`); })();

    pool.connect = async () => ({
      query: async (query, values = []) => {
        if (query.includes('SELECT id FROM users')) return { rowCount: 1, rows: [{ id: '42' }] };
        if (query.includes('FROM plans') && query.includes('FOR SHARE')) {
          return {
            rowCount: 1,
            rows: [{ id: '5', name: 'Premium mensal', billing_period: 'monthly', price: '10.00', currency: 'BRL' }],
          };
        }
        if (query.includes('FROM subscriptions') && query.includes("status = 'active'")) {
          return { rowCount: 0, rows: [] };
        }
        if (query.includes('FROM subscriptions') && query.includes("status = 'pending'")) {
          return { rowCount: 0, rows: [] };
        }
        if (query.includes('INSERT INTO subscriptions')) {
          assert.equal(values[0], '42');
          assert.match(values[6], /^sim_[0-9a-f-]{36}$/);
          return {
            rowCount: 1,
            rows: [{
              id: '77', user_id: '42', plan_id: '5', plan_name: 'Premium mensal',
              billing_period: 'monthly', contracted_price: '10.00', currency: 'BRL',
              status: 'pending', created_at: '2026-01-01T00:00:00.000Z',
            }],
          };
        }
        if (query.includes('INSERT INTO payments')) {
          assert.equal(values[0], '77');
          assert.equal(values[1], '42');
          assert.equal(values[3], '10.00');
          return { rowCount: 1, rows: [{ id: '88' }] };
        }
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'POST',
      url: '/api/subscriptions/checkout',
      headers: { authorization: `Bearer ${token}` },
    }, { planId: '5' });

    assert.equal(response.status, 201);
    assert.equal(response.body.checkout.paymentId, '88');
    assert.equal(response.body.checkout.mode, 'simulator');
    assert.match(response.body.message, /nenhum pagamento real/i);
  });

  it('ativa acesso só após aprovação simulada e rejeita finalização repetida', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    let paymentStatus = 'pending';
    let subscriptionStatus = 'pending';
    pool.connect = async () => ({
      query: async (query) => {
        if (query.includes('SELECT payment.*, subscription.status')) {
          return {
            rowCount: 1,
            rows: [{
              id: '88', subscription_id: '77', user_id: '42', external_provider: 'simulator',
              status: paymentStatus, subscription_status: subscriptionStatus,
            }],
          };
        }
        if (query.includes('UPDATE payments')) {
          paymentStatus = 'paid';
          return { rowCount: 1, rows: [{ subscription_id: '77' }] };
        }
        if (query.includes('UPDATE subscriptions')) {
          subscriptionStatus = 'active';
          assert.match(query, /INTERVAL '1 month'/);
          return {
            rowCount: 1,
            rows: [{
              id: '77', user_id: '42', plan_id: '5', plan_name: 'Premium mensal',
              billing_period: 'monthly', contracted_price: '10.00', currency: 'BRL',
              status: 'active', starts_at: '2026-01-01T00:00:00.000Z',
              renews_at: '2026-02-01T00:00:00.000Z',
              ends_at: '2026-02-01T00:00:00.000Z',
              created_at: '2026-01-01T00:00:00.000Z',
            }],
          };
        }
        if (query.includes('INSERT INTO subscription_history')) return { rowCount: 1, rows: [] };
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const token = createToken({ id: 42, username: 'jogador' });
    const request = {
      method: 'POST',
      url: '/api/payment-simulator/payments/88/complete',
      headers: { authorization: `Bearer ${token}` },
    };
    const approved = await handleAdminRoute(request, { outcome: 'approved' });
    assert.equal(approved.status, 200);
    assert.equal(subscriptionStatus, 'active');
    assert.match(approved.body.message, /nenhum dinheiro foi movimentado/i);

    const repeated = await handleAdminRoute(request, { outcome: 'approved' });
    assert.equal(repeated.status, 409);
  });

  it('marca a assinatura como cancelada quando o teste é recusado', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    const updated = [];
    pool.connect = async () => ({
      query: async (query) => {
        if (query.includes('SELECT payment.*, subscription.status')) {
          return {
            rowCount: 1,
            rows: [{
              id: '88', subscription_id: '77', user_id: '42',
              external_provider: 'simulator', status: 'pending', subscription_status: 'pending',
            }],
          };
        }
        if (query.includes('UPDATE payments')) {
          updated.push('payment_failed');
          return { rowCount: 1, rows: [] };
        }
        if (query.includes('UPDATE subscriptions')) {
          updated.push('subscription_canceled');
          return { rowCount: 1, rows: [] };
        }
        if (query.includes('INSERT INTO subscription_history')) return { rowCount: 1, rows: [] };
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'POST',
      url: '/api/payment-simulator/payments/88/complete',
      headers: { authorization: `Bearer ${token}` },
    }, { outcome: 'declined' });
    assert.equal(response.status, 200);
    assert.deepEqual(updated, ['payment_failed', 'subscription_canceled']);
  });

  it('exclui transações de teste dos relatórios financeiros', async () => {
    process.env.NODE_ENV = 'development';
    const queries = [];
    pool.query = async (query) => {
      queries.push(query);
      return { rowCount: 0, rows: [] };
    };

    const response = await getReports({ from: '2026-01-01', to: '2026-12-31' });
    assert.equal(response.status, 200);
    assert.ok(queries.some((query) => query.includes('FROM payments')
      && query.includes("external_provider IS DISTINCT FROM 'simulator'")));
    assert.ok(queries.some((query) => query.includes('FROM subscriptions')
      && query.includes("external_provider IS DISTINCT FROM 'simulator'")));
  });

  it('recusa operações de simulação quando o recurso não está explicitamente habilitado', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_SIMULATOR_ENABLED = 'false';
    const token = createToken({ id: 42, username: 'jogador' });
    const response = await handleAdminRoute({
      method: 'POST',
      url: '/api/payment-simulator/payments/88/complete',
      headers: { authorization: `Bearer ${token}` },
    }, { outcome: 'approved' });
    assert.equal(response.status, 503);
  });
});
