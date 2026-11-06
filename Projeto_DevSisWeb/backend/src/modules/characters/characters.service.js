import * as charactersRepository from './characters.repository.js';
import { withPlanResourceLimit } from '../../services/plan_access_service.js';

const validId = (value) => /^\d+$/.test(String(value));
const validName = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
const validData = (value) => value === undefined || (value !== null && typeof value === 'object' && !Array.isArray(value));
const validWorkspaceType = (value) => value === 'player' || value === 'master';

const resolveWorkspaceType = (value, fallback = 'player') => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return validWorkspaceType(normalized) ? normalized : fallback;
};

const resolveLegacyCreateArgs = (userId, workspaceTypeOrBody, maybeBody = {}) => {
  if (workspaceTypeOrBody && typeof workspaceTypeOrBody === 'object' && !Array.isArray(workspaceTypeOrBody)) {
    return { userId, workspaceType: 'player', body: workspaceTypeOrBody };
  }
  return { userId, workspaceType: resolveWorkspaceType(workspaceTypeOrBody, 'player'), body: maybeBody ?? {} };
};

const resolveLegacyUpdateArgs = (id, userId, workspaceTypeOrBody, maybeBody = {}) => {
  if (workspaceTypeOrBody && typeof workspaceTypeOrBody === 'object' && !Array.isArray(workspaceTypeOrBody)) {
    return { id, userId, workspaceType: 'player', body: workspaceTypeOrBody };
  }
  return { id, userId, workspaceType: resolveWorkspaceType(workspaceTypeOrBody, 'player'), body: maybeBody ?? {} };
};

const serialize = (row) => {
  let data = row.dados || {};
  if (row.dnd_id) {
    const dndData = {
      playerName: row.player_name,
      class: row.class,
      level: row.level,
      race: row.race,
      background: row.background,
      alignment: row.alignment,
      experiencePoints: row.experience_points,
      description: row.description,
      strength: row.strength,
      dexterity: row.dexterity,
      constitution: row.constitution,
      intelligence: row.intelligence,
      wisdom: row.wisdom,
      charisma: row.charisma,
      armorClass: row.armor_class,
      initiative: row.initiative,
      speed: row.speed,
      maxHitPoints: row.max_hit_points,
      currentHitPoints: row.current_hit_points,
      temporaryHitPoints: row.temporary_hit_points,
      hitDice: row.hit_dice,
      proficiencyBonus: row.proficiency_bonus,
      skillsAndSavingThrows: row.skills_and_saving_throws,
      attacksAndSpellcasting: row.attacks_and_spellcasting,
      equipmentAndTreasure: row.equipment_and_treasure,
      spellsAndSlots: row.spells_and_slots,
      personalityIdealsBondsFlaws: row.personality_ideals_bonds_flaws,
      historyAlliesOrganizations: row.history_allies_organizations,
    };
    data = { ...data, ...dndData };
  }
  return {
    id: String(row.id),
    name: row.name,
    data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workspaceType: row.workspace_type,
    system: { id: String(row.system_id), name: row.system_name, slug: row.system_slug },
    version: row.version_id ? {
      id: String(row.version_id),
      systemId: String(row.system_id),
      name: row.version_name,
      slug: row.version_slug,
    } : null,
    folderId: row.folder_id === null || row.folder_id === undefined ? null : String(row.folder_id),
  };
};

export const listCharacters = async (userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  const result = await charactersRepository.findByUser(userId, normalizedWorkspaceType);
  return { status: 200, body: { success: true, characters: result.rows.map(serialize) } };
};

export const getCharacter = async (id, userId, workspaceType = 'player') => {
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador de personagem inválido.' } };
  }
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  const result = await charactersRepository.findByIdAndUser(id, userId, normalizedWorkspaceType);
  return result.rowCount
    ? { status: 200, body: { success: true, character: serialize(result.rows[0]) } }
    : { status: 404, body: { success: false, message: 'Personagem não encontrado.' } };
};

export const createCharacter = async (userId, workspaceTypeOrBody, maybeBody = {}) => {
  const { workspaceType, body } = resolveLegacyCreateArgs(userId, workspaceTypeOrBody, maybeBody);
  if (!validName(body.name) || !validId(body.systemId) || !validData(body.data)) {
    return { status: 400, body: { success: false, message: 'Informe nome, sistema e dados válidos para o personagem.' } };
  }
  const system = await charactersRepository.findActiveSystem(body.systemId);
  if (!system.rowCount) {
    return { status: 404, body: { success: false, message: 'Sistema não encontrado.' } };
  }
  const folderId = await validateFolder(body.folderId, userId, workspaceType);
  if (folderId.error) return folderId.error;

  const requestedVersionId = body.systemVersionId ?? body.system_version_id ?? null;
  let systemVersionId = null;

  if (requestedVersionId !== null && requestedVersionId !== undefined && requestedVersionId !== '') {
    if (!validId(requestedVersionId)) {
      return { status: 400, body: { success: false, message: 'Identificador da versão do sistema inválido.' } };
    }
    const versionQuery = await charactersRepository.findSystemVersionById(requestedVersionId);
    if (!versionQuery.rowCount) {
      return { status: 404, body: { success: false, message: 'Versão do sistema não encontrada.' } };
    }
    if (String(versionQuery.rows[0].system_id) !== String(body.systemId)) {
      return { status: 400, body: { success: false, message: 'A versão informada não pertence ao sistema selecionado.' } };
    }
    systemVersionId = String(requestedVersionId);
  }

  if (body.data && body.data.level !== undefined && body.data.level !== null && body.data.level !== '') {
    const parsedLevel = typeof body.data.level === 'string' && body.data.level.trim() !== ''
      ? Number(body.data.level)
      : body.data.level;
    if (!Number.isSafeInteger(parsedLevel) || parsedLevel < 1) {
      return { status: 400, body: { success: false, message: 'O nível deve ser maior ou igual a 1.' } };
    }
  }

  const creation = await withPlanResourceLimit(userId, 'characters', () => charactersRepository.create(
    userId,
    body.systemId,
    systemVersionId,
    folderId.value,
    body.name.trim(),
    body.data,
    workspaceType,
  ));
  if (creation.error) return creation.error;
  const result = creation.result;
  const character = await getCharacter(result.rows[0].id, userId, workspaceType);
  return { status: 201, body: character.body };
};

