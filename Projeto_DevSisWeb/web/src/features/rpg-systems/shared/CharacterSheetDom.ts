import type { SistemaPasta } from '../../../models/SistemaPasta';

export type CharacterSheetSystem = 'D&D' | 'Call of Cthulhu' | 'Vampiro: A Máscara';

type CharacterSheetMode = 'guided' | 'editor';

export function isCharacterSheetSystem(system: string): system is CharacterSheetSystem {
  return system === 'D&D' || system === 'Call of Cthulhu' || system === 'Vampiro: A Máscara';
}

const dndKeyByField: Record<string, string> = {
  'dnd-player': 'playerName',
  'dnd-class': 'class',
  'dnd-level': 'level',
  'dnd-race': 'race',
  'dnd-background': 'background',
  'dnd-alignment': 'alignment',
  'dnd-xp': 'experiencePoints',
  'dnd-goal': 'guidedGoal',
  'dnd-str': 'strength',
  'dnd-dex': 'dexterity',
  'dnd-con': 'constitution',
  'dnd-int': 'intelligence',
  'dnd-wis': 'wisdom',
  'dnd-cha': 'charisma',
  'dnd-ac': 'armorClass',
  'dnd-initiative': 'initiative',
  'dnd-speed': 'speed',
  'dnd-hp': 'maxHitPoints',
  'dnd-current-hp': 'currentHitPoints',
  'dnd-temp-hp': 'temporaryHitPoints',
  'dnd-hit-dice': 'hitDice',
  'dnd-proficiency': 'proficiencyBonus',
  'dnd-skills': 'skillsAndSavingThrows',
  'dnd-attacks': 'attacksAndSpellcasting',
  'dnd-equipment': 'equipmentAndTreasure',
  'dnd-spells': 'spellsAndSlots',
  'dnd-personality': 'personalityIdealsBondsFlaws',
  'dnd-backstory': 'historyAlliesOrganizations'
};

const legacyFieldAliases: Partial<Record<CharacterSheetSystem, Record<string, string[]>>> = {
  'D&D': {
    'dnd-concept': ['guidedConcept'],
    'dnd-goal': ['guidedGoal'],
    'dnd-backstory': ['guided-dnd-story']
  },
  'Call of Cthulhu': {
    'coc-concept': ['guidedConcept', 'guided-coc-concept'],
    'coc-goal': ['guidedGoal', 'guided-coc-goal'],
    'coc-backstory': ['guided-coc-background']
  },
  'Vampiro: A Máscara': {
    'vampire-concept': ['guidedConcept', 'guided-vampire-concept'],
    'vampire-ambition': ['guidedGoal', 'guided-vampire-goal'],
    'vampire-backstory': ['guided-vampire-story']
  }
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character] || character);

function initialValue(ficha: SistemaPasta | null, system: CharacterSheetSystem, id: string): string {
  if (!ficha) return '';
  if (id === 'inline-ficha-name' || id.endsWith('-name')) return ficha.nome;
  if (id === 'inline-ficha-description') return ficha.descricao || '';

  const data = ficha.dados || {};
  const key = id.replace(/^inline-/, '').replace(/^guided-/, '');
  const candidates = [
    id,
    key,
    ...(system === 'D&D' && dndKeyByField[key] ? [dndKeyByField[key]] : []),
    ...(legacyFieldAliases[system]?.[key] || [])
  ];
  for (const candidate of candidates) {
    if (data[candidate] !== undefined) return String(data[candidate]);
  }
  const compatibleKey = Object.keys(data).find(savedKey =>
    candidates.some(candidate => savedKey.endsWith(`-${candidate}`))
  );
  return compatibleKey ? String(data[compatibleKey]) : '';
}

