import { Personagem } from '../models/Personagem';
import { Campanha } from '../models/Campanha';
import { NPC } from '../models/NPC';
import { Item } from '../models/Item';
import { MagiaHabilidade } from '../models/MagiaHabilidade';
import type { ResultadoRolagem } from './DiceService';

export class StorageService {
  private static readonly KEY_PERSONAGENS = 'rpg_personagens_v1';
  private static readonly KEY_CAMPANHAS = 'rpg_campanhas_v1';
  private static readonly KEY_NPCS = 'rpg_npcs_v1';
  private static readonly KEY_DICE_HISTORY = 'rpg_dice_history_v1';

  public static salvarPersonagens(personagens: Personagem[]): void {
    localStorage.setItem(this.KEY_PERSONAGENS, JSON.stringify(personagens));
  }

  public static carregarPersonagens(): Personagem[] {
    const raw = localStorage.getItem(this.KEY_PERSONAGENS);
    if (!raw) {
      const padrao = this.obterPersonagensDemonstracao();
      this.salvarPersonagens(padrao);
      return padrao;
    }

    try {
      const parsed: any[] = JSON.parse(raw);
      return parsed.map(p => {
        const personagem = new Personagem(
          p.nomePersonagem,
          p.classe,
          p.raca,
          p.sistema || 'D&D 5e',
          p.atributos,
          p.nivel,
          p.idPersonagem
        );
        personagem.pontosVida = p.pontosVida ?? personagem.pontosVidaMax;
        personagem.pontosVidaMax = p.pontosVidaMax ?? personagem.pontosVidaMax;
        personagem.pontosMana = p.pontosMana ?? 10;
        personagem.pontosManaMax = p.pontosManaMax ?? 10;
        personagem.ca = p.ca ?? 10;
        personagem.XP = p.XP ?? 0;

        if (p.inventario && Array.isArray(p.inventario.itens)) {
          personagem.inventario.itens = p.inventario.itens.map(
            (it: any) => new Item(it.nomeItem, it.pesoItem, it.quantidade, it.idItem)
          );
          personagem.inventario.limiteCarga = p.inventario.limiteCarga || Math.max(30, personagem.atributos.forca * 7);
        }

        if (Array.isArray(p.magiasHabilidades)) {
          personagem.magiasHabilidades = p.magiasHabilidades.map(
            (m: any) => new MagiaHabilidade(m.nome, m.custoMana, m.tempoConjuracao, m.efeito, m.id)
          );
        }

        return personagem;
      });
    } catch (e) {
      console.error('Erro ao ler personagens do localStorage:', e);
      return this.obterPersonagensDemonstracao();
    }
  }

  public static salvarCampanhas(campanhas: Campanha[]): void {
    localStorage.setItem(this.KEY_CAMPANHAS, JSON.stringify(campanhas));
  }

  public static carregarCampanhas(todosPersonagens: Personagem[], todosNpcs: NPC[]): Campanha[] {
    const raw = localStorage.getItem(this.KEY_CAMPANHAS);
    if (!raw) {
      const padrao = this.obterCampanhasDemonstracao(todosPersonagens, todosNpcs);
      this.salvarCampanhas(padrao);
      return padrao;
    }

    try {
      const parsed: any[] = JSON.parse(raw);
      return parsed.map(c => {
        const pers = todosPersonagens.filter(p => c.personagens?.some((cp: any) => cp.idPersonagem === p.idPersonagem));
        const npcs = todosNpcs.filter(n => c.npcs?.some((cn: any) => cn.idNpc === n.idNpc));
        return new Campanha(c.nomeCampanha, c.lore, c.dataCriacao, pers, npcs, c.idCampanha);
      });
    } catch (e) {
      console.error('Erro ao carregar campanhas:', e);
      return this.obterCampanhasDemonstracao(todosPersonagens, todosNpcs);
    }
  }

  public static salvarNPCs(npcs: NPC[]): void {
    localStorage.setItem(this.KEY_NPCS, JSON.stringify(npcs));
  }

  public static carregarNPCs(): NPC[] {
    const raw = localStorage.getItem(this.KEY_NPCS);
    if (!raw) {
      const padrao = this.obterNpcsDemonstracao();
      this.salvarNPCs(padrao);
      return padrao;
    }

    try {
      const parsed: any[] = JSON.parse(raw);
      return parsed.map(n => {
        const npc = new NPC(n.nome, n.nivelDesafio, n.vidaMax || n.vida, n.ataques, n.idNpc);
        npc.vida = n.vida ?? npc.vidaMax;
        return npc;
      });
    } catch (e) {
      console.error('Erro ao carregar NPCs:', e);
      return this.obterNpcsDemonstracao();
    }
  }

