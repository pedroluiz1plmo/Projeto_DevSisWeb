import { pool } from '../../config/database.js';

const monsterFields = `
  SELECT monster.id, monster.campaign_id, monster.owner_id, monster.workspace_type,
         monster.system_version_id, monster.name, monster.data,
         monster.created_at, monster.updated_at,
         monster.system_id, version.name AS version_name, version.slug AS version_slug,
         system.name AS system_name, system.slug AS system_slug
  FROM monsters monster
  JOIN system_versions version
    ON version.system_id = monster.system_id AND version.id = monster.system_version_id
  JOIN systems system ON system.id = monster.system_id
`;

export const findOwnedCampaign = (campaignId, ownerId, workspaceType) => pool.query(
  `SELECT id, owner_id FROM campaigns
   WHERE id = $1 AND owner_id = $2 AND workspace_type = $3`,
  [campaignId, ownerId, workspaceType],
);

export const findSystemVersion = (systemId, versionId) => pool.query(
  `SELECT version.id, version.system_id, version.name, version.slug,
          system.name AS system_name, system.slug AS system_slug
   FROM system_versions version
   JOIN systems system ON system.id = version.system_id
   WHERE version.id = $1 AND version.system_id = $2 AND system.is_active = TRUE`,
  [versionId, systemId],
);

export const findByCampaign = (campaignId, ownerId) => pool.query(
  `${monsterFields}
   WHERE monster.campaign_id = $1 AND monster.owner_id = $2 AND monster.workspace_type = 'master'
   ORDER BY monster.updated_at DESC, monster.id DESC`,
  [campaignId, ownerId],
);

export const findById = (campaignId, monsterId, ownerId) => pool.query(
  `${monsterFields}
   WHERE monster.campaign_id = $1 AND monster.id = $2
     AND monster.owner_id = $3 AND monster.workspace_type = 'master'`,
  [campaignId, monsterId, ownerId],
);

export const create = (campaignId, ownerId, systemId, systemVersionId, name, data) => pool.query(
  `INSERT INTO monsters
    (campaign_id, owner_id, workspace_type, system_id, system_version_id, name, data)
   VALUES ($1, $2, 'master', $3, $4, $5, $6::jsonb)
   RETURNING id`,
  [campaignId, ownerId, systemId, systemVersionId, name, JSON.stringify(data)],
);

export const update = (campaignId, monsterId, ownerId, systemId, systemVersionId, name, data) => pool.query(
  `UPDATE monsters
   SET system_id = $1, system_version_id = $2, name = $3, data = $4::jsonb,
       updated_at = NOW()
   WHERE campaign_id = $5 AND id = $6 AND owner_id = $7 AND workspace_type = 'master'
   RETURNING id`,
  [systemId, systemVersionId, name, JSON.stringify(data), campaignId, monsterId, ownerId],
);

export const remove = (campaignId, monsterId, ownerId) => pool.query(
  `DELETE FROM monsters
   WHERE campaign_id = $1 AND id = $2 AND owner_id = $3 AND workspace_type = 'master'
   RETURNING id`,
  [campaignId, monsterId, ownerId],
);