function inputField(
  ficha: SistemaPasta | null,
  system: CharacterSheetSystem,
  id: string,
  label: string,
  type = 'text',
  placeholder = '',
  options: { min?: number; max?: number; className?: string; required?: boolean } = {}
): string {
  const min = options.min === undefined ? '' : ` min="${options.min}"`;
  const max = options.max === undefined ? '' : ` max="${options.max}"`;
  const className = options.className ? ` ${options.className}` : '';
  const required = options.required ? ' data-required="true"' : '';
  return `<div class="form-group${className}"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="${type}" value="${escapeHtml(initialValue(ficha, system, id))}" placeholder="${escapeHtml(placeholder)}"${min}${max}${required}></div>`;
}

function textArea(
  ficha: SistemaPasta | null,
  system: CharacterSheetSystem,
  id: string,
  label: string,
  rows = 4,
  placeholder = '',
  className = ''
): string {
  return `<div class="form-group${className ? ` ${className}` : ''}"><label for="${id}">${label}</label><textarea id="${id}" class="form-control" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(initialValue(ficha, system, id))}</textarea></div>`;
}

function section(title: string, content: string, description = '', className = ''): string {
  return `<section class="sheet-editor-section character-sheet-section ${className}"><div class="character-sheet-section-heading"><h4>${title}</h4>${description ? `<p class="guided-question">${description}</p>` : ''}</div>${content}</section>`;
}

function actionButtons(guided: boolean, isExisting = false): string {
  const cancelButton = guided
    ? 'data-guided-sheet-cancel'
    : 'id="btn-cancel-ficha-inline"';
  const saveLabel = guided ? 'Salvar e abrir ficha' : 'Salvar ficha';
  const cancelLabel = guided || !isExisting ? 'Cancelar' : 'Voltar';
  return `<div class="character-sheet-actions"><button ${cancelButton} type="button" class="btn btn-secondary">${cancelLabel}</button><button type="submit" class="btn btn-primary">💾 ${saveLabel}</button></div>`;
}

function tabs(
  tabs: Array<{ id: string; label: string }>,
  activeId: string,
  requiredPanelId?: string
): string {
  return `<nav class="coc-sheet-tabs dnd-sheet-tabs" aria-label="Seções da ficha">${tabs.map(tab =>
    `<button type="button" class="coc-sheet-tab${tab.id === activeId ? ' active' : ''}" data-sheet-tab="${tab.id}"${tab.id === requiredPanelId ? ` data-required-panel="${tab.id}"` : ''} aria-pressed="${tab.id === activeId}">${tab.label}${tab.id === requiredPanelId ? '<span class="sheet-tab-pending" aria-label="Campo obrigatório pendente"> •</span>' : ''}</button>`
  ).join('')}</nav>`;
}

function panel(id: string, activeId: string, content: string): string {
  const active = id === activeId;
  return `<section class="sheet-editor-section character-sheet-panel coc-sheet-panel${active ? ' active' : ''}" data-sheet-panel="${id}" data-coc-panel="${id}"${active ? '' : ' hidden'}>${content}</section>`;
}

function reviewPanel(system: CharacterSheetSystem): string {
  return section(
    'Revisão da ficha',
    '<p>Confira os campos preenchidos antes de salvar.</p><ul data-sheet-review-summary></ul>',
    `Revise os dados de ${system} antes de concluir.`,
  );
}

function guidedSheetHeading(system: CharacterSheetSystem, version: string): string {
  const description = system === 'Call of Cthulhu'
    ? 'Crie e edite sua ficha de investigador, organizando os dados por seção.'
    : 'Crie e edite sua ficha de personagem, organizando os dados por seção.';
  return `<header class="sheet-editor-header character-sheet-guided-header"><div><h3>${system} · ${version}</h3><p>${description}</p></div><span class="character-sheet-guided-badge" aria-label="Ficha guiada">♧ Ficha guiada</span></header>`;
}

