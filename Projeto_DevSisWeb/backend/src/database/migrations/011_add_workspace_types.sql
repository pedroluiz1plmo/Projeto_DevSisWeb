ALTER TABLE characters ADD COLUMN IF NOT EXISTS workspace_type VARCHAR(20) DEFAULT 'player';
UPDATE characters SET workspace_type = 'player' WHERE workspace_type IS NULL;
ALTER TABLE characters ALTER COLUMN workspace_type SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'characters_workspace_type_check'
  ) THEN
    ALTER TABLE characters
      ADD CONSTRAINT characters_workspace_type_check
      CHECK (workspace_type IN ('player', 'master'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS characters_workspace_idx ON characters (user_id, workspace_type);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_type VARCHAR(20) DEFAULT 'player';
UPDATE campaigns SET workspace_type = 'player' WHERE workspace_type IS NULL;
ALTER TABLE campaigns ALTER COLUMN workspace_type SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_workspace_type_check'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_workspace_type_check
      CHECK (workspace_type IN ('player', 'master'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS campaigns_workspace_idx ON campaigns (owner_id, workspace_type);

ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS workspace_type VARCHAR(20) DEFAULT 'player';
UPDATE campaign_members SET workspace_type = 'player' WHERE workspace_type IS NULL;
ALTER TABLE campaign_members ALTER COLUMN workspace_type SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_members_workspace_type_check'
  ) THEN
    ALTER TABLE campaign_members
      ADD CONSTRAINT campaign_members_workspace_type_check
      CHECK (workspace_type IN ('player', 'master'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS campaign_members_workspace_idx ON campaign_members (campaign_id, workspace_type);
CREATE INDEX IF NOT EXISTS campaign_members_user_workspace_idx ON campaign_members (user_id, workspace_type);

ALTER TABLE campaign_characters ADD COLUMN IF NOT EXISTS workspace_type VARCHAR(20) DEFAULT 'player';
UPDATE campaign_characters SET workspace_type = 'player' WHERE workspace_type IS NULL;
ALTER TABLE campaign_characters ALTER COLUMN workspace_type SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_characters_workspace_type_check'
  ) THEN
    ALTER TABLE campaign_characters
      ADD CONSTRAINT campaign_characters_workspace_type_check
      CHECK (workspace_type IN ('player', 'master'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS campaign_characters_workspace_idx ON campaign_characters (campaign_id, workspace_type);
CREATE INDEX IF NOT EXISTS campaign_characters_character_workspace_idx ON campaign_characters (character_id, workspace_type);

ALTER TABLE folders ADD COLUMN IF NOT EXISTS workspace_type VARCHAR(20) DEFAULT 'player';
UPDATE folders SET workspace_type = 'player' WHERE workspace_type IS NULL;
ALTER TABLE folders ALTER COLUMN workspace_type SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'folders_workspace_type_check'
  ) THEN
    ALTER TABLE folders
      ADD CONSTRAINT folders_workspace_type_check
      CHECK (workspace_type IN ('player', 'master'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS folders_workspace_idx ON folders (owner_id, workspace_type);
