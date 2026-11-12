import { pool } from '../../config/database.js';
import { createCheckoutSession, PaymentProviderNotConfiguredError } from '../billing/payment_provider.js';

const PERMISSIONS = new Set([
  'dashboard.read',
  'users.read', 'users.manage',
  'plans.read', 'plans.manage',
  'subscriptions.read', 'subscriptions.manage',
  'systems.read', 'systems.manage',
  'payments.read',
  'expenses.read', 'expenses.manage',
  'reports.read',
  'settings.manage',
  'admin.permissions.manage',
  'admin.audit.read',
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value) => /^\d+$/.test(String(value));
const currencyPattern = /^[A-Z]{3}$/;
const fail = (status, message) => ({ status, body: { success: false, message } });
const success = (status, body) => ({ status, body: { success: true, ...body } });
const safeJsonObject = (value) => isObject(value) && Buffer.byteLength(JSON.stringify(value), 'utf8') <= 50000;
const validMoneyAmount = (value, { minimum = 0, exclusive = false } = {}) => (
  (typeof value === 'string' || typeof value === 'number')
  && /^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))
  && Number.isFinite(Number(value))
  && (exclusive ? Number(value) > minimum : Number(value) >= minimum)
  && Number(value) <= 9999999999.99
);
const decimalCents = (value) => {
  const match = String(value ?? '0').match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`Valor monetário inválido retornado pelo banco: ${value}`);
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0'));
  return match[1] ? -cents : cents;
};
const formatCents = (value) => {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
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

const lockAdminRoster = (client) => (
  client.query('SELECT pg_advisory_xact_lock(137438, 1)')
);

const activeAdminCount = async (client) => {
  const result = await client.query(
    `SELECT COUNT(DISTINCT u.id)::int AS total
       FROM users u
       JOIN admin_permissions p ON p.user_id = u.id
      WHERE u.is_active = TRUE`,
  );
  return result.rows[0].total;
};

const audit = (client, actorId, action, entityType, entityId, beforeData, afterData, metadata = {}) => (
  client.query(
    `INSERT INTO admin_audit_log
       (actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [
      actorId,
      action,
      entityType,
      entityId === null ? null : String(entityId),
      beforeData === null ? null : JSON.stringify(beforeData),
      afterData === null ? null : JSON.stringify(afterData),
      JSON.stringify(metadata),
    ],
  )
);

const subscriptionSnapshot = (row) => ({
  id: String(row.id),
  userId: String(row.user_id),
  planId: String(row.plan_id),
  planName: row.plan_name,
  billingPeriod: row.billing_period,
  contractedPrice: row.contracted_price,
  currency: row.currency,
  status: row.status,
  startsAt: row.starts_at,
  renewsAt: row.renews_at,
  endsAt: row.ends_at,
  createdAt: row.created_at,
});

const validatePlan = (body, current = null) => {
  const billingPeriod = body.billingPeriod ?? current?.billing_period;
  const status = body.status ?? current?.status ?? 'draft';
  const name = body.name ?? current?.name;
  const description = body.description ?? current?.description ?? '';
  const price = body.price === undefined ? current?.price : body.price;
  const currency = body.currency === undefined ? current?.currency : body.currency;
  const benefits = body.benefits === undefined ? current?.benefits ?? {} : body.benefits;
  const limits = body.limits === undefined ? current?.limits ?? {} : body.limits;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    return { error: 'Informe o nome do plano (até 120 caracteres).' };
  }
  if (typeof description !== 'string' || description.length > 2000) {
    return { error: 'A descrição do plano deve ter até 2.000 caracteres.' };
  }
  if (!['monthly', 'annual', 'free'].includes(billingPeriod) || !['draft', 'active', 'inactive'].includes(status)) {
    return { error: 'Periodicidade ou status do plano inválido.' };
  }
  if (billingPeriod === 'free') {
    if (price !== null && Number(price) !== 0) return { error: 'O plano gratuito deve ter preço zero.' };
    if (currency) return { error: 'O plano gratuito não deve ter moeda de cobrança.' };
  } else if (price !== null && price !== undefined && !validMoneyAmount(price, { minimum: 0, exclusive: true })) {
    return { error: 'O preço do plano pago deve ser maior que zero.' };
  }
  if (billingPeriod !== 'free' && currency !== null && currency !== undefined
    && (typeof currency !== 'string' || !currencyPattern.test(currency))) {
    return { error: 'Informe a moeda em formato ISO de três letras, por exemplo BRL ou USD.' };
  }
  if (status === 'active' && billingPeriod !== 'free'
    && (!validMoneyAmount(price, { minimum: 0, exclusive: true })
      || typeof currency !== 'string' || !currencyPattern.test(currency))) {
    return { error: 'Configure preço maior que zero e moeda antes de ativar um plano pago.' };
  }
  if (!safeJsonObject(benefits) || Object.values(benefits).some((value) => typeof value !== 'boolean')) {
    return { error: 'Benefícios devem ser um objeto de opções booleanas com até 50 KB.' };
  }
  if (!safeJsonObject(limits) || Object.values(limits).some((value) => (
    value !== null && (!Number.isSafeInteger(value) || value < 0)
  ))) {
    return { error: 'Limites devem ser um objeto de quantidades inteiras não negativas ou null (ilimitado).' };
  }
  return {
    value: {
      name: name.trim(),
      description: description.trim(),
      billingPeriod,
      status,
      price: billingPeriod === 'free' ? 0 : (price === '' || price === undefined ? null : price),
      currency: billingPeriod === 'free' ? null : (currency || null),
      benefits,
      limits,
    },
  };
};

const slugify = (value) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const serializePlan = (row) => ({
  id: String(row.id),
  slug: row.slug,
  name: row.name,
  description: row.description,
  billingPeriod: row.billing_period,
  status: row.status,
  price: row.price,
  currency: row.currency,
  benefits: row.benefits,
  limits: row.limits,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const dateRange = (query = {}) => {
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const from = query.from || defaultFrom;
  const to = query.to || defaultTo;
  if (!validateDate(from) || !validateDate(to) || from > to) return null;
  return { from, to };
};

export const permissionExists = (permission) => PERMISSIONS.has(permission);
export const listPermissions = () => [...PERMISSIONS].sort();

export const getAdminIdentity = async (userId) => {
  const [user, permissions] = await Promise.all([
    pool.query('SELECT id, name, username, email FROM users WHERE id = $1 AND is_active = TRUE', [userId]),
    pool.query('SELECT permission FROM admin_permissions WHERE user_id = $1 ORDER BY permission', [userId]),
  ]);
  if (!user.rowCount) return null;
  return {
    user: user.rows[0],
    permissions: permissions.rows.map((row) => row.permission),
  };
};

export const getDashboard = async () => {
  const settings = await pool.query(`SELECT value FROM admin_settings WHERE setting_key = 'active_user_window_days'`);
  const windowDays = Number(settings.rows[0]?.value ?? 30);
  const [users, workspaces, resources, revenue, subscriptions, cancellation, systems, activePlanUsers, adminUsers] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE is_active)::int AS enabled,
              COUNT(*) FILTER (WHERE NOT is_active)::int AS blocked,
              COUNT(*) FILTER (WHERE is_active AND last_login_at >= NOW() - ($1::text || ' days')::interval)::int AS active,
              COUNT(*) FILTER (WHERE is_active AND (last_login_at IS NULL OR last_login_at < NOW() - ($1::text || ' days')::interval))::int AS inactive,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d
         FROM users`,
      [windowDays],
    ),
    pool.query(
      `WITH activity AS (
         SELECT user_id, 'player'::text AS workspace FROM characters WHERE workspace_type = 'player'
         UNION SELECT owner_id, 'player' FROM campaigns WHERE workspace_type = 'player'
         UNION SELECT owner_id, workspace_type FROM notes
         UNION SELECT owner_id, workspace_type FROM missions
         UNION SELECT user_id, 'master' FROM characters WHERE workspace_type = 'master'
         UNION SELECT owner_id, 'master' FROM campaigns WHERE workspace_type = 'master'
         UNION SELECT owner_id, 'master' FROM monsters
       ), members AS (
         SELECT user_id, 'player'::text AS workspace FROM campaign_members WHERE workspace_type = 'player'
         UNION SELECT user_id, 'master' FROM campaign_members WHERE workspace_type = 'master'
       ), all_activity AS (SELECT * FROM activity UNION SELECT * FROM members)
       SELECT COUNT(DISTINCT aa.user_id) FILTER (WHERE workspace = 'player')::int AS players,
              COUNT(DISTINCT aa.user_id) FILTER (WHERE workspace = 'master')::int AS masters,
              COUNT(DISTINCT aa.user_id) FILTER (WHERE workspace = 'master' AND COALESCE(p.billing_period, 'free') = 'free')::int AS freemium_masters,
              COUNT(DISTINCT aa.user_id) FILTER (WHERE workspace = 'master' AND p.billing_period IN ('monthly', 'annual'))::int AS premium_masters
         FROM all_activity aa
         LEFT JOIN subscriptions s ON s.user_id = aa.user_id AND s.status = 'active'
           AND (s.ends_at IS NULL OR s.ends_at > NOW())
         LEFT JOIN plans p ON p.id = s.plan_id`,
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM campaigns) AS campaigns,
         (SELECT COUNT(*)::int FROM characters) AS characters,
         (SELECT COUNT(*)::int FROM monsters) AS monsters,
         (SELECT COUNT(*)::int FROM notes) AS notes,
         (SELECT COUNT(*)::int FROM missions) AS missions`,
    ),
    pool.query(
      `SELECT currency,
              SUM(amount) FILTER (WHERE status = 'paid')::numeric AS gross,
              SUM(refunded_amount)::numeric AS refunds,
              SUM(provider_fee) FILTER (WHERE status = 'paid')::numeric AS fees,
              SUM(amount) FILTER (WHERE status = 'pending')::numeric AS pending,
              COUNT(*) FILTER (WHERE status = 'paid')::int AS transaction_count
         FROM payments
        GROUP BY currency
        ORDER BY currency`,
    ),
    pool.query(
      `SELECT CASE WHEN status = 'active' AND ends_at IS NOT NULL AND ends_at <= NOW()
                   THEN 'expired' ELSE status END AS status,
              COUNT(*)::int AS count
         FROM subscriptions
        GROUP BY 1
        ORDER BY 1`,
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS started,
              COUNT(*) FILTER (WHERE status = 'canceled' AND created_at >= NOW() - INTERVAL '30 days')::int AS canceled
         FROM subscriptions`,
    ),
    pool.query(
      `SELECT name, SUM(count)::int AS usage
         FROM (
           SELECT s.name, COUNT(c.id)::int AS count
             FROM characters c JOIN systems s ON s.id = c.system_id
            GROUP BY s.name
           UNION ALL
           SELECT s.name, COUNT(m.id)::int
             FROM monsters m JOIN systems s ON s.id = m.system_id
            GROUP BY s.name
         ) usage_by_system
        GROUP BY name ORDER BY name`,
    ),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS ue
         FROM subscriptions
        WHERE status = 'active'
          AND (ends_at IS NULL OR ends_at > NOW())`,
    ),
    pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS ua
         FROM admin_permissions`,
    ),
  ]);
  const expenseResult = await pool.query(
    `SELECT currency, SUM(amount)::numeric AS total
       FROM expenses
      WHERE status = 'paid'
      GROUP BY currency
      ORDER BY currency`,
  );
  const expensesByCurrency = Object.fromEntries(expenseResult.rows.map((row) => [row.currency, row.total]));
  const revenueByCurrency = new Map(revenue.rows.map((row) => [row.currency, row]));
  const resourceSummary = resources.rows[0] || {};
  const totalResourceCount = Object.values(resourceSummary).reduce((total, value) => total + Number(value || 0), 0);
  const journeyMetrics = {
    uc: Number(workspaces.rows[0]?.players ?? 0),
    up: Number(workspaces.rows[0]?.masters ?? 0),
    ue: Number(activePlanUsers.rows[0]?.ue ?? 0),
    ua: Number(adminUsers.rows[0]?.ua ?? 0),
  };
  const financials = [...new Set([...revenueByCurrency.keys(), ...Object.keys(expensesByCurrency)])].sort().map((currency) => {
    const row = revenueByCurrency.get(currency) || {};
    const gross = row.gross || '0';
    const refunds = row.refunds || '0';
    const fees = row.fees || '0';
    const paidExpenses = expensesByCurrency[currency] || '0';
    return {
      currency,
      gross,
      refunds,
      providerFees: fees,
      pending: row.pending || '0',
      paidExpenses,
      net: formatCents(decimalCents(gross) - decimalCents(refunds) - decimalCents(fees) - decimalCents(paidExpenses)),
      averageTicket: row.transaction_count
        ? formatCents((decimalCents(gross) + BigInt(row.transaction_count) / 2n) / BigInt(row.transaction_count))
        : '0.00',
      paidTransactions: row.transaction_count || 0,
    };
  });
  return success(200, {
    dashboard: {
      activityWindowDays: windowDays,
      users: users.rows[0],
      workspaces: workspaces.rows[0],
      journeys: journeyMetrics,
      resources: {
        ...resourceSummary,
        total: totalResourceCount,
      },
      resourceUsage: {
        total: totalResourceCount,
        averagePerUser: users.rows[0]?.total ? Number((totalResourceCount / Number(users.rows[0].total)).toFixed(2)) : 0,
      },
      subscriptions: subscriptions.rows,
      subscriptionMetrics: {
        started30d: cancellation.rows[0].started,
        canceled30d: cancellation.rows[0].canceled,
        cancellationRatePercent: cancellation.rows[0].started
          ? Number(((cancellation.rows[0].canceled / cancellation.rows[0].started) * 100).toFixed(2))
          : 0,
      },
      financials,
      systemsUsage: systems.rows,
    },
  });
};