  public static salvarHistoricoDados(historico: ResultadoRolagem[]): void {
    localStorage.setItem(this.KEY_DICE_HISTORY, JSON.stringify(historico.slice(0, 30)));
  }

  public static carregarHistoricoDados(): ResultadoRolagem[] {
    const raw = localStorage.getItem(this.KEY_DICE_HISTORY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private static obterPersonagensDemonstracao(): Personagem[] {
    const p1 = new Personagem('Eldrin Ventonegro', 'Mago Evocador', 'Elfo', 'D&D 5e', {
      forca: 8,
      destreza: 14,
      constituicao: 12,
      inteligencia: 18,
      sabedoria: 13,
      carisma: 10
    }, 3);
    p1.pontosVidaMax = 22;
    p1.pontosVida = 22;
    p1.ca = 12;
    p1.XP = 1800;
    p1.inventario.adicionarItem(new Item('Grimório Ancestral', 1.5, 1));
    p1.inventario.adicionarItem(new Item('Varinha de Vidro Mágico', 0.5, 1));
    p1.inventario.adicionarItem(new Item('Poção de Cura Menor', 0.3, 3));
    p1.magiasHabilidades.push(new MagiaHabilidade('Mísseis Mágicos', 1, '1 ação', 'Dispara 3 dardos de energia arcana que causam 1d4+1 de dano de força cada.'));
    p1.magiasHabilidades.push(new MagiaHabilidade('Bola de Fogo', 3, '1 ação', 'Explosão de chamas de 6m de raio que causa 8d6 de dano de fogo.'));

    const p2 = new Personagem('Kaelen Quebra-Escudos', 'Guerreiro Campeão', 'Anão', 'Tormenta 20', {
      forca: 18,
      destreza: 12,
      constituicao: 16,
      inteligencia: 10,
      sabedoria: 12,
      carisma: 8
    }, 4);
    p2.pontosVidaMax = 46;
    p2.pontosVida = 40;
    p2.ca = 18;
    p2.XP = 3200;
    p2.inventario.adicionarItem(new Item('Machado de Batalha Pesado', 4.0, 1));
    p2.inventario.adicionarItem(new Item('Cota de Malha Completa', 25.0, 1));
    p2.inventario.adicionarItem(new Item('Escudo de Aço Forjado', 3.0, 1));
    p2.inventario.adicionarItem(new Item('Rações de Viagem (dias)', 1.0, 5));
    p2.magiasHabilidades.push(new MagiaHabilidade('Surto de Ação', 0, 'Livre', 'Realiza uma ação adicional no seu turno uma vez por descanso curto.'));
    p2.magiasHabilidades.push(new MagiaHabilidade('Golpe Poderoso', 2, 'Reação', 'Aumenta a margem de ameaça e causa +2d6 de dano físico.'));

    return [p1, p2];
  }

  private static obterNpcsDemonstracao(): NPC[] {
    return [
      new NPC('Goblin Salteador', 'CR 1/4', 7, 'Cimitarra (+4 para acertar, 1d6+2 cortante), Arco Curto (+4, 1d6+2 perfurante)'),
      new NPC('Lobisomem Alfa', 'CR 3', 58, 'Mordida (+4, 2d4+2 perfurante), Garras (+4, 2d4+2 cortante)'),
      new NPC('Dragão Vermelho Jovem', 'CR 10', 178, 'Mordida (+10, 2d10+6 perfurante + 1d6 fogo), Sopro de Chamas (16d6 fogo)')
    ];
  }

  private static obterCampanhasDemonstracao(personagens: Personagem[], npcs: NPC[]): Campanha[] {
    return [
      new Campanha(
        'A Mina Perdida de Phandelver',
        'Os heróis foram contratados por Gundren Rockseeker para escoltar suprimentos até a cidade fronteiriça de Phandalin, sem saber dos perigos antigos enterrados na Caverna da Onda de Eco.',
        '10/06/2026',
        personagens.slice(0, 2),
        npcs.slice(0, 2)
      )
    ];
  }
}
