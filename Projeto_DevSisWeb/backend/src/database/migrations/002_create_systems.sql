CREATE TABLE IF NOT EXISTS systems (
  id BIGSERIAL PRIMARY KEY,

  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT systems_name_unique UNIQUE (name),
  CONSTRAINT systems_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS systems_slug_idx ON systems (slug);