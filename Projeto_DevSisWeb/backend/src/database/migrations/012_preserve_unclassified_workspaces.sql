CREATE TABLE IF NOT EXISTS workspace_classification_queue (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(40) NOT NULL
    CHECK (table_name IN ('characters', 'campaigns', 'folders', 'campaign_members', 'campaign_characters')),
  record_key JSONB NOT NULL,
  previous_workspace_type VARCHAR(20),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'classified')),
  classified_workspace_type VARCHAR(20)
    CHECK (classified_workspace_type IS NULL OR classified_workspace_type IN ('player', 'master')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classified_at TIMESTAMPTZ,
  CHECK (
    (status = 'pending' AND classified_workspace_type IS NULL AND classified_at IS NULL)
    OR (status = 'classified' AND classified_workspace_type IS NOT NULL AND classified_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS workspace_classification_queue_status_idx
  ON workspace_classification_queue (status, table_name);

COMMENT ON TABLE workspace_classification_queue IS
  'Preserves identifiers and prior workspace values for records whose workspace cannot be trusted. Classify the source row manually, then mark the queue row classified.';
COMMENT ON COLUMN workspace_classification_queue.record_key IS
  'JSON identifiers and relevant pre-migration context; retain this row as the audit trail when resolving a record manually.';
COMMENT ON COLUMN workspace_classification_queue.classified_workspace_type IS
  'Set only after the source record has been explicitly classified and its workspace_type updated.';

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'characters',
       jsonb_build_object('id', id, 'userId', user_id, 'name', name, 'createdAt', created_at),
       workspace_type,
       'Existing player value may have been assigned by migration 011 default/backfill.'
FROM characters
WHERE workspace_type = 'player';

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'campaigns',
       jsonb_build_object('id', id, 'ownerId', owner_id, 'name', name, 'createdAt', created_at),
       workspace_type,
       'Existing player value may have been assigned by migration 011 default/backfill.'
FROM campaigns
WHERE workspace_type = 'player';

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'folders',
       jsonb_build_object(
         'id', id,
         'ownerId', owner_id,
         'parentFolderId', parent_folder_id,
         'name', name,
         'createdAt', created_at
       ),
       workspace_type,
       'Existing player value may have been assigned by migration 011 default/backfill.'
FROM folders
WHERE workspace_type = 'player';

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'campaign_members',
       jsonb_build_object('campaignId', campaign_id, 'userId', user_id, 'role', role, 'joinedAt', joined_at),
       workspace_type,
       'Existing player value may have been assigned by migration 011 default/backfill.'
FROM campaign_members
WHERE workspace_type = 'player';

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'campaign_characters',
       jsonb_build_object('campaignId', campaign_id, 'characterId', character_id, 'joinedAt', joined_at),
       workspace_type,
       'Existing player value may have been assigned by migration 011 default/backfill.'
FROM campaign_characters
WHERE workspace_type = 'player';

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'campaign_members',
       jsonb_build_object('campaignId', member.campaign_id, 'userId', member.user_id, 'role', member.role),
       member.workspace_type,
       'Membership workspace differs from, or cannot be derived from, its campaign.'
FROM campaign_members member
JOIN campaigns camp ON camp.id = member.campaign_id
WHERE member.workspace_type IS DISTINCT FROM camp.workspace_type;

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'campaign_characters',
       jsonb_build_object(
         'campaignId', link.campaign_id,
         'characterId', link.character_id,
         'linkWorkspace', link.workspace_type,
         'campaignWorkspace', camp.workspace_type,
         'characterWorkspace', ch.workspace_type
       ),
       link.workspace_type,
       'Campaign-character link has incompatible or unclassified endpoint workspaces.'
FROM campaign_characters link
JOIN campaigns camp ON camp.id = link.campaign_id
JOIN characters ch ON ch.id = link.character_id
WHERE link.workspace_type IS DISTINCT FROM camp.workspace_type
   OR camp.workspace_type IS DISTINCT FROM ch.workspace_type;

INSERT INTO workspace_classification_queue (table_name, record_key, previous_workspace_type, reason)
SELECT 'folders',
       jsonb_build_object(
         'id', folder.id,
         'ownerId', folder.owner_id,
         'previousParentFolderId', folder.parent_folder_id,
         'workspaceType', folder.workspace_type
       ),
       folder.workspace_type,
       'Parent folder belongs to a different or unclassified workspace; the link is retained here for manual review.'
FROM folders folder
WHERE folder.parent_folder_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM folders parent
    WHERE parent.id = folder.parent_folder_id
      AND parent.owner_id = folder.owner_id
      AND parent.workspace_type IS NOT DISTINCT FROM folder.workspace_type
  );

ALTER TABLE characters ALTER COLUMN workspace_type DROP DEFAULT;
ALTER TABLE characters ALTER COLUMN workspace_type DROP NOT NULL;
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_workspace_type_check;
ALTER TABLE characters
  ADD CONSTRAINT characters_workspace_type_check
  CHECK (workspace_type IS NULL OR workspace_type IN ('player', 'master'));

ALTER TABLE campaigns ALTER COLUMN workspace_type DROP DEFAULT;
ALTER TABLE campaigns ALTER COLUMN workspace_type DROP NOT NULL;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_workspace_type_check;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_workspace_type_check
  CHECK (workspace_type IS NULL OR workspace_type IN ('player', 'master'));

ALTER TABLE folders ALTER COLUMN workspace_type DROP DEFAULT;
ALTER TABLE folders ALTER COLUMN workspace_type DROP NOT NULL;
ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_workspace_type_check;
ALTER TABLE folders
  ADD CONSTRAINT folders_workspace_type_check
  CHECK (workspace_type IS NULL OR workspace_type IN ('player', 'master'));

ALTER TABLE campaign_members ALTER COLUMN workspace_type DROP DEFAULT;
ALTER TABLE campaign_members ALTER COLUMN workspace_type DROP NOT NULL;
ALTER TABLE campaign_members DROP CONSTRAINT IF EXISTS campaign_members_workspace_type_check;
ALTER TABLE campaign_members
  ADD CONSTRAINT campaign_members_workspace_type_check
  CHECK (workspace_type IS NULL OR workspace_type IN ('player', 'master'));

ALTER TABLE campaign_characters ALTER COLUMN workspace_type DROP DEFAULT;
ALTER TABLE campaign_characters ALTER COLUMN workspace_type DROP NOT NULL;
ALTER TABLE campaign_characters DROP CONSTRAINT IF EXISTS campaign_characters_workspace_type_check;
ALTER TABLE campaign_characters
  ADD CONSTRAINT campaign_characters_workspace_type_check
  CHECK (workspace_type IS NULL OR workspace_type IN ('player', 'master'));

UPDATE characters SET workspace_type = NULL WHERE workspace_type = 'player';
UPDATE campaigns SET workspace_type = NULL WHERE workspace_type = 'player';
UPDATE folders SET workspace_type = NULL WHERE workspace_type = 'player';

UPDATE campaign_members cm
SET workspace_type = camp.workspace_type
FROM campaigns camp
WHERE camp.id = cm.campaign_id
  AND camp.workspace_type IS NOT NULL;

UPDATE campaign_members cm
SET workspace_type = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM campaigns camp
  WHERE camp.id = cm.campaign_id
    AND camp.workspace_type IS NOT NULL
);

UPDATE campaign_characters link
SET workspace_type = camp.workspace_type
FROM campaigns camp, characters ch
WHERE camp.id = link.campaign_id
  AND ch.id = link.character_id
  AND camp.workspace_type IS NOT NULL
  AND camp.workspace_type = ch.workspace_type;

UPDATE campaign_characters link
SET workspace_type = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM campaigns camp
  JOIN characters ch ON ch.id = link.character_id
  WHERE camp.id = link.campaign_id
    AND camp.workspace_type IS NOT NULL
    AND camp.workspace_type = ch.workspace_type
);

