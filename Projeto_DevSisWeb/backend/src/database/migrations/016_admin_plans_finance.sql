ALTER TABLE users
  ADD COLUMN last_login_at TIMESTAMPTZ;

CREATE TABLE plans (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  billing_period VARCHAR(20) NOT NULL
    CHECK (billing_period IN ('free', 'monthly', 'annual')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive')),
  price NUMERIC(12, 2),
  currency CHAR(3),
  benefits JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(benefits) = 'object'),
  limits JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(limits) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (price IS NULL OR price >= 0),
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CHECK (
    (billing_period = 'free' AND price IS NOT NULL AND price = 0 AND currency IS NULL)
    OR billing_period IN ('monthly', 'annual')
  ),
  CHECK (
    status != 'active'
    OR billing_period = 'free'
    OR (price > 0 AND currency IS NOT NULL)
  )
);

INSERT INTO plans (slug, name, description, billing_period, status, price, currency)
VALUES (
  'freemium',
  'Mestre Freemium',
  'Plano gratuito para o espaço de Mestre; limites e benefícios são configuráveis pelo ADM.',
  'free',
  'active',
  0,
  NULL
)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE admin_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(80) NOT NULL,
  granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_permissions_user_permission_unique UNIQUE (user_id, permission)
);

CREATE INDEX admin_permissions_permission_idx ON admin_permissions (permission, user_id);

CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_source VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (actor_source IN ('user', 'bootstrap', 'system')),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at DESC, id DESC);
CREATE INDEX admin_audit_log_entity_idx ON admin_audit_log (entity_type, entity_id);
REVOKE UPDATE, DELETE, TRUNCATE ON admin_audit_log FROM PUBLIC;

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  plan_name VARCHAR(120) NOT NULL,
  billing_period VARCHAR(20) NOT NULL
    CHECK (billing_period IN ('monthly', 'annual')),
  contracted_price NUMERIC(12, 2) NOT NULL CHECK (contracted_price > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
  starts_at TIMESTAMPTZ,
  renews_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  external_provider VARCHAR(80),
  external_subscription_id VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX subscriptions_one_active_per_user_idx
  ON subscriptions (user_id)
  WHERE status = 'active';
CREATE INDEX subscriptions_user_status_idx ON subscriptions (user_id, status, created_at DESC);
CREATE INDEX subscriptions_status_renewal_idx ON subscriptions (status, renews_at);

CREATE TABLE subscription_history (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subscription_history_subscription_idx
  ON subscription_history (subscription_id, created_at DESC);

CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  external_provider VARCHAR(80),
  external_payment_id VARCHAR(200),
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  provider_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (provider_fee >= 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (refunded_amount <= amount)
);

CREATE UNIQUE INDEX payments_external_id_unique_idx
  ON payments (external_provider, external_payment_id)
  WHERE external_provider IS NOT NULL AND external_payment_id IS NOT NULL;
CREATE INDEX payments_status_date_currency_idx ON payments (status, paid_at, currency);
CREATE INDEX payments_subscription_idx ON payments (subscription_id, created_at DESC);

CREATE TABLE payment_provider_events (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(80) NOT NULL,
  external_event_id VARCHAR(200) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT payment_provider_events_idempotency_unique
    UNIQUE (provider, external_event_id)
);

CREATE TABLE expenses (
  id BIGSERIAL PRIMARY KEY,
  description VARCHAR(240) NOT NULL,
  category VARCHAR(60) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  occurred_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'pending', 'void')),
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX expenses_status_date_currency_idx ON expenses (status, occurred_on, currency);

CREATE TABLE admin_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_settings (setting_key, value)
VALUES ('active_user_window_days', '30'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
