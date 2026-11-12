import { handleCombatRequest } from './combats.controller.js';

export const handleCombatRoute = (request, body) => {
  const pathname = request.url.split('?')[0];

  const campaignCombats = pathname.match(/^\/api\/campaigns\/(\d+)\/combats$/);
  if (campaignCombats) {
    if (request.method === 'GET') {
      return handleCombatRequest(request, body, {
        operation: 'list',
        campaignId: campaignCombats[1],
      });
    }
    if (request.method === 'POST') {
      return handleCombatRequest(request, body, {
        operation: 'create',
        campaignId: campaignCombats[1],
      });
    }
  }

  const combat = pathname.match(/^\/api\/combats\/(\d+)$/);
  if (combat) {
    const operation = { GET: 'get', PUT: 'update', DELETE: 'delete' }[request.method];
    if (operation) {
      return handleCombatRequest(request, body, {
        operation,
        combatId: combat[1],
      });
    }
  }

  const participants = pathname.match(
    /^\/api\/combats\/(\d+)\/participants(?:\/(\d+))?$/,
  );
  if (participants) {
    let operation;
    if (!participants[2] && request.method === 'POST') operation = 'addParticipant';
    if (participants[2] && request.method === 'PUT') operation = 'updateParticipant';
    if (participants[2] && request.method === 'DELETE') operation = 'removeParticipant';
    if (operation) {
      return handleCombatRequest(request, body, {
        operation,
        combatId: participants[1],
        participantId: participants[2],
      });
    }
  }

  const turn = pathname.match(/^\/api\/combats\/(\d+)\/turn$/);
  if (turn && request.method === 'PATCH') {
    return handleCombatRequest(request, body, {
      operation: 'turn',
      combatId: turn[1],
    });
  }

  const order = pathname.match(/^\/api\/combats\/(\d+)\/order$/);
  if (order && request.method === 'PATCH') {
    return handleCombatRequest(request, body, {
      operation: 'order',
      combatId: order[1],
    });
  }

  const status = pathname.match(/^\/api\/combats\/(\d+)\/status$/);
  if (status && request.method === 'PATCH') {
    return handleCombatRequest(request, body, {
      operation: 'status',
      combatId: status[1],
    });
  }

  return null;
};
