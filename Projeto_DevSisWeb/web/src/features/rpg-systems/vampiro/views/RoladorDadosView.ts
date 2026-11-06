type ValueResolver = (attribute: string) => number;

/** Botões de atributos próprios de Vampiro: A Máscara para o rolador compartilhado. */
export class RoladorDadosView {
  public static renderAtributos(valorDoAtributo: ValueResolver, sistema: string): string {
    return [['Força', 'strength'], ['Destreza', 'dexterity'], ['Vigor', 'stamina'], ['Carisma', 'charisma'], ['Manipulação', 'manipulation'], ['Compostura', 'composure'], ['Inteligência', 'intelligence'], ['Raciocínio', 'wits'], ['Determinação', 'resolve']]
      .map(([label, chave]) => {
        const valor = valorDoAtributo(chave);
        return `<button class="btn btn-secondary btn-roll-action" data-attr="${label}" data-value="${valor}" data-system="${sistema}">${label} (${valor})</button>`;
      }).join('');
  }
}
