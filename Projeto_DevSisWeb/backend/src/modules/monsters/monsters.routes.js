import { handleMonsterRequest } from './monsters.controller.js';

export const handleMonsterRoute = (request, body) => {
  const pathname = request.url.split('?')[0];
  const match = pathname.match(/^\/api\/campaigns\/(\d+)\/monsters(?:\/(\d+))?$/);
  if (!match) return null;
  return handleMonsterRequest(request, body, match[1], match[2]);
};
