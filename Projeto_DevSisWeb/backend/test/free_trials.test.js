import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import { createToken } from '../src/services/token_service.js';
import { getPlanAccess } from '../src/services/plan_access_service.js';
import { activateMyTrial, getMyTrial } from '../src/modules/free-trials/free-trials.service.js';
import { handleAdminRoute } from '../src/modules/admin/admin.routes.js';

describe('avaliação gratuita Premium', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('informa elegibilidade, catálogo e ausência de trial para conta elegível', async () => {
    pool.query = async (query) => {
      if (query.includes('FROM free_trials trial')) return { rowCount: 0, rows: [] };
      if (query.includes("billing_period IN ('monthly', 'annual')")) {
        return {
          rowCount: 1,
          rows: [{
            id: 8, slug: 'premium-monthly', name: 'Premium mensal',
            billing_period: 'monthly', benefits: { campaigns: true }, limits: {},
          }],
        };
      }
      if (query.includes('FROM subscriptions')) return { rowCount: 0, rows: [] };
      throw new Error(`Consulta inesperada: ${query}`);
    };

    const result = await getMyTrial('12');
    assert.equal(result.status, 200);
    assert.equal(result.body.eligible, true);
    assert.equal(result.body.trial, null);
    assert.equal(result.body.premiumPlans[0].id, '8');
  });

  it('ativa o teste de sete dias sem criar assinatura ou pagamento', async () => {
    const statements = [];
    pool.connect = async () => ({
      query: async (query, values = []) => {
        statements.push(query);
        if (query.includes('SELECT id FROM users')) {
          assert.equal(values[0], '42');
          return { rowCount: 1, rows: [{ id: '42' }] };
        }
        if (query.includes('SELECT id FROM free_trials')) return { rowCount: 0, rows: [] };
        if (query.includes('SELECT id FROM subscriptions')) return { rowCount: 0, rows: [] };
        if (query.includes('FROM plans') && query.includes('FOR SHARE')) {
          return { rowCount: 1, rows: [{ id: '8', slug: 'premium-monthly', name: 'Premium mensal' }] };
        }
        if (query.includes('INSERT INTO free_trials')) {
          return {
            rowCount: 1,
            rows: [{
              id: '10', plan_id: '8', status: 'active',
              activated_at: '2025-01-01T10:00:00.000Z',
              starts_at: '2025-01-01T10:00:00.000Z',
              ends_at: '2025-01-08T10:00:00.000Z',
              remaining_seconds: '604800',
            }],
          };
        }
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });

    const result = await activateMyTrial('42', {
      planId: '8',
      user_id: '999',
      endsAt: '9999-12-31T23:59:59.000Z',
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.trial.remainingSeconds, 604800);
    assert.equal(
      new Date(result.body.trial.endsAt).getTime() - new Date(result.body.trial.startsAt).getTime(),
      7 * 24 * 60 * 60 * 1000,
    );
    assert.equal(statements.some((query) => query.includes('INSERT INTO subscriptions')), false);
    assert.equal(statements.some((query) => query.includes('INSERT INTO payments')), false);
  });

  it('impede ativação duplicada e rejeita identificador de plano inválido', async () => {
    pool.connect = async () => ({
      query: async (query) => {
        if (query.includes('SELECT id FROM users')) return { rowCount: 1, rows: [{ id: '42' }] };
        if (query.includes('SELECT id FROM free_trials')) return { rowCount: 1, rows: [{ id: '10' }] };
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });
    const duplicate = await activateMyTrial('42', { planId: '8' });
    assert.equal(duplicate.status, 409);

    const invalid = await activateMyTrial('42', { planId: '1 OR 1=1' });
    assert.equal(invalid.status, 400);
  });

  it('concede os benefícios do plano do trial somente enquanto ends_at está no futuro', async () => {
    pool.query = async (query) => {
      if (query.includes('FROM subscriptions s')) return { rowCount: 0, rows: [] };
      if (query.includes('FROM free_trials trial')) {
        assert.match(query, /trial\.ends_at > NOW\(\)/);
        return {
          rowCount: 1,
          rows: [{
            id: '8', slug: 'premium-monthly', name: 'Premium mensal',
            billing_period: 'monthly', benefits: { campaigns: true },
            limits: { campaigns: null }, ends_at: '2099-01-08T10:00:00.000Z',
          }],
        };
      }
      throw new Error(`Consulta inesperada: ${query}`);
    };

    const access = await getPlanAccess('42');
    assert.equal(access.subscriptionStatus, 'trialing');
    assert.equal(access.plan.slug, 'premium-monthly');
    assert.equal(access.trial.endsAt, '2099-01-08T10:00:00.000Z');
    assert.equal(access.benefits.campaigns, true);
  });

  it('preserva a prioridade de uma assinatura Premium ativa sobre o trial', async () => {
    pool.query = async (query) => {
      if (query.includes('FROM subscriptions s')) {
        return {
          rowCount: 1,
          rows: [{
            id: '9', slug: 'premium-monthly', name: 'Premium ativo',
            billing_period: 'monthly', benefits: { campaigns: true },
            limits: {}, subscription_status: 'active',
          }],
        };
      }
      throw new Error(`Não deveria consultar trial: ${query}`);
    };

    const access = await getPlanAccess('42');
    assert.equal(access.subscriptionStatus, 'active');
    assert.equal(access.plan.name, 'Premium ativo');
  });

  it('retorna ao plano gratuito quando o trial expirou sem assinatura ativa', async () => {
    pool.query = async (query) => {
      if (query.includes('FROM subscriptions s')) return { rowCount: 0, rows: [] };
      if (query.includes('FROM free_trials trial')) {
        assert.match(query, /trial\.ends_at > NOW\(\)/);
        return { rowCount: 0, rows: [] };
      }
      if (query.includes("WHERE slug = 'freemium'")) {
        return {
          rowCount: 1,
          rows: [{
            id: '1', slug: 'freemium', name: 'Freemium',
            billing_period: 'free', benefits: {}, limits: {},
          }],
        };
      }
      throw new Error(`Consulta inesperada: ${query}`);
    };

    const access = await getPlanAccess('42');
    assert.equal(access.plan.slug, 'freemium');
    assert.equal(access.subscriptionStatus, 'freemium');
  });

  it('usa a identidade JWT e ignora IDs de usuário enviados pelo cliente', async () => {
    let authenticatedUserId;
    pool.connect = async () => ({
      query: async (query, values = []) => {
        if (query.includes('SELECT id FROM users')) {
          authenticatedUserId = values[0];
          return { rowCount: 1, rows: [{ id: values[0] }] };
        }
        if (query.includes('SELECT id FROM free_trials')) return { rowCount: 1, rows: [{ id: '10' }] };
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rowCount: 0, rows: [] };
        throw new Error(`Consulta inesperada: ${query}`);
      },
      release: () => {},
    });
    const token = createToken({ id: 42, username: 'jogador' });
    const result = await handleAdminRoute({
      method: 'POST',
      url: '/api/free-trial/activate',
      headers: { authorization: 'Bearer '.concat(token) },
    }, { planId: '8', userId: '999' });
    assert.equal(authenticatedUserId, '42');
    assert.equal(result.status, 409);
  });

  it('protege consultas administrativas pela permissão de leitura de assinaturas', async () => {
    pool.query = async (query) => {
      if (query.includes('SELECT is_active')) return { rowCount: 1, rows: [{ is_active: true }] };
      if (query.includes('FROM admin_permissions')) return { rowCount: 0, rows: [] };
      throw new Error(`Consulta que não deve executar: ${query}`);
    };
    const token = createToken({ id: 42, username: 'usuario' });
    const result = await handleAdminRoute({
      method: 'GET',
      url: '/api/admin/free-trials',
      headers: { authorization: 'Bearer '.concat(token) },
    });
    assert.equal(result.status, 403);
  });
});
