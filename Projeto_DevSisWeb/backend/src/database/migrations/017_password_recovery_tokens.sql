CREATE TABLE password_recovery_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX password_recovery_tokens_user_active_idx
  ON password_recovery_tokens (user_id, expires_at)
  WHERE used_at IS NULL;

CREATE UNIQUE INDEX password_recovery_tokens_one_active_per_user_idx
  ON password_recovery_tokens (user_id)
  WHERE used_at IS NULL;
