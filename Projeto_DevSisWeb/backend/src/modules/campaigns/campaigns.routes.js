import { handleCampaignController } from './campaigns.controller.js';

export const handleCampaignRoute = async (request, body) => {
  const url = request.url.split('?')[0];

  if (url === '/api/campaigns') {
    if (request.method === 'GET') {
      return handleCampaignController(request, 'listCampaigns', {}, body);
    }
    if (request.method === 'POST') {
      return handleCampaignController(request, 'createCampaign', {}, body);
    }
    return null;
  }

  const campaignMatch = url.match(/^\/api\/campaigns\/(\d+)$/);
  if (campaignMatch) {
    const operation = {
      GET: 'getCampaign',
      PUT: 'updateCampaign',
      DELETE: 'deleteCampaign',
    }[request.method] ?? null;
    return handleCampaignController(
      request,
      operation,
      { campaignId: campaignMatch[1] },
      body,
    );
  }

  const membersListMatch = url.match(/^\/api\/campaigns\/(\d+)\/members$/);
  if (membersListMatch) {
    const operation = {
      GET: 'listCampaignMembers',
      POST: 'addCampaignMember',
    }[request.method] ?? null;
    return handleCampaignController(
      request,
      operation,
      { campaignId: membersListMatch[1] },
      body,
    );
  }

  const memberMatch = url.match(/^\/api\/campaigns\/(\d+)\/members\/(\d+)$/);
  if (memberMatch) {
    const operation = {
      PUT: 'updateCampaignMemberRole',
      DELETE: 'removeCampaignMember',
    }[request.method] ?? null;
    return handleCampaignController(
      request,
      operation,
      { campaignId: memberMatch[1], memberUserId: memberMatch[2] },
      body,
    );
  }

  const charactersListMatch = url.match(/^\/api\/campaigns\/(\d+)\/characters$/);
  if (charactersListMatch) {
    const operation = {
      GET: 'listCampaignCharacters',
      POST: 'addCampaignCharacter',
    }[request.method] ?? null;
    return handleCampaignController(
      request,
      operation,
      { campaignId: charactersListMatch[1] },
      body,
    );
  }

  const characterMatch = url.match(/^\/api\/campaigns\/(\d+)\/characters\/(\d+)$/);
  if (characterMatch) {
    const operation = request.method === 'DELETE' ? 'removeCampaignCharacter' : null;
    return handleCampaignController(
      request,
      operation,
      { campaignId: characterMatch[1], characterId: characterMatch[2] },
      body,
    );
  }

  return null;
};
