type FieldRenderer = (id: string, label: string, type?: string, placeholder?: string) => string;
type AreaRenderer = (id: string, label: string, rows: number) => string;

/** Painéis específicos do editor de ficha de Call of Cthulhu. */
export class FichaEditorView {
  public static render(field: FieldRenderer, area: AreaRenderer): string {
    return `
      <div class="sheet-editor-section"><h4>Identidade do investigador</h4><div class="grid-2">${field('inline-ficha-name', 'Nome do investigador', 'text', 'Nome usado na ficha')}${field('inline-coc-player', 'Jogador')}${field('inline-coc-occupation', 'Ocupação', 'text', 'Ex: Jornalista')}${field('inline-coc-age', 'Idade', 'number')}${field('inline-coc-sex', 'Sexo')}${field('inline-coc-residence', 'Residência')}${field('inline-coc-birthplace', 'Local de nascimento')}${area('inline-ficha-description', 'Descrição da ficha', 2)}</div></div>
      <nav class="coc-sheet-tabs" aria-label="Seções da ficha de Call of Cthulhu"><button type="button" class="coc-sheet-tab active" data-coc-tab="caracteristicas">Características</button><button type="button" class="coc-sheet-tab" data-coc-tab="pericias">Perícias</button><button type="button" class="coc-sheet-tab" data-coc-tab="combate">Combate</button><button type="button" class="coc-sheet-tab" data-coc-tab="historico">Histórico</button><button type="button" class="coc-sheet-tab" data-coc-tab="posses">Posses</button></nav>
      <div class="sheet-editor-section coc-sheet-panel active" data-coc-panel="caracteristicas"><div class="sheet-section-heading"><div><h4>Características</h4><p class="attribute-rule-hint">Rolagem automática: características em 3d6 × 5 e atributos especiais em 2d6+6 × 5.</p></div><button type="button" id="btn-roll-coc-attributes" class="btn btn-secondary">🎲 Rolar atributos</button></div><div class="grid-3 coc-attribute-grid">${field('inline-coc-str', 'FOR', 'number')}${field('inline-coc-con', 'CON', 'number')}${field('inline-coc-siz', 'TAM', 'number')}${field('inline-coc-dex', 'DES', 'number')}${field('inline-coc-app', 'APA', 'number')}${field('inline-coc-int', 'INT', 'number')}${field('inline-coc-pow', 'POD', 'number')}${field('inline-coc-edu', 'EDU', 'number')}${field('inline-coc-luck', 'Sorte', 'number')}</div></div>
      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="combate"><h4>Combate</h4><div class="grid-3">${field('inline-coc-hp', 'Pontos de vida', 'number')}${field('inline-coc-sanity', 'SAN', 'number')}${field('inline-coc-mp', 'Pontos de magia', 'number')}${field('inline-coc-move', 'Movimento')}${field('inline-coc-build', 'Construção')}${field('inline-coc-damage', 'Bônus de dano')}</div></div>
      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="pericias"><h4>Perícias</h4>${area('inline-coc-skills', 'Perícias e valores', 6)}</div>
      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="historico"><h4>Histórico</h4>${area('inline-coc-backstory', 'Antecedentes, aliados e anotações', 7)}</div>
      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="posses"><h4>Posses</h4>${area('inline-coc-equipment', 'Equipamentos, armas e objetos importantes', 6)}${area('inline-coc-finances', 'Dinheiro e recursos', 3)}</div>
    `;
  }
}
