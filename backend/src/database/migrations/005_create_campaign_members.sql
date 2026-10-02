CREATE TABLE IF NOT EXISTS campaign_members (

  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL,

  user_id BIGINT NOT NULL,

  role VARCHAR(30) NOT NULL DEFAULT 'player',

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaign_members_campaign_fk
    FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_members_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_members_unique
    UNIQUE (campaign_id, user_id)

);

CREATE INDEX IF NOT EXISTS campaign_members_campaign_idx
  ON campaign_members (campaign_id);

CREATE INDEX IF NOT EXISTS campaign_members_user_idx
  ON campaign_members (user_id);