export const listUsers = async (query = {}, includePermissions = false) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  const offset = (page - 1) * limit;
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
  const status = typeof query.status === 'string' ? query.status : '';
  if (status && !['active', 'blocked'].includes(status)) {
    return fail(400, 'Filtro de situação de usuário inválido.');
  }
  const result = await pool.query(
    `SELECT u.id, u.name, u.username, u.email, u.is_active, u.created_at, u.last_login_at,
            EXISTS (SELECT 1 FROM characters c WHERE c.user_id = u.id AND c.workspace_type = 'player')
              OR EXISTS (SELECT 1 FROM campaigns c WHERE c.owner_id = u.id AND c.workspace_type = 'player') AS player_workspace,
            EXISTS (SELECT 1 FROM campaigns c WHERE c.owner_id = u.id AND c.workspace_type = 'master')
              OR EXISTS (SELECT 1 FROM characters c WHERE c.user_id = u.id AND c.workspace_type = 'master') AS master_workspace,
            CASE WHEN $4::boolean THEN ARRAY(
              SELECT permission FROM admin_permissions p WHERE p.user_id = u.id ORDER BY permission
            ) ELSE ARRAY[]::varchar[] END AS permissions
       FROM users u
      WHERE ($1 = '' OR u.name ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
        AND ($5 = '' OR u.is_active = ($5 = 'active'))
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT $2 OFFSET $3`,
    [search, limit, offset, includePermissions, status],
  );
  const total = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users
      WHERE ($1 = '' OR name ILIKE '%' || $1 || '%' OR username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
        AND ($2 = '' OR is_active = ($2 = 'active'))`,
    [search, status],
  );
  return success(200, {
    users: result.rows.map((row) => ({
      id: String(row.id), name: row.name, username: row.username, email: row.email,
      isActive: row.is_active, createdAt: row.created_at, lastLoginAt: row.last_login_at,
      playerWorkspace: row.player_workspace, masterWorkspace: row.master_workspace,
      ...(includePermissions ? { permissions: row.permissions } : {}),
    })),
    page,
    limit,
    total: total.rows[0].total,
  });
};

export const setUserActive = async (actorId, userId, isActive) => {
  if (!validId(userId) || typeof isActive !== 'boolean') return fail(400, 'Identificador ou status de usuário inválido.');
  if (String(actorId) === String(userId) && !isActive) return fail(400, 'Não é possível bloquear a própria conta ADM.');
  const result = await transaction(async (client) => {
    await lockAdminRoster(client);
    const before = await client.query(
      'SELECT id, name, username, email, is_active FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!before.rowCount) return fail(404, 'Usuário não encontrado.');
    if (before.rows[0].is_active && !isActive) {
      const targetAdmin = await client.query(
        'SELECT 1 FROM admin_permissions WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      if (targetAdmin.rowCount && await activeAdminCount(client) <= 1) {
        return fail(409, 'Não é possível bloquear o último administrador ativo.');
      }
    }
    if (before.rows[0].is_active === isActive) {
      return success(200, { user: { id: String(userId), isActive }, changed: false });
    }
    const updated = await client.query(
      'UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING id, name, username, email, is_active',
      [userId, isActive],
    );
    await audit(client, actorId, isActive ? 'user.unblocked' : 'user.blocked', 'user', userId, before.rows[0], updated.rows[0]);
    return success(200, { user: { id: String(userId), isActive }, changed: true });
  });
  return result;
};

export const listPlans = async () => {
  const result = await pool.query('SELECT * FROM plans ORDER BY billing_period, name, id');
  return success(200, { plans: result.rows.map(serializePlan) });
};

const systemSnapshot = (row) => ({
  id: String(row.id),
  name: row.name,
  slug: row.slug,
  description: row.description || '',
  isActive: row.is_active,
  versions: row.versions || [],
});

export const listSystems = async () => {
  const result = await pool.query(
    `SELECT s.id, s.name, s.slug, s.description, s.is_active,
            COALESCE(
              jsonb_agg(jsonb_build_object(
                'id', v.id, 'name', v.name, 'slug', v.slug, 'description', COALESCE(v.description, '')
              ) ORDER BY v.name) FILTER (WHERE v.id IS NOT NULL),
              '[]'::jsonb
            ) AS versions
       FROM systems s
       LEFT JOIN system_versions v ON v.system_id = s.id
      GROUP BY s.id
      ORDER BY s.name`,
  );
  return success(200, { systems: result.rows.map(systemSnapshot) });
};

const validateSystem = (body = {}) => {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
    return 'Informe o nome do sistema (até 120 caracteres).';
  }
  if (typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || body.slug.length > 120) {
    return 'Informe um slug válido usando letras minúsculas, números e hífens.';
  }
  if (typeof (body.description ?? '') !== 'string' || (body.description ?? '').length > 2000) {
    return 'A descrição do sistema deve ter até 2.000 caracteres.';
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') return 'Status do sistema inválido.';
  return null;
};

export const saveSystem = async (actorId, systemId, body = {}) => {
  const validation = validateSystem(body);
  if (validation) return fail(400, validation);
  return transaction(async (client) => {
    if (systemId === null) {
      const inserted = await client.query(
        `INSERT INTO systems (name, slug, description, is_active)
         VALUES ($1, $2, $3, COALESCE($4, TRUE)) RETURNING *`,
        [body.name.trim(), body.slug, body.description ?? '', body.isActive],
      );
      const after = systemSnapshot(inserted.rows[0]);
      await audit(client, actorId, 'system.created', 'system', after.id, null, after);
      return success(201, { system: after });
    }
    if (!validId(systemId)) return fail(400, 'Identificador de sistema inválido.');
    const current = await client.query('SELECT * FROM systems WHERE id = $1 FOR UPDATE', [systemId]);
    if (!current.rowCount) return fail(404, 'Sistema não encontrado.');
    const updated = await client.query(
      `UPDATE systems
          SET name = $2, slug = $3, description = $4, is_active = COALESCE($5, is_active), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [systemId, body.name.trim(), body.slug, body.description ?? '', body.isActive],
    );
    const before = systemSnapshot(current.rows[0]);
    const after = systemSnapshot(updated.rows[0]);
    await audit(client, actorId, 'system.updated', 'system', systemId, before, after);
    return success(200, { system: after });
  }).catch((error) => {
    if (error.code === '23505') return fail(409, 'Já existe um sistema com esse nome ou slug.');
    throw error;
  });
};