function attributeCards(
  ficha: SistemaPasta | null,
  system: CharacterSheetSystem,
  prefix: string,
  editable: boolean
): string {
  const attributes = [
    ['str', 'Força', 'FOR'],
    ['dex', 'Destreza', 'DES'],
    ['con', 'Constituição', 'CON'],
    ['int', 'Inteligência', 'INT'],
    ['wis', 'Sabedoria', 'SAB'],
    ['cha', 'Carisma', 'CAR']
  ];
  return `<div class="dnd-guided-attribute-grid">${attributes.map(([key, label, shortLabel]) => {
    const id = `${prefix}-${key}`;
    const value = initialValue(ficha, system, id);
    const numericValue = Number(value);
    const modifier = value.trim() && Number.isFinite(numericValue)
      ? `${Math.floor((numericValue - 10) / 2) >= 0 ? '+' : ''}${Math.floor((numericValue - 10) / 2)}`
      : '—';
    return `<article class="dnd-attribute-card"><h5>${label}</h5><div class="dnd-attribute-score-row">${editable ? `<button type="button" class="dnd-score-step" data-dnd-target="${id}" data-dnd-delta="-1" aria-label="Diminuir ${label}">−</button>` : ''}<input id="${id}" class="form-control dnd-attribute-score" type="number" min="1" max="30" aria-label="${label}" value="${escapeHtml(value)}">${editable ? `<button type="button" class="dnd-score-step" data-dnd-target="${id}" data-dnd-delta="1" aria-label="Aumentar ${label}">+</button>` : ''}</div><div class="dnd-attribute-modifier"><span>${shortLabel}</span><strong data-dnd-modifier-for="${key}">${modifier}</strong></div></article>`;
  }).join('')}</div>`;
}

