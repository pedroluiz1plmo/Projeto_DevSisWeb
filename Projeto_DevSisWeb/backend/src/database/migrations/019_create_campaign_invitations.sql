CREATE TABLE campaign_invite_codes (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  owner_id BIGINT NOT NULL,
  workspace_type VARCHAR(20) NOT NULL DEFAULT 'master'
    CHECK (workspace_type = 'master'),
  code_hash CHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT campaign_invite_codes_campaign_fk
    FOREIGN KEY (campaign_id, owner_id, workspace_type)
    REFERENCES campaigns (id, owner_id, workspace_type)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX campaign_invite_codes_one_active_per_campaign_idx
  ON campaign_invite_codes (campaign_id)
  WHERE status = 'active';

CREATE TABLE campaign_join_requests (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  requester_id BIGINT NOT NULL,
  invite_code_id BIGINT,
  workspace_type VARCHAR(20) NOT NULL DEFAULT 'master'
    CHECK (workspace_type = 'master'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT,
  CONSTRAINT campaign_join_requests_campaign_fk
    FOREIGN KEY (campaign_id, workspace_type)
    REFERENCES campaigns (id, workspace_type)
    ON DELETE CASCADE,
  CONSTRAINT campaign_join_requests_requester_fk
    FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT campaign_join_requests_invite_fk
    FOREIGN KEY (invite_code_id)
    REFERENCES campaign_invite_codes (id)
    ON DELETE SET NULL,
  CONSTRAINT campaign_join_requests_reviewer_fk
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX campaign_join_requests_one_pending_per_user_idx
  ON campaign_join_requests (campaign_id, requester_id)
  WHERE status = 'pending';
CREATE INDEX campaign_join_requests_owner_queue_idx
  ON campaign_join_requests (campaign_id, status, requested_at);
CREATE INDEX campaign_join_requests_user_idx
  ON campaign_join_requests (requester_id, status, requested_at);

CREATE TABLE campaign_user_invitations (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL,
  invited_by BIGINT NOT NULL,
  workspace_type VARCHAR(20) NOT NULL DEFAULT 'master'
    CHECK (workspace_type = 'master'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT campaign_user_invitations_campaign_fk
    FOREIGN KEY (campaign_id, invited_by, workspace_type)
    REFERENCES campaigns (id, owner_id, workspace_type)
    ON DELETE CASCADE,
  CONSTRAINT campaign_user_invitations_target_fk
    FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX campaign_user_invitations_one_pending_idx
  ON campaign_user_invitations (campaign_id, target_user_id)
  WHERE status = 'pending';
CREATE INDEX campaign_user_invitations_target_idx
  ON campaign_user_invitations (target_user_id, status, invited_at);

CREATE TABLE campaign_invite_attempts (
  user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failed_attempts SMALLINT NOT NULL DEFAULT 0
    CHECK (failed_attempts BETWEEN 0 AND 5)
);
