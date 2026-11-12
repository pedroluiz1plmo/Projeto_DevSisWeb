import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as service from './campaign-invitations.service.js';

export const handleCampaignInvitationRequest = (request, body, params) => {
  const token = requireAuth(request);
  if (!token) {
    return { status: 401, body: { success: false, message: 'Não autorizado.' } };
  }
  const workspace = getWorkspaceTypeFromRequest(request);
  if (!workspace) {
    return {
      status: 400,
      body: { success: false, message: 'Informe um workspace válido.' },
    };
  }

  const userId = token.sub;
  const ownerOperation = [
    'getInviteStatus',
    'renewInvite',
    'revokeInvite',
    'searchUser',
    'createUserInvitation',
    'listUserInvitations',
    'cancelUserInvitation',
    'listJoinRequests',
    'reviewJoinRequest',
  ].includes(params.operation);
  const playerOperation = [
    'previewCode',
    'requestByCode',
    'listIncomingUserInvitations',
    'respondToUserInvitation',
    'listOwnJoinRequests',
    'cancelOwnJoinRequest',
  ].includes(params.operation);
  if (ownerOperation && workspace !== 'master') {
    return {
      status: 403,
      body: { success: false, message: 'A gestão de convites exige o workspace Mestre.' },
    };
  }
  if (playerOperation && workspace !== 'player') {
    return {
      status: 403,
      body: { success: false, message: 'Esta operação exige o workspace Jogador.' },
    };
  }

  switch (params.operation) {
    case 'getInviteStatus':
      return service.getInviteStatus(params.campaignId, userId);
    case 'renewInvite':
      return service.renewInvite(params.campaignId, userId);
    case 'revokeInvite':
      return service.revokeInvite(params.campaignId, userId);
    case 'previewCode':
      return service.previewCode(userId, body);
    case 'requestByCode':
      return service.requestByCode(userId, body);
    case 'searchUser':
      return service.searchUser(params.campaignId, userId, params.username);
    case 'createUserInvitation':
      return service.createUserInvitation(params.campaignId, userId, body);
    case 'listUserInvitations':
      return service.listUserInvitations(params.campaignId, userId);
    case 'cancelUserInvitation':
      return service.cancelUserInvitation(
        params.campaignId,
        userId,
        params.invitationId,
      );
    case 'listIncomingUserInvitations':
      return service.listIncomingUserInvitations(userId);
    case 'respondToUserInvitation':
      return service.respondToUserInvitation(params.invitationId, userId, body);
    case 'listJoinRequests':
      return service.listJoinRequests(params.campaignId, userId);
    case 'reviewJoinRequest':
      return service.reviewJoinRequest(
        params.campaignId,
        userId,
        params.requestId,
        body,
      );
    case 'listOwnJoinRequests':
      return service.listOwnJoinRequests(userId);
    case 'cancelOwnJoinRequest':
      return service.cancelOwnJoinRequest(params.requestId, userId);
    default:
      return null;
  }
};
