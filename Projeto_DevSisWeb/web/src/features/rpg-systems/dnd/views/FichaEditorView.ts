type FieldRenderer = (id: string, label: string, type?: string, placeholder?: string) => string;
type AreaRenderer = (id: string, label: string, rows: number) => string;

/** Painéis específicos do editor de ficha de D&D 5e. */
export class FichaEditorView {
  public static render(field: FieldRenderer, area: AreaRenderer): string {
    return `
      <nav class="coc-sheet-tabs dnd-sheet-tabs" aria-label="Seções da ficha de D&D 5e">
        <button type="button" class="coc-sheet-tab active" data-coc-tab="principal">Principal</button>
        <button type="button" class="coc-sheet-tab" data-coc-tab="equipamento">Equipamento</button>
        <button type="button" class="coc-sheet-tab" data-coc-tab="magias">Magias</button>
        <button type="button" class="coc-sheet-tab" data-coc-tab="detalhes">Detalhes</button>
      </nav>

      <div class="sheet-editor-section coc-sheet-panel active" data-coc-panel="principal">
        <section class="dnd-editor-group">
          <h4>Identidade</h4>
          <div class="dnd-guided-identity-grid dnd-editor-identity-grid">
          <div class="dnd-guided-name-field">${field('inline-ficha-name', 'Nome do personagem', 'text', 'Nome usado na ficha')}</div>
          ${field('inline-dnd-player', 'Nome do jogador', 'text', 'Nome do jogador')}
          ${field('inline-dnd-class', 'Classe', 'text', 'Ex.: Guerreiro')}
          ${field('inline-dnd-level', 'Nível', 'number')}
          ${field('inline-dnd-race', 'Raça', 'text', 'Ex.: Humano')}
          ${field('inline-dnd-background', 'Antecedente', 'text', 'Ex.: Soldado')}
          ${field('inline-dnd-alignment', 'Alinhamento', 'text', 'Ex.: Leal e Bom')}
          ${field('inline-dnd-xp', 'Pontos de experiência', 'number')}
          <div class="dnd-guided-concept-field">${area('inline-ficha-description', 'Descrição e conceito', 3)}</div>
          </div>
        </section>

        <section class="dnd-editor-group">
        <div class="sheet-section-heading dnd-editor-section-heading">
          <div>
            <h4>Atributos</h4>
            <p class="attribute-rule-hint">Distribuição automática: 4d6, descartando o menor dado.</p>
          </div>
          <button type="button" id="btn-roll-dnd-attributes" class="btn btn-secondary">🎲 Rolar atributos</button>
        </div>
        <div class="dnd-guided-attribute-grid">
          ${[
            ['str', 'Força', 'FOR'],
            ['dex', 'Destreza', 'DES'],
            ['con', 'Constituição', 'CON'],
            ['int', 'Inteligência', 'INT'],
            ['wis', 'Sabedoria', 'SAB'],
            ['cha', 'Carisma', 'CAR']
          ].map(([key, label, shortLabel]) => `
            <article class="dnd-attribute-card">
              <h5>${label}</h5>
              <div class="dnd-attribute-score-row">
                <button type="button" class="dnd-score-step" data-dnd-target="inline-dnd-${key}" data-dnd-delta="-1" aria-label="Diminuir ${label}">−</button>
                ${field(`inline-dnd-${key}`, shortLabel, 'number')}
                <button type="button" class="dnd-score-step" data-dnd-target="inline-dnd-${key}" data-dnd-delta="1" aria-label="Aumentar ${label}">+</button>
              </div>
              <div class="dnd-attribute-modifier"><span>${shortLabel}</span><strong data-dnd-modifier-for="${key}">+0</strong></div>
            </article>
          `).join('')}
        </div>
        </section>

        <section class="dnd-editor-group">
          <h4>Combate e sobrevivência</h4>
          <div class="dnd-guided-stat-grid dnd-editor-combat-grid">
            <div class="dnd-stat-card dnd-stat-card-defense">${field('inline-dnd-ac', 'Classe de armadura', 'number')}</div>
            <div class="dnd-stat-card">${field('inline-dnd-initiative', 'Iniciativa', 'text', 'Ex.: +2')}</div>
            <div class="dnd-stat-card dnd-stat-card-movement">${field('inline-dnd-speed', 'Deslocamento', 'text', 'Ex.: 9 m')}</div>
            <div class="dnd-stat-card dnd-stat-card-health">${field('inline-dnd-hp', 'Pontos de vida máximos', 'number')}</div>
            <div class="dnd-stat-card dnd-stat-card-health">${field('inline-dnd-current-hp', 'Pontos de vida atuais', 'number')}</div>
            <div class="dnd-stat-card">${field('inline-dnd-temp-hp', 'PV temporários', 'number')}</div>
            <div class="dnd-stat-card">${field('inline-dnd-hit-dice', 'Dados de vida', 'text', 'Ex.: 8d10')}</div>
            <div class="dnd-stat-card">${field('inline-dnd-proficiency', 'Bônus de proficiência', 'text', 'Ex.: +2')}</div>
          </div>
        </section>

        <section class="dnd-editor-group">
          <h4>Salvaguardas e perícias</h4>
          <div class="dnd-guided-field-card">${area('inline-dnd-skills', 'Salvaguardas, perícias e proficiências', 6)}</div>
        </section>

        <section class="dnd-editor-group">
          <h4>Ataques e conjuração</h4>
          <div class="dnd-guided-field-card">${area('inline-dnd-attacks', 'Ataques, bônus, dano e ações de conjuração', 5)}</div>
        </section>
      </div>

      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="equipamento">
        <section class="dnd-editor-group">
          <h4>Inventário, equipamentos e tesouros</h4>
          <div class="dnd-guided-field-card dnd-editor-equipment-card">${area('inline-dnd-equipment', 'Itens, quantidades, equipamentos, moedas e tesouros', 10)}</div>
        </section>
      </div>

      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="magias">
        <section class="dnd-editor-group">
          <h4>Magias e conjuração</h4>
          <div class="dnd-guided-field-card">${area('inline-dnd-spells', 'Classe/atributo de conjuração, CD, bônus, truques, círculos, espaços e magias preparadas', 10)}</div>
        </section>
      </div>

      <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="detalhes">
        <section class="dnd-editor-group">
          <h4>Personalidade e características</h4>
          <div class="dnd-guided-field-card">${area('inline-dnd-personality', 'Traços de personalidade, ideais, vínculos, defeitos e características', 6)}</div>
        </section>
        <section class="dnd-editor-group">
          <h4>Histórico e objetivos</h4>
          <div class="dnd-guided-field-card">${area('inline-dnd-backstory', 'História, aliados e organizações', 7)}</div>
          <div class="dnd-guided-field-card dnd-editor-goal-card">${field('inline-dnd-goal', 'Objetivo do personagem', 'text', 'O que espera conquistar?')}</div>
        </section>
      </div>
    `;
  }
}
