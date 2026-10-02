import { Inventario } from './Inventario';
import { MagiaHabilidade } from './MagiaHabilidade';

export interface Atributos {
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria: number;
  carisma: number;
}

export class Personagem {
  public idPersonagem: string;
  public nomePersonagem: string;
  public sistema: string;
  public raca: string;
  public classe: string;
  public nivel: number;
  public atributos: Atributos;
  public pontosVida: number;
  public pontosVidaMax: number;
  public pontosMana: number;
  public pontosManaMax: number;
  public ca: number; // Classe de Armadura
  public XP: number;
  public inventario: Inventario; // Composição
  public magiasHabilidades: MagiaHabilidade[];

  constructor(
    nomePersonagem: string,
    classe: string,
    raca: string,
    sistema: string = 'D&D 5e',
    atributos?: Partial<Atributos>,
    nivel: number = 1,
    idPersonagem?: string
  ) {
    this.idPersonagem = idPersonagem || crypto.randomUUID();
    this.nomePersonagem = nomePersonagem;
    this.classe = classe;
    this.raca = raca;
    this.sistema = sistema;
    this.nivel = Math.max(1, nivel);

    this.atributos = {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10,
      ...atributos
    };

    const modCon = this.calcularModificador(this.atributos.constituicao);
    const modDes = this.calcularModificador(this.atributos.destreza);

    // Cálculos derivados básicos
    const pvBase = this.calcularPvBaseClasse(classe);
    this.pontosVidaMax = Math.max(1, pvBase + modCon);
    this.pontosVida = this.pontosVidaMax;

    this.pontosManaMax = 10 + (this.atributos.inteligencia > 10 ? this.atributos.inteligencia - 10 : 0);
    this.pontosMana = this.pontosManaMax;

    this.ca = 10 + modDes;
    this.XP = 0;

    // Limite de carga proporcional à Força (Ex: Força * 7 kg)
    const limiteCarga = Math.max(30, this.atributos.forca * 7);
    this.inventario = new Inventario(limiteCarga);
    this.magiasHabilidades = [];
  }

  public calcularModificador(valor: number): number {
    return Math.floor((valor - 10) / 2);
  }

  public calcularModificadores(): Record<keyof Atributos, number> {
    return {
      forca: this.calcularModificador(this.atributos.forca),
      destreza: this.calcularModificador(this.atributos.destreza),
      constituicao: this.calcularModificador(this.atributos.constituicao),
      inteligencia: this.calcularModificador(this.atributos.inteligencia),
      sabedoria: this.calcularModificador(this.atributos.sabedoria),
      carisma: this.calcularModificador(this.atributos.carisma),
    };
  }

  public obterModificador(nomeAtributo: string): number {
    const chave = nomeAtributo.toLowerCase() as keyof Atributos;
    if (this.atributos[chave] !== undefined) {
      return this.calcularModificador(this.atributos[chave]);
    }
    return 0;
  }

  public atualizarVida(delta: number): number {
    this.pontosVida = Math.max(0, Math.min(this.pontosVidaMax, this.pontosVida + delta));
    return this.pontosVida;
  }

  public subirNivel(): void {
    this.nivel += 1;
    const modCon = this.calcularModificador(this.atributos.constituicao);
    const incrementoPV = Math.max(1, Math.floor(this.calcularPvBaseClasse(this.classe) / 2 + 1) + modCon);
    this.pontosVidaMax += incrementoPV;
    this.pontosVida = this.pontosVidaMax;
  }

  public adicionarXP(quantidade: number): boolean {
    this.XP += Math.max(0, quantidade);
    const xpNecessario = this.nivel * 1000;
    if (this.XP >= xpNecessario) {
      this.subirNivel();
      return true; // Indicador de subida de nível
    }
    return false;
  }

  private calcularPvBaseClasse(classe: string): number {
    const c = classe.toLowerCase();
    if (c.includes('bárbaro') || c.includes('barbarian')) return 12;
    if (c.includes('guerreiro') || c.includes('paladino') || c.includes('ranger')) return 10;
    if (c.includes('clérigo') || c.includes('druida') || c.includes('ladino') || c.includes('bardo') || c.includes('monge')) return 8;
    return 6; // Mago, Feiticeiro, etc.
  }
}
