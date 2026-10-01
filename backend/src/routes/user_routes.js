import { updateProfile, updatePassword } from '../controllers/user_controller.js';
import { requireAuth } from '../middleware/auth.js';

export const handleUserRoute = async (request, body) => {
  if (request.url === '/api/users/me') {
    const token = requireAuth(request);
    if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };
    
    if (request.method === 'PUT') {
      return updateProfile(token.sub, body);
    }
  }

  if (request.url === '/api/users/me/password') {
    const token = requireAuth(request);
    if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };

    if (request.method === 'PUT') {
      return updatePassword(token.sub, body);
    }
  }

  return null;
};
