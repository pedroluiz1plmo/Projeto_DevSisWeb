import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as campaignsService from './campaigns.service.js';

const unauthorized = { status: 401, body: { success: false, message: 'Não autorizado.' } };

export const handleCampaignController = async (request, operation, params, body) => {
  const token = requireAuth(request);
  if (!token) return unauthorized;

  const workspaceType = getWorkspaceTypeFromRequest(request);
  if (!workspaceType) {
    return {
      status: 400,
      body: { success: false, message: 'Workspace inválido ou ausente. Informe X-Workspace-Type: player ou master.' },
    };
  }

  const userId = token.sub;
  switch (operation) {
    case 'listCampaigns':
      return campaignsService.listCampaigns(userId, workspaceType);
    case 'createCampaign':
      return campaignsService.createCampaign(userId, workspaceType, body);
    case 'getCampaign':
      return campaignsService.getCampaign(params.campaignId, userId, workspaceType);
    case 'updateCampaign':
      return campaignsService.updateCampaign(params.campaignId, userId, workspaceType, body);
    case 'deleteCampaign':
      return campaignsService.deleteCampaign(params.campaignId, userId, workspaceType);
    case 'listCampaignMembers':
      return campaignsService.listCampaignMembers(params.campaignId, userId, workspaceType);
    case 'addCampaignMember':
      return campaignsService.addCampaignMember(params.campaignId, userId, workspaceType, body);
    case 'updateCampaignMemberRole':
      return campaignsService.updateCampaignMemberRole(
        params.campaignId,
        userId,
        workspaceType,
        params.memberUserId,
        body,
      );
    case 'removeCampaignMember':
      return campaignsService.removeCampaignMember(params.campaignId, userId, workspaceType, params.memberUserId);
    case 'listCampaignCharacters':
      return campaignsService.listCampaignCharacters(params.campaignId, userId, workspaceType);
    case 'listMyCharacterLinks':
      return campaignsService.listMyCharacterLinks(params.campaignId, userId, workspaceType);
    case 'requestCharacterLink':
      return campaignsService.requestCharacterLink(params.campaignId, userId, workspaceType, body);
    case 'cancelCharacterLinkRequest':
      return campaignsService.cancelCharacterLinkRequest(params.campaignId, userId, workspaceType, params.requestId);
    case 'listCharacterLinkRequests':
      return campaignsService.listCharacterLinkRequests(params.campaignId, userId, workspaceType);
    case 'reviewCharacterLinkRequest':
      return campaignsService.reviewCharacterLinkRequest(
        params.campaignId,
        userId,
        workspaceType,
        params.requestId,
        body,
      );
    case 'getCampaignCharacterSheet':
      return campaignsService.getCampaignCharacterSheet(params.campaignId, params.characterId, userId, workspaceType);
    case 'addCampaignCharacter':
      return campaignsService.addCampaignCharacter(params.campaignId, userId, workspaceType, body);
    case 'removeCampaignCharacter':
      return campaignsService.removeCampaignCharacter(params.campaignId, userId, workspaceType, params.characterId);
    default:
      return null;
  }
};
