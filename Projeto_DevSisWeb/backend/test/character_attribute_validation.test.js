import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../src/config/database.js';
import * as charactersService from '../src/modules/characters/characters.service.js';

describe('validação de atributos ao salvar personagens', () => {
  const originalQuery = pool.query;

  afterEach(() => {
    pool.query = originalQuery;
  });

  const mockSystemLookups = (systemSlug, versionSlug) => {
    pool.query = async (text) => {
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 2, slug: systemSlug }] };
      }
      if (text.includes('FROM system_versions sv WHERE sv.id = $1')) {
        return { rowCount: 1, rows: [{ id: 20, system_id: 2, slug: versionSlug }] };
      }
      return { rowCount: 0, rows: [] };
    };
  };

  it('rejects V5 attributes that do not follow the selected 7/5/3 priorities', async () => {
    mockSystemLookups('vampiro-a-mascara', 'v5');
    const data = Object.fromEntries([
      'strength', 'dexterity', 'stamina', 'charisma', 'manipulation',
      'composure', 'intelligence', 'wits', 'resolve',
    ].map((key) => [`inline-vampire-${key}`, 1]));
    data['inline-vampire-priorities'] = 'physical,social,mental';

    const result = await charactersService.createCharacter('10', 'player', {
      name: 'Vampiro',
      systemId: '2',
      systemVersionId: '20',
      data,
    });

    assert.equal(result.status, 400);
    assert.match(result.body.message, /prioridades 7\/5\/3/);
  });

  it('rejects Call of Cthulhu characteristics outside the percentage range', async () => {
    mockSystemLookups('call-of-cthulhu', '7a-edicao');
    const data = Object.fromEntries(
      ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck']
        .map((key) => [`inline-coc-${key}`, 50]),
    );
    data['inline-coc-str'] = 101;

    const result = await charactersService.createCharacter('10', 'player', {
      name: 'Investigador',
      systemId: '2',
      systemVersionId: '20',
      data,
    });

    assert.equal(result.status, 400);
    assert.match(result.body.message, /entre 0 e 100/);
  });
});
