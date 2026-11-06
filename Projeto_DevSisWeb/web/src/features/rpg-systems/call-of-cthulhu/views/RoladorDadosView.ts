type ValueResolver = (attribute: string) => number;

/** Botões de atributos próprios de Call of Cthulhu para o rolador compartilhado. */
export class RoladorDadosView {
  public static renderAtributos(valorDoAtributo: ValueResolver, sistema: string): string {
    return [['FOR', 'str'], ['CON', 'con'], ['TAM', 'siz'], ['DES', 'dex'], ['APA', 'app'], ['INT', 'int'], ['POD', 'pow'], ['EDU', 'edu'], ['Sorte', 'luck']]
      .map(([label, chave]) => {
        const valor = valorDoAtributo(chave);
        return `<button class="btn btn-secondary btn-roll-action" data-attr="${label}" data-value="${valor}" data-system="${sistema}">${label} (${valor})</button>`;
      }).join('');
  }
}
