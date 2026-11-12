import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/database.js';
import { buildSubscriptionConfirmationEmail } from '../src/services/email_service.js';
import {
  deliverSubscriptionEmailNotification,
  enqueueSubscriptionEmailNotification,
} from '../src/modules/billing/subscription_notifications.service.js';
import { createToken } from '../src/services/token_service.js';
import { handleAdminRoute } from '../src/modules/admin/admin.routes.js';

describe('notificações de assinatura', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('gera uma mensagem com os dados reais e escapa valores não confiáveis no HTML', () => {
    const message = buildSubscriptionConfirmationEmail({
      name: '<Alice>',
      planName: 'Premium <b>mensal</b>',
      notificationType: 'subscription_confirmed',
      confirmedAt: '2026-01-02T12:30:00.000Z',
      amount: '24.90',
      currency: 'BRL',
      billingPeriod: 'monthly',
      renewsAt: '2026-02-02T12:30:00.000Z',
      status: 'active',
      planUrl: 'https://example.test/#my-plan',
      supportEmail: 'support@example.test',
    });

    assert.equal(message.subject, 'Confirmação da sua assinatura — Digital Master Shield');
    assert.match(message.text, /Premium <b>mensal<\/b>/);
    assert.match(message.text, /R\$\s?24,90/);
    assert.match(message.text, /Próxima renovação:/);
    assert.match(message.html, /&lt;Alice&gt;/);
    assert.match(message.html, /Premium &lt;b&gt;mensal&lt;\/b&gt;/);
    assert.match(message.html, /https:\/\/example\.test\/#my-plan/);
    assert.doesNotMatch(message.html, /<strong><Alice><\/strong>/);
  });

  it('não inventa valor, renovação ou data quando não são conhecidos', () => {
    const message = buildSubscriptionConfirmationEmail({
      name: 'João',
      planName: 'Premium',
      notificationType: 'plan_changed',
      confirmedAt: null,
      amount: null,
      currency: null,
      billingPeriod: 'annual',
      renewsAt: null,
      status: 'active',
    });
    assert.doesNotMatch(message.text, /Valor confirmado:/);
    assert.doesNotMatch(message.text, /Próxima renovação:/);
    assert.doesNotMatch(message.text, /Data da confirmação:/);
    assert.match(message.text, /Período: Anual/);
  });

  it('só enfileira após evento processado e pagamento efetivamente pago', async () => {
    const calls = [];
    const client = {
      query: async (query, values = []) => {
        calls.push({ query, values });
        if (query.includes('FROM payment_provider_events')) return { rowCount: 1, rows: [{}] };
        if (query.includes('FROM payments')) {
          return {
            rowCount: 1,
            rows: [{
              id: '90', amount: '24.90', currency: 'BRL',
              paid_at: '2026-01-02T12:30:00.000Z',
            }],
          };
        }
        if (query.includes('INSERT INTO subscription_email_notifications')) {
          return { rowCount: 1, rows: [{ id: '100' }] };
        }
        throw new Error(`Consulta inesperada: ${query}`);
      },
    };

    const result = await enqueueSubscriptionEmailNotification(client, {
      provider: 'example-provider',
      eventId: 'evt_paid_123',
      subscriptionId: '12',
      paymentId: '90',
      notificationType: 'subscription_confirmed',
    });
    assert.deepEqual(result, { id: '100', created: true });
    assert.equal(calls.length, 3);
    assert.match(calls[0].query, /processing_status = 'processed'/);
    assert.match(calls[1].query, /status = 'paid'/);
    assert.deepEqual(calls[2].values, [
      'example-provider',
      'evt_paid_123',
      '12',
      '90',
      'subscription_confirmed',
      '24.90',
      'BRL',
      '2026-01-02T12:30:00.000Z',
    ]);
  });

  it('não enfileira trial gratuito ou evento de pagamento não validado', async () => {
    let queries = 0;
    const client = {
      query: async () => {
        queries += 1;
        return { rowCount: 0, rows: [] };
      },
    };
    await assert.rejects(
      enqueueSubscriptionEmailNotification(client, {
        provider: 'example-provider',
        eventId: 'trial',
        subscriptionId: '12',
        notificationType: 'trial_activated',
      }),
      /inválido/,
    );
    await assert.rejects(
      enqueueSubscriptionEmailNotification(client, {
        provider: 'example-provider',
        eventId: 'evt_unverified',
        subscriptionId: '12',
        paymentId: '90',
        notificationType: 'subscription_confirmed',
      }),
      /não foi validado/,
    );
    assert.equal(queries, 1);
  });

  it('retorna a notificação já registrada sem criar duplicata para evento repetido', async () => {
    let insertCalled = false;
    const client = {
      query: async (query) => {
        if (query.includes('FROM payment_provider_events')) return { rowCount: 1, rows: [{}] };
        if (query.includes('FROM payments')) {
          return { rowCount: 1, rows: [{ id: '90', amount: '24.90', currency: 'BRL' }] };
        }
        if (query.includes('INSERT INTO subscription_email_notifications')) {
          insertCalled = true;
          return { rowCount: 0, rows: [] };
        }
        if (query.includes('SELECT id FROM subscription_email_notifications')) {
          return { rowCount: 1, rows: [{ id: '100' }] };
        }
        throw new Error(`Consulta inesperada: ${query}`);
      },
    };
    const result = await enqueueSubscriptionEmailNotification(client, {
      provider: 'example-provider',
      eventId: 'evt_paid_123',
      subscriptionId: '12',
      paymentId: '90',
      notificationType: 'subscription_confirmed',
    });
    assert.deepEqual(result, { id: '100', created: false });
    assert.equal(insertCalled, true);
  });

  it('registra falha do SMTP sem desfazer a assinatura e permite retry controlado', async () => {
    const statuses = [];
    let sendCount = 0;
    pool.query = async (query, values = []) => {
      if (query.includes('UPDATE subscription_email_notifications')
        && query.includes("status IN ('pending', 'failed')")) {
        return { rowCount: 1, rows: [{ id: '100' }] };
      }
      if (query.includes('FROM subscription_email_notifications notification')) {
        return {
          rowCount: 1,
          rows: [{
            id: '100',
            email: 'alice@example.test',
            event_data: {
              name: 'Alice', planName: 'Premium', amount: '24.90',
              currency: 'BRL', billingPeriod: 'monthly', status: 'active',
            },
          }],
        };
      }
      if (query.includes("SET status = 'failed'")) {
        statuses.push({ status: 'failed', errorCode: values[1] });
        return { rowCount: 1, rows: [] };
      }
      if (query.includes("SET status = 'sent'")) {
        statuses.push({ status: 'sent' });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Consulta inesperada: ${query}`);
    };

    const failed = await deliverSubscriptionEmailNotification('100', async () => {
      sendCount += 1;
      const error = new Error('SMTP password must not be stored in logs');
      error.code = 'EAUTH';
      throw error;
    });
    assert.equal(failed.status, 200);
    assert.equal(failed.body.delivered, false);
    assert.deepEqual(statuses[0], { status: 'failed', errorCode: 'EAUTH' });
    assert.notEqual(statuses[0].errorCode, 'SMTP password must not be stored in logs');

    const sent = await deliverSubscriptionEmailNotification('100', async (message) => {
      sendCount += 1;
      assert.equal(message.email, 'alice@example.test');
      assert.equal(message.planName, 'Premium');
    });
    assert.equal(sent.body.delivered, true);
    assert.deepEqual(statuses[1], { status: 'sent' });
    assert.equal(sendCount, 2);
  });

  it('não envia novamente um registro já enviado', async () => {
    pool.query = async (query) => {
      if (query.includes("status IN ('pending', 'failed')")) return { rowCount: 0, rows: [] };
      if (query.includes('SELECT status FROM subscription_email_notifications')) {
        return { rowCount: 1, rows: [{ status: 'sent' }] };
      }
      throw new Error(`Consulta inesperada: ${query}`);
    };
    let sends = 0;
    const result = await deliverSubscriptionEmailNotification('100', async () => { sends += 1; });
    assert.equal(result.status, 409);
    assert.equal(sends, 0);
  });

  it('protege retry administrativo com subscriptions.manage', async () => {
    pool.query = async (query) => {
      if (query.includes('SELECT is_active')) return { rowCount: 1, rows: [{ is_active: true }] };
      if (query.includes('FROM admin_permissions')) {
        return { rowCount: 1, rows: [{ permission: 'subscriptions.read' }] };
      }
      throw new Error(`Retry não deveria ser executado: ${query}`);
    };
    const token = createToken({ id: 42, username: 'admin' });
    const result = await handleAdminRoute({
      method: 'POST',
      url: '/api/admin/subscription-notifications/100/retry',
      headers: { authorization: 'Bearer '.concat(token) },
    });
    assert.equal(result.status, 403);
  });
});
