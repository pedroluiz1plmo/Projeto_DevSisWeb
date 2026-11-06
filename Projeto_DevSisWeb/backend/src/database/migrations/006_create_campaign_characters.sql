CREATE TABLE IF NOT EXISTS campaign_characters (

  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL,

  character_id BIGINT NOT NULL,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaign_characters_campaign_fk
    FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_characters_character_fk
    FOREIGN KEY (character_id)
    REFERENCES characters(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_characters_unique
    UNIQUE (campaign_id, character_id)

);

CREATE INDEX IF NOT EXISTS campaign_characters_campaign_idx
  ON campaign_characters (campaign_id);

CREATE INDEX IF NOT EXISTS campaign_characters_character_idx
  ON campaign_characters (character_id);