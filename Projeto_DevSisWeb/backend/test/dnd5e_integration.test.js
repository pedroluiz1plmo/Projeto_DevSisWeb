import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import * as charactersService from '../src/modules/characters/characters.service.js';
import * as dndController from '../src/controllers/character_dnd_5e_controller.js';
import { pool } from '../src/config/database.js';
import { planAccessMock } from '../test_support/plan_access_mocks.js';

describe('D&D 5E Backend Integration Tests', () => {
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

  it('valida que o identificador da versão do sistema deve ser numérico válido', async () => {
    pool.query = async (text) => {
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const res = await charactersService.createCharacter(1, {
      name: 'Ranger 5E',
      systemId: '1',
      systemVersionId: 'abc',
      data: {},
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Identificador da versão do sistema inválido.');
  });

  it('valida que o nível em D&D deve ser maior ou igual a 1', async () => {
    pool.query = async (text) => {
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      if (text.includes('FROM system_versions sv WHERE sv.id = $1')) {
        return { rowCount: 1, rows: [{ id: 1, system_id: 1, name: '5E', slug: '5e' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const res = await charactersService.createCharacter(1, {
      name: 'Guerreiro 5E',
      systemId: '1',
      systemVersionId: '1',
      data: { level: 0 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'O nível deve ser maior ou igual a 1.');
  });

  it('impede associação de versão que pertence a outro sistema', async () => {
    pool.query = async (text) => {
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      if (text.includes('FROM system_versions sv WHERE sv.id = $1')) {
        return { rowCount: 1, rows: [{ id: 2, system_id: 2, name: '7ª edição', slug: '7a-edicao' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const res = await charactersService.createCharacter(1, {
      name: 'Personagem Conflitante',
      systemId: '1',
      systemVersionId: '2',
      data: {},
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'A versão informada não pertence ao sistema selecionado.');
  });

  it('cria personagem D&D 5E em transação unificada sincronizando character_dnd_5e', async () => {
    const executedQueries = [];
    const mockClient = {
      query: async (text, params) => {
        executedQueries.push({ text, params });
        if (text === 'BEGIN' || text === 'COMMIT') return {};
        if (text.includes('INSERT INTO characters')) {
          return { rowCount: 1, rows: [{ id: 100 }] };
        }
        if (text.includes('SELECT s.slug AS system_slug, sv.slug AS version_slug')) {
          return { rowCount: 1, rows: [{ system_slug: 'dungeons-and-dragons', version_slug: '5e' }] };
        }
        if (text.includes('INSERT INTO character_dnd_5e')) {
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {},
    };

    pool.connect = async () => mockClient;
    pool.query = async (text, params) => {
      const planResult = planAccessMock(text);
      if (planResult) return planResult;
      if (text.includes('FROM systems WHERE id = $1 AND is_active = TRUE')) {
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      if (text.includes('FROM system_versions sv WHERE sv.id = $1')) {
        return { rowCount: 1, rows: [{ id: 1, system_id: 1, name: '5E', slug: '5e' }] };
      }
      if (text.includes('SELECT c.id, c.name, c.dados')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 100,
              name: 'Bruxo 5E',
              dados: { level: 2, class: 'Bruxo' },
              created_at: '2026-10-31T12:00:00Z',
              updated_at: '2026-10-31T12:00:00Z',
              system_id: 1,
              system_name: 'Dungeons & Dragons',
              system_slug: 'dungeons-and-dragons',
              version_id: 1,
              version_name: '5E',
              version_slug: '5e',
              dnd_id: 100,
              class: 'Bruxo',
              level: 2,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const res = await charactersService.createCharacter(1, {
      name: 'Bruxo 5E',
      systemId: '1',
      systemVersionId: '1',
      data: { class: 'Bruxo', level: 2, charisma: 16 },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.character.id, '100');
    assert.equal(res.body.character.version.slug, '5e');

    // Valida que BEGIN, INSERT INTO characters, INSERT INTO character_dnd_5e, COMMIT foram executados
    const sqlCommands = executedQueries.map((q) => q.text);
    assert.ok(sqlCommands.includes('BEGIN'), 'Deve iniciar transação BEGIN');
    assert.ok(sqlCommands.some((t) => t.includes('INSERT INTO characters')), 'Deve inserir em characters');
    assert.ok(sqlCommands.some((t) => t.includes('INSERT INTO character_dnd_5e')), 'Deve inserir em character_dnd_5e');
    assert.ok(sqlCommands.includes('COMMIT'), 'Deve confirmar transação COMMIT');
  });

  it('mescla colunas relacionais da tabela character_dnd_5e na consulta do personagem', async () => {
    pool.query = async (text, params) => {
      assert.equal(params[0], '10');
      assert.equal(params[1], 1);
      return {
        rowCount: 1,
        rows: [
          {
            id: 10,
            name: 'Mago de Thay',
            dados: { customKey: 'customValue' },
            created_at: '2026-10-31T12:00:00Z',
            updated_at: '2026-10-31T12:00:00Z',
            system_id: 1,
            system_name: 'Dungeons & Dragons',
            system_slug: 'dungeons-and-dragons',
            version_id: 1,
            version_name: '5E',
            version_slug: '5e',
            dnd_id: 10,
            player_name: 'Mestre',
            class: 'Mago',
            level: 5,
            race: 'Humano',
            background: 'Sábio',
            alignment: 'Neutro',
            experience_points: 6500,
            description: 'Especialista em Evocação',
            strength: 10,
            dexterity: 14,
            constitution: 14,
            intelligence: 18,
            wisdom: 12,
            charisma: 8,
            armor_class: 15,
            initiative: '+2',
            speed: '9m',
            max_hit_points: 32,
            current_hit_points: 30,
            temporary_hit_points: 0,
            hit_dice: '5d6',
            proficiency_bonus: '+3',
            skills_and_saving_throws: 'Arcanismo +7, História +7',
            attacks_and_spellcasting: 'Bola de Fogo (CD 15)',
            equipment_and_treasure: 'Grimório, Foco Arcano',
            spells_and_slots: '4 de 1º, 3 de 2º, 2 de 3º',
            personality_ideals_bonds_flaws: 'Conhecimento acima de tudo',
            history_allies_organizations: 'Harper',
          },
        ],
      };
    };

    const res = await charactersService.getCharacter('10', 1);
    assert.equal(res.status, 200);
    const char = res.body.character;
    assert.equal(char.id, '10');
    assert.equal(char.name, 'Mago de Thay');
    assert.equal(char.version.slug, '5e');
    assert.equal(char.version.systemId, '1');
    assert.equal(char.data.class, 'Mago');
    assert.equal(char.data.level, 5);
    assert.equal(char.data.intelligence, 18);
    assert.equal(char.data.maxHitPoints, 32);
    assert.equal(char.data.customKey, 'customValue');
  });

  it('preserva dados legados JSONB se a ficha relacional ainda não existir', async () => {
    pool.query = async () => ({
      rowCount: 1,
      rows: [
        {
          id: 20,
          name: 'Personagem Antigo',
          dados: { level: 2, class: 'Clérigo', strength: 16 },
          created_at: '2026-10-31T12:00:00Z',
          updated_at: '2026-10-31T12:00:00Z',
          system_id: 1,
          system_name: 'Dungeons & Dragons',
          system_slug: 'dungeons-and-dragons',
          version_id: 1,
          version_name: '5E',
          version_slug: '5e',
          dnd_id: null,
        },
      ],
    });

    const res = await charactersService.getCharacter('20', 1);
    assert.equal(res.status, 200);
    const char = res.body.character;
    assert.equal(char.data.level, 2);
    assert.equal(char.data.class, 'Clérigo');
    assert.equal(char.data.strength, 16);
  });

  it('impede que outro usuário acerte ou visualize ficha D&D 5E que não lhe pertence', async () => {
    pool.query = async (queryText) => {
      if (queryText.includes('WHERE c.id = $1 AND c.user_id = $2 AND c.workspace_type = $3')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const res = await dndController.getDnd5eSheet('10', 999, 'player');
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Personagem não encontrado.');
  });
});
