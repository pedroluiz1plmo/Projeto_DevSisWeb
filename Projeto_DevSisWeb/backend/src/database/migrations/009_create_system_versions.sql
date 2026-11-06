CREATE TABLE IF NOT EXISTS system_versions (
  id BIGSERIAL PRIMARY KEY,
  system_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT system_versions_system_fk
    FOREIGN KEY (system_id)
    REFERENCES systems(id)
    ON DELETE RESTRICT,
  CONSTRAINT system_versions_system_slug_unique
    UNIQUE (system_id, slug)
);

CREATE INDEX IF NOT EXISTS system_versions_system_idx
  ON system_versions (system_id);

INSERT INTO system_versions (system_id, name, slug)
SELECT s.id, versions.name, versions.slug
FROM (
  VALUES
    ('dungeons-and-dragons', '5E', '5e'),
    ('call-of-cthulhu', '7ª edição', '7a-edicao'),
    ('vampiro-a-mascara', 'V5', 'v5')
) AS versions(system_slug, name, slug)
JOIN systems s ON s.slug = versions.system_slug
ON CONFLICT (system_id, slug) DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM system_versions sv
    JOIN systems s ON s.id = sv.system_id
    WHERE (s.slug, sv.slug) IN (
      ('dungeons-and-dragons', '5e'),
      ('call-of-cthulhu', '7a-edicao'),
      ('vampiro-a-mascara', 'v5')
    )
  ) <> 3 THEN
    RAISE EXCEPTION 'Não foi possível criar as versões iniciais: verifique os slugs dos sistemas existentes.';
  END IF;
END $$;

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS system_version_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'characters_system_version_fk'
      AND conrelid = 'characters'::regclass
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_system_version_fk
      FOREIGN KEY (system_version_id)
      REFERENCES system_versions(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS characters_system_version_idx
  ON characters (system_version_id);
