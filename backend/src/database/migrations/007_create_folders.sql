CREATE TABLE IF NOT EXISTS folders (

  id BIGSERIAL PRIMARY KEY,

  owner_id BIGINT NOT NULL,

  parent_folder_id BIGINT,

  name VARCHAR(120) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT folders_owner_fk
    FOREIGN KEY (owner_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT folders_parent_fk
    FOREIGN KEY (parent_folder_id)
    REFERENCES folders(id)
    ON DELETE CASCADE

);

CREATE INDEX IF NOT EXISTS folders_owner_idx
  ON folders (owner_id);

CREATE INDEX IF NOT EXISTS folders_parent_idx
  ON folders (parent_folder_id);