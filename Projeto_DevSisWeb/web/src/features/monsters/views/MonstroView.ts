import type { MonstroPasta } from '../../../models/MonstroPasta';

/** Renderiza a biblioteca e a ficha de monstro próprias de D&D 5e. */
export class MonstroView {
  public static render(itens: MonstroPasta[], pastaAtualId: string | null, fichaEmEdicao: MonstroPasta | null = null, criandoFicha = false): string {
    const pastaAtual = itens.find(item => item.id === pastaAtualId && item.tipo === 'pasta');
    const pastas = itens.filter(item => item.tipo === 'pasta');
    const caminho = (pasta: MonstroPasta): string => {
      const partes = [pasta.nome];
      let parentId = pasta.parentId;
      while (parentId) {
        const parent = itens.find(item => item.id === parentId && item.tipo === 'pasta');
        if (!parent) break;
        partes.unshift(parent.nome);
        parentId = parent.parentId;
      }
      return partes.join(' / ');
    };
    const field = (id: string, label: string, type = 'text') => `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="${type}" value="${this.escapeHtml(fichaEmEdicao?.dados?.[id]?.toString() || '')}" /></div>`;
    const area = (id: string, label: string) => `<div class="form-group"><label for="${id}">${label}</label><textarea id="${id}" class="form-control" rows="3">${this.escapeHtml(fichaEmEdicao?.dados?.[id]?.toString() || '')}</textarea></div>`;
    const editor = fichaEmEdicao || (criandoFicha ? { id: '', nome: '', tipo: 'ficha' as const, sistema: 'D&D' as const, descricao: '', parentId: pastaAtualId, dataCriacao: '', dados: {} } : null);
    const visiveis = itens.filter(item => item.parentId === pastaAtualId);
    const folderOptions = editor ? [
      `<option value="" ${editor.parentId === null ? 'selected' : ''}>🗂️ Monstros (raiz)</option>`,
      ...(editor.parentId && !pastas.some(pasta => pasta.id === editor.parentId)
        ? [`<option value="${this.escapeHtml(editor.parentId)}" selected>📁 Pasta atual não encontrada (manter vínculo)</option>`]
        : []),
      ...pastas.map(pasta => `<option value="${this.escapeHtml(pasta.id)}" ${pasta.id === editor.parentId ? 'selected' : ''}>📁 ${this.escapeHtml(caminho(pasta))}</option>`)
    ].join('') : '';

    return `
      <div class="systems-workspace monster-library">
        <div class="systems-heading"><div><span class="systems-kicker">Biblioteca do mestre</span><h2>🐉 ${this.escapeHtml(pastaAtual?.nome || 'Monstros')}</h2><p>Organize fichas de monstros de D&D por sistemas, campanhas e encontros.</p></div><div class="systems-actions">${pastaAtual ? '<button id="btn-monstro-up" class="btn btn-secondary">← Voltar</button>' : ''}<button id="btn-new-monstro-folder" class="btn btn-secondary">📁 Nova pasta</button><button id="btn-new-monstro-sheet" class="btn btn-primary">📄 Nova ficha</button></div></div>
        <nav class="systems-breadcrumb"><button class="btn-breadcrumb btn-open-monstro" data-id="">Monstros</button>${pastaAtual ? `<span>/</span><button class="btn-breadcrumb btn-open-monstro" data-id="${pastaAtual.id}">${this.escapeHtml(pastaAtual.nome)}</button>` : ''}</nav>
        ${editor ? `<form id="form-monstro-inline" class="sheet-editor"><div class="sheet-editor-header"><div><span class="systems-kicker">Ficha original do sistema</span><h3>🐉 D&D 5e</h3><p>Ficha de monstro para uso do Mestre.</p></div><div class="sheet-save-actions"><div class="sheet-destination-control"><label for="monstro-destination">Salvar ficha em:</label><select id="monstro-destination" class="custom-select" aria-describedby="monstro-destination-help">${folderOptions}</select><small id="monstro-destination-help" class="field-help">Escolha uma pasta existente ou mantenha a ficha na raiz.</small></div><button type="button" id="btn-cancel-monstro" class="btn btn-secondary">Cancelar</button><button type="submit" class="btn btn-primary">💾 Salvar ficha</button></div></div><div class="sheet-editor-section"><h4>Identidade e classificação</h4><div class="grid-2">${field('monstro-nome', 'Nome da criatura')}${field('monstro-size', 'Tamanho')}${field('monstro-type', 'Tipo de criatura')}${field('monstro-alignment', 'Tendência')}${field('monstro-cr', 'Classe de desafio')}${field('monstro-xp', 'Experiência', 'number')}${area('monstro-description', 'Descrição')}</div></div><div class="sheet-editor-section"><h4>Defesas e movimento</h4><div class="grid-3">${field('monstro-ac', 'Classe de armadura')}${field('monstro-hp', 'Pontos de vida', 'number')}${field('monstro-speed', 'Deslocamento')}${field('monstro-str', 'FOR', 'number')}${field('monstro-dex', 'DES', 'number')}${field('monstro-con', 'CON', 'number')}${field('monstro-int', 'INT', 'number')}${field('monstro-wis', 'SAB', 'number')}${field('monstro-cha', 'CAR', 'number')}</div></div><div class="sheet-editor-section"><h4>Resistências e sentidos</h4>${area('monstro-saving', 'Testes de resistência')}${area('monstro-skills', 'Perícias')}${area('monstro-resistances', 'Resistências, imunidades e vulnerabilidades')}${area('monstro-senses', 'Sentidos e idiomas')}</div><div class="sheet-editor-section"><h4>Ações e características</h4>${area('monstro-traits', 'Características')}${area('monstro-actions', 'Ações')}${area('monstro-reactions', 'Reações e ações lendárias')}</div></form>` : `<div class="systems-drive-grid">${visiveis.length ? visiveis.map(item => `<article class="system-drive-item"><button class="system-drive-open btn-open-monstro" data-id="${item.id}" ${item.tipo === 'ficha' ? 'disabled' : ''}><span class="system-drive-icon">${item.tipo === 'pasta' ? '📁' : '📄'}</span><span class="system-drive-name">${this.escapeHtml(item.nome)}</span><span class="system-drive-description">${this.escapeHtml(item.descricao || 'Sem descrição')}</span></button><div class="system-drive-actions"><button class="btn-icon btn-edit-monstro" data-id="${item.id}">✏️</button><button class="btn-icon btn-delete-monstro" data-id="${item.id}">🗑️</button></div></article>`).join('') : '<div class="systems-empty"><span>📂</span><strong>Esta pasta está vazia</strong><p>Crie uma pasta ou ficha para começar.</p></div>'}</div>`}
      </div>
      ${!editor ? `<div id="modal-monstro-folder" class="modal-backdrop hidden"><div class="modal-content glass-card"><div class="modal-header"><h3 id="modal-monstro-title">Nova pasta</h3><button id="btn-close-monstro-modal" class="btn-icon">✕</button></div><form id="form-monstro-folder"><div class="form-group"><label for="monstro-folder-name">Nome da pasta:</label><input id="monstro-folder-name" class="form-control" required /></div><div class="form-group"><label for="monstro-folder-description">Descrição:</label><textarea id="monstro-folder-description" class="form-control" rows="3"></textarea></div><div class="form-group"><label for="monstro-folder-parent">Salvar pasta em:</label><select id="monstro-folder-parent" class="custom-select">${['<option value="">🗂️ Raiz</option>', ...pastas.map(p => `<option value="${p.id}" ${p.id === pastaAtualId ? 'selected' : ''}>📁 ${this.escapeHtml(caminho(p))}</option>`)].join('')}</select></div><button type="submit" class="btn btn-primary" style="width:100%">Criar pasta</button></form></div></div>` : ''}
    `;
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
