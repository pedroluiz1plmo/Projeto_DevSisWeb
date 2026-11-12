import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { pool } from '../src/config/database.js';
import { handleCombatRoute } from '../src/modules/combats/combats.routes.js';

describe('iniciativa e combates de campanha', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let database;

  beforeEach(() => {
    database = createDatabase();
    pool.query = database.query;
    pool.connect = async () => ({
      query: database.query,
      release() {},
    });
  });

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('cria, organiza e preserva o histórico do combate', async () => {
    const created = await request(
      'POST',
      '/api/campaigns/7/combats',
      { name: 'Encontro na ponte' },
    );
    assert.equal(created.status, 201);
    const combatId = created.body.combat.id;

    const hero = await request(
      'POST',
      `/api/combats/${combatId}/participants`,
      { type: 'character', characterId: '30', initiativeValue: 14 },
    );
    assert.equal(hero.status, 201);
    assert.equal(hero.body.combat.participants[0].name, 'Heroi');

    await request(
      'POST',
      `/api/combats/${combatId}/participants`,
      { type: 'monster', name: 'Goblin', initiativeValue: 14 },
    );
    const npc = await request(
      'POST',
      `/api/combats/${combatId}/participants`,
      { type: 'npc', name: 'Guarda', initiativeValue: 7 },
    );
    assert.equal(npc.body.combat.participants.length, 3);

    const goblinId = npc.body.combat.participants[1].id;
    const edited = await request(
      'PUT',
      `/api/combats/${combatId}/participants/${goblinId}`,
      { type: 'monster', name: 'Goblin ferido', initiativeValue: 18 },
    );
    assert.equal(edited.body.combat.participants[1].name, 'Goblin ferido');
    assert.equal(edited.body.combat.participants[1].initiativeValue, 18);

    const ids = edited.body.combat.participants.map((participant) => participant.id);
    const reordered = await request(
      'PATCH',
      `/api/combats/${combatId}/order`,
      { participantIds: [ids[2], ids[0], ids[1]] },
    );
    assert.deepEqual(
      reordered.body.combat.participants.map((participant) => participant.id),
      [ids[2], ids[0], ids[1]],
    );

    const invalidOrder = await request(
      'PATCH',
      `/api/combats/${combatId}/order`,
      { participantIds: [ids[0], ids[0], ids[1]] },
    );
    assert.equal(invalidOrder.status, 400);

    const started = await request(
      'PATCH',
      `/api/combats/${combatId}/status`,
      { status: 'active' },
    );
    assert.equal(started.body.combat.currentRound, 1);
    assert.equal(
      started.body.combat.currentParticipantId,
      started.body.combat.participants[0].id,
    );

    const activeOrder = await request(
      'PATCH',
      `/api/combats/${combatId}/order`,
      { participantIds: [ids[0], ids[2], ids[1]] },
    );
    assert.equal(activeOrder.body.combat.currentParticipantId, ids[2]);

    const next = await request('PATCH', `/api/combats/${combatId}/turn`, {
      action: 'next',
    });
    assert.equal(next.body.combat.currentParticipantId, ids[1]);
    const wrap = await request('PATCH', `/api/combats/${combatId}/turn`, {
      action: 'next',
    });
    assert.equal(wrap.body.combat.currentParticipantId, ids[0]);
    assert.equal(wrap.body.combat.currentRound, 2);
    const previous = await request('PATCH', `/api/combats/${combatId}/turn`, {
      action: 'previous',
    });
    assert.equal(previous.body.combat.currentParticipantId, ids[1]);
    assert.equal(previous.body.combat.currentRound, 1);
    await request('PATCH', `/api/combats/${combatId}/turn`, {
      action: 'select',
      participantId: ids[0],
    });
    const rewind = await request('PATCH', `/api/combats/${combatId}/turn`, {
      action: 'previous',
    });
    assert.equal(rewind.body.combat.currentParticipantId, ids[1]);
    assert.equal(rewind.body.combat.currentRound, 1);
    const selected = await request('PATCH', `/api/combats/${combatId}/turn`, {
      action: 'select',
      participantId: ids[1],
    });
    assert.equal(selected.body.combat.currentParticipantId, ids[1]);

    const removed = await request(
      'DELETE',
      `/api/combats/${combatId}/participants/${ids[1]}`,
    );
    assert.equal(removed.body.combat.participants.length, 2);
    assert.notEqual(removed.body.combat.currentParticipantId, ids[1]);

    const finished = await request(
      'PATCH',
      `/api/combats/${combatId}/status`,
      { status: 'finished' },
    );
    assert.equal(finished.body.combat.status, 'finished');
    const history = await request('GET', '/api/campaigns/7/combats');
    assert.equal(history.body.combats.length, 1);
    assert.equal(history.body.combats[0].status, 'finished');

    const forbiddenEdit = await request(
      'POST',
      `/api/combats/${combatId}/participants`,
      { type: 'npc', name: 'Tarde demais', initiativeValue: 1 },
    );
    assert.equal(forbiddenEdit.status, 409);
  });

  it('valida personagens, valores de iniciativa e combate único aberto', async () => {
    const created = await request(
      'POST',
      '/api/campaigns/7/combats',
      { name: 'Combate' },
    );
    const combatId = created.body.combat.id;

    assert.equal(
      (await request('PATCH', `/api/combats/${combatId}/status`, {
        status: 'active',
      })).status,
      409,
    );

    const unlinked = await request(
      'POST',
      `/api/combats/${combatId}/participants`,
      { type: 'character', characterId: '31', initiativeValue: 10 },
    );
    assert.equal(unlinked.status, 400);

    const invalidInitiative = await request(
      'POST',
      `/api/combats/${combatId}/participants`,
      { type: 'npc', name: 'NPC', initiativeValue: 1.5 },
    );
    assert.equal(invalidInitiative.status, 400);

    const duplicate = await request(
      'POST',
      '/api/campaigns/7/combats',
      { name: 'Outro combate' },
    );
    assert.equal(duplicate.status, 409);

    await request('PATCH', `/api/combats/${combatId}/status`, {
      status: 'finished',
    });
    assert.equal(
      (await request('POST', '/api/campaigns/7/combats', {
        name: 'Combate seguinte',
      })).status,
      201,
    );
  });

  it('restringe escrita ao proprietário e exige workspace Mestre', async () => {
    const created = await request(
      'POST',
      '/api/campaigns/7/combats',
      { name: 'Combate' },
    );
    const combatId = created.body.combat.id;

    assert.equal(
      (await request(
        'POST',
        '/api/campaigns/7/combats',
        { name: 'Membro não pode criar' },
        '43',
      )).status,
      404,
    );
    assert.equal(
      (await request(
        'POST',
        `/api/combats/${combatId}/participants`,
        { type: 'npc', name: 'Membro', initiativeValue: 2 },
        '43',
      )).status,
      404,
    );
    assert.equal(
      (await request(
        'GET',
        '/api/campaigns/7/combats',
        {},
        '43',
      )).status,
      200,
    );
    assert.equal(
      (await request(
        'GET',
        '/api/campaigns/7/combats',
        {},
        '42',
        'player',
      )).status,
      403,
    );
  });

  it('não aceita corpos incompletos nem identificadores de participantes alheios', async () => {
    const created = await request(
      'POST',
      '/api/campaigns/7/combats',
      { name: 'Combate' },
    );
    const combatId = created.body.combat.id;

    assert.equal(
      (await request('POST', `/api/combats/${combatId}/participants`, {
        type: 'npc',
        name: '',
        initiativeValue: 2,
      })).status,
      400,
    );
    assert.equal(
      (await request('PUT', `/api/combats/${combatId}/participants/999`, {
        type: 'npc',
        name: 'NPC',
        initiativeValue: 2,
      })).status,
      404,
    );
    assert.equal(
      (await request('PATCH', `/api/combats/${combatId}/turn`, {
        action: 'select',
        participantId: '999',
      })).status,
      409,
    );
  });

  it('exclui combates em qualquer estado com participantes em cascata', async () => {
    for (const status of ['preparing', 'active', 'finished']) {
      const created = await request(
        'POST',
        '/api/campaigns/7/combats',
        { name: `Combate ${status}` },
      );
      const combatId = created.body.combat.id;
      await request('POST', `/api/combats/${combatId}/participants`, {
        type: 'npc',
        name: 'Guardião',
        initiativeValue: 4,
      });

      const unauthenticated = await handleCombatRoute({
        method: 'DELETE',
        url: `/api/combats/${combatId}`,
        headers: { 'x-workspace-type': 'master' },
      }, {});
      assert.equal(unauthenticated.status, 401);

      if (status !== 'preparing') {
        assert.equal(
          (await request('PATCH', `/api/combats/${combatId}/status`, {
            status: 'active',
          })).status,
          200,
        );
      }
      if (status === 'finished') {
        assert.equal(
          (await request('PATCH', `/api/combats/${combatId}/status`, {
            status: 'finished',
          })).status,
          200,
        );
      }

      const forbidden = await request(
        'DELETE',
        `/api/combats/${combatId}`,
        {},
        '43',
      );
      assert.equal(forbidden.status, 404);
      assert.equal(
        database.combats.some((combat) => combat.id === Number(combatId)),
        true,
      );

      const deleted = await request('DELETE', `/api/combats/${combatId}`);
      assert.equal(deleted.status, 200);
      assert.equal(deleted.body.success, true);
      assert.equal(
        database.combats.some((combat) => combat.id === Number(combatId)),
        false,
      );
      assert.equal(
        database.participants.some((participant) =>
          participant.combat_id === Number(combatId)),
        false,
      );
      assert.equal(
        (await request('GET', `/api/combats/${combatId}`)).status,
        404,
      );
    }

    assert.equal((await request('DELETE', '/api/combats/999')).status, 404);
  });

  it('retorna conflito se uma integridade referencial impedir a exclusão', async () => {
    const created = await request(
      'POST',
      '/api/campaigns/7/combats',
      { name: 'Combate protegido' },
    );
    const combatId = created.body.combat.id;
    await request('POST', `/api/combats/${combatId}/participants`, {
      type: 'npc',
      name: 'Guardião',
      initiativeValue: 4,
    });
    database.blockDeletion();

    const response = await request('DELETE', `/api/combats/${combatId}`);
    assert.equal(response.status, 409);
    assert.match(response.body.message, /registros associados/);
    assert.equal(
      database.combats.some((combat) => combat.id === Number(combatId)),
      true,
    );
    assert.equal(
      database.participants.some((participant) =>
        participant.combat_id === Number(combatId)),
      true,
    );
  });

  async function request(
    method,
    url,
    body = {},
    userId = '42',
    workspace = 'master',
  ) {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
    return handleCombatRoute({
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
  const campaign = { id: 7, owner_id: 42 };
  const members = new Set(['43']);
  const linkedCharacters = [{ id: 30, name: 'Heroi' }];
  const combats = [];
  const participants = [];
  let nextCombatId = 100;
  let nextParticipantId = 200;
  let deletionBlocked = false;

  const result = (rows = []) => ({ rowCount: rows.length, rows });
  const query = async (rawSql, params = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) ||
        sql.startsWith('SET CONSTRAINTS')) return result();

    if (sql.startsWith('SELECT campaign.id, campaign.owner_id')) {
      const userId = String(params[1]);
      return result(campaign.id === Number(params[0]) &&
          (campaign.owner_id === Number(userId) || members.has(userId))
        ? [{ ...campaign }]
        : []);
    }
    if (sql.startsWith('SELECT id, owner_id FROM campaigns')) {
      return result(campaign.id === Number(params[0]) &&
          campaign.owner_id === Number(params[1])
        ? [{ ...campaign }]
        : []);
    }
    if (sql.startsWith('SELECT combat.id, combat.campaign_id')) {
      const combat = combats.find((item) => item.id === Number(params[0]));
      const userId = String(params[1]);
      return result(combat &&
          (combat.owner_id === Number(userId) || members.has(userId))
        ? [{ ...combat }]
        : []);
    }
    if (sql.startsWith('SELECT id, campaign_id, owner_id, workspace_type')) {
      if (sql.includes('WHERE campaign_id = $1 AND owner_id = $2')) {
        return result(combats
          .filter((item) => item.campaign_id === Number(params[0]) &&
            item.owner_id === Number(params[1]))
          .sort((a, b) => b.id - a.id)
          .map((item) => ({ ...item })));
      }
      const combat = combats.find((item) => item.id === Number(params[0]) &&
        item.owner_id === Number(params[1]));
      return result(combat ? [{ ...combat }] : []);
    }
    if (sql.startsWith('SELECT id, campaign_id, owner_id, status, current_round')) {
      const combat = combats.find((item) => item.id === Number(params[0]) &&
        item.owner_id === Number(params[1]));
      return result(combat ? [{ ...combat }] : []);
    }
    if (sql.startsWith('SELECT id, combat_id, campaign_id, character_id')) {
      const matching = participants.filter((item) =>
        item.combat_id === Number(params[0]) &&
        (params.length < 2 || item.id === Number(params[1])));
      matching.sort((a, b) => a.turn_order - b.turn_order);
      return result(matching.map((item) => ({ ...item })));
    }
    if (sql.startsWith('SELECT character.id, character.name')) {
      const character = linkedCharacters.find((item) =>
        item.id === Number(params[1]));
      return result(campaign.id === Number(params[0]) && character
        ? [{ ...character }]
        : []);
    }
    if (sql.startsWith('INSERT INTO campaign_combats')) {
      if (combats.some((item) => item.campaign_id === Number(params[0]) &&
          item.status !== 'finished')) {
        throw Object.assign(new Error('duplicate open combat'), { code: '23505' });
      }
      const combat = {
        id: nextCombatId++,
        campaign_id: Number(params[0]),
        owner_id: Number(params[1]),
        workspace_type: 'master',
        name: params[2],
        status: 'preparing',
        current_round: 1,
        current_participant_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      combats.push(combat);
      return result([{ id: combat.id }]);
    }
    if (sql.startsWith('INSERT INTO campaign_combat_participants')) {
      const [combatId, campaignId, ownerId, characterId, type, name, initiative] = params;
      const turnOrder = participants
        .filter((item) => item.combat_id === Number(combatId))
        .reduce((max, item) => Math.max(max, item.turn_order), 0) + 1;
      const participant = {
        id: nextParticipantId++,
        combat_id: Number(combatId),
        campaign_id: Number(campaignId),
        owner_id: Number(ownerId),
        workspace_type: 'master',
        character_id: characterId == null ? null : Number(characterId),
        participant_type: type,
        name,
        initiative_value: initiative,
        turn_order: turnOrder,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };
      participants.push(participant);
      return result([{ id: participant.id }]);
    }
    if (sql.startsWith('UPDATE campaign_combat_participants SET character_id')) {
      const participant = participants.find((item) =>
        item.combat_id === Number(params[4]) &&
        item.id === Number(params[5]));
      if (!participant) return result();
      Object.assign(participant, {
        character_id: params[0] == null ? null : Number(params[0]),
        participant_type: params[1],
        name: params[2],
        initiative_value: params[3],
      });
      return result([{ id: participant.id }]);
    }
    if (sql.startsWith('UPDATE campaign_combat_participants SET turn_order')) {
      const participant = participants.find((item) =>
        item.combat_id === Number(params[1]) &&
        item.id === Number(params[2]));
      if (!participant) return result();
      participant.turn_order = params[0];
      return result([{ id: participant.id }]);
    }
    if (sql.startsWith('DELETE FROM campaign_combat_participants')) {
      const index = participants.findIndex((item) =>
        item.combat_id === Number(params[0]) &&
        item.id === Number(params[1]));
      if (index < 0) return result();
      const [removed] = participants.splice(index, 1);
      participants
        .filter((item) => item.combat_id === Number(params[0]) &&
          item.turn_order > removed.turn_order)
        .forEach((item) => { item.turn_order -= 1; });
      return result([{ turn_order: removed.turn_order }]);
    }
    if (sql.startsWith('UPDATE campaign_combats SET current_round')) {
      const combat = combats.find((item) => item.id === Number(params[3]) &&
        item.owner_id === Number(params[4]));
      if (!combat) return result();
      combat.current_round = params[0];
      combat.current_participant_id =
        params[1] == null ? null : Number(params[1]);
      if (params[2] != null) combat.status = params[2];
      return result([{ id: combat.id }]);
    }
    if (sql.startsWith("UPDATE campaign_combats SET status = 'active'")) {
      const combat = combats.find((item) => item.id === Number(params[1]) &&
        item.owner_id === Number(params[2]) && item.status === 'preparing');
      if (!combat) return result();
      combat.status = 'active';
      combat.current_round = 1;
      combat.current_participant_id = Number(params[0]);
      return result([{ id: combat.id }]);
    }
    if (sql.startsWith("UPDATE campaign_combats SET status = 'finished'")) {
      const combat = combats.find((item) => item.id === Number(params[0]) &&
        item.owner_id === Number(params[1]) && item.status !== 'finished');
      if (!combat) return result();
      combat.status = 'finished';
      return result([{ id: combat.id }]);
    }
    if (sql.startsWith('DELETE FROM campaign_combats')) {
      if (deletionBlocked) {
        throw Object.assign(new Error('foreign key violation'), {
          code: '23503',
        });
      }
      const index = combats.findIndex((item) =>
        item.id === Number(params[0]) &&
        item.owner_id === Number(params[1]));
      if (index < 0) return result();
      const [deleted] = combats.splice(index, 1);
      participants.splice(
        0,
        participants.length,
        ...participants.filter((item) => item.combat_id !== deleted.id),
      );
      return result([{ id: deleted.id }]);
    }
    if (sql.startsWith('UPDATE campaign_combats SET name')) {
      const combat = combats.find((item) => item.id === Number(params[1]) &&
        item.owner_id === Number(params[2]));
      if (!combat) return result();
      combat.name = params[0];
      return result([{ id: combat.id }]);
    }
    throw new Error(`Unexpected SQL in test fixture: ${sql}`);
  };

  return {
    query,
    combats,
    participants,
    blockDeletion: () => {
      deletionBlocked = true;
    },
  };
}
