import { verifyToken } from '../services/token_service.js';

export const requireAuth = (request) => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try { return verifyToken(header.slice(7)); } catch { return null; }
};
