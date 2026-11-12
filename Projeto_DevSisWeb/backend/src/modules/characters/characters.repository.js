import { pool } from '../../config/database.js';

const dndNumericFields = [
  'level',
  'experiencePoints',
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
  'armorClass',
  'maxHitPoints',
  'currentHitPoints',
  'temporaryHitPoints',
];

const dndTextFields = [
  'playerName',
  'class',
  'race',
  'background',
  'alignment',
  'description',
  'initiative',
  'speed',
  'hitDice',
  'proficiencyBonus',
  'skillsAndSavingThrows',
  'attacksAndSpellcasting',
  'equipmentAndTreasure',
  'spellsAndSlots',
  'personalityIdealsBondsFlaws',
  'historyAlliesOrganizations',
];

const dndFields = [...dndTextFields, ...dndNumericFields];
const dndColumns = Object.fromEntries(
  dndFields.map((field) => [
    field,
    field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  ]),
);

const characterFields = `
  SELECT c.id, c.name, c.dados, c.folder_id, c.created_at, c.updated_at, c.workspace_type,
         s.id AS system_id, s.name AS system_name, s.slug AS system_slug,
         sv.id AS version_id, sv.name AS version_name, sv.slug AS version_slug,
         dnd.character_id AS dnd_id,
         dnd.player_name, dnd.class, dnd.level, dnd.race, dnd.background, dnd.alignment,
         dnd.experience_points, dnd.description, dnd.strength, dnd.dexterity, dnd.constitution,
         dnd.intelligence, dnd.wisdom, dnd.charisma, dnd.armor_class, dnd.initiative, dnd.speed,
         dnd.max_hit_points, dnd.current_hit_points, dnd.temporary_hit_points, dnd.hit_dice,
         dnd.proficiency_bonus, dnd.skills_and_saving_throws, dnd.attacks_and_spellcasting,
         dnd.equipment_and_treasure, dnd.spells_and_slots, dnd.personality_ideals_bonds_flaws,
         dnd.history_allies_organizations
  FROM characters c
  JOIN systems s ON s.id = c.system_id
  LEFT JOIN system_versions sv ON sv.id = c.system_version_id
  LEFT JOIN character_dnd_5e dnd ON dnd.character_id = c.id
`;

const extractDndValues = (data = {}) => dndFields.map((field) => {
  const value = data[field];
  if (value === undefined || value === null || value === '') return null;
  if (dndNumericFields.includes(field)) {
    const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return typeof value === 'string' ? value : String(value);
});

const isDnd5eVersion = async (db, systemVersionId) => {
  if (!systemVersionId) return false;
  const versionQuery = await db.query(
    `SELECT s.slug AS system_slug, sv.slug AS version_slug
     FROM system_versions sv
     JOIN systems s ON s.id = sv.system_id
     WHERE sv.id = $1`,
    [systemVersionId],
  );
  if (!versionQuery.rowCount) return false;
  const row = versionQuery.rows[0];
  return row.system_slug === 'dungeons-and-dragons' && row.version_slug === '5e';
};

const upsertDnd5eSheet = async (db, characterId, data) => {
  const values = extractDndValues(data);
  const columnsList = dndFields.map((f) => dndColumns[f]);
  const placeholders = dndFields.map((_, i) => `$${i + 2}`);
  const updateAssignments = columnsList.map((col) => `${col} = EXCLUDED.${col}`);

  await db.query(
    `INSERT INTO character_dnd_5e (character_id, ${columnsList.join(', ')}, updated_at)
     VALUES ($1, ${placeholders.join(', ')}, NOW())
     ON CONFLICT (character_id) DO UPDATE
     SET ${updateAssignments.join(', ')}, updated_at = NOW()`,
    [characterId, ...values],
  );
};

export const findByUser = (userId, workspaceType) => pool.query(
  `${characterFields} WHERE c.user_id = $1 AND c.workspace_type = $2 ORDER BY c.updated_at DESC`,
  [userId, workspaceType],
);

export const findByIdAndUser = (id, userId, workspaceType) => pool.query(
  `${characterFields} WHERE c.id = $1 AND c.user_id = $2 AND c.workspace_type = $3`,
  [id, userId, workspaceType],
);

export const findActiveSystem = (systemId) => pool.query(
  'SELECT id, slug FROM systems WHERE id = $1 AND is_active = TRUE',
  [systemId],
);

export const findSystemVersionById = (versionId) => pool.query(
  'SELECT sv.id, sv.system_id, sv.name, sv.slug FROM system_versions sv WHERE sv.id = $1',
  [versionId],
);

export const findFolderByOwner = (folderId, userId, workspaceType) => pool.query(
  'SELECT id FROM folders WHERE id = $1 AND owner_id = $2 AND workspace_type = $3',
  [folderId, userId, workspaceType],
);

export const create = async (userId, systemId, systemVersionId, folderId, name, data, workspaceType) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO characters (user_id, system_id, system_version_id, folder_id, name, dados, workspace_type)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING id`,
      [userId, systemId, systemVersionId || null, folderId, name, JSON.stringify(data || {}), workspaceType],
    );
    const characterId = result.rows[0].id;

    if (await isDnd5eVersion(client, systemVersionId)) {
      await upsertDnd5eSheet(client, characterId, data);
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const update = async (id, userId, systemId, systemVersionId, folderId, name, data, workspaceType) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE characters
       SET name = $1, system_id = $2, system_version_id = $3, folder_id = $4,
           dados = $5::jsonb, updated_at = NOW()
       WHERE id = $6 AND user_id = $7 AND workspace_type = $8
       RETURNING id`,
      [name, systemId, systemVersionId || null, folderId, JSON.stringify(data || {}), id, userId, workspaceType],
    );

    if (result.rowCount) {
      if (await isDnd5eVersion(client, systemVersionId)) {
        await upsertDnd5eSheet(client, id, data);
      } else {
        await client.query('DELETE FROM character_dnd_5e WHERE character_id = $1', [id]);
      }
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const remove = (id, userId, workspaceType) => pool.query(
  'DELETE FROM characters WHERE id = $1 AND user_id = $2 AND workspace_type = $3 RETURNING id',
  [id, userId, workspaceType],
);
