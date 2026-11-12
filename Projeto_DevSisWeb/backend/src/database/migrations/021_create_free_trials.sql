CREATE TABLE free_trials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  plan_id BIGINT NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT free_trials_exact_duration CHECK (ends_at = starts_at + INTERVAL '7 days'),
  CONSTRAINT free_trials_activation_start_match CHECK (activated_at = starts_at)
);

CREATE INDEX free_trials_status_ends_at_idx
  ON free_trials (status, ends_at);
CREATE INDEX free_trials_plan_idx ON free_trials (plan_id);