export const saveSystemVersion = async (actorId, systemId, versionId, body = {}) => {
  if (!validId(systemId)) return fail(400, 'Identificador de sistema inválido.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120
    || typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)
    || body.slug.length > 120
    || typeof (body.description ?? '') !== 'string' || (body.description ?? '').length > 2000) {
    return fail(400, 'Informe nome, slug e descrição válidos para a versão.');
  }
  return transaction(async (client) => {
    const system = await client.query('SELECT id FROM systems WHERE id = $1 FOR UPDATE', [systemId]);
    if (!system.rowCount) return fail(404, 'Sistema não encontrado.');
    let updated;
    let before = null;
    if (versionId === null) {
      updated = await client.query(
        `INSERT INTO system_versions (system_id, name, slug, description)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [systemId, body.name.trim(), body.slug, body.description ?? ''],
      );
    } else {
      if (!validId(versionId)) return fail(400, 'Identificador de versão inválido.');
      const current = await client.query(
        'SELECT * FROM system_versions WHERE id = $1 AND system_id = $2 FOR UPDATE',
        [versionId, systemId],
      );
      if (!current.rowCount) return fail(404, 'Versão do sistema não encontrada.');
      before = current.rows[0];
      updated = await client.query(
        `UPDATE system_versions
            SET name = $3, slug = $4, description = $5, updated_at = NOW()
          WHERE id = $1 AND system_id = $2 RETURNING *`,
        [versionId, systemId, body.name.trim(), body.slug, body.description ?? ''],
      );
    }
    const after = updated.rows[0];
    await audit(client, actorId, versionId === null ? 'system_version.created' : 'system_version.updated',
      'system_version', after.id,
      before ? { id: String(before.id), name: before.name, slug: before.slug, description: before.description } : null,
      { id: String(after.id), systemId: String(systemId), name: after.name, slug: after.slug, description: after.description });
    return success(versionId === null ? 201 : 200, {
      version: { id: String(after.id), systemId: String(after.system_id), name: after.name, slug: after.slug, description: after.description },
    });
  }).catch((error) => {
    if (error.code === '23505') return fail(409, 'Já existe essa versão no sistema.');
    throw error;
  });
};

export const createPlan = async (actorId, body = {}) => {
  const candidate = validatePlan(body);
  if (candidate.error) return fail(400, candidate.error);
  const { value } = candidate;
  if (value.billingPeriod === 'free') return fail(400, 'O plano Freemium inicial é o único plano gratuito.');
  const customSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const suffix = value.billingPeriod === 'monthly' ? 'mensal' : 'anual';
  const slug = customSlug || `${slugify(value.name)}-${suffix}`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return fail(400, 'Slug do plano inválido.');
  return transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO plans (slug, name, description, billing_period, status, price, currency, benefits, limits)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
       RETURNING *`,
      [slug, value.name, value.description, value.billingPeriod, value.status, value.price, value.currency,
        JSON.stringify(value.benefits), JSON.stringify(value.limits)],
    );
    const plan = serializePlan(inserted.rows[0]);
    await audit(client, actorId, 'plan.created', 'plan', plan.id, null, plan);
    return success(201, { plan });
  }).catch((error) => {
    if (error.code === '23505') return fail(409, 'Já existe um plano com esse slug.');
    throw error;
  });
};

