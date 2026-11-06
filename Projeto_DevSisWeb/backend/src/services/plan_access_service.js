import { pool } from '../config/database.js';

export const getAdminPermissions = async (userId) => {
  const result = await pool.query(
    'SELECT permission FROM admin_permissions WHERE user_id = $1 ORDER BY permission',
    [userId],
  );
  return result.rows.map((row) => row.permission);
};

export const getPlanAccess = async (userId) => {
  const result = await pool.query(
    `SELECT p.id, p.slug, p.name, p.billing_period, p.benefits, p.limits,
            s.status AS subscription_status
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = $1
        AND s.status = 'active'
        AND (s.ends_at IS NULL OR s.ends_at > NOW())
      ORDER BY s.created_at DESC
      LIMIT 1`,
    [userId],
  );
  if (result.rowCount) {
    const row = result.rows[0];
    return {
      plan: { id: String(row.id), slug: row.slug, name: row.name, billingPeriod: row.billing_period },
      subscriptionStatus: row.subscription_status,
      benefits: row.benefits,
      limits: row.limits,
    };
  }

  const free = await pool.query(
    `SELECT id, slug, name, billing_period, benefits, limits
       FROM plans
      WHERE slug = 'freemium' AND status = 'active'
      LIMIT 1`,
  );
  if (!free.rowCount) throw new Error('O plano Freemium não está ativo. Execute as migrations do Backend.');
  const row = free.rows[0];
  return {
    plan: { id: String(row.id), slug: row.slug, name: row.name, billingPeriod: row.billing_period },
    subscriptionStatus: 'freemium',
    benefits: row.benefits,
    limits: row.limits,
  };
};

export const requirePlanBenefit = async (userId, benefit) => {
  const access = await getPlanAccess(userId);
  if (Object.hasOwn(access.benefits, benefit) && access.benefits[benefit] === false) {
    return { allowed: false, access };
  }
  return { allowed: true, access };
};

const resourceCountQueries = {
  campaigns: 'SELECT COUNT(*)::int AS count FROM campaigns WHERE owner_id = $1',
  characters: 'SELECT COUNT(*)::int AS count FROM characters WHERE user_id = $1',
  monsters: 'SELECT COUNT(*)::int AS count FROM monsters WHERE owner_id = $1',
  notes: 'SELECT COUNT(*)::int AS count FROM notes WHERE owner_id = $1',
  missions: 'SELECT COUNT(*)::int AS count FROM missions WHERE owner_id = $1',
};

export const withPlanResourceLimit = async (userId, resource, createResource) => {
  const countQuery = resourceCountQueries[resource];
  if (!countQuery) throw new Error(`Recurso de plano sem consulta de contagem: ${resource}`);

  const initialAccess = await getPlanAccess(userId);
  if (initialAccess.benefits[resource] === false) {
    return {
      error: {
        status: 403,
        body: { success: false, code: 'PLAN_BENEFIT_REQUIRED', message: `Este recurso não está habilitado no plano ${initialAccess.plan.name}.` },
      },
    };
  }
  const initialLimit = initialAccess.limits[resource];
  if (initialLimit === undefined || initialLimit === null) {
    return { result: await createResource() };
  }

  const lock = await pool.connect();
  const lockKey = `${userId}:${resource}`;
  let locked = false;
  try {
    await lock.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [lockKey]);
    locked = true;
    const access = await getPlanAccess(userId);
    if (access.benefits[resource] === false) {
      return {
        error: {
          status: 403,
          body: { success: false, code: 'PLAN_BENEFIT_REQUIRED', message: `Este recurso não está habilitado no plano ${access.plan.name}.` },
        },
      };
    }
    const limit = access.limits[resource];
    if (limit !== undefined && limit !== null) {
      const count = await pool.query(countQuery, [userId]);
      const used = count.rows[0].count;
      if (used >= limit) {
        return {
          error: {
            status: 403,
            body: {
              success: false,
              code: 'PLAN_LIMIT_REACHED',
              message: `O limite configurado para ${resource} no plano ${access.plan.name} foi atingido.`,
              limit,
              used,
            },
          },
        };
      }
    }
    return { result: await createResource() };
  } finally {
    if (locked) await lock.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [lockKey]);
    lock.release();
  }
};
