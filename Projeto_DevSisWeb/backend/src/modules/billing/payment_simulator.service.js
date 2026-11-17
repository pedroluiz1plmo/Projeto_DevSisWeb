import { randomUUID } from 'node:crypto';
import { pool } from '../../config/database.js';

const fail = (status, message) => ({ status, body: { success: false, message } });
const success = (status, body) => ({ status, body: { success: true, ...body } });

export const isPaymentSimulatorEnabled = () => (
  process.env.NODE_ENV !== 'production'
  && process.env.PAYMENT_SIMULATOR_ENABLED === 'true'
);

const transaction = async (operation) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const createSimulatedCheckout = async (userId, planId) => {
  if (!isPaymentSimulatorEnabled()) return fail(503, 'O simulador de pagamentos está desativado.');
  return transaction(async (client) => {
    const user = await client.query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE FOR UPDATE', [userId]);
    if (!user.rowCount) return fail(404, 'Conta ativa não encontrada.');

    const planResult = await client.query(
      `SELECT id, name, billing_period, price, currency
         FROM plans
        WHERE id = $1 AND status = 'active' AND billing_period IN ('monthly', 'annual')
        FOR SHARE`,
      [planId],
    );
    if (!planResult.rowCount) return fail(404, 'Plano pago ativo não encontrado.');
    const plan = planResult.rows[0];
    if (!plan.price || !plan.currency) return fail(409, 'O plano precisa ter preço e moeda configurados.');

    const active = await client.query(
      `SELECT id FROM subscriptions
        WHERE user_id = $1
          AND (status = 'active' OR (status = 'canceled' AND cancel_at_period_end = TRUE))
          AND (ends_at IS NULL OR ends_at > NOW())
        LIMIT 1`,
      [userId],
    );
    if (active.rowCount) return fail(409, 'Sua conta já possui acesso Premium ativo.');

    const stale = await client.query(
      `SELECT id FROM subscriptions
        WHERE user_id = $1 AND status = 'pending' AND external_provider = 'simulator'
          AND created_at <= NOW() - INTERVAL '30 minutes'
        FOR UPDATE`,
      [userId],
    );
    for (const subscription of stale.rows) {
      await client.query(
        `UPDATE payments SET status = 'canceled', occurred_at = NOW()
          WHERE subscription_id = $1 AND status = 'pending' AND external_provider = 'simulator'`,
        [subscription.id],
      );
      await client.query(
        `UPDATE subscriptions SET status = 'canceled', ends_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'pending'`,
        [subscription.id],
      );
    }

    const pending = await client.query(
      `SELECT id FROM subscriptions
        WHERE user_id = $1 AND status = 'pending' AND external_provider = 'simulator'
        LIMIT 1`,
      [userId],
    );
    if (pending.rowCount) return fail(409, 'Você já possui um pagamento simulado aguardando resultado.');

    const externalPaymentId = `sim_${randomUUID()}`;
    const subscriptionResult = await client.query(
      `INSERT INTO subscriptions
         (user_id, plan_id, plan_name, billing_period, contracted_price, currency,
          status, external_provider, external_subscription_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'simulator', $7)
       RETURNING id, user_id, plan_id, plan_name, billing_period, contracted_price, currency, status, created_at`,
      [userId, plan.id, plan.name, plan.billing_period, plan.price, plan.currency, externalPaymentId],
    );
    const subscription = subscriptionResult.rows[0];
    const paymentResult = await client.query(
      `INSERT INTO payments
         (subscription_id, user_id, external_provider, external_payment_id, status, amount, currency)
       VALUES ($1, $2, 'simulator', $3, 'pending', $4, $5)
       RETURNING id`,
      [subscription.id, userId, externalPaymentId, plan.price, plan.currency],
    );
    return success(201, {
      checkout: {
        subscriptionId: String(subscription.id),
        paymentId: String(paymentResult.rows[0].id),
        planName: plan.name,
        billingPeriod: plan.billing_period,
        amount: plan.price,
        currency: plan.currency,
        mode: 'simulator',
      },
      message: 'Checkout de teste criado. Nenhum pagamento real foi iniciado.',
    });
  });
};

export const completeSimulatedPayment = async (userId, paymentId, outcome) => {
  if (!isPaymentSimulatorEnabled()) return fail(503, 'O simulador de pagamentos está desativado.');
  if (!/^\d+$/.test(String(paymentId))) return fail(400, 'Identificador de pagamento inválido.');
  if (!['approved', 'declined'].includes(outcome)) return fail(400, 'Resultado de simulação inválido.');

  return transaction(async (client) => {
    const paymentResult = await client.query(
      `SELECT payment.*, subscription.status AS subscription_status
         FROM payments payment
         JOIN subscriptions subscription ON subscription.id = payment.subscription_id
        WHERE payment.id = $1 AND payment.user_id = $2
          AND payment.external_provider = 'simulator'
        FOR UPDATE OF payment, subscription`,
      [paymentId, userId],
    );
    if (!paymentResult.rowCount) return fail(404, 'Pagamento simulado não encontrado.');
    const payment = paymentResult.rows[0];
    if (payment.status !== 'pending' || payment.subscription_status !== 'pending') {
      return fail(409, 'Este pagamento simulado já foi finalizado.');
    }

    if (outcome === 'approved') {
      const completed = await client.query(
        `UPDATE payments
            SET status = 'paid', occurred_at = NOW(), paid_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING subscription_id`,
        [paymentId],
      );
      const subscription = await client.query(
        `UPDATE subscriptions
            SET status = 'active', starts_at = NOW(),
                renews_at = NOW() + CASE billing_period
                  WHEN 'annual' THEN INTERVAL '1 year'
                  ELSE INTERVAL '1 month'
                END,
                ends_at = NOW() + CASE billing_period
                  WHEN 'annual' THEN INTERVAL '1 year'
                  ELSE INTERVAL '1 month'
                END,
                updated_at = NOW()
          WHERE id = $1 AND status = 'pending'
          RETURNING id, user_id, plan_id, plan_name, billing_period, contracted_price,
                    currency, status, starts_at, renews_at, ends_at, created_at`,
        [completed.rows[0].subscription_id],
      );
      await client.query(
        `INSERT INTO subscription_history
           (subscription_id, actor_user_id, action, before_data, after_data)
         VALUES ($1, $2, 'simulator_payment_approved', $3::jsonb, $4::jsonb)`,
        [subscription.rows[0].id, userId, JSON.stringify({ status: 'pending' }),
          JSON.stringify({ status: 'active', simulator: true })],
      );
      return success(200, {
        outcome,
        subscriptionId: String(subscription.rows[0].id),
        message: 'Pagamento de teste aprovado. Nenhum dinheiro foi movimentado.',
      });
    }

    await client.query(
      `UPDATE payments SET status = 'failed', occurred_at = NOW()
        WHERE id = $1 AND status = 'pending'`,
      [paymentId],
    );
    await client.query(
      `UPDATE subscriptions
          SET status = 'canceled', ends_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status = 'pending'`,
      [payment.subscription_id],
    );
    await client.query(
      `INSERT INTO subscription_history
         (subscription_id, actor_user_id, action, before_data, after_data)
       VALUES ($1, $2, 'simulator_payment_declined', $3::jsonb, $4::jsonb)`,
      [payment.subscription_id, userId, JSON.stringify({ status: 'pending' }),
        JSON.stringify({ status: 'canceled', simulator: true })],
    );
    return success(200, {
      outcome,
      message: 'Pagamento de teste recusado. Nenhum dinheiro foi movimentado.',
    });
  });
};
