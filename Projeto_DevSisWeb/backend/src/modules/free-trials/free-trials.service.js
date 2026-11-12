import { pool } from '../../config/database.js';

const fail = (status, message) => ({ status, body: { success: false, message } });
const success = (status, body) => ({ status, body: { success: true, ...body } });
const validId = (value) => {
  if (!/^\d+$/.test(String(value))) return false;
  try {
    const id = BigInt(value);
    return id > 0n && id <= 9223372036854775807n;
  } catch {
    return false;
  }
};

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

const trialSnapshot = (row) => row ? ({
  id: String(row.id),
  planId: String(row.plan_id),
  planName: row.plan_name,
  planSlug: row.plan_slug,
  status: row.effective_status ?? row.status,
  activatedAt: row.activated_at,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  remainingSeconds: Math.max(0, Number(row.remaining_seconds ?? 0)),
}) : null;

export const getMyTrial = async (userId) => {
  const [trial, plans, activeSubscription] = await Promise.all([
    pool.query(
      `SELECT trial.id, trial.plan_id, plan.name AS plan_name, plan.slug AS plan_slug,
              trial.status,
              CASE WHEN trial.ends_at <= NOW() THEN 'expired' ELSE trial.status END AS effective_status,
              trial.activated_at, trial.starts_at, trial.ends_at,
              GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (trial.ends_at - NOW()))))::bigint AS remaining_seconds
       FROM free_trials trial
       JOIN plans plan ON plan.id = trial.plan_id
       WHERE trial.user_id = $1`,
      [userId],
    ),
    pool.query(
      `SELECT id, slug, name, description, billing_period, price, currency, benefits, limits
       FROM plans
       WHERE status = 'active' AND billing_period IN ('monthly', 'annual')
       ORDER BY name, billing_period`,
    ),
    pool.query(
      `SELECT 1 FROM subscriptions
       WHERE user_id = $1 AND status = 'active'
         AND (ends_at IS NULL OR ends_at > NOW())
       LIMIT 1`,
      [userId],
    ),
  ]);
  const existingTrial = trial.rows[0] ?? null;
  return success(200, {
    eligible: !existingTrial && !activeSubscription.rowCount && plans.rowCount > 0,
    trial: trialSnapshot(existingTrial),
    premiumPlans: plans.rows.map((plan) => ({
      id: String(plan.id),
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      billingPeriod: plan.billing_period,
      price: plan.price,
      currency: plan.currency,
      benefits: plan.benefits,
      limits: plan.limits,
    })),
    hasActiveSubscription: activeSubscription.rowCount > 0,
  });
};

export const activateMyTrial = async (userId, body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !validId(body.planId)) {
    return fail(400, 'Selecione um plano Premium válido para o período de avaliação.');
  }

  try {
    const trial = await transaction(async (client) => {
      const user = await client.query(
        'SELECT id FROM users WHERE id = $1 AND is_active = TRUE FOR UPDATE',
        [userId],
      );
      if (!user.rowCount) return fail(404, 'Conta ativa não encontrada.');

      const alreadyUsed = await client.query(
        'SELECT id FROM free_trials WHERE user_id = $1',
        [userId],
      );
      if (alreadyUsed.rowCount) {
        return fail(409, 'O período gratuito de 7 dias já foi utilizado nesta conta.');
      }

      const paidSubscription = await client.query(
        `SELECT id FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
           AND (ends_at IS NULL OR ends_at > NOW())
         LIMIT 1`,
        [userId],
      );
      if (paidSubscription.rowCount) {
        return fail(409, 'Sua conta já possui uma assinatura ativa e não é elegível para o teste.');
      }

      const plan = await client.query(
        `SELECT id, slug, name, billing_period
         FROM plans
         WHERE id = $1 AND status = 'active'
           AND billing_period IN ('monthly', 'annual')
         FOR SHARE`,
        [body.planId],
      );
      if (!plan.rowCount) return fail(404, 'Plano Premium ativo não encontrado.');

      const created = await client.query(
        `INSERT INTO free_trials (user_id, plan_id)
         VALUES ($1, $2)
         RETURNING id, plan_id, status, activated_at, starts_at, ends_at,
                   GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (ends_at - NOW()))))::bigint AS remaining_seconds`,
        [userId, body.planId],
      );
      return {
        ...created.rows[0],
        plan_name: plan.rows[0].name,
        plan_slug: plan.rows[0].slug,
      };
    });
    if (trial?.body) return trial;
    return success(201, {
      message: 'Teste Premium ativado por 7 dias. Nenhuma cobrança será feita automaticamente.',
      eligible: false,
      trial: trialSnapshot(trial),
    });
  } catch (error) {
    if (error.code === '23505') {
      return fail(409, 'O período gratuito de 7 dias já foi utilizado nesta conta.');
    }
    throw error;
  }
};

export const listTrialsForAdmin = async () => {
  const [result, summary] = await Promise.all([
    pool.query(
      `SELECT trial.id, trial.user_id, user.name AS user_name, user.username,
              trial.plan_id, plan.name AS plan_name, trial.status,
              trial.activated_at, trial.starts_at, trial.ends_at,
              CASE WHEN trial.ends_at <= NOW() THEN 'expired' ELSE trial.status END AS effective_status,
              EXISTS (
                SELECT 1 FROM subscriptions subscription
                JOIN plans subscribed_plan ON subscribed_plan.id = subscription.plan_id
                WHERE subscription.user_id = trial.user_id
                  AND subscribed_plan.billing_period <> 'free'
                  AND subscription.created_at >= trial.ends_at
              ) AS converted_after_trial
       FROM free_trials trial
       LEFT JOIN users user ON user.id = trial.user_id
       JOIN plans plan ON plan.id = trial.plan_id
       ORDER BY trial.activated_at DESC, trial.id DESC
       LIMIT 500`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE status = 'active' AND starts_at <= NOW() AND ends_at > NOW()
              )::int AS active,
              COUNT(*) FILTER (
                WHERE status = 'expired' OR ends_at <= NOW()
              )::int AS expired,
              COUNT(*) FILTER (
                WHERE ends_at <= NOW() AND EXISTS (
                  SELECT 1 FROM subscriptions subscription
                  JOIN plans subscribed_plan ON subscribed_plan.id = subscription.plan_id
                  WHERE subscription.user_id = free_trials.user_id
                    AND subscribed_plan.billing_period <> 'free'
                    AND subscription.created_at >= free_trials.ends_at
                )
              )::int AS converted_after_trial
       FROM free_trials`,
    ),
  ]);
  const trials = result.rows.map((row) => ({
    id: String(row.id),
    user: {
      id: row.user_id === null ? null : String(row.user_id),
      name: row.user_name ?? 'Conta removida',
      username: row.username ?? '—',
    },
    planId: String(row.plan_id),
    planName: row.plan_name,
    status: row.effective_status,
    activatedAt: row.activated_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    convertedAfterTrial: row.converted_after_trial,
  }));
  const counts = {
    total: summary.rows[0].total,
    active: summary.rows[0].active,
    expired: summary.rows[0].expired,
    convertedAfterTrial: summary.rows[0].converted_after_trial,
  };
  return success(200, { counts, trials });
};
