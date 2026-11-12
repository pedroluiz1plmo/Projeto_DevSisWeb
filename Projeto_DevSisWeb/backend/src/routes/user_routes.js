import {
  deleteAccount,
  updateProfile,
  updatePassword,
} from '../controllers/user_controller.js';
import { requireAuth } from '../middleware/auth.js';
import * as friendships from '../modules/friendships/friendships.service.js';

export const handleUserRoute = async (request, body, accountDeletionOptions) => {
  const pathname = request.url.split('?')[0];

  if (pathname === '/api/users/search' && request.method === 'GET') {
    const token = requireAuth(request);
    if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };
    const url = new URL(request.url, 'http://localhost');
    return friendships.searchUsers(token.sub, url.searchParams.get('username') ?? '');
  }

  if (pathname === '/api/users/me') {
    const token = requireAuth(request);
    if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };
    
    if (request.method === 'PUT') {
      return updateProfile(token.sub, body);
    }
    if (request.method === 'DELETE') {
      return deleteAccount(token.sub, body, accountDeletionOptions);
    }
  }

  if (pathname === '/api/users/me/password') {
    const token = requireAuth(request);
    if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };

    if (request.method === 'PUT') {
      return updatePassword(token.sub, body);
    }
  }

  return null;
};
