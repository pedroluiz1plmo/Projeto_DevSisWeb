import * as monstersRepository from './monsters.repository.js';
import { withPlanResourceLimit } from '../../services/plan_access_service.js';

const validId = (value) => /^\d+$/.test(String(value));
const validName = (value) => typeof value === 'string'
  && value.trim().length > 0
  && value.trim().length <= 160;
const validData = (value) => value !== null
  && typeof value === 'object'
  && !Array.isArray(value);

const serializeMonster = (row) => ({
  id: String(row.id),
  campaignId: String(row.campaign_id),
  ownerId: String(row.owner_id),
  workspaceType: row.workspace_type,
  name: row.name,
  data: row.data || {},
  system: {
    id: String(row.system_id),
    name: row.system_name,
    slug: row.system_slug,
  },
  version: {
    id: String(row.system_version_id),
    systemId: String(row.system_id),
    name: row.version_name,
    slug: row.version_slug,
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateCampaign = async (campaignId, ownerId) => {
  if (!validId(campaignId)) return { error: { status: 400, message: 'Identificador da campanha inválido.' } };
  const campaign = await monstersRepository.findOwnedCampaign(campaignId, ownerId, 'master');
  return campaign.rowCount
    ? { campaign: campaign.rows[0] }
    : { error: { status: 404, message: 'Campanha do Mestre não encontrada.' } };
};

const validatePayload = async (body) => {
  if (!validName(body.name) || !validData(body.data)) {
    return { error: { status: 400, message: 'Informe nome e dados estruturados válidos para o monstro.' } };
  }
  if (!validId(body.systemId) || !validId(body.systemVersionId)) {
    return { error: { status: 400, message: 'Selecione um sistema e uma versão válidos.' } };
  }
  const version = await monstersRepository.findSystemVersion(body.systemId, body.systemVersionId);
  if (!version.rowCount) {
    return { error: { status: 400, message: 'A versão selecionada não pertence ao sistema ativo informado.' } };
  }
  return {
    systemId: String(body.systemId),
    systemVersionId: String(body.systemVersionId),
    name: body.name.trim(),
    data: body.data,
  };
};

export const listMonsters = async (campaignId, ownerId) => {
  const campaign = await validateCampaign(campaignId, ownerId);
  if (campaign.error) {
    return { status: campaign.error.status, body: { success: false, message: campaign.error.message } };
  }
  const result = await monstersRepository.findByCampaign(campaignId, ownerId);
  return { status: 200, body: { success: true, monsters: result.rows.map(serializeMonster) } };
};

export const getMonster = async (campaignId, monsterId, ownerId) => {
  const campaign = await validateCampaign(campaignId, ownerId);
  if (campaign.error) {
    return { status: campaign.error.status, body: { success: false, message: campaign.error.message } };
  }
  if (!validId(monsterId)) {
    return { status: 400, body: { success: false, message: 'Identificador do monstro inválido.' } };
  }
  const result = await monstersRepository.findById(campaignId, monsterId, ownerId);
  return result.rowCount
    ? { status: 200, body: { success: true, monster: serializeMonster(result.rows[0]) } }
    : { status: 404, body: { success: false, message: 'Monstro não encontrado nesta campanha.' } };
};

export const createMonster = async (campaignId, ownerId, body = {}) => {
  const campaign = await validateCampaign(campaignId, ownerId);
  if (campaign.error) {
    return { status: campaign.error.status, body: { success: false, message: campaign.error.message } };
  }
  const payload = await validatePayload(body);
  if (payload.error) {
    return { status: payload.error.status, body: { success: false, message: payload.error.message } };
  }
  const creation = await withPlanResourceLimit(ownerId, 'monsters', () => monstersRepository.create(
    campaignId, ownerId, payload.systemId, payload.systemVersionId, payload.name, payload.data,
  ));
  if (creation.error) return creation.error;
  const result = creation.result;
  const monster = await monstersRepository.findById(campaignId, result.rows[0].id, ownerId);
  return { status: 201, body: { success: true, monster: serializeMonster(monster.rows[0]) } };
};

export const updateMonster = async (campaignId, monsterId, ownerId, body = {}) => {
  const campaign = await validateCampaign(campaignId, ownerId);
  if (campaign.error) {
    return { status: campaign.error.status, body: { success: false, message: campaign.error.message } };
  }
  if (!validId(monsterId)) {
    return { status: 400, body: { success: false, message: 'Identificador do monstro inválido.' } };
  }
  const payload = await validatePayload(body);
  if (payload.error) {
    return { status: payload.error.status, body: { success: false, message: payload.error.message } };
  }
  const result = await monstersRepository.update(
    campaignId, monsterId, ownerId, payload.systemId, payload.systemVersionId,
    payload.name, payload.data,
  );
  if (!result.rowCount) {
    return { status: 404, body: { success: false, message: 'Monstro não encontrado nesta campanha.' } };
  }
  const monster = await monstersRepository.findById(campaignId, monsterId, ownerId);
  return { status: 200, body: { success: true, monster: serializeMonster(monster.rows[0]) } };
};

export const deleteMonster = async (campaignId, monsterId, ownerId) => {
  const campaign = await validateCampaign(campaignId, ownerId);
  if (campaign.error) {
    return { status: campaign.error.status, body: { success: false, message: campaign.error.message } };
  }
  if (!validId(monsterId)) {
    return { status: 400, body: { success: false, message: 'Identificador do monstro inválido.' } };
  }
  const result = await monstersRepository.remove(campaignId, monsterId, ownerId);
  return result.rowCount
    ? { status: 200, body: { success: true, message: 'Monstro excluído.' } }
    : { status: 404, body: { success: false, message: 'Monstro não encontrado nesta campanha.' } };
};