function dndSheet(ficha: SistemaPasta | null, mode: CharacterSheetMode): string {
  const guided = mode === 'guided';
  const prefix = guided ? 'guided-dnd' : 'inline-dnd';
  const rollButton = `<div class="sheet-section-heading sheet-roll-heading"><span></span><button id="${guided ? 'btn-guided-roll-dnd' : 'btn-roll-dnd-attributes'}" type="button" class="btn btn-secondary">🎲 Rolar atributos</button></div>`;
  if (guided) {
    return `<div class="character-sheet-module dnd-sheet-module">
      ${section('1. Quem é seu personagem?', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'D&D', `${prefix}-name`, 'Nome do personagem', 'text', 'Ex.: Lia, a exploradora', { className: 'dnd-guided-name-field' })}${inputField(ficha, 'D&D', `${prefix}-player`, 'Nome do jogador', 'text', 'Quem interpreta o personagem')}${inputField(ficha, 'D&D', `${prefix}-class`, 'Classe', 'text', 'Ex.: Guerreiro')}${inputField(ficha, 'D&D', `${prefix}-level`, 'Nível', 'number', '1')}${inputField(ficha, 'D&D', `${prefix}-race`, 'Raça ou espécie', 'text', 'Ex.: Humano, elfo, anão')}${inputField(ficha, 'D&D', `${prefix}-background`, 'Antecedente', 'text', 'Ex.: Soldado, artista, nobre')}${inputField(ficha, 'D&D', `${prefix}-alignment`, 'Alinhamento', 'text', 'Ex.: Leal e bom')}${inputField(ficha, 'D&D', `${prefix}-xp`, 'Experiência', 'number', '0')}<div class="dnd-guided-concept-field">${textArea(ficha, 'D&D', `${prefix}-concept`, 'Descrição e conceito', 3, 'Quem é este aventureiro e o que o torna único?')}</div></div>`, 'Defina a identidade do aventureiro; os demais detalhes podem ser completados depois.', 'dnd-guided-section')}
      ${section('2. Como seu personagem é?', `${rollButton}${attributeCards(ficha, 'D&D', prefix, true)}`, 'Role 4d6 e descarte o menor dado de cada atributo. Ajuste os valores quando quiser.', 'dnd-guided-section')}
      ${section('3. Sobreviver aos perigos', `<div class="dnd-guided-stat-grid"><div class="dnd-stat-card dnd-stat-card-health">${inputField(ficha, 'D&D', `${prefix}-current-hp`, 'Vida atual', 'number', '0')}<small>Pontos de vida</small></div><div class="dnd-stat-card dnd-stat-card-health">${inputField(ficha, 'D&D', `${prefix}-max-hp`, 'Vida máxima', 'number', '0')}<small>Limite de vida</small></div><div class="dnd-stat-card dnd-stat-card-defense">${inputField(ficha, 'D&D', `${prefix}-ac`, 'Classe de armadura', 'number', '10')}<small>Defesa (CA)</small></div></div>`, 'Destaque os valores que ajudam a personagem a resistir e se defender.', 'dnd-guided-section')}
      ${section('4. Como você age?', `<div class="dnd-action-grid"><div class="dnd-stat-card dnd-stat-card-movement">${inputField(ficha, 'D&D', `${prefix}-speed`, 'Deslocamento', 'text', 'Ex.: 9 m')}<small>Distância por turno</small></div><div class="dnd-guided-field-card">${textArea(ficha, 'D&D', `${prefix}-attacks`, 'Ataques e conjuração', 4, 'Nome, bônus e dano dos ataques principais')}<small>Ex.: Espada longa · +5 · 1d8+3 cortante</small></div></div>`, 'Reúna deslocamento e ações de combate.', 'dnd-guided-section')}
      ${section('5. O que você carrega?', `<div class="dnd-guided-field-card">${textArea(ficha, 'D&D', `${prefix}-equipment`, 'Equipamento e tesouros', 5, 'Ex.: espada, escudo, mochila, poções')}</div><div class="dnd-guided-identity-grid dnd-guided-extra-grid"><div class="dnd-guided-field-card">${inputField(ficha, 'D&D', `${prefix}-goal`, 'Objetivo', 'text', 'O que espera conquistar?')}</div><div class="dnd-guided-field-card">${textArea(ficha, 'D&D', `${prefix}-story`, 'História inicial', 3, 'Uma breve origem ou acontecimento marcante')}</div></div>`, 'Anote armas, mochila, poções e objetos importantes.', 'dnd-guided-section')}
      ${actionButtons(true)}
    </div>`;
  }

  const sheetTabs = [
    { id: 'principal', label: 'Principal' },
    { id: 'equipamento', label: 'Equipamento' },
    { id: 'magias', label: 'Magias' },
    { id: 'detalhes', label: 'Detalhes' }
  ];
  return `<div class="character-sheet-module dnd-sheet-module">
    ${tabs(sheetTabs, 'principal')}
    ${panel('principal', 'principal', `${section('Identidade', `<div class="dnd-guided-identity-grid dnd-editor-identity-grid">${inputField(ficha, 'D&D', 'inline-ficha-name', 'Nome do personagem', 'text', 'Nome usado na ficha', { className: 'dnd-guided-name-field' })}${inputField(ficha, 'D&D', `${prefix}-player`, 'Nome do jogador')}${inputField(ficha, 'D&D', `${prefix}-class`, 'Classe', 'text', 'Ex.: Guerreiro')}${inputField(ficha, 'D&D', `${prefix}-level`, 'Nível', 'number')}${inputField(ficha, 'D&D', `${prefix}-race`, 'Raça')}${inputField(ficha, 'D&D', `${prefix}-background`, 'Antecedente')}${inputField(ficha, 'D&D', `${prefix}-alignment`, 'Alinhamento')}${inputField(ficha, 'D&D', `${prefix}-xp`, 'Pontos de experiência', 'number')}<div class="dnd-guided-concept-field">${textArea(ficha, 'D&D', 'inline-ficha-description', 'Descrição e conceito', 3)}</div></div>`)}${section('Atributos', `${rollButton}${attributeCards(ficha, 'D&D', prefix, true)}`, 'Distribuição automática: 4d6, descartando o menor dado.')}${section('Combate e sobrevivência', `<div class="dnd-guided-stat-grid dnd-editor-combat-grid">${inputField(ficha, 'D&D', `${prefix}-ac`, 'Classe de armadura', 'number')}${inputField(ficha, 'D&D', `${prefix}-initiative`, 'Iniciativa', 'text', 'Ex.: +2')}${inputField(ficha, 'D&D', `${prefix}-speed`, 'Deslocamento', 'text', 'Ex.: 9 m')}${inputField(ficha, 'D&D', `${prefix}-hp`, 'Pontos de vida máximos', 'number')}${inputField(ficha, 'D&D', `${prefix}-current-hp`, 'Pontos de vida atuais', 'number')}${inputField(ficha, 'D&D', `${prefix}-temp-hp`, 'PV temporários', 'number')}${inputField(ficha, 'D&D', `${prefix}-hit-dice`, 'Dados de vida', 'text', 'Ex.: 8d10')}${inputField(ficha, 'D&D', `${prefix}-proficiency`, 'Bônus de proficiência', 'text', 'Ex.: +2')}</div>`)}${section('Salvaguardas e perícias', textArea(ficha, 'D&D', `${prefix}-skills`, 'Salvaguardas, perícias e proficiências', 6))}${section('Ataques e conjuração', textArea(ficha, 'D&D', `${prefix}-attacks`, 'Ataques, bônus, dano e ações de conjuração', 5))}`)}
    ${panel('equipamento', 'principal', section('Inventário, equipamentos e tesouros', `<div class="dnd-guided-field-card">${textArea(ficha, 'D&D', `${prefix}-equipment`, 'Itens, quantidades, equipamentos, moedas e tesouros', 10)}</div>`, 'Mantenha equipamentos e moedas no formato de dados atual da ficha.'))}
    ${panel('magias', 'principal', section('Magias e conjuração', `<div class="dnd-guided-field-card">${textArea(ficha, 'D&D', `${prefix}-spells`, 'Classe/atributo de conjuração, CD, bônus, truques, círculos, espaços e magias preparadas', 10)}</div>`))}
    ${panel('detalhes', 'principal', `${section('Personalidade e características', textArea(ficha, 'D&D', `${prefix}-personality`, 'Traços de personalidade, ideais, vínculos, defeitos e características', 6))}${section('Histórico e objetivos', `${textArea(ficha, 'D&D', `${prefix}-backstory`, 'História, aliados e organizações', 7)}${inputField(ficha, 'D&D', `${prefix}-goal`, 'Objetivo do personagem', 'text', 'O que espera conquistar?')}`)}`)}
    ${actionButtons(false, Boolean(ficha?.id))}
  </div>`;
}

function cocSheet(ficha: SistemaPasta | null, mode: CharacterSheetMode): string {
  const guided = mode === 'guided';
  const prefix = guided ? 'guided-coc' : 'inline-coc';
  const field = (key: string, label: string, type = 'text', placeholder = '') =>
    inputField(ficha, 'Call of Cthulhu', `${prefix}-${key}`, label, type, placeholder);
  const area = (key: string, label: string, rows: number) =>
    textArea(ficha, 'Call of Cthulhu', `${prefix}-${key}`, label, rows);
  const nameId = guided ? `${prefix}-name` : 'inline-ficha-name';
  const description = guided
    ? ''
    : textArea(ficha, 'Call of Cthulhu', 'inline-ficha-description', 'Descrição da ficha', 2);
  const characteristics = [
    ['str', 'Força', 'FOR'],
    ['con', 'Constituição', 'CON'],
    ['siz', 'Tamanho', 'TAM'],
    ['dex', 'Destreza', 'DES'],
    ['app', 'Aparência', 'APA'],
    ['int', 'Inteligência', 'INT'],
    ['pow', 'Poder', 'POD'],
    ['edu', 'Educação', 'EDU'],
    ['luck', 'Sorte', 'Sorte']
  ];
  const cardGrid = `<div class="coc-characteristic-grid">${characteristics.map(([key, label, shortLabel]) =>
    `<article class="coc-characteristic-card"><span>${label}</span>${inputField(ficha, 'Call of Cthulhu', `${prefix}-${key}`, shortLabel, 'number', '', { min: 0, max: 100, className: 'coc-characteristic-value' })}<small>${shortLabel}</small></article>`
  ).join('')}</div>`;
  const rollButton = `<div class="sheet-section-heading sheet-roll-heading"><span></span><button id="${guided ? 'btn-guided-roll-coc' : 'btn-roll-coc-attributes'}" type="button" class="btn btn-secondary">🎲 Rolar características</button></div>`;
  const sheetTabs = [
    { id: 'investigador', label: 'Investigador' },
    { id: 'caracteristicas', label: 'Atributos e recursos' },
    { id: 'pericias', label: 'Perícias' },
    { id: 'historico', label: 'Antecedentes' },
    { id: 'posses', label: 'Equipamentos' },
    { id: 'revisao', label: 'Revisão' }
  ];
  return `<div class="character-sheet-module dnd-sheet-module coc-sheet-module">
    ${guidedSheetHeading('Call of Cthulhu', '7ª edição')}
    ${tabs(sheetTabs, 'investigador', 'investigador')}
    ${panel('investigador', 'investigador', section('Identidade do investigador', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'Call of Cthulhu', nameId, 'Nome do investigador', 'text', guided ? 'Ex.: Helena Duarte' : 'Nome usado na ficha', { required: true })}${field('player', 'Jogador')}${field('occupation', 'Ocupação', 'text', 'Ex.: Jornalista')}${field('age', 'Idade', 'number')}${field('sex', 'Sexo')}${field('residence', 'Residência')}${field('birthplace', 'Local de nascimento')}${description}${field('concept', 'Conceito')}</div>`, 'Identificação e ocupação do investigador.'))}
    ${panel('caracteristicas', 'investigador', `${section('Características', `${rollButton}${cardGrid}`, 'Rolagem padrão: 3d6 × 5; TAM e INT usam (2d6 + 6) × 5.')}${section('Recursos e combate', `<div class="dnd-guided-stat-grid coc-combat-grid">${field('hp', 'Pontos de vida', 'number')}${field('sanity', 'Sanidade (SAN)', 'number')}${field('mp', 'Pontos de magia', 'number')}${field('move', 'Movimento')}${field('build', 'Construção')}${field('damage', 'Bônus de dano')}</div>`, 'Valores derivados já existentes na ficha podem ser conferidos e ajustados.')}`)}
    ${panel('pericias', 'investigador', section('Perícias', area('skills', 'Perícias, valores e especializações já suportadas', 8)))}
    ${panel('historico', 'investigador', section('Antecedentes', `${field('goal', 'Objetivo', 'text', 'O que espera descobrir?')}${area('backstory', 'História, crenças, pessoas e locais importantes', 8)}`))}
    ${panel('posses', 'investigador', `${section('Equipamentos e posses', area('equipment', 'Equipamentos, armas e objetos importantes', 7))}${section('Finanças', area('finances', 'Dinheiro e recursos', 4))}`)}
    ${panel('revisao', 'investigador', reviewPanel('Call of Cthulhu'))}
    ${actionButtons(guided, Boolean(ficha?.id))}
  </div>`;
}