UPDATE folders folder
SET parent_folder_id = NULL
WHERE folder.parent_folder_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM folders parent
    WHERE parent.id = folder.parent_folder_id
      AND parent.owner_id = folder.owner_id
      AND parent.workspace_type IS NOT DISTINCT FROM folder.workspace_type
  );

UPDATE workspace_classification_queue queue
SET status = 'classified',
    classified_workspace_type = member.workspace_type,
    classified_at = NOW()
FROM campaign_members member
WHERE queue.table_name = 'campaign_members'
  AND member.campaign_id = (queue.record_key ->> 'campaignId')::BIGINT
  AND member.user_id = (queue.record_key ->> 'userId')::BIGINT
  AND member.workspace_type = 'master';

UPDATE workspace_classification_queue queue
SET status = 'classified',
    classified_workspace_type = link.workspace_type,
    classified_at = NOW()
FROM campaign_characters link
WHERE queue.table_name = 'campaign_characters'
  AND link.campaign_id = (queue.record_key ->> 'campaignId')::BIGINT
  AND link.character_id = (queue.record_key ->> 'characterId')::BIGINT
  AND link.workspace_type = 'master';

ALTER TABLE characters
  ADD CONSTRAINT characters_id_workspace_unique UNIQUE (id, workspace_type);
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_id_workspace_unique UNIQUE (id, workspace_type);
ALTER TABLE folders
  ADD CONSTRAINT folders_id_owner_workspace_unique UNIQUE (id, owner_id, workspace_type);