export const updateCharacter = async (id, userId, workspaceTypeOrBody, maybeBody = {}) => {
  const { workspaceType, body } = resolveLegacyUpdateArgs(id, userId, workspaceTypeOrBody, maybeBody);
  if (!validId(id) || !validName(body.name) || !validId(body.systemId) || !validData(body.data)) {
    return { status: 400, body: { success: false, message: 'Informe nome, sistema e dados válidos para o personagem.' } };
  }
  const existing = await charactersRepository.findByIdAndUser(id, userId, workspaceType);
  if (!existing.rowCount) {
    return { status: 404, body: { success: false, message: 'Personagem não encontrado.' } };
  }
  const current = existing.rows[0];
  const requestedFolderId = Object.hasOwn(body, 'folderId') ? body.folderId : current.folder_id;
  const folderId = await validateFolder(requestedFolderId, userId, workspaceType);
  if (folderId.error) return folderId.error;

  const system = await charactersRepository.findActiveSystem(body.systemId);
  if (!system.rowCount) {
    return { status: 404, body: { success: false, message: 'Sistema não encontrado.' } };
  }

  const hasExplicitVersion = 'systemVersionId' in body || 'system_version_id' in body;
  const requestedVersionId = body.systemVersionId ?? body.system_version_id ?? null;
  let systemVersionId = null;

  if (hasExplicitVersion) {
    if (requestedVersionId !== null && requestedVersionId !== undefined && requestedVersionId !== '') {
      if (!validId(requestedVersionId)) {
        return { status: 400, body: { success: false, message: 'Identificador da versão do sistema inválido.' } };
      }
      const versionQuery = await charactersRepository.findSystemVersionById(requestedVersionId);
      if (!versionQuery.rowCount) {
        return { status: 404, body: { success: false, message: 'Versão do sistema não encontrada.' } };
      }
      if (String(versionQuery.rows[0].system_id) !== String(body.systemId)) {
        return { status: 400, body: { success: false, message: 'A versão informada não pertence ao sistema selecionado.' } };
      }
      systemVersionId = String(requestedVersionId);
    } else {
      systemVersionId = null;
    }
  } else {
    if (String(body.systemId) === String(current.system_id)) {
      systemVersionId = current.version_id ? String(current.version_id) : null;
    } else {
      systemVersionId = null;
    }
  }

  if (body.data && body.data.level !== undefined && body.data.level !== null && body.data.level !== '') {
    const parsedLevel = typeof body.data.level === 'string' && body.data.level.trim() !== ''
      ? Number(body.data.level)
      : body.data.level;
    if (!Number.isSafeInteger(parsedLevel) || parsedLevel < 1) {
      return { status: 400, body: { success: false, message: 'O nível deve ser maior ou igual a 1.' } };
    }
  }

  const result = await charactersRepository.update(
    id,
    userId,
    body.systemId,
    systemVersionId,
    folderId.value,
    body.name.trim(),
    body.data,
    workspaceType,
  );
  return result.rowCount
    ? getCharacter(id, userId, workspaceType)
    : { status: 404, body: { success: false, message: 'Personagem não encontrado.' } };
};

const validateFolder = async (value, userId, workspaceType) => {
  if (value === undefined || value === null || value === '') return { value: null };
  if (!validId(value)) {
    return {
      error: { status: 400, body: { success: false, message: 'Identificador da pasta inválido.' } },
    };
  }
  const result = await charactersRepository.findFolderByOwner(value, userId, workspaceType);
  return result.rowCount
    ? { value: String(value) }
    : {
      error: { status: 404, body: { success: false, message: 'Pasta não encontrada para este usuário e workspace.' } },
    };
};

export const deleteCharacter = async (id, userId, workspaceType = 'player') => {
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador de personagem inválido.' } };
  }
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  const result = await charactersRepository.remove(id, userId, normalizedWorkspaceType);
  return result.rowCount
    ? { status: 200, body: { success: true, message: 'Personagem excluído.' } }
    : { status: 404, body: { success: false, message: 'Personagem não encontrado.' } };
};
