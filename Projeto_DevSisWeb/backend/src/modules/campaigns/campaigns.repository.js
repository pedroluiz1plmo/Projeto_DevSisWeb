import { pool } from '../../config/database.js';

const normalizeWorkspaceType = (workspaceType = 'player') => (workspaceType === 'master' ? 'master' : 'player');

export const findCampaignAccess = (campaignId, workspaceType = 'player') => pool.query(
  'SELECT id, owner_id, workspace_type FROM campaigns WHERE id = $1 AND workspace_type = $2',
  [campaignId, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignMembership = (campaignId, userId, workspaceType = 'player') => pool.query(
  `SELECT 1
   FROM campaign_members cm
   JOIN campaigns c ON c.id = cm.campaign_id
   WHERE cm.campaign_id = $1
     AND cm.user_id = $2
     AND cm.workspace_type = $3
     AND c.workspace_type = $3
   LIMIT 1`,
  [campaignId, userId, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignsByUser = (userId, workspaceType = 'player') => pool.query(
  `SELECT id, owner_id, name, description, is_active, created_at, updated_at, workspace_type
   FROM campaigns
   WHERE workspace_type = $1
     AND (owner_id = $2 OR id IN (
       SELECT campaign_id FROM campaign_members WHERE user_id = $2 AND workspace_type = $1
     ))
   ORDER BY updated_at DESC`,
  [normalizeWorkspaceType(workspaceType), userId],
);

export const findCampaignById = (id, workspaceType = 'player') => pool.query(
  'SELECT id, owner_id, name, description, is_active, created_at, updated_at, workspace_type FROM campaigns WHERE id = $1 AND workspace_type = $2',
  [id, normalizeWorkspaceType(workspaceType)],
);

export const createCampaign = (userId, name, description, workspaceType = 'player') => pool.query(
  `INSERT INTO campaigns (owner_id, name, description, is_active, workspace_type)
   VALUES ($1, $2, $3, TRUE, $4)
   RETURNING id, owner_id, name, description, is_active, created_at, updated_at, workspace_type`,
  [userId, name, description || null, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignForUpdate = (id, workspaceType = 'player') => pool.query(
  'SELECT id, owner_id, name, description, is_active, workspace_type FROM campaigns WHERE id = $1 AND workspace_type = $2',
  [id, normalizeWorkspaceType(workspaceType)],
);

export const updateCampaign = (id, userId, name, description, isActive, workspaceType = 'player') => pool.query(
  `UPDATE campaigns
   SET name = $1, description = $2, is_active = COALESCE($3, is_active), updated_at = NOW()
   WHERE id = $5 AND owner_id = $6 AND workspace_type = $4
   RETURNING id, owner_id, name, description, is_active, created_at, updated_at, workspace_type`,
  [name, description || null, isActive, normalizeWorkspaceType(workspaceType), id, userId],
);

export const deleteCampaign = (id, userId, workspaceType = 'player') => pool.query(
  'DELETE FROM campaigns WHERE id = $1 AND owner_id = $2 AND workspace_type = $3 RETURNING id',
  [id, userId, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignOwner = (id, workspaceType = 'player') => pool.query(
  'SELECT owner_id FROM campaigns WHERE id = $1 AND workspace_type = $2',
  [id, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignOwnerUser = (ownerId) => pool.query(
  'SELECT id AS user_id, name, username, $1::varchar AS role, NOW() AS joined_at FROM users WHERE id = $2',
  ['owner', ownerId],
);

export const findCampaignMembers = (campaignId, workspaceType = 'player') => pool.query(
  `SELECT cm.user_id, u.name, u.username, cm.role, cm.joined_at
   FROM campaign_members cm
   JOIN users u ON u.id = cm.user_id
   WHERE cm.campaign_id = $1 AND cm.workspace_type = $2
   ORDER BY cm.joined_at DESC`,
  [campaignId, normalizeWorkspaceType(workspaceType)],
);

export const findActiveUser = (userId) => pool.query(
  'SELECT id, name, username FROM users WHERE id = $1 AND is_active = TRUE',
  [userId],
);

export const findCampaignMember = (campaignId, userId, workspaceType = 'player') => pool.query(
  'SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2 AND workspace_type = $3 LIMIT 1',
  [campaignId, userId, normalizeWorkspaceType(workspaceType)],
);

export const createCampaignMember = (campaignId, userId, role, workspaceType = 'player') => pool.query(
  `INSERT INTO campaign_members (campaign_id, user_id, role, workspace_type)
   VALUES ($1, $2, $3, $4)
   RETURNING campaign_id, user_id, role, joined_at`,
  [campaignId, userId, role, normalizeWorkspaceType(workspaceType)],
);

export const updateCampaignMemberRole = (campaignId, userId, role, workspaceType = 'player') => pool.query(
  `UPDATE campaign_members
   SET role = $1
   WHERE campaign_id = $2 AND user_id = $3 AND workspace_type = $4
   RETURNING campaign_id, user_id, role, joined_at`,
  [role, campaignId, userId, normalizeWorkspaceType(workspaceType)],
);

export const deleteCampaignMember = (campaignId, userId, workspaceType = 'player') => pool.query(
  'DELETE FROM campaign_members WHERE campaign_id = $1 AND user_id = $2 AND workspace_type = $3 RETURNING user_id',
  [campaignId, userId, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignCharacters = (campaignId, workspaceType = 'player') => pool.query(
  `SELECT cc.character_id, c.name AS character_name, s.id AS system_id, s.name AS system_name, s.slug AS system_slug, cc.joined_at
   FROM campaign_characters cc
   JOIN characters c ON c.id = cc.character_id
   JOIN systems s ON s.id = c.system_id
   JOIN campaigns camp ON camp.id = cc.campaign_id
   WHERE cc.campaign_id = $1
     AND camp.workspace_type = $2
     AND c.workspace_type = $2
     AND cc.workspace_type = $2
   ORDER BY cc.joined_at DESC`,
  [campaignId, normalizeWorkspaceType(workspaceType)],
);

export const findCharacterById = (characterId, workspaceType = 'player') => pool.query(
  'SELECT id, user_id, name, system_id, workspace_type FROM characters WHERE id = $1 AND workspace_type = $2',
  [characterId, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignCharacter = (campaignId, characterId, workspaceType = 'player') => pool.query(
  `SELECT 1
   FROM campaign_characters cc
   JOIN campaigns camp ON camp.id = cc.campaign_id
   WHERE cc.campaign_id = $1
     AND cc.character_id = $2
     AND camp.workspace_type = $3
     AND cc.workspace_type = $3
   LIMIT 1`,
  [campaignId, characterId, normalizeWorkspaceType(workspaceType)],
);

export const createCampaignCharacter = (campaignId, characterId, workspaceType = 'player') => pool.query(
  `INSERT INTO campaign_characters (campaign_id, character_id, workspace_type)
   VALUES ($1, $2, $3)
   RETURNING campaign_id, character_id, joined_at`,
  [campaignId, characterId, normalizeWorkspaceType(workspaceType)],
);

export const findLinkedCampaignCharacter = (campaignId, characterId, workspaceType = 'player') => pool.query(
  `SELECT cc.character_id, c.name AS character_name, s.id AS system_id, s.name AS system_name, s.slug AS system_slug, cc.joined_at
   FROM campaign_characters cc
   JOIN characters c ON c.id = cc.character_id
   JOIN systems s ON s.id = c.system_id
   JOIN campaigns camp ON camp.id = cc.campaign_id
   WHERE cc.campaign_id = $1
     AND cc.character_id = $2
     AND camp.workspace_type = $3
     AND c.workspace_type = $3
     AND cc.workspace_type = $3`,
  [campaignId, characterId, normalizeWorkspaceType(workspaceType)],
);

export const deleteCampaignCharacter = (campaignId, characterId, userId, workspaceType = 'player') => pool.query(
  `DELETE FROM campaign_characters cc
   USING characters ch, campaigns camp
   WHERE cc.campaign_id = $1
     AND cc.character_id = $2
     AND ch.id = cc.character_id
     AND camp.id = cc.campaign_id
     AND camp.workspace_type = $4
     AND ch.workspace_type = $4
     AND cc.workspace_type = $4
     AND ($3 = camp.owner_id OR ch.user_id = $3)
   RETURNING cc.character_id`,
  [campaignId, characterId, userId, normalizeWorkspaceType(workspaceType)],
);

export const findCampaignCharacterLink = (campaignId, characterId, workspaceType = 'player') => pool.query(
  `SELECT 1
   FROM campaign_characters cc
   JOIN campaigns camp ON camp.id = cc.campaign_id
   WHERE cc.campaign_id = $1
     AND cc.character_id = $2
     AND camp.workspace_type = $3
     AND cc.workspace_type = $3`,
  [campaignId, characterId, normalizeWorkspaceType(workspaceType)],
);
