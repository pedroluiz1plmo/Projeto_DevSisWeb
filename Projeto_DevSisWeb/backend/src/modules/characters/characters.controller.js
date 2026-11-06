import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as charactersService from './characters.service.js';

const unauthorized = { status: 401, body: { success: false, message: 'Não autorizado.' } };

export const handleCharactersRequest = async (request, operation, id, body) => {
  const token = requireAuth(request);
  if (!token) return unauthorized;

  const workspaceType = getWorkspaceTypeFromRequest(request);
  if (!workspaceType) {
    return {
      status: 400,
      body: { success: false, message: 'Workspace inválido ou ausente. Informe X-Workspace-Type: player ou master.' },
    };
  }

  switch (operation) {
    case 'list':
      return charactersService.listCharacters(token.sub, workspaceType);
    case 'get':
      return charactersService.getCharacter(id, token.sub, workspaceType);
    case 'create':
      return charactersService.createCharacter(token.sub, workspaceType, body);
    case 'update':
      return charactersService.updateCharacter(id, token.sub, workspaceType, body);
    case 'delete':
      return charactersService.deleteCharacter(id, token.sub, workspaceType);
    default:
      return { status: 404, body: { success: false, message: 'Rota não encontrada.' } };
  }
};
