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
  options: { min?: number; max?: number; className?: string } = {}
): string {
  const min = options.min === undefined ? '' : ` min="${options.min}"`;
  const max = options.max === undefined ? '' : ` max="${options.max}"`;
  const className = options.className ? ` ${options.className}` : '';
  return `<div class="form-group${className}"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="${type}" value="${escapeHtml(initialValue(ficha, system, id))}" placeholder="${escapeHtml(placeholder)}"${min}${max}></div>`;
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

function tabs(tabs: Array<{ id: string; label: string }>, activeId: string): string {
  return `<nav class="coc-sheet-tabs" aria-label="Seções da ficha">${tabs.map(tab =>
    `<button type="button" class="coc-sheet-tab${tab.id === activeId ? ' active' : ''}" data-sheet-tab="${tab.id}" aria-pressed="${tab.id === activeId}">${tab.label}</button>`
  ).join('')}</nav>`;
}

function panel(id: string, activeId: string, content: string): string {
  const active = id === activeId;
  return `<section class="sheet-editor-section character-sheet-panel coc-sheet-panel${active ? ' active' : ''}" data-sheet-panel="${id}" data-coc-panel="${id}"${active ? '' : ' hidden'}>${content}</section>`;
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

  if (guided) {
    return `<div class="character-sheet-module coc-sheet-module">
      ${section('2. Quem é seu investigador?', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'Call of Cthulhu', `${prefix}-name`, 'Nome do investigador', 'text', 'Ex.: Helena Duarte')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-occupation`, 'Ocupação', 'text', 'Ex.: Jornalista')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-age`, 'Idade', 'text', 'Ex.: 32')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-concept`, 'Conceito', 'text', 'Ex.: Repórter obcecada por mistérios')}</div>`, 'Escolha uma identidade e uma ocupação para quem se envolve com o inexplicável.', 'coc-guided-section')}
      ${section('3. Características do investigador', `${rollButton}${cardGrid}`, '3d6 × 5; TAM e INT usam (2d6 + 6) × 5.', 'coc-guided-section')}
      ${section('4. O que trouxe você ao horror?', `${inputField(ficha, 'Call of Cthulhu', `${prefix}-goal`, 'Objetivo', 'text', 'O que espera descobrir?')}${textArea(ficha, 'Call of Cthulhu', `${prefix}-background`, 'História inicial', 4, 'Conte como começou o envolvimento com o inexplicável.')}`, 'Registre o objetivo e o acontecimento que iniciou a investigação.', 'coc-guided-section')}
      ${actionButtons(true)}
    </div>`;
  }

  const sheetTabs = [
    { id: 'caracteristicas', label: 'Características' },
    { id: 'pericias', label: 'Perícias' },
    { id: 'combate', label: 'Combate' },
    { id: 'historico', label: 'Histórico' },
    { id: 'posses', label: 'Posses' }
  ];
  return `<div class="character-sheet-module coc-sheet-module">
    ${section('Identidade do investigador', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'Call of Cthulhu', 'inline-ficha-name', 'Nome do investigador', 'text', 'Nome usado na ficha')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-player`, 'Jogador')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-occupation`, 'Ocupação', 'text', 'Ex.: Jornalista')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-age`, 'Idade', 'number')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-sex`, 'Sexo')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-residence`, 'Residência')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-birthplace`, 'Local de nascimento')}${textArea(ficha, 'Call of Cthulhu', 'inline-ficha-description', 'Descrição da ficha', 2)}</div>`)}
    ${tabs(sheetTabs, 'caracteristicas')}
    ${panel('caracteristicas', 'caracteristicas', section('Características', `${rollButton}${cardGrid}`, 'Rolagem automática: características em 3d6 × 5; TAM e INT em (2d6 + 6) × 5.'))}
    ${panel('pericias', 'caracteristicas', section('Perícias', textArea(ficha, 'Call of Cthulhu', `${prefix}-skills`, 'Perícias e valores', 8)))}
    ${panel('combate', 'caracteristicas', section('Combate e recursos', `<div class="dnd-guided-stat-grid coc-combat-grid">${inputField(ficha, 'Call of Cthulhu', `${prefix}-hp`, 'Pontos de vida', 'number')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-sanity`, 'Sanidade (SAN)', 'number')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-mp`, 'Pontos de magia', 'number')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-move`, 'Movimento')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-build`, 'Construção')}${inputField(ficha, 'Call of Cthulhu', `${prefix}-damage`, 'Bônus de dano')}</div>`))}
    ${panel('historico', 'caracteristicas', section('Histórico do investigador', textArea(ficha, 'Call of Cthulhu', `${prefix}-backstory`, 'Antecedentes, aliados e anotações', 8)))}
    ${panel('posses', 'caracteristicas', `${section('Posses', textArea(ficha, 'Call of Cthulhu', `${prefix}-equipment`, 'Equipamentos, armas e objetos importantes', 7))}${section('Finanças', textArea(ficha, 'Call of Cthulhu', `${prefix}-finances`, 'Dinheiro e recursos', 4))}`)}
    ${actionButtons(false, Boolean(ficha?.id))}
  </div>`;
}

function vampireSheet(ficha: SistemaPasta | null, mode: CharacterSheetMode): string {
  const guided = mode === 'guided';
  const prefix = guided ? 'guided-vampire' : 'inline-vampire';
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
  const rollButton = `<div class="sheet-section-heading sheet-roll-heading"><span></span><button id="${guided ? 'btn-guided-roll-vampire' : 'btn-roll-vampire-attributes'}" type="button" class="btn btn-secondary">🎲 Distribuir atributos</button></div>`;

  if (guided) {
    return `<div class="character-sheet-module vampire-sheet-module">
      ${section('2. Quem você se tornou?', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-name`, 'Nome do personagem', 'text', 'Ex.: Bianca')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-concept`, 'Conceito', 'text', 'Ex.: Herdeira exilada')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-clan`, 'Clã', 'text', 'Ex.: Toreador')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-generation`, 'Geração', 'text', 'Ex.: 12ª')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-predator`, 'Tipo de predador')}</div>`, 'Defina a identidade, o clã e o predador que moldam sua existência na noite.', 'vampire-guided-section')}
      ${section('3. Atributos da criatura', `${rollButton}${cardGrid}`, 'Distribuição V5: atributos começam em 1 e recebem 7/5/3 pontos.', 'vampire-guided-section')}
      ${section('4. O que ainda importa?', `${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-goal`, 'Ambição')}${textArea(ficha, 'Vampiro: A Máscara', `${prefix}-story`, 'História inicial', 4)}`, 'Escolha uma ambição e conte a história que trouxe você até esta crônica.', 'vampire-guided-section')}
      ${actionButtons(true)}
    </div>`;
  }

  const sheetTabs = [
    { id: 'ficha', label: 'Ficha' },
    { id: 'habilidade', label: 'Habilidade' },
    { id: 'historia', label: 'História' }
  ];
  return `<div class="character-sheet-module vampire-sheet-module">
    ${tabs(sheetTabs, 'ficha')}
    ${panel('ficha', 'ficha', `${section('Identidade e crônica', `<div class="dnd-guided-identity-grid">${inputField(ficha, 'Vampiro: A Máscara', 'inline-ficha-name', 'Nome do personagem', 'text', 'Nome usado na ficha')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-player`, 'Jogador')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-chronicle`, 'Crônica')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-concept`, 'Conceito')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-clan`, 'Clã')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-generation`, 'Geração')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-sire`, 'Senhor')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-predator`, 'Tipo de predador')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-ambition`, 'Ambição')}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-desire`, 'Desejo')}${textArea(ficha, 'Vampiro: A Máscara', 'inline-ficha-description', 'Descrição do personagem', 2)}</div>`)}${section('Atributos', `${rollButton}${cardGrid}`, 'Atributos físicos, sociais e mentais da ficha V5.')}${section('Recursos e estado', `<div class="dnd-guided-stat-grid vampire-resource-grid">${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-health`, 'Vitalidade / Saúde', 'number', '', { min: 0 })}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-willpower`, 'Força de vontade', 'number', '', { min: 0 })}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-humanity`, 'Humanidade', 'number', '', { min: 0 })}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-hunger`, 'Fome', 'number', '', { min: 0 })}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-stains`, 'Manchas', 'number', '', { min: 0 })}${inputField(ficha, 'Vampiro: A Máscara', `${prefix}-blood-potency`, 'Potência de sangue', 'number', '', { min: 0 })}</div>`)}`)}
    ${panel('habilidade', 'ficha', `${section('Habilidades', textArea(ficha, 'Vampiro: A Máscara', `${prefix}-abilities`, 'Perícias e habilidades', 5))}${section('Disciplinas', textArea(ficha, 'Vampiro: A Máscara', `${prefix}-disciplines`, 'Disciplinas', 5))}${section('Vantagens e defeitos', textArea(ficha, 'Vampiro: A Máscara', `${prefix}-advantages`, 'Vantagens e defeitos', 5))}`)}
    ${panel('historia', 'ficha', `${section('Âncoras e convicções', textArea(ficha, 'Vampiro: A Máscara', `${prefix}-touchstones`, 'Âncoras e convicções', 5))}${section('História', textArea(ficha, 'Vampiro: A Máscara', `${prefix}-backstory`, 'História e anotações da crônica', 7))}`)}
    ${actionButtons(false, Boolean(ficha?.id))}
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
    });
  });
}
