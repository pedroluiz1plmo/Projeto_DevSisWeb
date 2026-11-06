import * as recordsRepository from './records.repository.js';
import { withPlanResourceLimit } from '../../services/plan_access_service.js';

const validId = (value) => /^\d+$/.test(String(value));
const validClientId = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validText = (value, { required = false, max = 300000 } = {}) => (
  typeof value === 'string'
  && (!required || value.trim().length > 0)
  && value.length <= max
);
const nullableId = (value) => value === null || value === undefined || value === ''
  ? { valid: true, id: null }
  : /^\d+$/.test(String(value))
    ? { valid: true, id: String(value) }
    : { valid: false, id: null };

const serialize = (row, table) => ({
  id: String(row.id),
  clientId: row.client_id,
  ownerId: String(row.owner_id),
  workspaceType: row.workspace_type,
  folderId: row.folder_id === null ? null : String(row.folder_id),
  campaignId: row.campaign_id === null ? null : String(row.campaign_id),
  title: row.title,
  ...(table === 'notes'
    ? { content: row.content }
    : { description: row.description, reward: row.reward, status: row.status }),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateLinks = async (ownerId, workspaceType, folderId, campaignId) => {
  if (folderId !== null) {
    const folder = await recordsRepository.findFolder(folderId, ownerId, workspaceType);
    if (!folder.rowCount) return { status: 404, message: 'Pasta não encontrada neste workspace.' };
  }
  if (campaignId !== null) {
    const campaign = await recordsRepository.findCampaignAccess(campaignId, ownerId, workspaceType);
    if (!campaign.rowCount) return { status: 404, message: 'Campanha não encontrada neste workspace.' };
  }
  return null;
};

const validateValues = (table, body, creating) => {
  if (!validText(body.title, { required: true, max: 160 })) {
    return { status: 400, message: 'Informe um título válido (até 160 caracteres).' };
  }
  const folder = nullableId(body.folderId);
  const campaign = nullableId(body.campaignId);
  if (!folder.valid || !campaign.valid) {
    return { status: 400, message: 'Identificador de pasta ou campanha inválido.' };
  }
  if (table === 'notes') {
    if (!validText(body.content, { required: true })) {
      return { status: 400, message: 'Informe o conteúdo da nota (até 300.000 caracteres).' };
    }
  } else if (
    !validText(body.description, { required: true })
    || !validText(body.reward ?? '', { max: 2000 })
    || !['em_progresso', 'concluida'].includes(body.status ?? 'em_progresso')
  ) {
    return { status: 400, message: 'Dados inválidos para a missão.' };
  }
  if (creating && body.clientId !== undefined && !validClientId(body.clientId)) {
    return { status: 400, message: 'Identificador do registro inválido.' };
  }
  return {
    values: {
      clientId: body.clientId,
      folderId: folder.id,
      campaignId: campaign.id,
      title: body.title.trim(),
      ...(table === 'notes'
        ? { content: body.content }
        : {
          description: body.description.trim(),
          reward: (body.reward ?? '').trim(),
          status: body.status ?? 'em_progresso',
        }),
    },
  };
};

export const list = async (table, ownerId, workspaceType) => {
  const result = await recordsRepository.findAll(table, ownerId, workspaceType);
  return {
    status: 200,
    body: { success: true, [table]: result.rows.map((row) => serialize(row, table)) },
  };
};

export const get = async (table, id, ownerId, workspaceType) => {
  if (!validId(id)) return { status: 400, body: { success: false, message: 'Identificador inválido.' } };
  const result = await recordsRepository.findById(table, id, ownerId, workspaceType);
  return result.rowCount
    ? { status: 200, body: { success: true, [table === 'notes' ? 'note' : 'mission']: serialize(result.rows[0], table) } }
    : { status: 404, body: { success: false, message: 'Registro não encontrado.' } };
};

export const create = async (table, ownerId, workspaceType, body = {}) => {
  const validation = validateValues(table, body, true);
  if (validation.status) {
    return { status: validation.status, body: { success: false, message: validation.message } };
  }
  const linkError = await validateLinks(ownerId, workspaceType, validation.values.folderId, validation.values.campaignId);
  if (linkError) return { status: linkError.status, body: { success: false, message: linkError.message } };
  const resource = table === 'notes' ? 'notes' : 'missions';
  const existingClientRecord = validation.values.clientId
    ? await recordsRepository.findByClientId(table, validation.values.clientId, ownerId, workspaceType)
    : { rowCount: 0 };
  let result;
  if (existingClientRecord.rowCount) {
    result = await recordsRepository.create(table, { ...validation.values, ownerId, workspaceType });
  } else {
    const creation = await withPlanResourceLimit(ownerId, resource, () =>
      recordsRepository.create(table, { ...validation.values, ownerId, workspaceType }));
    if (creation.error) return creation.error;
    result = creation.result;
  }
  const key = table === 'notes' ? 'note' : 'mission';
  return { status: 201, body: { success: true, [key]: serialize(result.rows[0], table) } };
};

export const update = async (table, id, ownerId, workspaceType, body = {}) => {
  if (!validId(id)) return { status: 400, body: { success: false, message: 'Identificador inválido.' } };
  const validation = validateValues(table, body, false);
  if (validation.status) {
    return { status: validation.status, body: { success: false, message: validation.message } };
  }
  const linkError = await validateLinks(ownerId, workspaceType, validation.values.folderId, validation.values.campaignId);
  if (linkError) return { status: linkError.status, body: { success: false, message: linkError.message } };
  const result = await recordsRepository.update(table, id, ownerId, workspaceType, validation.values);
  const key = table === 'notes' ? 'note' : 'mission';
  return result.rowCount
    ? { status: 200, body: { success: true, [key]: serialize(result.rows[0], table) } }
    : { status: 404, body: { success: false, message: 'Registro não encontrado.' } };
};

export const remove = async (table, id, ownerId, workspaceType) => {
  if (!validId(id)) return { status: 400, body: { success: false, message: 'Identificador inválido.' } };
  const result = await recordsRepository.remove(table, id, ownerId, workspaceType);
  return result.rowCount
    ? { status: 200, body: { success: true } }
    : { status: 404, body: { success: false, message: 'Registro não encontrado.' } };
};
