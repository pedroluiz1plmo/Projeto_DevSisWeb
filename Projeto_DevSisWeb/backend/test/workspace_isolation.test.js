import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { pool } from '../src/config/database.js';
import { handleCharactersRequest } from '../src/modules/characters/characters.controller.js';
import * as charactersService from '../src/modules/characters/characters.service.js';
import * as campaignsService from '../src/modules/campaigns/campaigns.service.js';
import * as foldersService from '../src/modules/folders/folders.service.js';
import * as dndController from '../src/controllers/character_dnd_5e_controller.js';
import { planAccessMock } from '../test_support/plan_access_mocks.js';

describe('isolamento dos workspaces', () => {
  let originalQuery;
  let originalConnect;

  beforeEach(() => {
    originalQuery = pool.query;
    originalConnect = pool.connect;
  });

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('grava personagens no workspace da requisição e mantém esse workspace na atualização', async () => {
    const executed = [];
    let activeWorkspace;
    pool.query = async (text, params) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      executed.push({ text, params });
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      if (text.includes('WHERE c.id = $1 AND c.user_id = $2 AND c.workspace_type = $3')) {
        return {
          rowCount: 1,
          rows: [{
            id: params[0],
            name: 'Mestre personagem',
            dados: {},
            created_at: new Date(),
            updated_at: new Date(),
            workspace_type: activeWorkspace,
            system_id: 1,
            system_name: 'D&D',
            system_slug: 'dungeons-and-dragons',
            version_id: null,
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    };
    pool.connect = async () => ({
      query: async (text, params) => {
        executed.push({ text, params });
        if (text === 'BEGIN' || text === 'COMMIT') return { rowCount: 0, rows: [] };
        if (text.includes('INSERT INTO characters')) {
          activeWorkspace = params.at(-1);
          return { rowCount: 1, rows: [{ id: activeWorkspace === 'master' ? 10 : 9 }] };
        }
        if (text.includes('UPDATE characters')) return { rowCount: 1, rows: [{ id: 10 }] };
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    });

    const playerResult = await charactersService.createCharacter(123, 'player', {
      name: 'Jogador personagem',
      systemId: '1',
      data: {},
    });
    const result = await charactersService.createCharacter(123, 'master', {
      name: 'Mestre personagem',
      systemId: '1',
      data: {},
    });

    assert.equal(playerResult.status, 201);
    assert.equal(playerResult.body.character.workspaceType, 'player');
    assert.equal(result.status, 201);
    assert.equal(result.body.character.workspaceType, 'master');
    const insertions = executed.filter(({ text }) => text.includes('INSERT INTO characters'));
    assert.deepEqual(insertions.map(({ params }) => params.at(-1)), ['player', 'master']);

    const update = await charactersService.updateCharacter('10', 123, 'master', {
      name: 'Atualizado',
      systemId: '1',
      data: {},
      workspaceType: 'player',
    });
    assert.equal(update.status, 200);
    const updateQuery = executed.find(({ text }) => text.includes('UPDATE characters'));
    assert.doesNotMatch(updateQuery.text.split('WHERE')[0], /workspace_type/i);
    assert.equal(updateQuery.params.at(-1), 'master');
  });

  it('cria campanhas e pastas usando o workspace ativo', async () => {
    const queries = [];
    pool.query = async (text, params) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      queries.push({ text, params });
      if (text.includes('INSERT INTO campaigns')) {
        return {
          rowCount: 1,
          rows: [{
            id: 20,
            owner_id: 123,
            name: params[1],
            description: params[2],
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            workspace_type: params[3],
          }],
        };
      }
      if (text.includes('INSERT INTO folders')) {
        return {
          rowCount: 1,
          rows: [{
            id: 30,
            owner_id: 123,
            parent_folder_id: null,
            name: params[2],
            created_at: new Date(),
            updated_at: new Date(),
            workspace_type: params[3],
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const playerCampaign = await campaignsService.createCampaign(123, 'player', { name: 'Campanha Jogador' });
    const masterCampaign = await campaignsService.createCampaign(123, 'master', { name: 'Campanha Mestre' });
    const playerFolder = await foldersService.createFolder(123, 'player', { name: 'Pasta Jogador' });
    const masterFolder = await foldersService.createFolder(123, 'master', { name: 'Pasta Mestre' });

    assert.equal(playerCampaign.body.campaign.workspaceType, 'player');
    assert.equal(masterCampaign.body.campaign.workspaceType, 'master');
    assert.equal(playerFolder.body.folder.workspaceType, 'player');
    assert.equal(masterFolder.body.folder.workspaceType, 'master');
    assert.deepEqual(
      queries.filter(({ text }) => text.includes('INSERT INTO campaigns')).map(({ params }) => params[3]),
      ['player', 'master'],
    );
    assert.deepEqual(
      queries.filter(({ text }) => text.includes('INSERT INTO folders')).map(({ params }) => params[3]),
      ['player', 'master'],
    );
  });

  it('lista campanhas apenas no contexto solicitado, inclusive vínculos de membros', async () => {
    let query;
    pool.query = async (text, params) => {
      query = { text, params };
      return { rowCount: 0, rows: [] };
    };

    await campaignsService.listCampaigns(123, 'master');

    assert.deepEqual(query.params, ['master', 123]);
    assert.match(query.text, /WHERE \(\s*workspace_type = \$1/);
    assert.match(query.text, /campaign_members WHERE user_id = \$2 AND workspace_type = \$1/);
    assert.match(query.text, /\$1 = 'player'[\s\S]*workspace_type = 'master'/);
  });

  it('recusa acesso direto a personagem quando o workspace da rota não coincide', async () => {
    const secret = process.env.JWT_SECRET;
    assert.ok(secret, 'JWT_SECRET deve estar definido para executar testes do backend.');
    const token = jwt.sign({ sub: '123' }, secret);
    let query;
    pool.query = async (text, params) => {
      query = { text, params };
      return { rowCount: 0, rows: [] };
    };

    const result = await handleCharactersRequest({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-type': 'player',
      },
    }, 'get', '10');

    assert.equal(result.status, 404);
    assert.match(query.text, /c\.workspace_type = \$3/);
    assert.deepEqual(query.params, ['10', '123', 'player']);

    const invalidContext = await handleCharactersRequest({
      headers: { authorization: `Bearer ${token}` },
    }, 'get', '10');
    assert.equal(invalidContext.status, 400);
  });

  it('escopa a ficha D&D 5E ao personagem e workspace autenticados', async () => {
    let query;
    pool.query = async (text, params) => {
      query = { text, params };
      return { rowCount: 0, rows: [] };
    };

    const result = await dndController.getDnd5eSheet('10', '123', 'master');

    assert.equal(result.status, 404);
    assert.match(query.text, /c\.workspace_type = \$3/);
    assert.deepEqual(query.params, ['10', '123', 'master']);
  });
});
