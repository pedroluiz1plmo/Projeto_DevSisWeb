import { login, me, register } from '../controllers/auth_controller.js';
import { requireAuth } from '../middleware/auth.js';

export const handleAuthRoute = async (request, body) => {
  if (request.method === 'POST' && request.url === '/api/auth/register') return register(body);
  if (request.method === 'POST' && request.url === '/api/auth/login') return login(body);
  if (request.method === 'POST' && request.url === '/api/auth/logout') return { status: 200, body: { success: true, message: 'Logout realizado. Descarte o token no cliente.' } };
  if (request.method === 'GET' && request.url === '/api/auth/me') {
    const token = requireAuth(request);
    return token ? me(token) : { status: 401, body: { authenticated: false } };
  }
  return null;
};
