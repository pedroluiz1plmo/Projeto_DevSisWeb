import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { pool } from '../src/config/database.js';
import { handleCampaignRoute } from '../src/modules/campaigns/campaigns.routes.js';
import { handleCampaignInvitationRoute } from '../src/modules/campaign-invitations/campaign-invitations.routes.js';

describe('convites e solicitações de participação em campanhas', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let database;

  beforeEach(() => {
    database = createDatabase();
    pool.query = database.query;
    pool.connect = async () => ({ query: database.query, release() {} });
  });

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('gera, consulta, renova e revoga código sem expor o segredo armazenado', async () => {
    const first = await request('POST', '/api/campaigns/7/invite-code');
    assert.equal(first.status, 201);
    const code = first.body.invite.code;
    assert.equal(code.length >= 32, true);

    const status = await request('GET', '/api/campaigns/7/invite-code');
    assert.equal(status.body.invite.status, 'active');
    assert.equal('code' in status.body.invite, false);

    const preview = await request(
      'POST',
      '/api/campaign-invites/preview',
      { code },
      '43',
      'player',
    );
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.body.campaign, {
      name: 'Aventura',
      description: 'Uma campanha segura.',
    });
    assert.equal('id' in preview.body.campaign, false);

    const renewed = await request('POST', '/api/campaigns/7/invite-code');
    assert.equal(renewed.status, 201);
    assert.notEqual(renewed.body.invite.code, code);
    assert.equal(
      (await request(
        'POST',
        '/api/campaign-invites/preview',
        { code },
        '43',
        'player',
      )).status,
      404,
    );
    assert.equal((await request('DELETE', '/api/campaigns/7/invite-code')).status, 200);
    assert.equal(
      (await request(
        'POST',
        '/api/campaign-invites/preview',
        { code: renewed.body.invite.code },
        '43',
        'player',
      )).status,
      404,
    );
  });

  it('mantém solicitações por código pendentes até o Mestre aprovar', async () => {
    const code = (await request('POST', '/api/campaigns/7/invite-code'))
      .body.invite.code;
    const created = await request(
      'POST',
      '/api/campaign-invites/requests',
      { code },
      '43',
      'player',
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.request.status, 'pending');
    assert.equal(database.members.length, 0);

    const duplicate = await request(
      'POST',
      '/api/campaign-invites/requests',
      { code },
      '43',
      'player',
    );
    assert.equal(duplicate.status, 409);

    const forbidden = await request(
      'PATCH',
      `/api/campaigns/7/join-requests/${created.body.request.id}`,
      { action: 'approve' },
      '43',
      'master',
    );
    assert.equal(forbidden.status, 404);
    assert.equal(database.members.length, 0);

    const approved = await request(
      'PATCH',
      `/api/campaigns/7/join-requests/${created.body.request.id}`,
      { action: 'approve' },
    );
    assert.equal(approved.status, 200);
    assert.equal(approved.body.request.status, 'approved');
    assert.deepEqual(database.members.map((member) => member.user_id), [43]);

    const repeated = await request(
      'PATCH',
      `/api/campaigns/7/join-requests/${created.body.request.id}`,
      { action: 'approve' },
    );
    assert.equal(repeated.status, 409);
    assert.equal(database.members.length, 1);
  });

  it('recusa sem vincular, permite cancelar e lista estado da solicitação', async () => {
    const code = (await request('POST', '/api/campaigns/7/invite-code'))
      .body.invite.code;
    const created = await request(
      'POST',
      '/api/campaign-invites/requests',
      { code },
      '43',
      'player',
    );
    const rejected = await request(
      'PATCH',
      `/api/campaigns/7/join-requests/${created.body.request.id}`,
      { action: 'reject' },
    );
    assert.equal(rejected.body.request.status, 'rejected');
    assert.equal(database.members.length, 0);

    const second = await request(
      'POST',
      '/api/campaign-invites/requests',
      { code },
      '44',
      'player',
    );
    assert.equal(
      (await request(
        'DELETE',
        `/api/campaign-join-requests/${second.body.request.id}`,
        {},
        '44',
        'player',
      )).status,
      200,
    );
    const ownRequests = await request(
      'GET',
      '/api/me/campaign-join-requests',
      {},
      '44',
      'player',
    );
    assert.equal(ownRequests.body.requests[0].status, 'cancelled');
  });

  it('envia convite por username e só cria vínculo após o aceite', async () => {
    const search = await request(
      'GET',
      '/api/campaigns/7/users/search?username=aventureiro',
    );
    assert.deepEqual(search.body.user, {
      name: 'Jogador',
      username: 'aventureiro',
    });
    assert.equal('id' in search.body.user, false);

    const created = await request(
      'POST',
      '/api/campaigns/7/user-invitations',
      { username: 'aventureiro' },
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.invitation.status, 'pending');
    assert.equal(database.members.length, 0);

    const incoming = await request(
      'GET',
      '/api/me/campaign-invitations',
      {},
      '43',
      'player',
    );
    assert.equal(incoming.body.invitations[0].campaignName, 'Aventura');
    const accepted = await request(
      'POST',
      `/api/campaign-user-invitations/${created.body.invitation.id}/respond`,
      { action: 'accept' },
      '43',
      'player',
    );
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.invitation.campaignId, '7');
    assert.equal(database.members.length, 1);
    assert.equal(database.members[0].user_id, 43);
  });

  it('permite recusar convite e cancelar convite ainda pendente pelo Mestre', async () => {
    const declined = await request(
      'POST',
      '/api/campaigns/7/user-invitations',
      { username: 'aventureiro' },
    );
    assert.equal(
      (await request(
        'POST',
        `/api/campaign-user-invitations/${declined.body.invitation.id}/respond`,
        { action: 'decline' },
        '43',
        'player',
      )).status,
      200,
    );
    assert.equal(database.members.length, 0);

    const pending = await request(
      'POST',
      '/api/campaigns/7/user-invitations',
      { username: 'aventureiro' },
    );
    assert.equal(
      (await request(
        'DELETE',
        `/api/campaigns/7/user-invitations/${pending.body.invitation.id}`,
      )).status,
      200,
    );
    assert.equal(database.userInvitations[1].status, 'cancelled');
  });

  it('bloqueia proprietário convidando a si mesmo e tentativas excessivas de código', async () => {
    assert.equal(
      (await request('POST', '/api/campaigns/7/user-invitations', {
        username: 'mestre',
      })).status,
      409,
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal(
        (await request(
          'POST',
          '/api/campaign-invites/preview',
          { code: 'codigo-invalido-1234567890' },
          '43',
          'player',
        )).status,
        404,
      );
    }
    assert.equal(
      (await request(
        'POST',
        '/api/campaign-invites/preview',
        { code: 'codigo-invalido-1234567890' },
        '43',
        'player',
      )).status,
      429,
    );
  });

  it('exige autenticação e workspace esperado para cada fluxo', async () => {
    const unauthenticated = await handleCampaignInvitationRoute({
      method: 'POST',
      url: '/api/campaign-invites/requests',
      headers: { 'x-workspace-type': 'player' },
    }, { code: 'a'.repeat(32) });
    assert.equal(unauthenticated.status, 401);

    assert.equal(
      (await request(
        'POST',
        '/api/campaign-invites/requests',
        { code: 'a'.repeat(32) },
        '43',
        'master',
      )).status,
      403,
    );
    assert.equal(
      (await request('POST', '/api/campaigns/7/invite-code', {}, '43')).status,
      404,
    );
    assert.equal(
      (await request('POST', '/api/campaigns/7/invite-code', {}, '42', 'player'))
        .status,
      403,
    );
  });

  it('desativa a inclusão direta que contornaria aceite ou aprovação', async () => {
    const token = jwt.sign({ sub: '42' }, process.env.JWT_SECRET);
    const response = await handleCampaignRoute({
      method: 'POST',
      url: '/api/campaigns/7/members',
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-type': 'master',
      },
    }, { userId: '43', role: 'player' });

    assert.equal(response.status, 410);
    assert.equal(database.members.length, 0);
    assert.match(response.body.message, /convite e aprovação/i);
  });

  async function request(
    method,
    url,
    body = {},
    userId = '42',
    workspace = 'master',
  ) {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
    return handleCampaignInvitationRoute({
      method,
      url,
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-type': workspace,
      },
    }, body);
  }
});

