import * as campaignsRepository from './campaigns.repository.js';
import * as charactersRepository from '../characters/characters.repository.js';
import { withPlanResourceLimit } from '../../services/plan_access_service.js';

const validId = (value) => /^\d+$/.test(String(value));
const validWorkspaceType = (value) => value === 'player' || value === 'master';
const resolveWorkspaceType = (value, fallback = 'player') => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return validWorkspaceType(normalized) ? normalized : fallback;
};

const validCampaignName = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120;
};

const validDescription = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  return value.trim().length <= 2000;
};

const validRole = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 30;
};

const serializeCampaign = (row) => ({
  id: String(row.id),
  ownerId: String(row.owner_id),
  name: row.name,
  description: row.description || '',
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  workspaceType: row.workspace_type || 'player',
});

const serializeMember = (row) => ({
  userId: String(row.user_id),
  name: row.name,
  username: row.username,
  role: row.role,
  joinedAt: row.joined_at,
});

const serializeCharacter = (row) => ({
  id: String(row.character_id),
  name: row.character_name,
  system: row.system_id ? {
    id: String(row.system_id),
    name: row.system_name,
    slug: row.system_slug,
  } : null,
  joinedAt: row.joined_at,
});

const serializePublicCharacter = (row) => ({
  id: String(row.character_id),
  name: row.character_name,
  playerName: row.player_name,
  status: row.status || 'active',
});

const serializeCharacterRequest = (row) => ({
  id: String(row.id),
  campaignId: String(row.campaign_id ?? row.campaignId),
  characterId: String(row.character_id ?? row.characterId),
  requesterId: String(row.requester_id ?? row.requesterId),
  characterName: row.character_name || row.characterName || null,
  playerName: row.player_name || row.playerName || null,
  characterSheet: row.character_data === undefined ? undefined : {
    name: row.character_name || row.characterName || null,
    system: row.system_id ? {
      id: String(row.system_id),
      name: row.system_name,
      slug: row.system_slug,
    } : null,
    data: row.character_data || {},
  },
  status: row.status,
  requestedAt: row.requested_at || row.requestedAt || null,
  reviewedAt: row.reviewed_at || row.reviewedAt || null,
  reason: row.review_note || row.reason || null,
});

const isOwner = (campaign, userId) => Number(campaign.owner_id) === Number(userId);

const hasCampaignAccess = async (campaignId, userId, workspaceType) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  let campaign = await campaignsRepository.findCampaignAccess(
    campaignId,
    normalizedWorkspaceType,
  );
  if (!campaign.rowCount && normalizedWorkspaceType === 'player') {
    campaign = await campaignsRepository.findMasterCampaignAccessForMember(
      campaignId,
      userId,
    );
  }
  if (!campaign.rowCount) return { campaign: null, allowed: false };
  if (isOwner(campaign.rows[0], userId)) return { campaign: campaign.rows[0], allowed: true };

  const campaignWorkspace = campaign.rows[0].workspace_type || normalizedWorkspaceType;
  const member = await campaignsRepository.findCampaignMembership(
    campaignId,
    userId,
    campaignWorkspace,
  );
  return {
    campaign: campaign.rows[0],
    allowed: member.rowCount > 0,
    workspaceType: campaignWorkspace,
  };
};

export const listCampaigns = async (userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  const result = await campaignsRepository.findCampaignsByUser(userId, normalizedWorkspaceType);
  return {
    status: 200,
    body: { success: true, campaigns: result.rows.map(serializeCampaign) },
  };
};

export const getCampaign = async (id, userId, workspaceType = 'player') => {
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');

  const access = await hasCampaignAccess(id, userId, normalizedWorkspaceType);
  if (!access.campaign) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  if (!access.allowed) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  return {
    status: 200,
    body: { success: true, campaign: serializeCampaign(access.campaign) },
  };
};

export const createCampaign = async (userId, workspaceType = 'player', body = {}) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = body.description === undefined ? '' : String(body.description).trim();

  if (!validCampaignName(name)) {
    return { status: 400, body: { success: false, message: 'Informe um nome para a campanha.' } };
  }
  if (!validDescription(description)) {
    return { status: 400, body: { success: false, message: 'A descrição da campanha é inválida.' } };
  }

  const creation = await withPlanResourceLimit(userId, 'campaigns', () =>
    campaignsRepository.createCampaign(userId, name, description, normalizedWorkspaceType));
  if (creation.error) return creation.error;
  const result = creation.result;
  return {
    status: 201,
    body: { success: true, message: 'Campanha criada com sucesso.', campaign: serializeCampaign(result.rows[0]) },
  };
};

