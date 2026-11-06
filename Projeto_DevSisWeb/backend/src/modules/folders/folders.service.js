import * as foldersRepository from './folders.repository.js';

const validId = (value) => /^\d+$/.test(String(value));
const validName = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
const normalizeWorkspaceType = (workspaceType = 'player') => (workspaceType === 'master' ? 'master' : 'player');

const serializeFolder = (row) => ({
  id: String(row.id),
  ownerId: String(row.owner_id),
  parentId: row.parent_folder_id === null ? null : String(row.parent_folder_id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  workspaceType: row.workspace_type || 'player',
});

const validParent = async (parentId, ownerId, workspaceType) => {
  if (parentId === null || parentId === undefined || parentId === '') {
    return { valid: true, parentId: null };
  }
  if (!validId(parentId)) return { valid: false, parentId: null, status: 400 };
  const parent = await foldersRepository.findIdByOwner(parentId, ownerId, workspaceType);
  return parent.rowCount
    ? { valid: true, parentId: String(parentId) }
    : { valid: false, parentId: null, status: 404 };
};

export const listFolders = async (ownerId, workspaceType = 'player') => {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  const result = await foldersRepository.findByOwner(ownerId, normalizedWorkspaceType);
  return { status: 200, body: { success: true, folders: result.rows.map(serializeFolder) } };
};

export const getFolder = async (id, ownerId, workspaceType = 'player') => {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador da pasta inválido.' } };
  }
  const result = await foldersRepository.findByIdAndOwner(id, ownerId, normalizedWorkspaceType);
  return result.rowCount
    ? { status: 200, body: { success: true, folder: serializeFolder(result.rows[0]) } }
    : { status: 404, body: { success: false, message: 'Pasta não encontrada.' } };
};

export const createFolder = async (ownerId, workspaceType = 'player', body = {}) => {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (!validName(body.name)) {
    return { status: 400, body: { success: false, message: 'Informe um nome válido para a pasta.' } };
  }
  const parent = await validParent(body.parentId, ownerId, normalizedWorkspaceType);
  if (!parent.valid) {
    return {
      status: parent.status,
      body: { success: false, message: parent.status === 400 ? 'Identificador da pasta pai inválido.' : 'Pasta pai não encontrada.' },
    };
  }
  const result = await foldersRepository.create(ownerId, parent.parentId, body.name.trim(), normalizedWorkspaceType);
  return { status: 201, body: { success: true, folder: serializeFolder(result.rows[0]) } };
};

export const updateFolder = async (id, ownerId, workspaceType = 'player', body = {}) => {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador da pasta inválido.' } };
  }
  if (!validName(body.name)) {
    return { status: 400, body: { success: false, message: 'Informe um nome válido para a pasta.' } };
  }
  const existing = await foldersRepository.findParentFolderId(id, ownerId, normalizedWorkspaceType);
  if (!existing.rowCount) {
    return { status: 404, body: { success: false, message: 'Pasta não encontrada.' } };
  }

  const requestedParent = body.parentId === undefined ? existing.rows[0].parent_folder_id : body.parentId;
  const parent = await validParent(requestedParent, ownerId, normalizedWorkspaceType);
  if (!parent.valid) {
    return {
      status: parent.status,
      body: { success: false, message: parent.status === 400 ? 'Identificador da pasta pai inválido.' : 'Pasta pai não encontrada.' },
    };
  }
  if (parent.parentId === id) {
    return { status: 400, body: { success: false, message: 'Uma pasta não pode ser sua própria pasta pai.' } };
  }

  if (parent.parentId) {
    const descendant = await foldersRepository.findDescendant(id, ownerId, parent.parentId, normalizedWorkspaceType);
    if (descendant.rowCount) {
      return { status: 400, body: { success: false, message: 'Não é possível mover uma pasta para dentro de uma subpasta sua.' } };
    }
  }

  const result = await foldersRepository.update(id, ownerId, parent.parentId, body.name.trim(), normalizedWorkspaceType);
  return { status: 200, body: { success: true, folder: serializeFolder(result.rows[0]) } };
};

export const deleteFolder = async (id, ownerId, workspaceType = 'player') => {
  const normalizedWorkspaceType = normalizeWorkspaceType(workspaceType);
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador da pasta inválido.' } };
  }
  const result = await foldersRepository.remove(id, ownerId, normalizedWorkspaceType);
  return result.rowCount
    ? { status: 200, body: { success: true, message: 'Pasta e subpastas excluídas. Notas e missões vinculadas foram mantidas sem pasta.' } }
    : { status: 404, body: { success: false, message: 'Pasta não encontrada.' } };
};