export const updatePlan = async (actorId, planId, body = {}) => {
  if (!validId(planId)) return fail(400, 'Identificador de plano inválido.');
  const existing = await pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
  if (!existing.rowCount) return fail(404, 'Plano não encontrado.');
  const current = existing.rows[0];
  if (current.slug === 'freemium' && (body.status === 'inactive' || body.billingPeriod === 'monthly' || body.billingPeriod === 'annual')) {
    return fail(400, 'O plano Freemium padrão não pode ser desativado nem convertido em plano pago.');
  }
  const candidate = validatePlan(body, current);
  if (candidate.error) return fail(400, candidate.error);
  const { value } = candidate;
  return transaction(async (client) => {
    const updated = await client.query(
      `UPDATE plans
          SET name = $2, description = $3, billing_period = $4, status = $5, price = $6,
              currency = $7, benefits = $8::jsonb, limits = $9::jsonb, updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [planId, value.name, value.description, value.billingPeriod, value.status, value.price, value.currency,
        JSON.stringify(value.benefits), JSON.stringify(value.limits)],
    );
    const plan = serializePlan(updated.rows[0]);
    await audit(client, actorId, 'plan.updated', 'plan', planId, serializePlan(current), plan);
    return success(200, { plan });
  });
};

const serializeSubscription = (row) => ({
  ...subscriptionSnapshot(row),
  status: row.effective_status ?? row.status,
  user: { id: String(row.user_id), name: row.user_name, username: row.username, email: row.email },
  planSlug: row.plan_slug,
  history: row.history ?? [],
});

export const listSubscriptions = async (query = {}) => {
  const status = typeof query.status === 'string' ? query.status : '';
  if (status && !['pending', 'active', 'past_due', 'canceled', 'expired'].includes(status)) return fail(400, 'Filtro de assinatura inválido.');
  const result = await pool.query(
    `SELECT s.*, CASE WHEN s.status = 'active' AND s.ends_at IS NOT NULL AND s.ends_at <= NOW()
                      THEN 'expired' ELSE s.status END AS effective_status,
            u.name AS user_name, u.username, u.email, p.slug AS plan_slug,
            COALESCE(
              (SELECT jsonb_agg(jsonb_build_object(
                'action', h.action, 'createdAt', h.created_at,
                'before', h.before_data, 'after', h.after_data
              ) ORDER BY h.created_at DESC)
                 FROM subscription_history h WHERE h.subscription_id = s.id),
              '[]'::jsonb
            ) AS history
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       JOIN plans p ON p.id = s.plan_id
      WHERE ($1 = '' OR s.status = $1)
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 500`,
    [status],
  );
  return success(200, { subscriptions: result.rows.map(serializeSubscription) });
};

export const cancelSubscription = async (actorId, subscriptionId, isAdmin = true) => {
  if (!validId(subscriptionId)) return fail(400, 'Identificador de assinatura inválido.');
  return transaction(async (client) => {
    const result = await client.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [subscriptionId]);
    if (!result.rowCount) return fail(404, 'Assinatura não encontrada.');
    const before = result.rows[0];
    if (!['pending', 'active', 'past_due'].includes(before.status)) return fail(409, 'Esta assinatura não pode mais ser cancelada.');
    const changed = await client.query(
      `UPDATE subscriptions SET status = 'canceled', ends_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [subscriptionId],
    );
    const after = changed.rows[0];
    await client.query(
      `INSERT INTO subscription_history (subscription_id, actor_user_id, action, before_data, after_data)
       VALUES ($1, $2, 'canceled', $3::jsonb, $4::jsonb)`,
      [subscriptionId, actorId, JSON.stringify(subscriptionSnapshot(before)), JSON.stringify(subscriptionSnapshot(after))],
    );
    if (isAdmin) await audit(client, actorId, 'subscription.canceled', 'subscription', subscriptionId,
      subscriptionSnapshot(before), subscriptionSnapshot(after));
    return success(200, { subscription: subscriptionSnapshot(after) });
  });
};

