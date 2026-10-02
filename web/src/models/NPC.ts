export class NPC {
  public idNpc: string;
  public nome: string;
  public nivelDesafio: string; // Ex: "CR 1/2", "CR 3"
  public vida: number;
  public vidaMax: number;
  public ataques: string;
  public iniciativa: number;

  constructor(
    nome: string,
    nivelDesafio: string,
    vida: number,
    ataques: string,
    idNpc?: string
  ) {
    this.idNpc = idNpc || crypto.randomUUID();
    this.nome = nome;
    this.nivelDesafio = nivelDesafio;
    this.vidaMax = Math.max(1, vida);
    this.vida = this.vidaMax;
    this.ataques = ataques;
    this.iniciativa = 10;
  }

  public atualizarVida(delta: number): number {
    this.vida = Math.max(0, Math.min(this.vidaMax, this.vida + delta));
    return this.vida;
  }
}
