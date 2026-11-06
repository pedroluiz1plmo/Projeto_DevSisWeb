type ValueResolver = (attribute: string) => number;

/** Botões de atributos próprios de D&D para o rolador compartilhado. */
export class RoladorDadosView {
  public static renderAtributos(valorDoAtributo: ValueResolver, sistema: string): string {
    return [['FOR', 'str'], ['DES', 'dex'], ['CON', 'con'], ['INT', 'int'], ['SAB', 'wis'], ['CAR', 'cha']]
      .map(([label, chave]) => {
        const valor = valorDoAtributo(chave);
        const modificador = Math.floor((valor - 10) / 2);
        const exibicao = `${modificador >= 0 ? '+' : ''}${modificador}`;
        return `<button class="btn btn-secondary btn-roll-action" data-attr="${label}" data-value="${valor}" data-system="${sistema}">${label} (${exibicao})</button>`;
      }).join('');
  }
}