function vampireSheet(ficha: SistemaPasta | null, mode: CharacterSheetMode): string {
  const guided = mode === 'guided';
  const prefix = guided ? 'guided-vampire' : 'inline-vampire';
  const field = (key: string, label: string, type = 'text', placeholder = '') =>
    inputField(ficha, 'Vampiro: A Máscara', `${prefix}-${key}`, label, type, placeholder);
  const area = (key: string, label: string, rows: number) =>
    textArea(ficha, 'Vampiro: A Máscara', `${prefix}-${key}`, label, rows);
  const nameId = guided ? `${prefix}-name` : 'inline-ficha-name';
  const description = guided
    ? ''
    : textArea(ficha, 'Vampiro: A Máscara', 'inline-ficha-description', 'Descrição do personagem', 2);
  const attributes = [
    ['strength', 'Força', 'Físico'],
    ['dexterity', 'Destreza', 'Físico'],
    ['stamina', 'Vigor', 'Físico'],
    ['charisma', 'Carisma', 'Social'],
    ['manipulation', 'Manipulação', 'Social'],
    ['composure', 'Compostura', 'Social'],
    ['intelligence', 'Inteligência', 'Mental'],
    ['wits', 'Raciocínio', 'Mental'],
    ['resolve', 'Determinação', 'Mental']
  ];
  const cardGrid = `<div class="vampire-attribute-grid">${attributes.map(([key, label, group]) =>
    `<article class="vampire-attribute-card"><span class="vampire-attribute-group">${group}</span><strong>${label}</strong>${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-${key}`, label, 'number', '', { min: 1, max: 5, className: 'vampire-attribute-value' })}</article>`
  ).join('')}</div>`;
  const priorityOptions = [
    ['physical,social,mental', 'Físicos → Sociais → Mentais'],
    ['physical,mental,social', 'Físicos → Mentais → Sociais'],
    ['social,physical,mental', 'Sociais → Físicos → Mentais'],
    ['social,mental,physical', 'Sociais → Mentais → Físicos'],
    ['mental,physical,social', 'Mentais → Físicos → Sociais'],
    ['mental,social,physical', 'Mentais → Sociais → Físicos']
  ];
  const savedPriorities = initialValue(ficha, 'Vampiro: A Máscara', `${prefix}-priorities`);
  const priorityControl = `<label class="vampire-priority-control" for="${prefix}-priorities">Prioridade dos grupos
    <select id="${prefix}-priorities" class="custom-select">
      ${priorityOptions.map(([value, label]) =>
    `<option value="${value}"${(savedPriorities || priorityOptions[0][0]) === value ? ' selected' : ''}>${label}</option>`
  ).join('')}
    </select>
  </label>`;
  const rollButton = `<div class="sheet-section-heading sheet-roll-heading">${priorityControl}<button id="${guided ? 'btn-guided-roll-vampire' : 'btn-roll-vampire-attributes'}" type="button" class="btn btn-secondary">🎲 Distribuir atributos</button></div>`;
  const sheetTabs = [
    { id: 'conceito', label: 'Conceito' },
    { id: 'atributos', label: 'Atributos' },
    { id: 'habilidades', label: 'Habilidades' },
    { id: 'disciplinas', label: 'Disciplinas' },
    { id: 'vantagens', label: 'Vantagens e defeitos' },
    { id: 'recursos', label: 'Características e recursos' },
    { id: 'revisao', label: 'Revisão' }
  ];
  return `<div class="character-sheet-module dnd-sheet-module vampire-sheet-module">
    ${guidedSheetHeading('Vampiro: A Máscara', 'V5')}
    ${tabs(sheetTabs, 'conceito', 'conceito')}
    ${panel('conceito', 'conceito', `${section('Conceito e identidade', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'Vampiro: A Máscara', nameId, 'Nome do personagem', 'text', 'Ex.: Bianca', { required: true })}${field('player', 'Jogador')}${field('chronicle', 'Crônica')}${field('concept', 'Conceito')}${field('clan', 'Clã')}${field('sire', 'Senhor')}${field('predator', 'Tipo de predador')}${field('ambition', 'Ambição')}${field('desire', 'Desejo')}${field('generation', 'Geração')}${description}</div>`)}${section('História e âncoras', `${area('touchstones', 'Âncoras e convicções', 4)}${area('backstory', 'História e anotações da crônica', 6)}`)}`)}
    ${panel('atributos', 'conceito', section('Atributos', `${rollButton}${cardGrid}`, 'Escolha as prioridades e distribua os pontos 7/5/3 conforme a regra V5.'))}
    ${panel('habilidades', 'conceito', section('Habilidades', area('abilities', 'Perícias e habilidades já suportadas pela ficha', 8)))}
    ${panel('disciplinas', 'conceito', section('Disciplinas', area('disciplines', 'Disciplinas e níveis', 8)))}
    ${panel('vantagens', 'conceito', section('Vantagens e defeitos', area('advantages', 'Vantagens e defeitos', 7)))}
    ${panel('recursos', 'conceito', section('Características e recursos', `<div class="dnd-guided-stat-grid vampire-resource-grid">${field('health', 'Saúde', 'number')}${field('willpower', 'Força de vontade', 'number')}${field('humanity', 'Humanidade', 'number')}${field('hunger', 'Fome', 'number')}${field('stains', 'Manchas', 'number')}${field('blood-potency', 'Potência de sangue', 'number')}</div>`, 'Confira os valores derivados e os demais recursos já presentes na ficha.'))}
    ${panel('revisao', 'conceito', reviewPanel('Vampiro: A Máscara'))}
    ${actionButtons(guided, Boolean(ficha?.id))}
  </div>`;
}

