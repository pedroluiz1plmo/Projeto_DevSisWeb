import { getWorkspaceTypeFromRequest, requireAuth } from '../../middleware/auth.js';
import * as dashboardService from './dashboard.service.js';

export const handleMasterDashboard = async (request) => {
  const token = requireAuth(request);
  if (!token) {
    return { status: 401, body: { success: false, message: 'Não autorizado.' } };
  }

  if (getWorkspaceTypeFromRequest(request) !== 'master') {
    return {
      status: 400,
      body: { success: false, message: 'O dashboard exige o workspace master.' },
    };
  }

  return dashboardService.getMasterDashboard(token.sub);
};