export const listPayments = async (query = {}) => {
  const range = dateRange(query);
  if (!range) return fail(400, 'Informe um intervalo de datas válido.');
  const status = typeof query.status === 'string' ? query.status : '';
  const userId = typeof query.userId === 'string' ? query.userId : '';
  const currency = typeof query.currency === 'string' ? query.currency.toUpperCase() : '';
  if (status && !['pending', 'paid', 'failed', 'canceled', 'refunded'].includes(status)) {
    return fail(400, 'Filtro de pagamento inválido.');
  }
  if (userId && !validId(userId)) return fail(400, 'Filtro de usuário inválido.');
  if (currency && !currencyPattern.test(currency)) return fail(400, 'Filtro de moeda inválido.');
  const result = await pool.query(
    `SELECT p.id, p.subscription_id, p.user_id, u.name AS user_name, u.username,
            p.external_provider, p.external_payment_id, p.status, p.amount,
            p.refunded_amount, p.provider_fee, p.currency, p.occurred_at, p.paid_at
       FROM payments p JOIN users u ON u.id = p.user_id
      WHERE p.occurred_at::date BETWEEN $1::date AND $2::date
        AND ($3 = '' OR p.status = $3)
        AND ($4 = '' OR p.user_id = NULLIF($4, '')::bigint)
        AND ($5 = '' OR p.currency = $5)
      ORDER BY p.occurred_at DESC, p.id DESC
      LIMIT 1000`,
    [range.from, range.to, status, userId, currency],
  );
  return success(200, { payments: result.rows.map((row) => ({
    id: String(row.id), subscriptionId: row.subscription_id === null ? null : String(row.subscription_id),
    user: { id: String(row.user_id), name: row.user_name, username: row.username },
    provider: row.external_provider, providerPaymentId: row.external_payment_id,
    status: row.status, amount: row.amount, refundedAmount: row.refunded_amount, providerFee: row.provider_fee,
    currency: row.currency, occurredAt: row.occurred_at, paidAt: row.paid_at,
  })), range });
};

