import {
  createDnd5eSheet,
  deleteDnd5eSheet,
  getDnd5eSheet,
  updateDnd5eSheet,
} from '../../controllers/character_dnd_5e_controller.js';
import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import { handleCharactersRequest } from './characters.controller.js';

export const handleCharactersRoute = async (request, body) => {
  const pathname = request.url.split('?')[0];

  const dnd5eMatch = pathname.match(/^\/api\/characters\/(\d+)\/dnd-5e$/);
  if (dnd5eMatch) {
    const token = requireAuth(request);
    if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };
    const workspaceType = getWorkspaceTypeFromRequest(request);
    if (!workspaceType) {
      return {
        status: 400,
        body: { success: false, message: 'Workspace inválido ou ausente. Informe X-Workspace-Type: player ou master.' },
      };
    }
    const characterId = dnd5eMatch[1];
    if (request.method === 'GET') return getDnd5eSheet(characterId, token.sub, workspaceType);
    if (request.method === 'POST') return createDnd5eSheet(characterId, token.sub, workspaceType, body);
    if (request.method === 'PUT') return updateDnd5eSheet(characterId, token.sub, workspaceType, body);
    if (request.method === 'DELETE') return deleteDnd5eSheet(characterId, token.sub, workspaceType);
    return { status: 404, body: { success: false, message: 'Rota não encontrada.' } };
  }

  const match = pathname.match(/^\/api\/characters(?:\/(\d+))?$/);
  if (!match) return null;
  const id = match[1];
  if (request.method === 'GET') {
    return handleCharactersRequest(request, id ? 'get' : 'list', id, body);
  }
  if (request.method === 'POST' && !id) {
    return handleCharactersRequest(request, 'create', id, body);
  }
  if (request.method === 'PUT' && id) {
    return handleCharactersRequest(request, 'update', id, body);
  }
  if (request.method === 'DELETE' && id) {
    return handleCharactersRequest(request, 'delete', id, body);
  }
  return handleCharactersRequest(request, 'not-found', id, body);
};
