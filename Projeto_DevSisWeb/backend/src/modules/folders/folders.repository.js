import { pool } from '../../config/database.js';

const normalizeWorkspaceType = (workspaceType = 'player') => (workspaceType === 'master' ? 'master' : 'player');

export const findByOwner = (ownerId, workspaceType = 'player') => pool.query(
  `SELECT id, owner_id, parent_folder_id, name, created_at, updated_at, workspace_type
   FROM folders
   WHERE owner_id = $1 AND workspace_type = $2
   ORDER BY parent_folder_id NULLS FIRST, name`,
  [ownerId, normalizeWorkspaceType(workspaceType)],
);

export const findByIdAndOwner = (id, ownerId, workspaceType = 'player') => pool.query(
  `SELECT id, owner_id, parent_folder_id, name, created_at, updated_at, workspace_type
   FROM folders WHERE id = $1 AND owner_id = $2 AND workspace_type = $3`,
  [id, ownerId, normalizeWorkspaceType(workspaceType)],
);

export const findIdByOwner = (id, ownerId, workspaceType = 'player') => pool.query(
  'SELECT id FROM folders WHERE id = $1 AND owner_id = $2 AND workspace_type = $3',
  [id, ownerId, normalizeWorkspaceType(workspaceType)],
);

export const create = (ownerId, parentId, name, workspaceType = 'player') => pool.query(
  `INSERT INTO folders (owner_id, parent_folder_id, name, workspace_type)
   VALUES ($1, $2, $3, $4)
   RETURNING id, owner_id, parent_folder_id, name, created_at, updated_at, workspace_type`,
  [ownerId, parentId, name, normalizeWorkspaceType(workspaceType)],
);

export const findParentFolderId = (id, ownerId, workspaceType = 'player') => pool.query(
  'SELECT id, parent_folder_id FROM folders WHERE id = $1 AND owner_id = $2 AND workspace_type = $3',
  [id, ownerId, normalizeWorkspaceType(workspaceType)],
);

export const findDescendant = (id, ownerId, proposedParentId, workspaceType = 'player') => pool.query(
  `WITH RECURSIVE descendants(id) AS (
     SELECT id FROM folders WHERE parent_folder_id = $1 AND owner_id = $2 AND workspace_type = $4
     UNION
     SELECT child.id
     FROM folders child
     JOIN descendants parent ON child.parent_folder_id = parent.id
     WHERE child.owner_id = $2 AND child.workspace_type = $4
   )
   SELECT 1 FROM descendants WHERE id = $3 LIMIT 1`,
  [id, ownerId, proposedParentId, normalizeWorkspaceType(workspaceType)],
);

export const update = (id, ownerId, parentId, name, workspaceType = 'player') => pool.query(
  `UPDATE folders
   SET name = $1, parent_folder_id = $2, updated_at = NOW()
   WHERE id = $3 AND owner_id = $4 AND workspace_type = $5
   RETURNING id, owner_id, parent_folder_id, name, created_at, updated_at, workspace_type`,
  [name, parentId, id, ownerId, normalizeWorkspaceType(workspaceType)],
);

export const remove = (id, ownerId, workspaceType = 'player') => pool.query(
  'DELETE FROM folders WHERE id = $1 AND owner_id = $2 AND workspace_type = $3 RETURNING id',
  [id, ownerId, normalizeWorkspaceType(workspaceType)],
);
