CREATE TABLE campaign_combats (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  owner_id BIGINT NOT NULL,
  workspace_type VARCHAR(20) NOT NULL DEFAULT 'master'
    CHECK (workspace_type = 'master'),
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'preparing'
    CHECK (status IN ('preparing', 'active', 'finished')),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1),
  current_participant_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaign_combats_campaign_fk
    FOREIGN KEY (campaign_id, owner_id, workspace_type)
    REFERENCES campaigns (id, owner_id, workspace_type)
    ON DELETE CASCADE,
  CONSTRAINT campaign_combats_id_campaign_owner_workspace_unique
    UNIQUE (id, campaign_id, owner_id, workspace_type)
);

CREATE UNIQUE INDEX campaign_combats_one_open_per_campaign_idx
  ON campaign_combats (campaign_id)
  WHERE status <> 'finished';

CREATE TABLE campaign_combat_participants (
  id BIGSERIAL PRIMARY KEY,
  combat_id BIGINT NOT NULL,
  campaign_id BIGINT NOT NULL,
  owner_id BIGINT NOT NULL,
  workspace_type VARCHAR(20) NOT NULL DEFAULT 'master'
    CHECK (workspace_type = 'master'),
  character_id BIGINT,
  participant_type VARCHAR(20) NOT NULL
    CHECK (participant_type IN ('character', 'monster', 'npc')),
  name VARCHAR(160) NOT NULL,
  initiative_value INTEGER NOT NULL
    CHECK (initiative_value BETWEEN -999999 AND 999999),
  turn_order INTEGER NOT NULL CHECK (turn_order >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaign_combat_participants_combat_fk
    FOREIGN KEY (combat_id, campaign_id, owner_id, workspace_type)
    REFERENCES campaign_combats (id, campaign_id, owner_id, workspace_type)
    ON DELETE CASCADE,
  CONSTRAINT campaign_combat_participants_character_fk
    FOREIGN KEY (character_id)
    REFERENCES characters (id)
    ON DELETE SET NULL,
  CONSTRAINT campaign_combat_participants_combat_id_unique
    UNIQUE (combat_id, id),
  CONSTRAINT campaign_combat_participants_order_unique
    UNIQUE (combat_id, turn_order)
    DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT campaign_combat_participants_character_type_check
    CHECK (
      participant_type = 'character'
      OR character_id IS NULL
    )
);

ALTER TABLE campaign_combats
  ADD CONSTRAINT campaign_combats_current_participant_fk
  FOREIGN KEY (id, current_participant_id)
  REFERENCES campaign_combat_participants (combat_id, id);

CREATE INDEX campaign_combats_campaign_owner_idx
  ON campaign_combats (campaign_id, owner_id, workspace_type);
CREATE INDEX campaign_combat_participants_character_idx
  ON campaign_combat_participants (character_id)
  WHERE character_id IS NOT NULL;