export function renderCharacterSheet(
  root: HTMLElement,
  system: CharacterSheetSystem,
  mode: CharacterSheetMode,
  ficha: SistemaPasta | null
): void {
  root.innerHTML = system === 'D&D'
    ? dndSheet(ficha, mode)
    : system === 'Call of Cthulhu'
      ? cocSheet(ficha, mode)
      : vampireSheet(ficha, mode);

  const updateRequiredMarkers = (): void => {
    root.querySelectorAll<HTMLButtonElement>('[data-required-panel]').forEach(button => {
      const panelId = button.dataset.requiredPanel;
      const requiredPanel = panelId
        ? root.querySelector<HTMLElement>(`[data-sheet-panel="${panelId}"]`)
        : null;
      const pending = Boolean(requiredPanel?.querySelector<HTMLInputElement>('input[data-required]')?.value.trim());
      const indicator = button.querySelector<HTMLElement>('.sheet-tab-pending');
      if (indicator) indicator.hidden = pending;
      button.classList.toggle('has-pending-required', !pending);
    });
  };
  root.addEventListener('input', updateRequiredMarkers);
  root.addEventListener('change', updateRequiredMarkers);
  updateRequiredMarkers();

  root.querySelectorAll<HTMLButtonElement>('[data-sheet-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.sheetTab;
      if (!targetId) return;
      root.querySelectorAll<HTMLButtonElement>('[data-sheet-tab]').forEach(tab => {
        const active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', String(active));
      });
      root.querySelectorAll<HTMLElement>('[data-sheet-panel]').forEach(sheetPanel => {
        const active = sheetPanel.dataset.sheetPanel === targetId;
        sheetPanel.hidden = !active;
        sheetPanel.classList.toggle('active', active);
      });
      if (mode === 'guided' && targetId === 'revisao') {
        const module = root.querySelector<HTMLElement>('.character-sheet-module');
        if (module) module.dataset.guidedReviewReady = 'true';
        const summary = root.querySelector<HTMLElement>('[data-sheet-review-summary]');
        if (summary) {
          summary.replaceChildren();
          root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            'input, textarea, select',
          ).forEach(field => {
            if (!field.value.trim()) return;
            const label = root.querySelector<HTMLLabelElement>(`label[for="${field.id}"]`);
            const item = document.createElement('li');
            item.textContent = `${label?.textContent?.trim() || field.id}: ${field.value.trim()}`;
            summary.append(item);
          });
        }
      }
    });
  });
}
