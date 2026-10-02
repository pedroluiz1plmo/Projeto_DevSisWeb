import { Personagem } from './Personagem';
import { NPC } from './NPC';
import type { SistemaPasta } from './SistemaPasta';
import type { MonstroPasta } from './MonstroPasta';

export class Campanha {
  public idCampanha: string;
  public nomeCampanha: string;
  public lore: string;
  public dataCriacao: string;
  public personagens: Personagem[];
  public npcs: NPC[];
  public fichas: SistemaPasta[];
  public monstros: MonstroPasta[];

  constructor(
    nomeCampanha: string,
    lore: string,
    dataCriacao?: string,
    personagens: Personagem[] = [],
    npcs: NPC[] = [],
    idCampanha?: string,
    fichas: SistemaPasta[] = [],
    monstros: MonstroPasta[] = []
  ) {
    this.idCampanha = idCampanha || crypto.randomUUID();
    this.nomeCampanha = nomeCampanha;
    this.lore = lore;
    this.dataCriacao = dataCriacao || new Date().toLocaleDateString('pt-BR');
    this.personagens = personagens;
    this.npcs = npcs;
    this.fichas = fichas;
    this.monstros = monstros;
  }

  public adicionarPersonagem(p: Personagem): void {
    if (!this.personagens.some(item => item.idPersonagem === p.idPersonagem)) {
      this.personagens.push(p);
    }
  }

  public removerPersonagem(idPersonagem: string): void {
    this.personagens = this.personagens.filter(p => p.idPersonagem !== idPersonagem);
  }

  public adicionarNPC(npc: NPC): void {
    this.npcs.push(npc);
  }

  public removerNPC(idNpc: string): void {
    this.npcs = this.npcs.filter(n => n.idNpc !== idNpc);
  }
}
