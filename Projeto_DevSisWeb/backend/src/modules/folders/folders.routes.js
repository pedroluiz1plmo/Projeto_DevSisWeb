import { handleFolderRequest } from './folders.controller.js';

export const handleFolderRoute = async (request, body) => {
  const url = request.url.split('?')[0];
  if (!/^\/api\/folders(?:\/[^/]+)?$/.test(url)) return null;

  if (url === '/api/folders') {
    if (request.method === 'GET') return handleFolderRequest(request, body, 'list');
    if (request.method === 'POST') return handleFolderRequest(request, body, 'create');
    return handleFolderRequest(request, body, null);
  }

  const match = url.match(/^\/api\/folders\/([^/]+)$/);
  if (!match) return handleFolderRequest(request, body, null);
  const id = match[1];
  if (request.method === 'GET') return handleFolderRequest(request, body, 'get', id);
  if (request.method === 'PUT') return handleFolderRequest(request, body, 'update', id);
  if (request.method === 'DELETE') return handleFolderRequest(request, body, 'delete', id);
  return handleFolderRequest(request, body, 'not-found', id);
};
