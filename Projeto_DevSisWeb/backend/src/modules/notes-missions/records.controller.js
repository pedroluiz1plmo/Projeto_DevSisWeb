import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as recordsService from './records.service.js';

export const handleRecordRequest = async (request, body, table, operation, id) => {
  const token = requireAuth(request);
  if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };

  const workspaceType = getWorkspaceTypeFromRequest(request);
  if (!workspaceType) {
    return {
      status: 400,
      body: { success: false, message: 'Workspace inválido ou ausente. Informe X-Workspace-Type: player ou master.' },
    };
  }

  switch (operation) {
    case 'list':
      return recordsService.list(table, token.sub, workspaceType);
    case 'get':
      return recordsService.get(table, id, token.sub, workspaceType);
    case 'create':
      return recordsService.create(table, token.sub, workspaceType, body);
    case 'update':
      return recordsService.update(table, id, token.sub, workspaceType, body);
    case 'delete':
      return recordsService.remove(table, id, token.sub, workspaceType);
    default:
      return { status: 404, body: { success: false, message: 'Rota não encontrada.' } };
  }
};
