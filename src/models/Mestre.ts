import { Usuario } from './Usuario';
import { Campanha } from './Campanha';
import { NPC } from './NPC';

export interface CombatenteIniciativa {
  id: string;
  nome: string;
  tipo: 'Personagem' | 'NPC';
  iniciativa: number;
  vidaAtual: number;
  vidaMax: number;
  ca?: number;
}

export class Mestre extends Usuario {
  public campanhas: Campanha[];
  public npcs: NPC[];
  public filaIniciativa: CombatenteIniciativa[];

  constructor(
    idUsuario: string,
    nome: string,
    email: string,
    campanhas: Campanha[] = [],
    npcs: NPC[] = []
  ) {
    super(idUsuario, nome, email);
    this.campanhas = campanhas;
    this.npcs = npcs;
    this.filaIniciativa = [];
  }

  public gerenciarCampanhas(): Campanha[] {
    return this.campanhas;
  }

  public gerenciarNPCs(): NPC[] {
    return this.npcs;
  }

  public gerenciarIniciativa(): CombatenteIniciativa[] {
    return this.filaIniciativa.sort((a, b) => b.iniciativa - a.iniciativa);
  }

  public adicionarCampanha(campanha: Campanha): void {
    this.campanhas.push(campanha);
  }

  public removerCampanha(idCampanha: string): void {
    this.campanhas = this.campanhas.filter(c => c.idCampanha !== idCampanha);
  }

  public adicionarNPC(npc: NPC): void {
    this.npcs.push(npc);
  }

  public removerNPC(idNpc: string): void {
    this.npcs = this.npcs.filter(n => n.idNpc !== idNpc);
  }

  public adicionarCombatente(combatente: CombatenteIniciativa): void {
    this.filaIniciativa.push(combatente);
    this.ordenarIniciativa();
  }

  public removerCombatente(id: string): void {
    this.filaIniciativa = this.filaIniciativa.filter(c => c.id !== id);
  }

  public ordenarIniciativa(): void {
    this.filaIniciativa.sort((a, b) => b.iniciativa - a.iniciativa);
  }

  public limparIniciativa(): void {
    this.filaIniciativa = [];
  }
}
