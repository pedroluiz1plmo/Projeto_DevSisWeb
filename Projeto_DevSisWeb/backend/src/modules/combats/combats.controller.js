import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as combatsService from './combats.service.js';

export const handleCombatRequest = (request, body, params) => {
  const token = requireAuth(request);
  if (!token) {
    return { status: 401, body: { success: false, message: 'Não autorizado.' } };
  }

  if (getWorkspaceTypeFromRequest(request) !== 'master') {
    return {
      status: 403,
      body: {
        success: false,
        message: 'O controle de iniciativa está disponível apenas no workspace Mestre.',
      },
    };
  }

  const userId = token.sub;
  switch (params.operation) {
    case 'list':
      return combatsService.listCombats(params.campaignId, userId);
    case 'create':
      return combatsService.createCombat(params.campaignId, userId, body);
    case 'get':
      return combatsService.getCombat(params.combatId, userId);
    case 'update':
      return combatsService.updateCombat(params.combatId, userId, body);
    case 'delete':
      return combatsService.deleteCombat(params.combatId, userId);
    case 'addParticipant':
      return combatsService.addParticipant(params.combatId, userId, body);
    case 'updateParticipant':
      return combatsService.updateParticipant(
        params.combatId,
        params.participantId,
        userId,
        body,
      );
    case 'removeParticipant':
      return combatsService.removeParticipant(
        params.combatId,
        params.participantId,
        userId,
      );
    case 'turn':
      return combatsService.updateTurn(params.combatId, userId, body);
    case 'order':
      return combatsService.updateOrder(params.combatId, userId, body);
    case 'status':
      return combatsService.updateStatus(params.combatId, userId, body);
    default:
      return null;
  }
};