export const updateCampaign = async (id, userId, workspaceType = 'player', body = {}) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const campaign = await campaignsRepository.findCampaignForUpdate(id, normalizedWorkspaceType);
  if (!campaign.rowCount) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  if (!isOwner(campaign.rows[0], userId)) {
    return { status: 403, body: { success: false, message: 'Você não pode editar esta campanha.' } };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : campaign.rows[0].name;
  const description = body.description === undefined ? campaign.rows[0].description : String(body.description).trim();
  const isActive = body.isActive !== undefined ? body.isActive : body.is_active;

  if (!validCampaignName(name)) {
    return { status: 400, body: { success: false, message: 'Informe um nome válido para a campanha.' } };
  }
  if (!validDescription(description)) {
    return { status: 400, body: { success: false, message: 'A descrição da campanha é inválida.' } };
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return { status: 400, body: { success: false, message: 'Status da campanha inválido.' } };
  }

  const result = await campaignsRepository.updateCampaign(id, userId, name, description, isActive, normalizedWorkspaceType);
  if (!result.rowCount) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  return {
    status: 200,
    body: { success: true, message: 'Campanha atualizada com sucesso.', campaign: serializeCampaign(result.rows[0]) },
  };
};

export const deleteCampaign = async (id, userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(id)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const result = await campaignsRepository.deleteCampaign(id, userId, normalizedWorkspaceType);
  if (!result.rowCount) {
    const candidate = await campaignsRepository.findCampaignOwner(id, normalizedWorkspaceType);
    if (!candidate.rowCount) {
      return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
    }
    return { status: 403, body: { success: false, message: 'Você não pode excluir esta campanha.' } };
  }
  return { status: 200, body: { success: true, message: 'Campanha excluída com sucesso.' } };
};

export const listCampaignMembers = async (campaignId, userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  const ownerQuery = await campaignsRepository.findCampaignOwnerUser(access.campaign.owner_id);
  const result = await campaignsRepository.findCampaignMembers(
    campaignId,
    access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType,
  );
  const members = result.rows.map(serializeMember);
  const owner = ownerQuery.rowCount ? serializeMember(ownerQuery.rows[0]) : null;
  const uniqueMembers = owner && members.some((member) => Number(member.userId) === Number(owner.userId))
    ? members
    : [...(owner ? [owner] : []), ...members];

  return { status: 200, body: { success: true, members: uniqueMembers } };
};

export const addCampaignMember = async () => ({
  status: 410,
  body: {
    success: false,
    message: 'A inclusão direta foi desativada. Use os fluxos de convite e aprovação.',
  },
});

export const updateCampaignMemberRole = async (campaignId, userId, workspaceType = 'player', memberUserId, body = {}) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId) || !validId(memberUserId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha ou do membro inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.campaign) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  if (!isOwner(access.campaign, userId)) {
    return { status: 403, body: { success: false, message: 'Você não tem permissão para alterar este membro.' } };
  }
  if (Number(memberUserId) === Number(access.campaign.owner_id)) {
    return { status: 403, body: { success: false, message: 'O proprietário da campanha não pode ter sua função alterada.' } };
  }

  const role = typeof body.role === 'string' ? body.role.trim() : '';
  if (!validRole(role)) {
    return { status: 400, body: { success: false, message: 'Informe uma função válida para o membro.' } };
  }
  const result = await campaignsRepository.updateCampaignMemberRole(campaignId, memberUserId, role, normalizedWorkspaceType);
  if (!result.rowCount) {
    return { status: 404, body: { success: false, message: 'Membro não encontrado nesta campanha.' } };
  }
  return {
    status: 200,
    body: { success: true, message: 'Função do membro atualizada.', member: serializeMember(result.rows[0]) },
  };
};

