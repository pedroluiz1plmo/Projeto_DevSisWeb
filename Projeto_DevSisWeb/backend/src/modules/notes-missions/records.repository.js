import { pool } from '../../config/database.js';

const tables = {
  notes: {
    columns: 'id, client_id, owner_id, workspace_type, folder_id, campaign_id, title, content, created_at, updated_at',
  },
  missions: {
    columns: 'id, client_id, owner_id, workspace_type, folder_id, campaign_id, title, description, reward, status, created_at, updated_at',
  },
};

export const findAll = (table, ownerId, workspaceType) => pool.query(
  `SELECT ${tables[table].columns}
   FROM ${table}
   WHERE owner_id = $1 AND workspace_type = $2
   ORDER BY updated_at DESC, id DESC`,
  [ownerId, workspaceType],
);

export const findById = (table, id, ownerId, workspaceType) => pool.query(
  `SELECT ${tables[table].columns}
   FROM ${table}
   WHERE id = $1 AND owner_id = $2 AND workspace_type = $3`,
  [id, ownerId, workspaceType],
);

export const findByClientId = (table, clientId, ownerId, workspaceType) => pool.query(
  `SELECT id FROM ${table}
   WHERE client_id = $1 AND owner_id = $2 AND workspace_type = $3
   LIMIT 1`,
  [clientId, ownerId, workspaceType],
);

export const findFolder = (id, ownerId, workspaceType) => pool.query(
  'SELECT id FROM folders WHERE id = $1 AND owner_id = $2 AND workspace_type = $3',
  [id, ownerId, workspaceType],
);

export const findCampaignAccess = (id, ownerId, workspaceType) => pool.query(
  `SELECT 1
   FROM campaigns campaign
   WHERE campaign.id = $1
     AND campaign.workspace_type = $3
     AND (
       campaign.owner_id = $2
       OR EXISTS (
         SELECT 1
         FROM campaign_members member
         WHERE member.campaign_id = campaign.id
           AND member.user_id = $2
           AND member.workspace_type = $3
       )
     )
   LIMIT 1`,
  [id, ownerId, workspaceType],
);

export const create = (table, values) => {
  const { ownerId, workspaceType, clientId, folderId, campaignId } = values;
  if (table === 'notes') {
    return pool.query(
      `INSERT INTO notes (owner_id, workspace_type, client_id, folder_id, campaign_id, title, content)
       VALUES ($1, $2, COALESCE($3::uuid, gen_random_uuid()), $4, $5, $6, $7)
       ON CONFLICT (owner_id, workspace_type, client_id)
       DO UPDATE SET folder_id = EXCLUDED.folder_id, campaign_id = EXCLUDED.campaign_id,
                     title = EXCLUDED.title, content = EXCLUDED.content, updated_at = NOW()
       RETURNING ${tables.notes.columns}`,
      [ownerId, workspaceType, clientId, folderId, campaignId, values.title, values.content],
    );
  }
  return pool.query(
    `INSERT INTO missions (owner_id, workspace_type, client_id, folder_id, campaign_id, title, description, reward, status)
     VALUES ($1, $2, COALESCE($3::uuid, gen_random_uuid()), $4, $5, $6, $7, $8, $9)
     ON CONFLICT (owner_id, workspace_type, client_id)
     DO UPDATE SET folder_id = EXCLUDED.folder_id, campaign_id = EXCLUDED.campaign_id,
                   title = EXCLUDED.title, description = EXCLUDED.description,
                   reward = EXCLUDED.reward, status = EXCLUDED.status, updated_at = NOW()
     RETURNING ${tables.missions.columns}`,
    [ownerId, workspaceType, clientId, folderId, campaignId, values.title,
      values.description, values.reward, values.status],
  );
};

export const update = (table, id, ownerId, workspaceType, values) => {
  if (table === 'notes') {
    return pool.query(
      `UPDATE notes
       SET folder_id = $1, campaign_id = $2, title = $3, content = $4, updated_at = NOW()
       WHERE id = $5 AND owner_id = $6 AND workspace_type = $7
       RETURNING ${tables.notes.columns}`,
      [values.folderId, values.campaignId, values.title, values.content, id, ownerId, workspaceType],
    );
  }
  return pool.query(
    `UPDATE missions
     SET folder_id = $1, campaign_id = $2, title = $3, description = $4,
         reward = $5, status = $6, updated_at = NOW()
     WHERE id = $7 AND owner_id = $8 AND workspace_type = $9
     RETURNING ${tables.missions.columns}`,
    [values.folderId, values.campaignId, values.title, values.description,
      values.reward, values.status, id, ownerId, workspaceType],
  );
};

export const remove = (table, id, ownerId, workspaceType) => pool.query(
  `DELETE FROM ${table} WHERE id = $1 AND owner_id = $2 AND workspace_type = $3 RETURNING id`,
  [id, ownerId, workspaceType],
);
