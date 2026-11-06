ALTER TABLE characters
  ADD COLUMN folder_id BIGINT;

ALTER TABLE characters
  ADD CONSTRAINT characters_folder_owner_workspace_fk
  FOREIGN KEY (folder_id, user_id, workspace_type)
  REFERENCES folders (id, owner_id, workspace_type);

CREATE INDEX characters_folder_idx ON characters (folder_id);

CREATE FUNCTION detach_characters_from_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE characters
  SET folder_id = NULL, updated_at = NOW()
  WHERE folder_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER folders_detach_characters
  BEFORE DELETE ON folders
  FOR EACH ROW EXECUTE FUNCTION detach_characters_from_folder();
