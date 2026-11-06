CREATE TABLE notes (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_type VARCHAR(20) NOT NULL CHECK (workspace_type IN ('player', 'master')),
  folder_id BIGINT,
  campaign_id BIGINT,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notes_owner_workspace_client_unique UNIQUE (owner_id, workspace_type, client_id),
  CONSTRAINT notes_id_owner_workspace_unique UNIQUE (id, owner_id, workspace_type),
  CONSTRAINT notes_folder_owner_workspace_fk
    FOREIGN KEY (folder_id, owner_id, workspace_type)
    REFERENCES folders(id, owner_id, workspace_type),
  CONSTRAINT notes_campaign_workspace_fk
    FOREIGN KEY (campaign_id, workspace_type)
    REFERENCES campaigns(id, workspace_type)
);

CREATE TABLE missions (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_type VARCHAR(20) NOT NULL CHECK (workspace_type IN ('player', 'master')),
  folder_id BIGINT,
  campaign_id BIGINT,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  reward VARCHAR(2000) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'em_progresso'
    CHECK (status IN ('em_progresso', 'concluida')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT missions_owner_workspace_client_unique UNIQUE (owner_id, workspace_type, client_id),
  CONSTRAINT missions_id_owner_workspace_unique UNIQUE (id, owner_id, workspace_type),
  CONSTRAINT missions_folder_owner_workspace_fk
    FOREIGN KEY (folder_id, owner_id, workspace_type)
    REFERENCES folders(id, owner_id, workspace_type),
  CONSTRAINT missions_campaign_workspace_fk
    FOREIGN KEY (campaign_id, workspace_type)
    REFERENCES campaigns(id, workspace_type)
);

CREATE INDEX notes_owner_workspace_idx ON notes (owner_id, workspace_type);
CREATE INDEX notes_folder_idx ON notes (folder_id);
CREATE INDEX notes_campaign_idx ON notes (campaign_id);
CREATE INDEX missions_owner_workspace_idx ON missions (owner_id, workspace_type);
CREATE INDEX missions_folder_idx ON missions (folder_id);
CREATE INDEX missions_campaign_idx ON missions (campaign_id);

CREATE FUNCTION detach_private_records_from_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE notes SET folder_id = NULL, updated_at = NOW() WHERE folder_id = OLD.id;
  UPDATE missions SET folder_id = NULL, updated_at = NOW() WHERE folder_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER folders_detach_private_records
  BEFORE DELETE ON folders
  FOR EACH ROW EXECUTE FUNCTION detach_private_records_from_folder();

CREATE FUNCTION detach_private_records_from_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE notes SET campaign_id = NULL, updated_at = NOW() WHERE campaign_id = OLD.id;
  UPDATE missions SET campaign_id = NULL, updated_at = NOW() WHERE campaign_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER campaigns_detach_private_records
  BEFORE DELETE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION detach_private_records_from_campaign();
