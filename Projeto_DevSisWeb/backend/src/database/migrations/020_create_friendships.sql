CREATE TABLE friendship_requests (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  recipient_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friendship_requests_distinct_users CHECK (requester_id <> recipient_id)
);

CREATE UNIQUE INDEX friendship_requests_one_pending_per_pair_idx
  ON friendship_requests (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id))
  WHERE status = 'pending';
CREATE INDEX friendship_requests_recipient_status_idx
  ON friendship_requests (recipient_id, status, created_at DESC);
CREATE INDEX friendship_requests_requester_status_idx
  ON friendship_requests (requester_id, status, created_at DESC);

CREATE TABLE friendships (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friendships_distinct_users CHECK (user_id < friend_id),
  CONSTRAINT friendships_unique_pair UNIQUE (user_id, friend_id)
);

CREATE INDEX friendships_friend_id_idx ON friendships (friend_id);
