import { requireAuth } from '../../middleware/auth.js';
import * as service from './friendships.service.js';

export const handleFriendshipRoute = (request, body = {}) => {
  const url = new URL(request.url, 'http://localhost');
  let operation;
  let params = {};

  if (url.pathname === '/api/friendships/requests' && request.method === 'POST') {
    operation = 'sendRequest';
  } else if (url.pathname === '/api/friendships/requests/received' && request.method === 'GET') {
    operation = 'listReceivedRequests';
  } else if (url.pathname === '/api/friendships/requests/sent' && request.method === 'GET') {
    operation = 'listSentRequests';
  } else if (url.pathname === '/api/friendships' && request.method === 'GET') {
    operation = 'listFriendships';
  } else {
    const requestMatch = url.pathname.match(/^\/api\/friendships\/requests\/(\d+)\/(accept|reject)$/);
    const friendshipMatch = url.pathname.match(/^\/api\/friendships\/(\d+)$/);
    if (requestMatch && request.method === 'PATCH') {
      operation = requestMatch[2] === 'accept' ? 'acceptRequest' : 'rejectRequest';
      params.id = requestMatch[1];
    } else if (friendshipMatch && request.method === 'DELETE') {
      operation = 'removeFriendship';
      params.id = friendshipMatch[1];
    } else {
      return null;
    }
  }

  const token = requireAuth(request);
  if (!token) return { status: 401, body: { success: false, message: 'Não autorizado.' } };

  switch (operation) {
    case 'sendRequest': return service.sendRequest(token.sub, body);
    case 'listReceivedRequests': return service.listReceivedRequests(token.sub);
    case 'listSentRequests': return service.listSentRequests(token.sub);
    case 'listFriendships': return service.listFriendships(token.sub);
    case 'acceptRequest': return service.acceptRequest(params.id, token.sub);
    case 'rejectRequest': return service.rejectRequest(params.id, token.sub);
    case 'removeFriendship': return service.removeFriendship(params.id, token.sub);
    default: return null;
  }
};
