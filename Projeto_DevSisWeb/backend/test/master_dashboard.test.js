import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { pool } from '../src/config/database.js';
import { handleDashboardRoute } from '../src/modules/dashboard/dashboard.routes.js';

describe('dashboard do Mestre', () => {
  const originalQuery = pool.query;

  afterEach(() => {
    pool.query = originalQuery;
  });

  it('exige autenticação e workspace master', async () => {
    const unauthenticated = await handleDashboardRoute({
      method: 'GET',
      url: '/api/dashboard/master',
      headers: { 'x-workspace-type': 'master' },
    });
    assert.equal(unauthenticated.status, 401);

    const playerWorkspace = await request('player');
    assert.equal(playerWorkspace.status, 400);
  });

  it('retorna estatísticas reais limitadas às campanhas próprias do Mestre', async () => {
    let executedQuery;
    pool.query = async (text, params) => {
      executedQuery = { text, params };
      return {
        rowCount: 1,
        rows: [{
          total_campaigns: 2,
          active_campaigns: 1,
          inactive_campaigns: 1,
          participant_links: 3,
          character_links: 2,
          total_combats: 4,
          pending_join_requests: 1,
          campaigns: [{
            id: '20',
            name: 'Crônicas do Norte',
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            participantCount: 3,
            characterCount: 2,
            combatCount: 4,
            systems: ['Dungeons & Dragons'],
          }],
          activities: [{
            type: 'combat_created',
            occurredAt: '2026-01-02T00:00:00.000Z',
            campaignId: '20',
            campaignName: 'Crônicas do Norte',
            actorName: null,
            detail: 'Emboscada',
          }],
        }],
      };
    };

    const response = await request('master', '42');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.dashboard.metrics, {
      totalCampaigns: 2,
      activeCampaigns: 1,
      inactiveCampaigns: 1,
      participantLinks: 3,
      characterLinks: 2,
      totalCombats: 4,
      pendingJoinRequests: 1,
    });
    assert.equal(response.body.dashboard.campaigns[0].id, '20');
    assert.equal(response.body.dashboard.activities[0].detail, 'Emboscada');
    assert.deepEqual(executedQuery.params, ['42']);
    assert.match(executedQuery.text, /campaign\.owner_id = \$1/);
    assert.match(executedQuery.text, /campaign\.workspace_type = 'master'/);
  });

  async function request(workspace, userId = '42') {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
    return handleDashboardRoute({
      method: 'GET',
      url: '/api/dashboard/master',
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-type': workspace,
      },
    });
  }
});
