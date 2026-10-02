export class MagiaHabilidade {
  public id: string;
  public nome: string;
  public custoMana: number;
  public tempoConjuracao: string;
  public efeito: string;

  constructor(
    nome: string,
    custoMana: number,
    tempoConjuracao: string,
    efeito: string,
    id?: string
  ) {
    this.id = id || crypto.randomUUID();
    this.nome = nome;
    this.custoMana = Math.max(0, custoMana);
    this.tempoConjuracao = tempoConjuracao;
    this.efeito = efeito;
  }
}