const validateExpense = (body = {}) => {
  if (typeof body.description !== 'string' || !body.description.trim() || body.description.trim().length > 240) return 'Informe a descrição da despesa (até 240 caracteres).';
  if (typeof body.category !== 'string' || !body.category.trim() || body.category.trim().length > 60) return 'Informe uma categoria válida (até 60 caracteres).';
  if (!validMoneyAmount(body.amount, { minimum: 0, exclusive: true })) return 'O valor da despesa deve ser maior que zero e ter no máximo duas casas decimais.';
  if (typeof body.currency !== 'string' || !currencyPattern.test(body.currency)) return 'Informe a moeda em formato ISO de três letras.';
  if (!validateDate(body.occurredOn || '')) return 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!['paid', 'pending', 'void'].includes(body.status ?? 'paid')) return 'Status de despesa inválido.';
  if (typeof (body.notes ?? '') !== 'string' || (body.notes ?? '').length > 4000) return 'As observações devem ter até 4.000 caracteres.';
  return null;
};

const expenseSnapshot = (row) => ({
  id: String(row.id), description: row.description, category: row.category, amount: row.amount,
  currency: row.currency, occurredOn: String(row.occurred_on).slice(0, 10), status: row.status,
  notes: row.notes, createdBy: String(row.created_by), createdAt: row.created_at, updatedAt: row.updated_at,
});

export const listExpenses = async (query = {}) => {
  const range = dateRange(query);
  if (!range) return fail(400, 'Informe um intervalo de datas válido.');
  const status = typeof query.status === 'string' ? query.status : '';
  const currency = typeof query.currency === 'string' ? query.currency.toUpperCase() : '';
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
  if (status && !['paid', 'pending', 'void'].includes(status)) {
    return fail(400, 'Filtro de despesa inválido.');
  }
  if (currency && !currencyPattern.test(currency)) return fail(400, 'Filtro de moeda inválido.');
  const result = await pool.query(
    `SELECT * FROM expenses
      WHERE occurred_on BETWEEN $1::date AND $2::date
        AND ($3 = '' OR status = $3)
        AND ($4 = '' OR currency = $4)
        AND ($5 = '' OR description ILIKE '%' || $5 || '%'
          OR category ILIKE '%' || $5 || '%' OR notes ILIKE '%' || $5 || '%')
      ORDER BY occurred_on DESC, id DESC
      LIMIT 1000`,
    [range.from, range.to, status, currency, search],
  );
  return success(200, { expenses: result.rows.map(expenseSnapshot), range });
};

