import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { pool } from '../src/config/database.js';
import { handleMonsterRequest } from '../src/modules/monsters/monsters.controller.js';
import * as monstersService from '../src/modules/monsters/monsters.service.js';
import { planAccessMock } from '../test_support/plan_access_mocks.js';

describe('monstros de campanha', () => {
  const originalQuery = pool.query;

  afterEach(() => {
    pool.query = originalQuery;
  });

  it('oculta campanhas que não pertencem ao usuário no workspace Mestre', async () => {
    const queries = [];
    pool.query = async (text, params) => {
      queries.push({ text, params });
      return { rowCount: 0, rows: [] };
    };

    const result = await monstersService.listMonsters('40', '10');

    assert.equal(result.status, 404);
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].params, ['40', '10', 'master']);
    assert.match(queries[0].text, /owner_id = \$2 AND workspace_type = \$3/);
  });

  it('bloqueia o gerenciamento de monstros fora do workspace Mestre', async () => {
    const token = jwt.sign({ sub: '10' }, process.env.JWT_SECRET);
    const result = await handleMonsterRequest({
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-type': 'player',
      },
    }, {}, '40');

    assert.equal(result.status, 403);
    assert.match(result.body.message, /workspace Mestre/);
  });

  it('valida a relação sistema/versão antes de criar o monstro', async () => {
    const queries = [];
    pool.query = async (text, params) => {
      queries.push({ text, params });
      if (text.includes('FROM campaigns')) {
        return { rowCount: 1, rows: [{ id: 40, owner_id: 10 }] };
      }
      if (text.includes('FROM system_versions')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const result = await monstersService.createMonster('40', '10', {
      name: 'Criatura',
      systemId: '3',
      systemVersionId: '8',
      data: { health: 12 },
    });

    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(queries.length, 2);
    assert.deepEqual(queries[1].params, ['8', '3']);
  });

  it('cria e serializa um monstro no contexto da campanha proprietária', async () => {
    const queries = [];
    const row = {
      id: 19,
      campaign_id: 40,
      owner_id: 10,
      workspace_type: 'master',
      system_version_id: 8,
      system_id: 3,
      system_name: 'Call of Cthulhu',
      system_slug: 'call-of-cthulhu',
      version_name: '7ª edição',
      version_slug: '7a-edicao',
      name: 'Criatura',
      data: { health: 12 },
    };
    pool.query = async (text, params) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      queries.push({ text, params });
      if (text.includes('FROM campaigns')) {
        return { rowCount: 1, rows: [{ id: 40, owner_id: 10 }] };
      }
      if (text.includes('FROM system_versions')) {
        return { rowCount: 1, rows: [{ id: 8, system_id: 3 }] };
      }
      if (text.includes('INSERT INTO monsters')) {
        return { rowCount: 1, rows: [{ id: 19 }] };
      }
      if (text.includes('FROM monsters monster')) {
        return { rowCount: 1, rows: [row] };
      }
      return { rowCount: 0, rows: [] };
    };

    const result = await monstersService.createMonster('40', '10', {
      name: ' Criatura ',
      systemId: '3',
      systemVersionId: '8',
      data: { health: 12 },
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.monster.name, 'Criatura');
    assert.equal(result.body.monster.workspaceType, 'master');
    assert.equal(result.body.monster.system.id, '3');
    assert.equal(result.body.monster.version.id, '8');
    const insert = queries.find(({ text }) => text.includes('INSERT INTO monsters'));
    assert.deepEqual(insert.params, ['40', '10', '3', '8', 'Criatura', '{"health":12}']);
    assert.match(insert.text, /'master'/);
  });
});
