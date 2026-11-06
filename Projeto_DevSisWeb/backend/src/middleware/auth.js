import { verifyToken } from '../services/token_service.js';

const validWorkspaceTypes = new Set(['player', 'master']);

export const requireAuth = (request) => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try { return verifyToken(header.slice(7)); } catch { return null; }
};

export const normalizeWorkspaceType = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return validWorkspaceTypes.has(normalized) ? normalized : null;
};

export const getWorkspaceTypeFromRequest = (request) => {
  const raw = request.headers['x-workspace-type'] ?? request.headers['X-Workspace-Type'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return normalizeWorkspaceType(value);
};