export const saveExpense = async (actorId, expenseId, body = {}) => {
  const validation = validateExpense(body);
  if (validation) return fail(400, validation);
  const values = [
    body.description.trim(), body.category.trim(), Number(body.amount).toFixed(2), body.currency,
    body.occurredOn, body.status ?? 'paid', body.notes ?? '',
  ];
  return transaction(async (client) => {
    if (expenseId === null) {
      const inserted = await client.query(
        `INSERT INTO expenses (description, category, amount, currency, occurred_on, status, notes, created_by)
         VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8) RETURNING *`,
        [...values, actorId],
      );
      const expense = expenseSnapshot(inserted.rows[0]);
      await audit(client, actorId, 'expense.created', 'expense', expense.id, null, expense);
      return success(201, { expense });
    }
    if (!validId(expenseId)) return fail(400, 'Identificador de despesa inválido.');
    const current = await client.query('SELECT * FROM expenses WHERE id = $1 FOR UPDATE', [expenseId]);
    if (!current.rowCount) return fail(404, 'Despesa não encontrada.');
    const updated = await client.query(
      `UPDATE expenses SET description = $2, category = $3, amount = $4, currency = $5,
              occurred_on = $6::date, status = $7, notes = $8, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [expenseId, ...values],
    );
    const before = expenseSnapshot(current.rows[0]);
    const after = expenseSnapshot(updated.rows[0]);
    await audit(client, actorId, 'expense.updated', 'expense', expenseId, before, after);
    return success(200, { expense: after });
  });
};

export const voidExpense = async (actorId, expenseId) => {
  if (!validId(expenseId)) return fail(400, 'Identificador de despesa inválido.');
  return transaction(async (client) => {
    const current = await client.query('SELECT * FROM expenses WHERE id = $1 FOR UPDATE', [expenseId]);
    if (!current.rowCount) return fail(404, 'Despesa não encontrada.');
    if (current.rows[0].status === 'void') return fail(409, 'A despesa já está estornada.');
    const updated = await client.query(
      `UPDATE expenses SET status = 'void', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [expenseId],
    );
    const before = expenseSnapshot(current.rows[0]);
    const after = expenseSnapshot(updated.rows[0]);
    await audit(client, actorId, 'expense.voided', 'expense', expenseId, before, after);
    return success(200, { expense: after });
  });
};

export const getReports = async (query = {}) => {
  const range = dateRange(query);
  if (!range) return fail(400, 'Informe um intervalo de datas válido.');
  const [payments, expenses, subscriptions, content] = await Promise.all([
    pool.query(
      `SELECT TO_CHAR(paid_at::date, 'YYYY-MM') AS period, currency,
              SUM(amount)::numeric AS gross, SUM(refunded_amount)::numeric AS refunds,
              SUM(provider_fee)::numeric AS fees, COUNT(*)::int AS transactions
         FROM payments
        WHERE status = 'paid' AND paid_at::date BETWEEN $1::date AND $2::date
        GROUP BY period, currency ORDER BY period, currency`,
      [range.from, range.to],
    ),
    pool.query(
      `SELECT TO_CHAR(occurred_on, 'YYYY-MM') AS period, currency,
              SUM(amount)::numeric AS expenses, COUNT(*)::int AS entries
         FROM expenses
        WHERE status = 'paid' AND occurred_on BETWEEN $1::date AND $2::date
        GROUP BY period, currency ORDER BY period, currency`,
      [range.from, range.to],
    ),
    pool.query(
      `SELECT status, billing_period, currency, COUNT(*)::int AS count,
              SUM(contracted_price)::numeric AS contracted_total
         FROM subscriptions
        WHERE created_at::date BETWEEN $1::date AND $2::date
        GROUP BY status, billing_period, currency ORDER BY status, billing_period, currency`,
      [range.from, range.to],
    ),
    pool.query(
      `SELECT 'campaigns' AS resource, COUNT(*)::int AS count FROM campaigns WHERE created_at::date BETWEEN $1::date AND $2::date
       UNION ALL SELECT 'characters', COUNT(*)::int FROM characters WHERE created_at::date BETWEEN $1::date AND $2::date
       UNION ALL SELECT 'monsters', COUNT(*)::int FROM monsters WHERE created_at::date BETWEEN $1::date AND $2::date
       UNION ALL SELECT 'notes', COUNT(*)::int FROM notes WHERE created_at::date BETWEEN $1::date AND $2::date
       UNION ALL SELECT 'missions', COUNT(*)::int FROM missions WHERE created_at::date BETWEEN $1::date AND $2::date`,
      [range.from, range.to],
    ),
  ]);
  return success(200, {
    range,
    financial: { payments: payments.rows, expenses: expenses.rows },
    subscriptions: subscriptions.rows,
    contentCreation: content.rows,
    financialNote: 'Valores são agrupados por moeda; não há conversão cambial. Receita líquida usa pagamentos confirmados menos reembolsos, tarifas e despesas pagas.',
  });
};

