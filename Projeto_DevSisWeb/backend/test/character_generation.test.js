import 'dotenv/config';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { handleCharacterGenerationRoute } from '../src/modules/character-generation/character-generation.routes.js';
import {
  generateCallOfCthulhu7eAttributes,
  generateVampireV5Attributes,
} from '../src/modules/character-generation/character-generation.service.js';

const attributeKeys = [
  'strength', 'dexterity', 'stamina', 'charisma', 'manipulation',
  'composure', 'intelligence', 'wits', 'resolve',
];
const groupAttributeKeys = {
  physical: ['strength', 'dexterity', 'stamina'],
  social: ['charisma', 'manipulation', 'composure'],
  mental: ['intelligence', 'wits', 'resolve'],
};

describe('geração compartilhada de atributos de personagens', () => {
  const token = jwt.sign({ sub: '10' }, process.env.JWT_SECRET);

  it('usa os dados padrão de CoC 7E e mantém atributos percentuais nos limites', () => {
    const result = generateCallOfCthulhu7eAttributes(() => 1);

    for (const key of ['str', 'con', 'dex', 'app', 'pow', 'edu', 'luck']) {
      assert.equal(result.attributes[key], 15);
    }
    assert.equal(result.attributes.siz, 40);
    assert.equal(result.attributes.int, 40);
    assert.equal(result.derived.hp, 5);
    assert.equal(result.derived.sanity, 15);
    assert.equal(result.derived.mp, 3);

    const maximum = generateCallOfCthulhu7eAttributes((sides) => sides);
    assert.equal(maximum.attributes.str, 90);
    assert.equal(maximum.attributes.siz, 90);
    assert.equal(maximum.attributes.int, 90);
    assert.equal(maximum.attributes.luck, 90);
  });

  it('rejects invalid random values rather than returning an invalid character', () => {
    assert.throws(
      () => generateCallOfCthulhu7eAttributes(() => 7),
      RangeError,
    );
  });

  it('distributes V5 dots according to each selected priority and derives resources', () => {
    const result = generateVampireV5Attributes(['mental', 'physical', 'social']);

    assert.deepEqual(result.attributes, {
      intelligence: 4, wits: 3, resolve: 3,
      strength: 3, dexterity: 3, stamina: 2,
      charisma: 2, manipulation: 2, composure: 2,
    });
    assert.equal(result.derived.health, 5);
    assert.equal(result.derived.willpower, 5);
    assert.deepEqual(
      attributeKeys.map((key) => result.attributes[key]).sort(),
      [2, 2, 2, 2, 3, 3, 3, 3, 4],
    );
  });

  it('supports every valid V5 priority order with the required dot totals', () => {
    const groups = ['physical', 'social', 'mental'];
    for (const first of groups) {
      for (const second of groups.filter((group) => group !== first)) {
        const third = groups.find((group) => group !== first && group !== second);
        const result = generateVampireV5Attributes([first, second, third]);
        const totals = [first, second, third].map((group) =>
          groupAttributeKeys[group].reduce((sum, key) => sum + result.attributes[key], 0) - 3,
        );
        assert.deepEqual(totals, [7, 5, 3]);
      }
    }
  });

  it('rejects missing, duplicate, or unsupported V5 priorities', () => {
    for (const priorities of [
      ['physical', 'social'],
      ['physical', 'physical', 'mental'],
      ['physical', 'social', 'unknown'],
    ]) {
      assert.equal(generateVampireV5Attributes(priorities).error.status, 400);
    }
  });

  it('requires authentication and only supports the approved system versions', () => {
    const unauthorized = handleCharacterGenerationRoute(
      { method: 'POST', url: '/api/character-generation/attributes', headers: {} },
      { systemSlug: 'call-of-cthulhu', versionSlug: '7a-edicao' },
    );
    assert.equal(unauthorized.status, 401);

    const unsupported = handleCharacterGenerationRoute(
      {
        method: 'POST',
        url: '/api/character-generation/attributes',
        headers: { authorization: `Bearer ${token}` },
      },
      { systemSlug: 'dungeons-and-dragons', versionSlug: '5e' },
    );
    assert.equal(unsupported.status, 400);
  });
});