ALTER TABLE campaign_members
  ADD CONSTRAINT campaign_members_campaign_workspace_fk
  FOREIGN KEY (campaign_id, workspace_type)
  REFERENCES campaigns (id, workspace_type)
  ON DELETE CASCADE;

ALTER TABLE campaign_characters
  ADD CONSTRAINT campaign_characters_campaign_workspace_fk
  FOREIGN KEY (campaign_id, workspace_type)
  REFERENCES campaigns (id, workspace_type)
  ON DELETE CASCADE;

ALTER TABLE campaign_characters
  ADD CONSTRAINT campaign_characters_character_workspace_fk
  FOREIGN KEY (character_id, workspace_type)
  REFERENCES characters (id, workspace_type)
  ON DELETE CASCADE;

ALTER TABLE folders
  ADD CONSTRAINT folders_parent_owner_workspace_fk
  FOREIGN KEY (parent_folder_id, owner_id, workspace_type)
  REFERENCES folders (id, owner_id, workspace_type)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION enforce_workspace_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.workspace_type IS NULL THEN
    RAISE EXCEPTION 'workspace_type is required for new records'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.workspace_type IS DISTINCT FROM OLD.workspace_type
     AND current_setting('app.workspace_reclassification', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'workspace_type cannot be changed during a normal update'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER characters_workspace_immutable
  BEFORE INSERT OR UPDATE OF workspace_type ON characters
  FOR EACH ROW EXECUTE FUNCTION enforce_workspace_type();

CREATE TRIGGER campaigns_workspace_immutable
  BEFORE INSERT OR UPDATE OF workspace_type ON campaigns
  FOR EACH ROW EXECUTE FUNCTION enforce_workspace_type();

CREATE TRIGGER folders_workspace_immutable
  BEFORE INSERT OR UPDATE OF workspace_type ON folders
  FOR EACH ROW EXECUTE FUNCTION enforce_workspace_type();

CREATE TRIGGER campaign_members_workspace_immutable
  BEFORE INSERT OR UPDATE OF workspace_type ON campaign_members
  FOR EACH ROW EXECUTE FUNCTION enforce_workspace_type();

CREATE TRIGGER campaign_characters_workspace_immutable
  BEFORE INSERT OR UPDATE OF workspace_type ON campaign_characters
  FOR EACH ROW EXECUTE FUNCTION enforce_workspace_type();

COMMENT ON FUNCTION enforce_workspace_type() IS
  'Legacy rows may remain NULL. For explicit manual classification only, start a transaction and SET LOCAL app.workspace_reclassification = ''on'' before updating the row and its classification-queue entry.';

CREATE OR REPLACE VIEW workspace_classification_pending AS
SELECT id, table_name, record_key, previous_workspace_type, reason, created_at
FROM workspace_classification_queue
WHERE status = 'pending';

COMMENT ON VIEW workspace_classification_pending IS
  'Read-only list of preserved workspace records requiring explicit manual classification.';