function createDatabase() {
  const campaigns = [{
    id: 7,
    owner_id: 42,
    workspace_type: 'master',
    name: 'Aventura',
    description: 'Uma campanha segura.',
    is_active: true,
  }];
  const users = [
    { id: 42, name: 'Mestre', username: 'mestre', is_active: true },
    { id: 43, name: 'Jogador', username: 'aventureiro', is_active: true },
    { id: 44, name: 'Outro', username: 'outro', is_active: true },
  ];
  const members = [];
  const invites = [];
  const joinRequests = [];
  const userInvitations = [];
  const rateLimits = new Map();
  let nextInviteId = 1;
  let nextRequestId = 1;
  let nextUserInviteId = 1;

  const result = (rows = []) => ({ rowCount: rows.length, rows });
  const query = async (rawSql, params = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return result();
    if (sql.startsWith('SELECT id, owner_id, name, description, is_active FROM campaigns')) {
      const campaign = campaigns.find((item) =>
        item.id === Number(params[0]) && item.owner_id === Number(params[1]));
      return result(campaign ? [{ ...campaign }] : []);
    }
    if (sql.startsWith('SELECT id, status, created_at, revoked_at FROM campaign_invite_codes')) {
      const invite = [...invites].reverse().find((item) =>
        item.campaign_id === Number(params[0]) && item.owner_id === Number(params[1]));
      return result(invite ? [{ ...invite }] : []);
    }
    if (sql.startsWith("UPDATE campaign_invite_codes SET status = 'revoked'")) {
      const active = invites.filter((item) =>
        item.campaign_id === Number(params[0]) &&
        item.owner_id === Number(params[1]) &&
        item.status === 'active');
      active.forEach((invite) => {
        invite.status = 'revoked';
        invite.revoked_at = '2026-01-02T00:00:00.000Z';
      });
      return result(active.map((invite) => ({ id: invite.id })));
    }
    if (sql.startsWith('INSERT INTO campaign_invite_codes')) {
      const invite = {
        id: nextInviteId++,
        campaign_id: Number(params[0]),
        owner_id: Number(params[1]),
        code_hash: params[2],
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        revoked_at: null,
      };
      invites.push(invite);
      return result([{ id: invite.id, status: invite.status, created_at: invite.created_at }]);
    }
    if (sql.startsWith('SELECT invite.id AS invite_id')) {
      const invite = invites.find((item) =>
        item.code_hash === params[0] && item.status === 'active');
      const campaign = campaigns.find((item) =>
        item.id === invite?.campaign_id && item.is_active);
      return result(invite && campaign ? [{
        invite_id: invite.id,
        campaign_id: campaign.id,
        owner_id: campaign.owner_id,
        name: campaign.name,
        description: campaign.description,
        is_active: campaign.is_active,
      }] : []);
    }
    if (sql.startsWith('SELECT 1 FROM campaign_members')) {
      const member = members.find((item) =>
        item.campaign_id === Number(params[0]) && item.user_id === Number(params[1]));
      return result(member ? [{ '?column?': 1 }] : []);
    }
    if (sql.startsWith('INSERT INTO campaign_join_requests')) {
      const [campaignId, requesterId, inviteCodeId] = params;
      if (joinRequests.some((item) => item.campaign_id === Number(campaignId) &&
          item.requester_id === Number(requesterId) && item.status === 'pending')) {
        throw Object.assign(new Error('duplicate pending request'), { code: '23505' });
      }
      const request = {
        id: nextRequestId++,
        campaign_id: Number(campaignId),
        requester_id: Number(requesterId),
        invite_code_id: inviteCodeId,
        status: 'pending',
        requested_at: '2026-01-01T00:00:00.000Z',
      };
      joinRequests.push(request);
      return result([{ ...request }]);
    }
    if (sql.startsWith('SELECT failed_attempts,')) {
      const entry = rateLimits.get(Number(params[0]));
      return result(entry ? [{
        failed_attempts: entry.failed_attempts,
        in_window: true,
      }] : []);
    }
    if (sql.startsWith('INSERT INTO campaign_invite_attempts')) {
      const id = Number(params[0]);
      const entry = rateLimits.get(id) ?? { failed_attempts: 0 };
      entry.failed_attempts = Math.min(5, entry.failed_attempts + 1);
      rateLimits.set(id, entry);
      return result();
    }
    if (sql.startsWith('DELETE FROM campaign_invite_attempts')) {
      rateLimits.delete(Number(params[0]));
      return result();
    }
    if (sql.startsWith('SELECT id, name, username FROM users')) {
      const user = users.find((item) =>
        item.username.toLowerCase() === String(params[0]).toLowerCase() &&
        item.is_active);
      return result(user ? [{ ...user }] : []);
    }
    if (sql.startsWith('SELECT id FROM campaign_join_requests')) {
      const request = joinRequests.find((item) =>
        item.campaign_id === Number(params[0]) &&
        item.requester_id === Number(params[1]) &&
        item.status === 'pending');
      return result(request ? [{ id: request.id }] : []);
    }
    if (sql.startsWith('SELECT id FROM campaign_user_invitations')) {
      const invitation = userInvitations.find((item) =>
        item.campaign_id === Number(params[0]) &&
        item.target_user_id === Number(params[1]) &&
        item.status === 'pending');
      return result(invitation ? [{ id: invitation.id }] : []);
    }
    if (sql.startsWith('INSERT INTO campaign_user_invitations')) {
      const invitation = {
        id: nextUserInviteId++,
        campaign_id: Number(params[0]),
        target_user_id: Number(params[1]),
        invited_by: Number(params[2]),
        status: 'pending',
        invited_at: '2026-01-01T00:00:00.000Z',
      };
      userInvitations.push(invitation);
      return result([{ ...invitation }]);
    }
    if (sql.startsWith('SELECT invitation.id, invitation.target_user_id, user.name')) {
      return result(userInvitations
        .filter((item) => item.campaign_id === Number(params[0]) &&
          item.invited_by === Number(params[1]))
        .map((item) => ({
          id: item.id,
          target_user_id: item.target_user_id,
          name: users.find((user) => user.id === item.target_user_id).name,
          username: users.find((user) => user.id === item.target_user_id).username,
          status: item.status,
          invited_at: item.invited_at,
        })));
    }
    if (sql.startsWith("UPDATE campaign_user_invitations SET status = 'cancelled'")) {
      const invitation = userInvitations.find((item) =>
        item.id === Number(params[0]) &&
        item.campaign_id === Number(params[1]) &&
        item.invited_by === Number(params[2]) &&
        item.status === 'pending');
      if (!invitation) return result();
      invitation.status = 'cancelled';
      return result([{ id: invitation.id }]);
    }
    if (sql.startsWith('SELECT invitation.id, campaign.name AS campaign_name')) {
      return result(userInvitations
        .filter((item) => item.target_user_id === Number(params[0]) &&
          item.status === 'pending')
        .map((item) => {
          const campaign = campaigns.find((value) => value.id === item.campaign_id);
          const owner = users.find((value) => value.id === item.invited_by);
          return {
            id: item.id,
            campaign_name: campaign.name,
            owner_name: owner.name,
            owner_username: owner.username,
            status: item.status,
            invited_at: item.invited_at,
          };
        }));
    }
    if (sql.startsWith('SELECT invitation.id, invitation.campaign_id, invitation.status')) {
      const invitation = userInvitations.find((item) =>
        item.id === Number(params[0]) && item.target_user_id === Number(params[1]));
      const campaign = campaigns.find((item) => item.id === invitation?.campaign_id);
      return result(invitation && campaign ? [{
        id: invitation.id,
        campaign_id: invitation.campaign_id,
        status: invitation.status,
        owner_id: campaign.owner_id,
        is_active: campaign.is_active,
      }] : []);
    }
    if (sql.startsWith('INSERT INTO campaign_members')) {
      const [campaignId, userId] = params;
      const exists = members.some((item) =>
        item.campaign_id === Number(campaignId) && item.user_id === Number(userId));
      if (exists) return result();
      const member = {
        campaign_id: Number(campaignId),
        user_id: Number(userId),
        role: 'player',
        workspace_type: 'master',
      };
      members.push(member);
      return result([{ user_id: member.user_id }]);
    }
    if (sql.startsWith("UPDATE campaign_user_invitations SET status = $1")) {
      const [status, invitationId, userId] = params;
      const invitation = userInvitations.find((item) =>
        item.id === Number(invitationId) &&
        item.target_user_id === Number(userId) &&
        item.status === 'pending');
      if (!invitation) return result();
      invitation.status = status;
      return result([{ id: invitation.id, campaign_id: invitation.campaign_id, status }]);
    }
    if (sql.startsWith('SELECT request.id, request.requester_id, user.name')) {
      return result(joinRequests
        .filter((item) => item.campaign_id === Number(params[0]))
        .map((item) => {
          const user = users.find((value) => value.id === item.requester_id);
          return {
            id: item.id,
            requester_id: item.requester_id,
            name: user.name,
            username: user.username,
            status: item.status,
            requested_at: item.requested_at,
          };
        }));
    }
    if (sql.startsWith('SELECT request.id, campaign.name AS campaign_name')) {
      return result(joinRequests
        .filter((item) => item.requester_id === Number(params[0]))
        .map((item) => ({
          id: item.id,
          campaign_name: campaigns.find((campaign) => campaign.id === item.campaign_id).name,
          owner_name: 'Mestre',
          status: item.status,
          requested_at: item.requested_at,
          reviewed_at: item.reviewed_at ?? null,
        })));
    }
    if (sql.startsWith('SELECT request.id, request.requester_id, request.status')) {
      const [requestId, campaignId, ownerId] = params;
      const request = joinRequests.find((item) =>
        item.id === Number(requestId) &&
        item.campaign_id === Number(campaignId));
      const campaign = campaigns.find((item) =>
        item.id === Number(campaignId) && item.owner_id === Number(ownerId));
      return result(request && campaign ? [{
        id: request.id,
        requester_id: request.requester_id,
        status: request.status,
        campaign_id: campaign.id,
        owner_id: campaign.owner_id,
      }] : []);
    }
    if (sql.startsWith('UPDATE campaign_join_requests SET status = $1')) {
      const [status, reviewerId, requestId] = params;
      const request = joinRequests.find((item) =>
        item.id === Number(requestId) && item.status === 'pending');
      if (!request) return result();
      request.status = status;
      request.reviewed_by = Number(reviewerId);
      request.reviewed_at = '2026-01-02T00:00:00.000Z';
      return result([{ id: request.id }]);
    }
    if (sql.startsWith("UPDATE campaign_join_requests SET status = 'cancelled'")) {
      const request = joinRequests.find((item) =>
        item.id === Number(params[0]) &&
        item.requester_id === Number(params[1]) &&
        item.status === 'pending');
      if (!request) return result();
      request.status = 'cancelled';
      return result([{ id: request.id }]);
    }

    throw new Error(`Unexpected SQL in campaign invitation fixture: ${sql}`);
  };

  return {
    query,
    members,
    invites,
    joinRequests,
    userInvitations,
  };
}
