import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/database.js';
import * as recordsService from '../src/modules/notes-missions/records.service.js';
import { planAccessMock } from '../test_support/plan_access_mocks.js';

describe('notas e missões pessoais', () => {
  const originalQuery = pool.query;

  afterEach(() => {
    pool.query = originalQuery;
  });

  it('lista somente registros do usuário e workspace solicitados', async () => {
    let executed;
    pool.query = async (text, params) => {
      executed = { text, params };
      return {
        rowCount: 0,
        rows: [{
          id: 8,
          client_id: 'a7dfeacf-5673-4f4f-9cad-2ff0f587c0ca',
          owner_id: 123,
          workspace_type: 'master',
          folder_id: null,
          campaign_id: null,
          title: 'Segredo',
          content: 'Texto',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      };
    };

    const result = await recordsService.list('notes', '123', 'master');

    assert.deepEqual(executed.params, ['123', 'master']);
    assert.match(executed.text, /owner_id = \$1 AND workspace_type = \$2/);
    assert.equal(result.body.notes[0].workspaceType, 'master');
    assert.equal(result.body.notes[0].ownerId, '123');
  });

  it('recusa pasta de outro workspace sem inserir o registro', async () => {
    const executed = [];
    pool.query = async (text, params) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      executed.push({ text, params });
      return { rowCount: 0, rows: [] };
    };

    const result = await recordsService.create('missions', '123', 'master', {
      title: 'Missão privada',
      description: 'Objetivo',
      reward: '',
      folderId: '44',
      campaignId: null,
    });

    assert.equal(result.status, 404);
    assert.equal(executed.length, 1);
    assert.deepEqual(executed[0].params, ['44', '123', 'master']);
    assert.match(executed[0].text, /owner_id = \$2 AND workspace_type = \$3/);
  });

  it('valida os vínculos e cria missão no workspace do proprietário', async () => {
    const executed = [];
    pool.query = async (text, params) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      executed.push({ text, params });
      if (text.includes('SELECT id FROM folders')) return { rowCount: 1, rows: [{ id: 30 }] };
      if (text.includes('FROM campaigns campaign')) return { rowCount: 1, rows: [{ id: 50 }] };
      return {
        rowCount: 1,
        rows: [{
          id: 12,
          client_id: params[2],
          owner_id: params[0],
          workspace_type: params[1],
          folder_id: params[3],
          campaign_id: params[4],
          title: params[5],
          description: params[6],
          reward: params[7],
          status: params[8],
          created_at: new Date(),
          updated_at: new Date(),
        }],
      };
    };
    const clientId = 'a7dfeacf-5673-4f4f-9cad-2ff0f587c0ca';

    const result = await recordsService.create('missions', '123', 'player', {
      clientId,
      title: 'Encontrar a chave',
      description: 'Investigar as ruínas.',
      reward: '100 XP',
      status: 'em_progresso',
      folderId: '30',
      campaignId: '50',
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.mission.workspaceType, 'player');
    assert.equal(result.body.mission.folderId, '30');
    assert.equal(result.body.mission.campaignId, '50');
    const insert = executed.at(-1);
    assert.equal(insert.params[0], '123');
    assert.equal(insert.params[1], 'player');
    assert.match(insert.text, /ON CONFLICT \(owner_id, workspace_type, client_id\)/);
  });

  it('escopa edição e exclusão por id, proprietário e workspace', async () => {
    const executed = [];
    pool.query = async (text, params) => {
      executed.push({ text, params });
      if (text.startsWith('UPDATE notes')) {
        return {
          rowCount: 1,
          rows: [{
            id: 9,
            client_id: 'a7dfeacf-5673-4f4f-9cad-2ff0f587c0ca',
            owner_id: 123,
            workspace_type: 'master',
            folder_id: null,
            campaign_id: null,
            title: 'Editada',
            content: 'Conteúdo atualizado',
            created_at: new Date(),
            updated_at: new Date(),
          }],
        };
      }
      return { rowCount: 1, rows: [{ id: 9 }] };
    };

    const updated = await recordsService.update('notes', '9', '123', 'master', {
      title: 'Editada',
      content: 'Conteúdo atualizado',
      folderId: null,
      campaignId: null,
    });
    const deleted = await recordsService.remove('notes', '9', '123', 'master');

    assert.equal(updated.status, 200);
    assert.deepEqual(executed[0].params.slice(-3), ['9', '123', 'master']);
    assert.match(executed[0].text, /WHERE id = \$5 AND owner_id = \$6 AND workspace_type = \$7/);
    assert.deepEqual(executed[1].params, ['9', '123', 'master']);
    assert.match(executed[1].text, /owner_id = \$2 AND workspace_type = \$3/);
    assert.equal(deleted.status, 200);
  });
});
