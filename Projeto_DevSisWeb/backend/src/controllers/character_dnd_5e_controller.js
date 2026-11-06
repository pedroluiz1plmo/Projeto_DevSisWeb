import { pool } from '../config/database.js';

const numericFields = [
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

const textFields = [
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

const fields = [...textFields, ...numericFields];
const columns = Object.fromEntries(
  fields.map((field) => [
    field,
    field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
  ]),
);
const validId = (value) => /^\d+$/.test(String(value));

const serialize = (row) => {
  const result = {
    characterId: String(row.character_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  for (const field of fields) result[field] = row[columns[field]];
  return result;
};

const validatePayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Informe os dados da ficha em um objeto JSON.';
  }

  const unexpected = Object.keys(body).filter((key) => !fields.includes(key));
  if (unexpected.length) return `Campo não suportado: ${unexpected[0]}.`;

  for (const field of textFields) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      return `O campo ${field} deve ser textual.`;
    }
  }

  for (const field of numericFields) {
    const value = body[field];
    if (value === undefined || value === null || value === '') continue;
    const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (
      typeof parsed !== 'number'
      || !Number.isSafeInteger(parsed)
      || parsed < -2147483648
      || parsed > 2147483647
    ) {
      return `O campo ${field} deve ser um número inteiro válido.`;
    }
    if (field === 'level' && parsed < 1) return 'O nível deve ser maior ou igual a 1.';
  }

  return null;
};

const getOwnedDndCharacter = async (characterId, userId, workspaceType) => {
  const result = await pool.query(
    `SELECT c.id, c.system_id, c.system_version_id, sv.system_id AS version_system_id,
            s.slug AS system_slug, sv.slug AS version_slug
     FROM characters c
     LEFT JOIN system_versions sv ON sv.id = c.system_version_id
     LEFT JOIN systems s ON s.id = sv.system_id
     WHERE c.id = $1 AND c.user_id = $2 AND c.workspace_type = $3`,
    [characterId, userId, workspaceType],
  );
  if (!result.rowCount) {
    return { error: { status: 404, body: { success: false, message: 'Personagem não encontrado.' } } };
  }

  const character = result.rows[0];
  if (
    !character.system_version_id
    || character.system_slug !== 'dungeons-and-dragons'
    || character.version_slug !== '5e'
    || String(character.system_id) !== String(character.version_system_id)
  ) {
    return {
      error: {
        status: 409,
        body: { success: false, message: 'A personagem não está vinculada à versão Dungeons & Dragons 5E.' },
      },
    };
  }
  return { character };
};

const selectSheet = async (characterId) => pool.query(
  `SELECT ${[
    'character_id',
    ...fields.map((field) => columns[field]),
    'created_at',
    'updated_at',
  ].join(', ')}
   FROM character_dnd_5e
   WHERE character_id = $1`,
  [characterId],
);

const saveValues = (body) => fields.map((field) => {
  const value = body[field];
  return value === undefined || value === '' ? null : value;
});

const sheetColumns = fields.map((field) => columns[field]);
const placeholders = fields.map((_, index) => `$${index + 2}`);

export const getDnd5eSheet = async (characterId, userId, workspaceType) => {
  if (!validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Identificador de personagem inválido.' } };
  }
  const access = await getOwnedDndCharacter(characterId, userId, workspaceType);
  if (access.error) return access.error;

  const result = await selectSheet(characterId);
  return result.rowCount
    ? { status: 200, body: { success: true, sheet: serialize(result.rows[0]) } }
    : { status: 404, body: { success: false, message: 'Ficha D&D 5E não encontrada.' } };
};

