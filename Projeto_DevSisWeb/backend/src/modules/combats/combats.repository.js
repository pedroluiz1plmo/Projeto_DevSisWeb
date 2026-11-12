import { pool } from '../../config/database.js';

const combatSelect = `
  SELECT id, campaign_id, owner_id, workspace_type, name, status,
         current_round, current_participant_id, created_at, updated_at
  FROM campaign_combats
`;

const participantSelect = `
  SELECT id, combat_id, campaign_id, character_id, participant_type, name,
         initiative_value, turn_order, created_at, updated_at
  FROM campaign_combat_participants
`;

export const transaction = async (operation) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const findCampaignAccess = (campaignId, userId) => pool.query(
  `SELECT campaign.id, campaign.owner_id
   FROM campaigns campaign
   WHERE campaign.id = $1
     AND campaign.workspace_type = 'master'
     AND (
       campaign.owner_id = $2
       OR EXISTS (
         SELECT 1 FROM campaign_members member
         WHERE member.campaign_id = campaign.id
           AND member.user_id = $2
           AND member.workspace_type = 'master'
       )
     )`,
  [campaignId, userId],
);

export const findOwnedCampaign = (campaignId, ownerId) => pool.query(
  `SELECT id, owner_id FROM campaigns
   WHERE id = $1 AND owner_id = $2 AND workspace_type = 'master'`,
  [campaignId, ownerId],
);

export const findCombatAccess = (combatId, userId) => pool.query(
  `SELECT combat.id, combat.campaign_id, combat.owner_id,
          combat.workspace_type, combat.name, combat.status,
          combat.current_round, combat.current_participant_id,
          combat.created_at, combat.updated_at
   FROM campaign_combats combat
   JOIN campaigns campaign ON campaign.id = combat.campaign_id
   WHERE combat.id = $1
     AND combat.workspace_type = 'master'
     AND campaign.workspace_type = 'master'
     AND (
       combat.owner_id = $2
       OR EXISTS (
         SELECT 1 FROM campaign_members member
         WHERE member.campaign_id = combat.campaign_id
           AND member.user_id = $2
           AND member.workspace_type = 'master'
       )
     )`,
  [combatId, userId],
);

export const findOwnedCombat = (combatId, ownerId, executor = pool) => executor.query(
  `${combatSelect}
   WHERE id = $1 AND owner_id = $2 AND workspace_type = 'master'`,
  [combatId, ownerId],
);

export const findCombatsByCampaign = (campaignId, ownerId) => pool.query(
  `${combatSelect}
   WHERE campaign_id = $1 AND owner_id = $2 AND workspace_type = 'master'
   ORDER BY created_at DESC, id DESC`,
  [campaignId, ownerId],
);

export const findParticipants = (combatId, executor = pool) => executor.query(
  `${participantSelect}
   WHERE combat_id = $1
   ORDER BY turn_order ASC, id ASC`,
  [combatId],
);

export const findLinkedCharacter = (campaignId, characterId, executor = pool) =>
  executor.query(
    `SELECT character.id, character.name
     FROM campaign_characters link
     JOIN characters character ON character.id = link.character_id
     WHERE link.campaign_id = $1
       AND link.character_id = $2
       AND link.workspace_type = 'master'
       AND character.workspace_type = 'master'`,
    [campaignId, characterId],
  );

export const createCombat = (campaignId, ownerId, name) => pool.query(
  `INSERT INTO campaign_combats
    (campaign_id, owner_id, workspace_type, name)
   VALUES ($1, $2, 'master', $3)
   RETURNING id`,
  [campaignId, ownerId, name],
);

export const updateCombatName = (
  combatId,
  ownerId,
  name,
  executor = pool,
) => executor.query(
  `UPDATE campaign_combats
   SET name = $1, updated_at = NOW()
   WHERE id = $2 AND owner_id = $3
     AND workspace_type = 'master' AND status <> 'finished'
   RETURNING id`,
  [name, combatId, ownerId],
);

