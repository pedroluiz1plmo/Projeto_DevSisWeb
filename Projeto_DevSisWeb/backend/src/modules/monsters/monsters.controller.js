import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as monstersService from './monsters.service.js';

export const handleMonsterRequest = (request, body, campaignId, monsterId) => {
  const token = requireAuth(request);
  if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };

  const workspaceType = getWorkspaceTypeFromRequest(request);
  if (!workspaceType) {
    return {
      status: 400,
      body: { success: false, message: 'Workspace inválido ou ausente. Informe X-Workspace-Type: player ou master.' },
    };
  }
  if (workspaceType !== 'master') {
    return { status: 403, body: { success: false, message: 'O gerenciamento de monstros está disponível apenas no workspace Mestre.' } };
  }

  if (!monsterId && request.method === 'GET') return monstersService.listMonsters(campaignId, token.sub);
  if (!monsterId && request.method === 'POST') return monstersService.createMonster(campaignId, token.sub, body);
  if (monsterId && request.method === 'GET') return monstersService.getMonster(campaignId, monsterId, token.sub);
  if (monsterId && request.method === 'PUT') return monstersService.updateMonster(campaignId, monsterId, token.sub, body);
  if (monsterId && request.method === 'DELETE') return monstersService.deleteMonster(campaignId, monsterId, token.sub);
  return { status: 404, body: { success: false, message: 'Rota não encontrada.' } };
};
