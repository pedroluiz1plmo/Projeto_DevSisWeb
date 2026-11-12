CREATE TABLE subscription_email_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions (id) ON DELETE RESTRICT,
  payment_id BIGINT REFERENCES payments (id) ON DELETE RESTRICT,
  provider VARCHAR(80) NOT NULL,
  external_event_id VARCHAR(200) NOT NULL,
  notification_type VARCHAR(30) NOT NULL
    CHECK (notification_type IN ('subscription_confirmed', 'subscription_renewed', 'plan_changed')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  event_data JSONB NOT NULL CHECK (jsonb_typeof(event_data) = 'object'),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code VARCHAR(120),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_email_notifications_event_unique
    UNIQUE (provider, external_event_id, notification_type)
);

CREATE INDEX subscription_email_notifications_status_idx
  ON subscription_email_notifications (status, created_at);
CREATE INDEX subscription_email_notifications_subscription_idx
  ON subscription_email_notifications (subscription_id, created_at DESC);
CREATE INDEX subscription_email_notifications_user_idx
  ON subscription_email_notifications (user_id, created_at DESC);
