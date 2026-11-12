import { handleCampaignInvitationRequest } from './campaign-invitations.controller.js';

export const handleCampaignInvitationRoute = (request, body) => {
  const url = new URL(request.url, 'http://localhost');
  const pathname = url.pathname;
  let match;

  if (pathname === '/api/campaign-invites/preview' && request.method === 'POST') {
    return handleCampaignInvitationRequest(request, body, { operation: 'previewCode' });
  }
  if (pathname === '/api/campaign-invites/requests' && request.method === 'POST') {
    return handleCampaignInvitationRequest(request, body, { operation: 'requestByCode' });
  }
  if (pathname === '/api/me/campaign-join-requests' && request.method === 'GET') {
    return handleCampaignInvitationRequest(request, body, { operation: 'listOwnJoinRequests' });
  }
  if (pathname === '/api/me/campaign-invitations' && request.method === 'GET') {
    return handleCampaignInvitationRequest(request, body, { operation: 'listIncomingUserInvitations' });
  }
  match = pathname.match(/^\/api\/campaign-join-requests\/(\d+)$/);
  if (match && request.method === 'DELETE') {
    return handleCampaignInvitationRequest(request, body, {
      operation: 'cancelOwnJoinRequest',
      requestId: match[1],
    });
  }

  match = pathname.match(/^\/api\/campaign-user-invitations\/(\d+)\/respond$/);
  if (match && request.method === 'POST') {
    return handleCampaignInvitationRequest(request, body, {
      operation: 'respondToUserInvitation',
      invitationId: match[1],
    });
  }

  match = pathname.match(/^\/api\/campaigns\/(\d+)\/invite-code$/);
  if (match) {
    const operation = { GET: 'getInviteStatus', POST: 'renewInvite', DELETE: 'revokeInvite' }[request.method];
    if (operation) {
      return handleCampaignInvitationRequest(request, body, {
        operation,
        campaignId: match[1],
      });
    }
  }

  match = pathname.match(/^\/api\/campaigns\/(\d+)\/users\/search$/);
  if (match && request.method === 'GET') {
    return handleCampaignInvitationRequest(request, body, {
      operation: 'searchUser',
      campaignId: match[1],
      username: url.searchParams.get('username') ?? '',
    });
  }

  match = pathname.match(/^\/api\/campaigns\/(\d+)\/user-invitations(?:\/(\d+))?$/);
  if (match) {
    let operation;
    if (!match[2] && request.method === 'GET') operation = 'listUserInvitations';
    if (!match[2] && request.method === 'POST') operation = 'createUserInvitation';
    if (match[2] && request.method === 'DELETE') operation = 'cancelUserInvitation';
    if (operation) {
      return handleCampaignInvitationRequest(request, body, {
        operation,
        campaignId: match[1],
        invitationId: match[2],
      });
    }
  }

  match = pathname.match(/^\/api\/campaigns\/(\d+)\/join-requests(?:\/(\d+))?$/);
  if (match) {
    let operation;
    if (!match[2] && request.method === 'GET') operation = 'listJoinRequests';
    if (match[2] && request.method === 'PATCH') operation = 'reviewJoinRequest';
    if (operation) {
      return handleCampaignInvitationRequest(request, body, {
        operation,
        campaignId: match[1],
        requestId: match[2],
      });
    }
  }

  return null;
};