export const lockOwnedCombat = (combatId, ownerId, executor) => executor.query(
  `SELECT id, campaign_id, owner_id, status, current_round,
          current_participant_id
   FROM campaign_combats
   WHERE id = $1 AND owner_id = $2 AND workspace_type = 'master'
   FOR UPDATE`,
  [combatId, ownerId],
);

export const deleteOwnedCombat = (combatId, ownerId, executor) => executor.query(
  `DELETE FROM campaign_combats
   WHERE id = $1 AND owner_id = $2 AND workspace_type = 'master'
   RETURNING id`,
  [combatId, ownerId],
);

export const insertParticipant = (
  combat,
  participant,
  executor,
) => executor.query(
  `INSERT INTO campaign_combat_participants
    (combat_id, campaign_id, owner_id, workspace_type, character_id,
     participant_type, name, initiative_value, turn_order)
   SELECT $1, $2, $3, 'master', $4, $5, $6, $7,
          COALESCE(MAX(turn_order), 0) + 1
   FROM campaign_combat_participants
   WHERE combat_id = $1
   RETURNING id`,
  [
    combat.id,
    combat.campaign_id,
    combat.owner_id,
    participant.characterId,
    participant.type,
    participant.name,
    participant.initiativeValue,
  ],
);

export const updateParticipantRow = (
  combatId,
  participantId,
  participant,
  executor = pool,
) => executor.query(
  `UPDATE campaign_combat_participants
   SET character_id = $1, participant_type = $2, name = $3,
       initiative_value = $4, updated_at = NOW()
   WHERE combat_id = $5 AND id = $6
   RETURNING id`,
  [
    participant.characterId,
    participant.type,
    participant.name,
    participant.initiativeValue,
    combatId,
    participantId,
  ],
);

export const findParticipant = (combatId, participantId, executor = pool) =>
  executor.query(
    `${participantSelect} WHERE combat_id = $1 AND id = $2`,
    [combatId, participantId],
  );

export const deleteParticipant = (combatId, participantId, executor) =>
  executor.query(
    `DELETE FROM campaign_combat_participants
     WHERE combat_id = $1 AND id = $2
     RETURNING turn_order`,
    [combatId, participantId],
  );

export const updateTurnPointer = (
  combatId,
  ownerId,
  round,
  participantId,
  status,
  executor,
) => executor.query(
  `UPDATE campaign_combats
   SET current_round = $1, current_participant_id = $2,
       status = COALESCE($3, status), updated_at = NOW()
   WHERE id = $4 AND owner_id = $5 AND workspace_type = 'master'
   RETURNING id`,
  [round, participantId, status, combatId, ownerId],
);

export const finishCombat = (combatId, ownerId, executor) => executor.query(
  `UPDATE campaign_combats
   SET status = 'finished', updated_at = NOW()
   WHERE id = $1 AND owner_id = $2
     AND workspace_type = 'master' AND status <> 'finished'
   RETURNING id`,
  [combatId, ownerId],
);

export const startCombat = (combatId, ownerId, participantId, executor = pool) =>
  executor.query(
    `UPDATE campaign_combats
     SET status = 'active', current_round = 1,
         current_participant_id = $1, updated_at = NOW()
     WHERE id = $2 AND owner_id = $3
       AND workspace_type = 'master' AND status = 'preparing'
     RETURNING id`,
    [participantId, combatId, ownerId],
  );

export const updateParticipantOrders = async (
  combatId,
  participantIds,
  executor,
) => {
  await executor.query(
    `SET CONSTRAINTS campaign_combat_participants_order_unique DEFERRED`,
  );
  for (const [index, participantId] of participantIds.entries()) {
    await executor.query(
      `UPDATE campaign_combat_participants
       SET turn_order = $1, updated_at = NOW()
       WHERE combat_id = $2 AND id = $3`,
      [index + 1, combatId, participantId],
    );
  }
};
