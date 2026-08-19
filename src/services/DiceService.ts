export interface ResultadoRolagem {
  id: string;
  dataHora: string;
  nomePersonagem?: string;
  periciaOuAtributo: string;
  dadoTipo: string; // ex: "1d20"
  valorDado: number; // 1 a 20
  modificador: number;
  total: number;
  tipoResultado: 'critico' | 'falha' | 'normal';
  detalheCalculo: string;
}

export class DiceService {
  /**
   * Executa sorteio de dados utilizando crypto.getRandomValues para alta aleatoriedade/entropia criptográfica
   */
  public static sortearNumero(min: number = 1, max: number = 20): number {
    const range = max - min + 1;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] % range);
  }

  /**
   * Implementa o fluxo do UC05: Realizar Rolagem de Dados
   */
  public static rolarD20(
    periciaOuAtributo: string,
    modificador: number,
    nomePersonagem?: string
  ): ResultadoRolagem {
    const valorDado = this.sortearNumero(1, 20);
    const total = valorDado + modificador;

    let tipoResultado: 'critico' | 'falha' | 'normal' = 'normal';
    if (valorDado === 20) {
      tipoResultado = 'critico';
    } else if (valorDado === 1) {
      tipoResultado = 'falha';
    }

    const sinalMod = modificador >= 0 ? `+${modificador}` : `${modificador}`;
    const detalheCalculo = `d20 (${valorDado}) ${sinalMod} = ${total}`;

    return {
      id: crypto.randomUUID(),
      dataHora: new Date().toLocaleTimeString('pt-BR'),
      nomePersonagem,
      periciaOuAtributo,
      dadoTipo: '1d20',
      valorDado,
      modificador,
      total,
      tipoResultado,
      detalheCalculo
    };
  }

  public static rolarGenerico(lados: number, quantidade: number = 1, bonus: number = 0): { total: number; dados: number[]; formula: string } {
    const dados: number[] = [];
    for (let i = 0; i < quantidade; i++) {
      dados.push(this.sortearNumero(1, lados));
    }
    const somaDados = dados.reduce((a, b) => a + b, 0);
    const total = somaDados + bonus;
    const formula = `${quantidade}d${lados}${bonus !== 0 ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : ''} [${dados.join(', ')}]`;
    return { total, dados, formula };
  }
}
