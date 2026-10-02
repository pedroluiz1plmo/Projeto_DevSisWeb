CREATE TABLE IF NOT EXISTS characters (

  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL,

  system_id BIGINT NOT NULL,

  name VARCHAR(120) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT characters_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT characters_system_fk
    FOREIGN KEY (system_id)
    REFERENCES systems(id)
    ON DELETE RESTRICT

);

CREATE INDEX IF NOT EXISTS characters_user_idx
  ON characters (user_id);

CREATE INDEX IF NOT EXISTS characters_system_idx
  ON characters (system_id);