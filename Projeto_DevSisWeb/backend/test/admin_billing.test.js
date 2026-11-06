import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import { createToken } from '../src/services/token_service.js';
import { handleAdminRoute } from '../src/modules/admin/admin.routes.js';
import { getDashboard } from '../src/modules/admin/admin.service.js';
import { withPlanResourceLimit } from '../src/services/plan_access_service.js';

describe('administração e entitlements', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('recusa acesso administrativo sem uma conta autenticada', async () => {
    const result = await handleAdminRoute(
      { method: 'GET', url: '/api/admin/dashboard', headers: {} },
    );
    assert.equal(result.status, 401);
  });

  it('recusa usuário autenticado sem a permissão necessária', async () => {
    pool.query = async (query) => query.includes('SELECT is_active')
      ? { rowCount: 1, rows: [{ is_active: true }] }
      : { rowCount: 0, rows: [] };
    const token = createToken({ id: 33, username: 'jogador' });
    const result = await handleAdminRoute({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(result.status, 403);
  });

  it('expõe o catálogo de permissões somente a quem pode administrar permissões', async () => {
    pool.query = async (query) => {
      if (query.includes('SELECT is_active')) return { rowCount: 1, rows: [{ is_active: true }] };
      return { rowCount: 1, rows: [{ permission: 'admin.permissions.manage' }] };
    };
    const token = createToken({ id: 44, username: 'admin' });
    const result = await handleAdminRoute({
      method: 'GET',
      url: '/api/admin/permissions',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(result.status, 200);
    assert.ok(result.body.permissions.includes('plans.manage'));
    assert.ok(result.body.permissions.includes('systems.manage'));
  });

  it('não cria assinatura pendente nem simula checkout sem provedor configurado', async () => {
    pool.query = async () => ({
      rowCount: 1,
      rows: [{ id: 5, status: 'active', billing_period: 'monthly', price: '10.00', currency: 'BRL' }],
    });
    const result = await (await import('../src/modules/admin/admin.service.js'))
      .requestCheckout('44', '5');
    assert.equal(result.status, 503);
    assert.match(result.body.message, /provedor de pagamento/i);
  });

  it('deixa os recursos Freemium ilimitados quando nenhum limite está configurado', async () => {
    pool.query = async (query) => {
      if (query.includes('FROM subscriptions s')) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [{ id: 1, slug: 'freemium', name: 'Freemium', billing_period: 'free', benefits: {}, limits: {} }],
      };
    };
    let created = false;
    const result = await withPlanResourceLimit('9', 'campaigns', async () => {
      created = true;
      return 'created';
    });
    assert.equal(created, true);
    assert.equal(result.result, 'created');
  });

  it('expõe as jornadas UC, UP, UE, UA e a média de uso de recursos no dashboard', async () => {
    pool.query = async (query) => {
      if (query.includes('SELECT value FROM admin_settings')) {
        return { rowCount: 1, rows: [{ value: '30' }] };
      }
      if (query.includes('FROM users')) {
        return { rowCount: 1, rows: [{ total: 12, enabled: 10, blocked: 2, active: 9, inactive: 1, new_30d: 2 }] };
      }
      if (query.includes('COUNT(DISTINCT aa.user_id) FILTER (WHERE workspace = \'player\')')) {
        return { rowCount: 1, rows: [{ players: 9, masters: 5, freemium_masters: 3, premium_masters: 2 }] };
      }
      if (query.includes('(SELECT COUNT(*)::int FROM campaigns)')) {
        return { rowCount: 1, rows: [{ campaigns: 8, characters: 17, monsters: 5, notes: 9, missions: 6 }] };
      }
      if (query.includes('FROM payments')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.includes("SELECT CASE WHEN status = 'active'")) {
        return { rowCount: 1, rows: [{ status: 'active', count: 4 }] };
      }
      if (query.includes('COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL')) {
        return { rowCount: 1, rows: [{ started: 4, canceled: 1 }] };
      }
      if (query.includes('COUNT(DISTINCT user_id)::int AS ue')) {
        return { rowCount: 1, rows: [{ ue: 4 }] };
      }
      if (query.includes('COUNT(DISTINCT user_id)::int AS ua')) {
        return { rowCount: 1, rows: [{ ua: 2 }] };
      }
      return { rowCount: 0, rows: [] };
    };
    const result = await getDashboard();
    assert.equal(result.status, 200);
    assert.equal(result.body.dashboard.journeys.uc, 9);
    assert.equal(result.body.dashboard.journeys.up, 5);
    assert.equal(result.body.dashboard.journeys.ue, 4);
    assert.equal(result.body.dashboard.journeys.ua, 2);
    assert.equal(result.body.dashboard.resources.total, 45);
    assert.equal(result.body.dashboard.resourceUsage.averagePerUser, 3.75);
  });

  it('impede novas criações quando o limite configurado foi atingido', async () => {
    pool.query = async (query) => {
      if (query.includes('FROM subscriptions s')) {
        return {
          rowCount: 1,
          rows: [{
            id: 2, slug: 'premium-monthly', name: 'Premium', billing_period: 'monthly',
            benefits: {}, limits: { campaigns: 2 }, subscription_status: 'active',
          }],
        };
      }
      if (query.includes('COUNT(*)::int AS count FROM campaigns')) {
        return { rowCount: 1, rows: [{ count: 2 }] };
      }
      throw new Error(`Consulta inesperada no teste: ${query}`);
    };
    pool.connect = async () => ({
      query: async () => ({ rowCount: 0, rows: [] }),
      release: () => {},
    });
    let created = false;
    const result = await withPlanResourceLimit('9', 'campaigns', async () => {
      created = true;
      return 'created';
    });
    assert.equal(created, false);
    assert.equal(result.error.status, 403);
    assert.equal(result.error.body.code, 'PLAN_LIMIT_REACHED');
    assert.equal(result.error.body.used, 2);
  });
});