export const removeCampaignMember = async (campaignId, userId, workspaceType = 'player', memberUserId) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId) || !validId(memberUserId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha ou do membro inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.campaign) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  if (!isOwner(access.campaign, userId)) {
    return { status: 403, body: { success: false, message: 'Você não tem permissão para remover membros desta campanha.' } };
  }
  if (Number(memberUserId) === Number(access.campaign.owner_id)) {
    return { status: 403, body: { success: false, message: 'O proprietário da campanha não pode ser removido.' } };
  }

  const result = await campaignsRepository.deleteCampaignMember(campaignId, memberUserId, normalizedWorkspaceType);
  if (!result.rowCount) {
    return { status: 404, body: { success: false, message: 'Membro não encontrado nesta campanha.' } };
  }
  return { status: 200, body: { success: true, message: 'Membro removido da campanha.' } };
};

export const listCampaignCharacters = async (campaignId, userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  const campaignWorkspace = access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType;
  const result = await campaignsRepository.findCampaignCharacters(campaignId, campaignWorkspace);
  const isMasterView = isOwner(access.campaign, userId) || campaignWorkspace === 'master';

  if (!isMasterView) {
    const publicResult = await campaignsRepository.findPublicCampaignCharacters(campaignId, campaignWorkspace);
    return {
      status: 200,
      body: { success: true, characters: publicResult.rows.map(serializePublicCharacter) },
    };
  }

  return {
    status: 200,
    body: { success: true, characters: result.rows.map(serializeCharacter) },
  };
};

export const listMyCharacterLinks = async (campaignId, userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  const campaignWorkspace = access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType;
  const result = await campaignsRepository.findMyCharacterRequests(campaignId, userId, campaignWorkspace);
  const active = await campaignsRepository.findActiveCampaignCharacterByUser(campaignId, userId, campaignWorkspace);

  return {
    status: 200,
    body: {
      success: true,
      characterLinks: result.rows.map(serializeCharacterRequest),
      activeCharacter: active.rowCount ? { id: String(active.rows[0].character_id) } : null,
    },
  };
};

export const requestCharacterLink = async (campaignId, userId, workspaceType = 'player', body = {}) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  const campaignWorkspace = access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType;
  const characterId = body.characterId ?? body.character_id ?? body.id;
  if (!validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Informe um personagem válido.' } };
  }

  const character = await campaignsRepository.findCharacterById(characterId, campaignWorkspace);
  if (!character.rowCount) {
    return { status: 404, body: { success: false, message: 'Personagem não encontrado.' } };
  }
  if (Number(character.rows[0].user_id) !== Number(userId)) {
    return { status: 403, body: { success: false, message: 'Você só pode solicitar inclusão de suas próprias fichas.' } };
  }

  const existingLink = await campaignsRepository.findActiveCampaignCharacterByUser(campaignId, userId, campaignWorkspace);
  if (existingLink.rowCount) {
    return { status: 409, body: { success: false, message: 'Você já possui um personagem ativo nesta campanha.' } };
  }

  const pending = await campaignsRepository.findPendingCharacterRequest(campaignId, userId, characterId, campaignWorkspace);
  if (pending.rowCount) {
    return { status: 409, body: { success: false, message: 'Você já tem uma solicitação pendente para este personagem.' } };
  }

  const result = await campaignsRepository.createCharacterRequest(campaignId, characterId, userId, campaignWorkspace, body.reason || null);
  const row = result.rows[0];
  return {
    status: 201,
    body: {
      success: true,
      message: 'Solicitação de inclusão enviada.',
      request: {
        id: String(row.id),
        campaignId: String(row.campaign_id),
        characterId: String(row.character_id),
        requesterId: String(row.requester_id),
        status: row.status,
        requestedAt: row.requested_at,
      },
    },
  };
};