export const createDnd5eSheet = async (characterId, userId, workspaceType, body) => {
  if (!validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Identificador de personagem inválido.' } };
  }
  const validationError = validatePayload(body);
  if (validationError) return { status: 400, body: { success: false, message: validationError } };

  const access = await getOwnedDndCharacter(characterId, userId, workspaceType);
  if (access.error) return access.error;

  const values = saveValues(body);
  try {
    const result = await pool.query(
      `INSERT INTO character_dnd_5e (character_id, ${sheetColumns.join(', ')})
       SELECT c.id, ${placeholders.join(', ')}
       FROM characters c
       JOIN system_versions sv ON sv.id = c.system_version_id
       JOIN systems s ON s.id = sv.system_id
       WHERE c.id = $1
         AND c.user_id = $${fields.length + 2}
         AND c.workspace_type = $${fields.length + 3}
         AND c.system_id = sv.system_id
         AND s.slug = 'dungeons-and-dragons'
         AND sv.slug = '5e'`,
      [characterId, ...values, userId, workspaceType],
    );
    if (!result.rowCount) {
      const currentAccess = await getOwnedDndCharacter(characterId, userId, workspaceType);
      return currentAccess.error || {
        status: 409,
        body: { success: false, message: 'A personagem não está vinculada à versão Dungeons & Dragons 5E.' },
      };
    }
  } catch (error) {
    if (error.code === '23505') {
      return { status: 409, body: { success: false, message: 'A personagem já possui uma ficha D&D 5E.' } };
    }
    throw error;
  }
  await pool.query(
    `UPDATE characters
     SET dados = COALESCE(dados, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND user_id = $3 AND workspace_type = $4`,
    [JSON.stringify(body), characterId, userId, workspaceType],
  );
  const result = await selectSheet(characterId);
  return { status: 201, body: { success: true, sheet: serialize(result.rows[0]) } };
};

export const updateDnd5eSheet = async (characterId, userId, workspaceType, body) => {
  if (!validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Identificador de personagem inválido.' } };
  }
  const validationError = validatePayload(body);
  if (validationError) return { status: 400, body: { success: false, message: validationError } };

  const access = await getOwnedDndCharacter(characterId, userId, workspaceType);
  if (access.error) return access.error;

  const assignments = sheetColumns.map((column, index) => `${column} = $${index + 2}`);
  const values = saveValues(body);
  const result = await pool.query(
    `UPDATE character_dnd_5e sheet
     SET ${assignments.join(', ')}, updated_at = NOW()
     FROM characters c
     JOIN system_versions sv ON sv.id = c.system_version_id
     JOIN systems s ON s.id = sv.system_id
     WHERE sheet.character_id = c.id
       AND c.id = $1
       AND c.user_id = $${fields.length + 2}
       AND c.workspace_type = $${fields.length + 3}
       AND c.system_id = sv.system_id
       AND s.slug = 'dungeons-and-dragons'
       AND sv.slug = '5e'
     RETURNING sheet.character_id`,
    [characterId, ...values, userId, workspaceType],
  );
  if (!result.rowCount) {
    const sheet = await selectSheet(characterId);
    return sheet.rowCount
      ? {
          status: 409,
          body: { success: false, message: 'A personagem não está vinculada à versão Dungeons & Dragons 5E.' },
        }
      : { status: 404, body: { success: false, message: 'Ficha D&D 5E não encontrada.' } };
  }

  await pool.query(
    `UPDATE characters
     SET dados = COALESCE(dados, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND user_id = $3 AND workspace_type = $4`,
    [JSON.stringify(body), characterId, userId, workspaceType],
  );

  const updated = await selectSheet(characterId);
  return { status: 200, body: { success: true, sheet: serialize(updated.rows[0]) } };
};

export const deleteDnd5eSheet = async (characterId, userId, workspaceType) => {
  if (!validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Identificador de personagem inválido.' } };
  }
  const access = await getOwnedDndCharacter(characterId, userId, workspaceType);
  if (access.error) return access.error;

  const result = await pool.query(
    `DELETE FROM character_dnd_5e sheet
     USING characters c
     JOIN system_versions sv ON sv.id = c.system_version_id
     JOIN systems s ON s.id = sv.system_id
     WHERE sheet.character_id = c.id
       AND c.id = $1
       AND c.user_id = $2
       AND c.workspace_type = $3
       AND c.system_id = sv.system_id
       AND s.slug = 'dungeons-and-dragons'
       AND sv.slug = '5e'
     RETURNING sheet.character_id`,
    [characterId, userId, workspaceType],
  );
  if (!result.rowCount) {
    const sheet = await selectSheet(characterId);
    return sheet.rowCount
      ? {
          status: 409,
          body: { success: false, message: 'A personagem não está vinculada à versão Dungeons & Dragons 5E.' },
        }
      : { status: 404, body: { success: false, message: 'Ficha D&D 5E não encontrada.' } };
  }
  await pool.query(
    `UPDATE characters
     SET dados = '{}'::jsonb, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND workspace_type = $3`,
    [characterId, userId, workspaceType],
  );
  return { status: 200, body: { success: true, message: 'Ficha D&D 5E excluída.' } };
};
