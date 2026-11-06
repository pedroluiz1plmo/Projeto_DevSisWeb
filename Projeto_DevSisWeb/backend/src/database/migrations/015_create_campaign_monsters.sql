ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_id_owner_workspace_unique
  UNIQUE (id, owner_id, workspace_type);

ALTER TABLE system_versions
  ADD CONSTRAINT system_versions_system_id_id_unique
  UNIQUE (system_id, id);

CREATE TABLE monsters (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  owner_id BIGINT NOT NULL,
  workspace_type VARCHAR(20) NOT NULL DEFAULT 'master'
    CHECK (workspace_type = 'master'),
  system_id BIGINT NOT NULL,
  system_version_id BIGINT NOT NULL,
  name VARCHAR(160) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT monsters_campaign_owner_workspace_fk
    FOREIGN KEY (campaign_id, owner_id, workspace_type)
    REFERENCES campaigns (id, owner_id, workspace_type)
    ON DELETE CASCADE,
  CONSTRAINT monsters_system_version_fk
    FOREIGN KEY (system_id, system_version_id)
    REFERENCES system_versions (system_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX monsters_campaign_owner_workspace_idx
  ON monsters (campaign_id, owner_id, workspace_type);
CREATE INDEX monsters_system_version_idx ON monsters (system_version_id);
CREATE INDEX monsters_system_idx ON monsters (system_id);
