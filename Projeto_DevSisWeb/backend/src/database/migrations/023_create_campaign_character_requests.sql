CREATE TABLE IF NOT EXISTS campaign_character_requests (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL,

  character_id BIGINT NOT NULL,

  requester_id BIGINT NOT NULL,

  workspace_type VARCHAR(20) NOT NULL DEFAULT 'player',

  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  review_note TEXT,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  reviewed_at TIMESTAMPTZ,

  reviewed_by_user_id BIGINT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaign_character_requests_campaign_fk
    FOREIGN KEY (campaign_id)
    REFERENCES campaigns(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_character_requests_character_fk
    FOREIGN KEY (character_id)
    REFERENCES characters(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_character_requests_requester_fk
    FOREIGN KEY (requester_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT campaign_character_requests_reviewer_fk
    FOREIGN KEY (reviewed_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT campaign_character_requests_workspace_type_check
    CHECK (workspace_type IN ('player', 'master')),

  CONSTRAINT campaign_character_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'removed'))
);

CREATE INDEX IF NOT EXISTS campaign_character_requests_campaign_status_idx
  ON campaign_character_requests (campaign_id, status, requested_at);

CREATE INDEX IF NOT EXISTS campaign_character_requests_user_idx
  ON campaign_character_requests (requester_id, status, requested_at);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_character_requests_pending_unique_idx
  ON campaign_character_requests (campaign_id, requester_id, character_id)
  WHERE status = 'pending';
