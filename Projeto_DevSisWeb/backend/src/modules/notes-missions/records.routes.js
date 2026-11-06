import { handleRecordRequest } from './records.controller.js';

export const handleRecordRoute = async (request, body) => {
  const url = request.url.split('?')[0];
  const match = url.match(/^\/api\/(notes|missions)(?:\/([^/]+))?$/);
  if (!match) return null;

  const table = match[1] === 'notes' ? 'notes' : 'missions';
  const id = match[2];
  if (!id) {
    if (request.method === 'GET') return handleRecordRequest(request, body, table, 'list');
    if (request.method === 'POST') return handleRecordRequest(request, body, table, 'create');
    return handleRecordRequest(request, body, table, null);
  }
  const operation = {
    GET: 'get',
    PUT: 'update',
    DELETE: 'delete',
  }[request.method] ?? null;
  return handleRecordRequest(request, body, table, operation, id);
};
