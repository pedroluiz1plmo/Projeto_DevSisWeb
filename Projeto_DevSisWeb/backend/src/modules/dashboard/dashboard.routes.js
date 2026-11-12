import { handleMasterDashboard } from './dashboard.controller.js';

export const handleDashboardRoute = (request) => {
  if (request.url.split('?')[0] !== '/api/dashboard/master') return null;
  if (request.method !== 'GET') return null;
  return handleMasterDashboard(request);
};