export const listAudit = async (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  const result = await pool.query(
    `SELECT l.*, u.name AS actor_name, u.username AS actor_username
       FROM admin_audit_log l
       LEFT JOIN users u ON u.id = l.actor_user_id
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  );
  return success(200, { entries: result.rows.map((row) => ({
    id: String(row.id), actor: row.actor_user_id ? {
      id: String(row.actor_user_id), name: row.actor_name, username: row.actor_username,
    } : { source: row.actor_source },
    action: row.action, entityType: row.entity_type, entityId: row.entity_id,
    before: row.before_data, after: row.after_data, metadata: row.metadata, createdAt: row.created_at,
  })), page, limit });
};

export const getSettings = async () => {
  const result = await pool.query(`SELECT value FROM admin_settings WHERE setting_key = 'active_user_window_days'`);
  return success(200, { settings: { activeUserWindowDays: Number(result.rows[0]?.value ?? 30) } });
};

export const updateSettings = async (actorId, body = {}) => {
  if (!Number.isSafeInteger(body.activeUserWindowDays) || body.activeUserWindowDays < 1 || body.activeUserWindowDays > 365) {
    return fail(400, 'A janela de atividade deve ser um inteiro entre 1 e 365 dias.');
  }
  return transaction(async (client) => {
    const current = await client.query(
      `SELECT value FROM admin_settings WHERE setting_key = 'active_user_window_days' FOR UPDATE`,
    );
    const before = { activeUserWindowDays: Number(current.rows[0]?.value ?? 30) };
    await client.query(
      `INSERT INTO admin_settings (setting_key, value, updated_by, updated_at)
       VALUES ('active_user_window_days', $1::jsonb, $2, NOW())
       ON CONFLICT (setting_key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [JSON.stringify(body.activeUserWindowDays), actorId],
    );
    const after = { activeUserWindowDays: body.activeUserWindowDays };
    await audit(client, actorId, 'settings.updated', 'settings', 'active_user_window_days', before, after);
    return success(200, { settings: after });
  });
};

export const changePermission = async (actorId, userId, permission, granted) => {
  if (!validId(userId) || !PERMISSIONS.has(permission) || typeof granted !== 'boolean') {
    return fail(400, 'Usuário, permissão ou operação inválida.');
  }
  if (String(actorId) === String(userId) && !granted && permission === 'admin.permissions.manage') {
    return fail(400, 'Não é possível remover de si mesmo a permissão necessária para administrar permissões.');
  }
  return transaction(async (client) => {
    await lockAdminRoster(client);
    const user = await client.query('SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user.rowCount) return fail(404, 'Usuário não encontrado.');
    const currentPermissions = await client.query(
      'SELECT permission FROM admin_permissions WHERE user_id = $1 ORDER BY permission',
      [userId],
    );
    const currentlyGranted = currentPermissions.rows.some((row) => row.permission === permission);
    if (currentlyGranted === granted) {
      return success(200, {
        changed: false,
        permissions: currentPermissions.rows.map((row) => row.permission),
      });
    }
    if (!granted && user.rows[0].is_active && currentPermissions.rowCount === 1
      && await activeAdminCount(client) <= 1) {
      return fail(409, 'Não é possível remover a última permissão do último administrador ativo.');
    }
    let result;
    if (granted) {
      result = await client.query(
        `INSERT INTO admin_permissions (user_id, permission, granted_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, permission) DO NOTHING
         RETURNING user_id`,
        [userId, permission, actorId],
      );
    } else {
      result = await client.query(
        'DELETE FROM admin_permissions WHERE user_id = $1 AND permission = $2 RETURNING user_id',
        [userId, permission],
      );
    }
    await audit(client, actorId, granted ? 'permission.granted' : 'permission.revoked',
      'admin_permission', `${userId}:${permission}`, { granted: !granted }, { granted });
    const permissions = await client.query('SELECT permission FROM admin_permissions WHERE user_id = $1 ORDER BY permission', [userId]);
    return success(200, { changed: result.rowCount > 0, permissions: permissions.rows.map((row) => row.permission) });
  });
};

export const listMySubscriptions = async (userId) => {
  const result = await pool.query(
    `SELECT s.*, p.slug AS plan_slug
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC, s.id DESC`,
    [userId],
  );
  return success(200, { subscriptions: result.rows.map((row) => ({
    ...subscriptionSnapshot(row), planSlug: row.plan_slug,
  })) });
};

export const requestCheckout = async (userId, planId) => {
  if (!validId(planId)) return fail(400, 'Identificador de plano inválido.');
  const plan = await pool.query('SELECT id, status, billing_period, price, currency FROM plans WHERE id = $1', [planId]);
  if (!plan.rowCount || plan.rows[0].status !== 'active' || plan.rows[0].billing_period === 'free') {
    return fail(404, 'Plano pago ativo não encontrado.');
  }
  try {
    await createCheckoutSession({ userId, plan: plan.rows[0] });
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) {
      return fail(503, 'A contratação online está indisponível: nenhum provedor de pagamento foi configurado.');
    }
    throw error;
  }
  return fail(503, 'O provedor de pagamento não retornou uma sessão de contratação.');
};