export const cancelCharacterLinkRequest = async (campaignId, userId, workspaceType = 'player', requestId) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId) || !validId(requestId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha ou da solicitação inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  const result = await campaignsRepository.cancelCharacterRequest(requestId, userId, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
  if (!result.rowCount) {
    return { status: 404, body: { success: false, message: 'Solicitação não encontrada ou não pode ser cancelada.' } };
  }

  return {
    status: 200,
    body: { success: true, message: 'Solicitação cancelada com sucesso.', request: serializeCharacterRequest(result.rows[0]) },
  };
};

export const listCharacterLinkRequests = async (campaignId, userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  if (!isOwner(access.campaign, userId) && (access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType) !== 'master') {
    return { status: 403, body: { success: false, message: 'Somente o Mestre pode visualizar as solicitações desta campanha.' } };
  }

  const campaignWorkspace = access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType;
  const result = await campaignsRepository.findCharacterRequestsByCampaign(campaignId, campaignWorkspace);
  return {
    status: 200,
    body: {
      success: true,
      requests: result.rows.map(serializeCharacterRequest),
    },
  };
};

export const reviewCharacterLinkRequest = async (campaignId, userId, workspaceType = 'player', requestId, body = {}) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId) || !validId(requestId)) {
    return { status: 400, body: { success: false, message: 'Identificador inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  if (!isOwner(access.campaign, userId) && (access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType) !== 'master') {
    return { status: 403, body: { success: false, message: 'Você não pode revisar solicitações desta campanha.' } };
  }

  const request = await campaignsRepository.findCharacterRequestById(requestId, campaignId, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
  if (!request.rowCount) {
    return { status: 404, body: { success: false, message: 'Solicitação não encontrada.' } };
  }

  const current = request.rows[0];
  const action = (body.action ?? body.status ?? '').toString().trim().toLowerCase();
  const reason = body.reason ?? body.note ?? body.reviewNote ?? null;

  if (!['approve', 'reject'].includes(action)) {
    return { status: 400, body: { success: false, message: 'Ação inválida. Use approve ou reject.' } };
  }
  if (current.status !== 'pending') {
    return { status: 409, body: { success: false, message: 'Esta solicitação já foi processada.' } };
  }

  if (action === 'approve') {
    const activeByUser = await campaignsRepository.findActiveCampaignCharacterByUser(campaignId, current.requester_id, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
    if (activeByUser.rowCount && Number(activeByUser.rows[0].character_id) !== Number(current.character_id)) {
      return { status: 409, body: { success: false, message: 'Este jogador já possui um personagem ativo nesta campanha.' } };
    }

    const link = await campaignsRepository.findCampaignCharacter(campaignId, current.character_id, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
    if (link.rowCount) {
      return { status: 409, body: { success: false, message: 'Este personagem já está vinculado à campanha.' } };
    }

    const updated = await campaignsRepository.updateCharacterRequestStatus(requestId, 'approved', userId, reason, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
    if (!updated.rowCount) {
      return { status: 409, body: { success: false, message: 'Esta solicitação não pode mais ser aprovada.' } };
    }

    await campaignsRepository.createCampaignCharacter(campaignId, current.character_id, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
    const finalRequest = await campaignsRepository.findCharacterRequestById(requestId, campaignId, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
    return {
      status: 200,
      body: {
        success: true,
        message: 'Personagem aprovado na campanha.',
        request: serializeCharacterRequest(finalRequest.rows[0]),
      },
    };
  }

  const updated = await campaignsRepository.updateCharacterRequestStatus(requestId, 'rejected', userId, reason, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
  if (!updated.rowCount) {
    return { status: 409, body: { success: false, message: 'Esta solicitação não pode mais ser rejeitada.' } };
  }

  const finalRequest = await campaignsRepository.findCharacterRequestById(requestId, campaignId, access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType);
  return {
    status: 200,
    body: {
      success: true,
      message: 'Solicitação rejeitada.',
      request: serializeCharacterRequest(finalRequest.rows[0]),
    },
  };
};

export const getCampaignCharacterSheet = async (campaignId, characterId, userId, workspaceType = 'player') => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId) || !validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Identificador inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem acesso a esta campanha.' } };
  }

  const campaignWorkspace = access.workspaceType || access.campaign.workspace_type || normalizedWorkspaceType;
  const linked = await campaignsRepository.findCampaignCharacter(campaignId, characterId, campaignWorkspace);
  if (!linked.rowCount) {
    return { status: 404, body: { success: false, message: 'Personagem não vinculado à campanha.' } };
  }

  const fullCharacter = await campaignsRepository.findCharacterSheet(campaignId, characterId, campaignWorkspace);
  if (!fullCharacter.rowCount) {
    return { status: 404, body: { success: false, message: 'Ficha não encontrada.' } };
  }

  const candidate = fullCharacter.rows[0];
  const isOwnerOfSheet = Number(candidate.owner_id) === Number(userId);
  const isMaster = isOwner(access.campaign, userId) || campaignWorkspace === 'master';
  if (!isOwnerOfSheet && !isMaster) {
    return { status: 403, body: { success: false, message: 'Você não pode consultar esta ficha.' } };
  }

  return {
    status: 200,
    body: {
      success: true,
      character: {
        id: String(candidate.character_id),
        name: candidate.character_name,
        ownerId: String(candidate.owner_id),
        ownerName: candidate.owner_name,
        system: candidate.system_id ? {
          id: String(candidate.system_id),
          name: candidate.system_name,
          slug: candidate.system_slug,
        } : null,
        data: candidate.dados || {},
      },
    },
  };
};

export const addCampaignCharacter = async (campaignId, userId, workspaceType = 'player', body = {}) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.allowed || !access.campaign) {
    return { status: 403, body: { success: false, message: 'Você não tem permissão para gerenciar personagens desta campanha.' } };
  }

  const characterId = body.characterId ?? body.character_id ?? body.id;
  if (!validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Informe o personagem que será vinculado.' } };
  }
  const campaignWorkspace = access.workspaceType
    || access.campaign.workspace_type
    || normalizedWorkspaceType;
  const character = await campaignsRepository.findCharacterById(
    characterId,
    campaignWorkspace,
  );
  if (!character.rowCount) {
    return { status: 404, body: { success: false, message: 'Personagem não encontrado.' } };
  }
  if (Number(character.rows[0].user_id) !== Number(userId)) {
    return { status: 403, body: { success: false, message: 'Você não pode vincular um personagem de outro usuário.' } };
  }
  if (character.rows[0].workspace_type !== campaignWorkspace) {
    return { status: 403, body: { success: false, message: 'Você não pode vincular um personagem de outro workspace.' } };
  }

  const duplicate = await campaignsRepository.findCampaignCharacter(
    campaignId,
    characterId,
    campaignWorkspace,
  );
  if (duplicate.rowCount) {
    return { status: 409, body: { success: false, message: 'Este personagem já está vinculado à campanha.' } };
  }

  const activeByUser = await campaignsRepository.findActiveCampaignCharacterByUser(campaignId, userId, campaignWorkspace);
  if (activeByUser.rowCount) {
    return { status: 409, body: { success: false, message: 'Este jogador já possui um personagem ativo nesta campanha.' } };
  }

  await campaignsRepository.createCampaignCharacter(
    campaignId,
    characterId,
    campaignWorkspace,
  );
  const linkedCharacter = await campaignsRepository.findLinkedCampaignCharacter(
    campaignId,
    characterId,
    campaignWorkspace,
  );
  return {
    status: 201,
    body: {
      success: true,
      message: 'Personagem vinculado com sucesso.',
      character: serializeCharacter(linkedCharacter.rows[0]),
    },
  };
};

export const removeCampaignCharacter = async (campaignId, userId, workspaceType = 'player', characterId) => {
  const normalizedWorkspaceType = resolveWorkspaceType(workspaceType, 'player');
  if (!validId(campaignId) || !validId(characterId)) {
    return { status: 400, body: { success: false, message: 'Identificador da campanha ou do personagem inválido.' } };
  }

  const access = await hasCampaignAccess(campaignId, userId, normalizedWorkspaceType);
  if (!access.campaign) {
    return { status: 404, body: { success: false, message: 'Campanha não encontrada.' } };
  }
  if (!access.allowed) {
    return { status: 403, body: { success: false, message: 'Você não tem permissão para remover personagens desta campanha.' } };
  }

  const result = await campaignsRepository.deleteCampaignCharacter(campaignId, characterId, userId, normalizedWorkspaceType);
  if (!result.rowCount) {
    const linked = await campaignsRepository.findCampaignCharacterLink(campaignId, characterId, normalizedWorkspaceType);
    return linked.rowCount
      ? { status: 403, body: { success: false, message: 'Você não pode desvincular o personagem de outro usuário.' } }
      : { status: 404, body: { success: false, message: 'Personagem não encontrado na campanha.' } };
  }
  return { status: 200, body: { success: true, message: 'Personagem removido da campanha.' } };
};
