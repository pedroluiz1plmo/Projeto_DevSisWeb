import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/database.js';
import * as charactersService from '../src/modules/characters/characters.service.js';
import { planAccessMock } from '../test_support/plan_access_mocks.js';

describe('pastas de personagens', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('recusa pasta de outro usuário ou workspace sem inserir personagem', async () => {
    const queries = [];
    pool.query = async (text, params) => {
      queries.push({ text, params });
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 2 }] };
      }
      if (text.includes('SELECT id FROM folders')) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    };
    pool.connect = async () => {
      throw new Error('Uma pasta não autorizada não pode iniciar a inserção.');
    };

    const result = await charactersService.createCharacter('10', 'master', {
      name: 'Personagem',
      systemId: '2',
      folderId: '30',
      data: {},
    });

    assert.equal(result.status, 404);
    assert.deepEqual(queries.at(-1).params, ['30', '10', 'master']);
    assert.match(queries.at(-1).text, /owner_id = \$2 AND workspace_type = \$3/);
  });

  it('persiste a pasta validada e a devolve na resposta do personagem', async () => {
    let insertedFolderId;
    pool.query = async (text) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 2 }] };
      }
      if (text.includes('SELECT id FROM folders')) {
        return { rowCount: 1, rows: [{ id: 30 }] };
      }
      if (text.includes('WHERE c.id = $1 AND c.user_id = $2 AND c.workspace_type = $3')) {
        return {
          rowCount: 1,
          rows: [{
            id: 90,
            name: 'Personagem',
            dados: {},
            folder_id: insertedFolderId,
            workspace_type: 'master',
            system_id: 2,
            system_name: 'Sistema',
            system_slug: 'sistema',
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    };
    pool.connect = async () => ({
      query: async (text, params) => {
        if (text === 'BEGIN' || text === 'COMMIT') return { rowCount: 0, rows: [] };
        if (text.includes('INSERT INTO characters')) {
          insertedFolderId = params[3];
          return { rowCount: 1, rows: [{ id: 90 }] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    });

    const result = await charactersService.createCharacter('10', 'master', {
      name: 'Personagem',
      systemId: '2',
      folderId: '30',
      data: {},
    });

    assert.equal(result.status, 201);
    assert.equal(insertedFolderId, '30');
    assert.equal(result.body.character.folderId, '30');
  });
});
