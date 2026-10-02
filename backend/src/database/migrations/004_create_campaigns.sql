CREATE TABLE IF NOT EXISTS campaigns (

  id BIGSERIAL PRIMARY KEY,

  owner_id BIGINT NOT NULL,

  name VARCHAR(120) NOT NULL,

  description TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaigns_owner_fk
    FOREIGN KEY (owner_id)
    REFERENCES users(id)
    ON DELETE CASCADE

);

CREATE INDEX IF NOT EXISTS campaigns_owner_idx
  ON campaigns (owner_id);