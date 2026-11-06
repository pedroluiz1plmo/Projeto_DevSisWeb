import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as foldersService from './folders.service.js';

const unauthorized = { status: 401, body: { success: false, message: 'Não autorizado.' } };

export const handleFolderRequest = async (request, body, operation, id) => {
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
      return foldersService.listFolders(token.sub, workspaceType);
    case 'get':
      return foldersService.getFolder(id, token.sub, workspaceType);
    case 'create':
      return foldersService.createFolder(token.sub, workspaceType, body);
    case 'update':
      return foldersService.updateFolder(id, token.sub, workspaceType, body);
    case 'delete':
      return foldersService.deleteFolder(id, token.sub, workspaceType);
    case 'not-found':
      return { status: 404, body: { success: false, message: 'Rota não encontrada.' } };
    default:
      return null;
  }
};
