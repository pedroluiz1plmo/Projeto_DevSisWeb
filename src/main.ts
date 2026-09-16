import './index.css';
import { Personagem } from './models/Personagem';
import { Jogador } from './models/Jogador';
import { Mestre, type CombatenteIniciativa } from './models/Mestre';
import { Campanha } from './models/Campanha';
import { NPC } from './models/NPC';
import { Item } from './models/Item';
import { MagiaHabilidade } from './models/MagiaHabilidade';
import { Nota } from './models/Nota';
import { Missao } from './models/Missao';
import type { SistemaPasta } from './models/SistemaPasta';
import type { MonstroPasta } from './models/MonstroPasta';
import { StorageService } from './services/StorageService';
import { DiceService, type ResultadoRolagem } from './services/DiceService';

import { DashboardView } from './views/DashboardView';
import { JogadorView } from './views/JogadorView';
import { MestreView } from './views/MestreView';
import { RoleSelectionModal, type UserRole } from './views/RoleSelectionModal';

class AppController {
  private personagens: Personagem[] = [];
  private campanhas: Campanha[] = [];
  private npcs: NPC[] = [];
  private historicoDados: ResultadoRolagem[] = [];
  private notas: Nota[] = [];
  private missoes: Missao[] = [];
  private campanhaEmEdicaoId: string | null = null;
  private sistemaItens: SistemaPasta[] = [];
  private monstroItens: MonstroPasta[] = [];

  private jogador: Jogador;
  private mestre: Mestre;

  private personagemAtivoId: string | null = null;
  private pastaSistemaAtualId: string | null = null;
  private fichaSistemaEmEdicaoId: string | null = null;
  private criandoFichaSistema = false;
  private criandoFichaGuiada = false;
  private fichaRolagemSelecionadaId: string | null = null;
  private fichaInventarioSelecionadaId: string | null = null;
  private sistemaFichaEmCriacao: string | null = null;
  private pastaMonstroAtualId: string | null = null;
  private monstroEmEdicaoId: string | null = null;
  private criandoMonstro = false;
  private currentTab: string = 'dashboard';
  private userRole: UserRole | null = null;
  private wizardStep: number = 1;

  constructor() {
    this.userRole = StorageService.carregarPerfil();
    StorageService.definirPerfilAtivo(this.userRole || 'jogador');
    // Carregar dados salvos ou dados de demonstração
    this.personagens = StorageService.carregarPersonagens();
    this.npcs = StorageService.carregarNPCs();
    this.campanhas = StorageService.carregarCampanhas(this.personagens, this.npcs);
    this.historicoDados = StorageService.carregarHistoricoDados();
    this.notas = StorageService.carregarNotas();
    this.missoes = StorageService.carregarMissoes();
    this.sistemaItens = StorageService.carregarSistemaPastas();
    this.monstroItens = StorageService.carregarMonstroPastas();

    // Inicializar atores conforme UML
    this.jogador = new Jogador('user-jog-1', 'Jogador Aventureiro', 'jogador@unemat.br', this.personagens);
    this.mestre = new Mestre('user-mestre-1', 'Mestre dos Magos', 'mestre@unemat.br', this.campanhas, this.npcs);

    if (this.personagens.length > 0) {
      this.personagemAtivoId = this.personagens[0].idPersonagem;
    }

    this.userRole = StorageService.carregarPerfil();
    if (this.userRole) {
      this.currentTab = this.userRole === 'jogador' ? 'sistemas' : 'campanhas';
    }
    this.initEventListeners();
    this.updateCharacterSelector();
    this.applyRoleView();
    if (!this.userRole) this.openRoleSelection();
  }

  private get personagemAtivo(): Personagem | null {
    if (!this.personagemAtivoId) return this.personagens[0] || null;
    return this.personagens.find(p => p.idPersonagem === this.personagemAtivoId) || this.personagens[0] || null;
  }

  private initEventListeners(): void {
    // Navegação lateral por abas
    const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    document.getElementById('btn-switch-role')?.addEventListener('click', () => this.openRoleSelection());

    // Seletor de Personagem Ativo no Topbar
    const charSelect = document.getElementById('active-character-select') as HTMLSelectElement;
    if (charSelect) {
      charSelect.addEventListener('change', (e) => {
        const selected = (e.target as HTMLSelectElement).value;
        if (selected.startsWith('ficha:')) {
          this.fichaRolagemSelecionadaId = selected.slice('ficha:'.length);
        } else {
          this.personagemAtivoId = selected;
          this.fichaRolagemSelecionadaId = null;
        }
        this.renderCurrentView();
        const ficha = this.sistemaItens.find(item => item.id === this.fichaRolagemSelecionadaId);
        this.showToast(ficha ? `Ficha ativa: ${ficha.nome} (${ficha.sistema})` : `Personagem ativo: ${this.personagemAtivo?.nomePersonagem}`);
      });
    }

    // Botão de Rolagem Rápida d20 no Topbar
    const btnQuickRoll = document.getElementById('btn-quick-roll-d20');
    if (btnQuickRoll) {
      btnQuickRoll.addEventListener('click', () => {
        this.executarRolagemD20('Rolagem Rápida', 0);
      });
    }

    // Fechar modal de dados
    const btnCloseDiceModal = document.getElementById('btn-close-dice-modal');
    if (btnCloseDiceModal) {
      btnCloseDiceModal.addEventListener('click', () => {
        document.getElementById('dice-modal')?.classList.add('hidden');
      });
    }

    // Inicializar eventos dos pop-ups de Nota e Missão
    this.initPopupEvents();
  }

  private openRoleSelection(): void {
    document.getElementById('role-selection-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', RoleSelectionModal.render());
    document.querySelectorAll<HTMLButtonElement>('#role-selection-modal [data-role]').forEach(button => {
      button.addEventListener('click', () => {
        const role = button.dataset.role as UserRole;
        if (role === 'jogador' || role === 'mestre') this.selectRole(role);
      });
    });
  }

  private selectRole(role: UserRole): void {
    this.userRole = role;
    StorageService.salvarPerfil(role);
    StorageService.definirPerfilAtivo(role);
    setTimeout(() => window.location.reload(), 0);
    document.getElementById('role-selection-modal')?.remove();
    this.currentTab = role === 'jogador' ? 'sistemas' : 'campanhas';
    this.applyRoleView();
    this.showToast(`Visão de ${role === 'jogador' ? 'Jogador' : 'Mestre'} ativada.`);
  }

  private applyRoleView(): void {
    const role = this.userRole;
    document.querySelectorAll<HTMLElement>('[data-role-view]').forEach(element => {
      const allowedRoles = element.dataset.roleView?.split(' ') || [];
      element.classList.toggle('hidden', Boolean(role && !allowedRoles.includes(role)));
    });
    const switchButton = document.getElementById('btn-switch-role');
    if (switchButton && role) {
      switchButton.textContent = role === 'jogador' ? '🎲 Jogador' : '👑 Mestre';
      switchButton.setAttribute('aria-label', 'Alterar visão do sistema');
    }
    this.switchTab(this.currentTab);
  }

  /* ================= POP-UPS NOTA E MISSÃO ================= */
  private initPopupEvents(): void {
    const btnNota = document.getElementById('btn-popup-nota');
    const btnMissao = document.getElementById('btn-popup-missao');
    const modalNota = document.getElementById('modal-nota');
    const modalMissao = document.getElementById('modal-missao');
    const btnCloseNota = document.getElementById('btn-close-nota-modal');
    const btnCloseMissao = document.getElementById('btn-close-missao-modal');

    // Inicializar contadores nos badges
    this.renderNotas();
    this.renderMissoes();

    // Abertura dos pop-ups
    btnNota?.addEventListener('click', () => {
      this.renderNotas();
      modalNota?.classList.remove('hidden');
    });

    btnMissao?.addEventListener('click', () => {
      this.renderMissoes();
      modalMissao?.classList.remove('hidden');
    });

    // Fechamento via botão ✕
    btnCloseNota?.addEventListener('click', () => {
      modalNota?.classList.add('hidden');
    });

    btnCloseMissao?.addEventListener('click', () => {
      modalMissao?.classList.add('hidden');
    });

    // Fechamento ao clicar fora do card (no backdrop)
    modalNota?.addEventListener('click', (e) => {
      if (e.target === modalNota) modalNota.classList.add('hidden');
    });

    modalMissao?.addEventListener('click', (e) => {
      if (e.target === modalMissao) modalMissao.classList.add('hidden');
    });

    // Fechamento ao pressionar a tecla Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalNota?.classList.add('hidden');
        modalMissao?.classList.add('hidden');
      }
    });

    // Submissão do formulário de Nota
    const formNota = document.getElementById('form-nova-nota') as HTMLFormElement | null;
    formNota?.addEventListener('submit', (e) => {
      e.preventDefault();
      const tituloInput = document.getElementById('input-nota-titulo') as HTMLInputElement | null;
      const conteudoInput = document.getElementById('input-nota-conteudo') as HTMLTextAreaElement | null;
      if (!tituloInput || !conteudoInput) return;

      const titulo = tituloInput.value.trim();
      const conteudo = conteudoInput.value.trim();
      if (!titulo || !conteudo) return;

      const novaNota = new Nota(titulo, conteudo);
      this.notas.unshift(novaNota);
      StorageService.salvarNotas(this.notas);

      tituloInput.value = '';
      conteudoInput.value = '';
      this.renderNotas();
      this.showToast(`Nota "${novaNota.titulo}" anotada com sucesso!`);
    });

    // Submissão do formulário de Missão
    const formMissao = document.getElementById('form-nova-missao') as HTMLFormElement | null;
    formMissao?.addEventListener('submit', (e) => {
      e.preventDefault();
      const tituloInput = document.getElementById('input-missao-titulo') as HTMLInputElement | null;
      const descInput = document.getElementById('input-missao-descricao') as HTMLTextAreaElement | null;
      const recInput = document.getElementById('input-missao-recompensa') as HTMLInputElement | null;
      if (!tituloInput || !descInput) return;

      const titulo = tituloInput.value.trim();
      const descricao = descInput.value.trim();
      const recompensa = recInput?.value.trim() || '';
      if (!titulo || !descricao) return;

      const novaMissao = new Missao(titulo, descricao, recompensa);
      this.missoes.unshift(novaMissao);
      StorageService.salvarMissoes(this.missoes);

      tituloInput.value = '';
      descInput.value = '';
      if (recInput) recInput.value = '';
      this.renderMissoes();
      this.showToast(`Missão "${novaMissao.titulo}" adicionada ao quadro!`);
    });
  }

  private renderNotas(): void {
    const lista = document.getElementById('lista-notas');
    const badge = document.getElementById('badge-total-notas');
    if (badge) {
      badge.textContent = `${this.notas.length} ${this.notas.length === 1 ? 'nota' : 'notas'}`;
    }

    if (!lista) return;

    if (this.notas.length === 0) {
      lista.innerHTML = `<div class="popup-empty-state">Nenhuma anotação registrada ainda. Crie uma nota acima!</div>`;
      return;
    }

    lista.innerHTML = this.notas.map(n => `
      <div class="popup-note-item" data-id="${n.idNota}">
        <div class="popup-note-header">
          <span class="popup-note-title">${this.escapeHtml(n.titulo)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="popup-note-date">${n.dataCriacao}</span>
            <button class="btn-icon btn-delete-nota" data-id="${n.idNota}" title="Excluir Nota" style="color: var(--danger); font-size: 0.95rem; padding: 2px 4px;">🗑️</button>
          </div>
        </div>
        <div class="popup-note-body">${this.escapeHtml(n.conteudo)}</div>
      </div>
    `).join('');

    lista.querySelectorAll<HTMLButtonElement>('.btn-delete-nota').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          const removida = this.notas.find(n => n.idNota === id);
          this.notas = this.notas.filter(n => n.idNota !== id);
          StorageService.salvarNotas(this.notas);
          this.renderNotas();
          this.showToast(`Nota "${removida?.titulo || ''}" removida.`);
        }
      });
    });
  }

  private renderMissoes(): void {
    const lista = document.getElementById('lista-missoes');
    const badge = document.getElementById('badge-total-missoes');
    const ativas = this.missoes.filter(m => m.status === 'em_progresso').length;

    if (badge) {
      badge.textContent = `${ativas} ${ativas === 1 ? 'ativa' : 'ativas'}`;
    }

    if (!lista) return;

    if (this.missoes.length === 0) {
      lista.innerHTML = `<div class="popup-empty-state">Nenhuma missão cadastrada. Crie uma missão acima!</div>`;
      return;
    }

    lista.innerHTML = this.missoes.map(m => {
      const isConcluida = m.status === 'concluida';
      return `
        <div class="popup-mission-item ${m.status}" data-id="${m.idMissao}">
          <button class="popup-mission-toggle btn-toggle-missao" data-id="${m.idMissao}" title="${isConcluida ? 'Reabrir Missão' : 'Concluir Missão'}">
            ${isConcluida ? '✅' : '⏳'}
          </button>
          <div class="popup-mission-content">
            <div class="popup-mission-title">${this.escapeHtml(m.titulo)}</div>
            <div class="popup-mission-desc">${this.escapeHtml(m.descricao)}</div>
            <div class="popup-mission-footer">
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span class="mission-status-tag ${m.status}">
                  ${isConcluida ? 'Concluída' : 'Em Progresso'}
                </span>
                ${m.recompensa ? `<span class="mission-reward-tag">🎁 ${this.escapeHtml(m.recompensa)}</span>` : ''}
              </div>
              <button class="btn-icon btn-delete-missao" data-id="${m.idMissao}" title="Excluir Missão" style="color: var(--danger); font-size: 0.95rem; padding: 2px 4px;">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    lista.querySelectorAll<HTMLButtonElement>('.btn-toggle-missao').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const missao = this.missoes.find(m => m.idMissao === id);
        if (missao) {
          missao.toggleStatus();
          StorageService.salvarMissoes(this.missoes);
          this.renderMissoes();
          this.showToast(missao.status === 'concluida' ? `Missão "${missao.titulo}" concluída!` : `Missão "${missao.titulo}" reaberta.`);
        }
      });
    });

    lista.querySelectorAll<HTMLButtonElement>('.btn-delete-missao').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          const removida = this.missoes.find(m => m.idMissao === id);
          this.missoes = this.missoes.filter(m => m.idMissao !== id);
          StorageService.salvarMissoes(this.missoes);
          this.renderMissoes();
          this.showToast(`Missão "${removida?.titulo || ''}" excluída.`);
        }
      });
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private switchTab(tabName: string): void {
    this.currentTab = tabName;

    // Atualizar classes ativas na navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Atualizar títulos no topbar
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    const titulos: Record<string, { title: string; sub: string }> = {
      dashboard: { title: 'RPG Hub', sub: 'Seu espaço para criar personagens e viver aventuras' },
      personagens: { title: 'Ficha do Personagem', sub: 'Consulte e atualize os atributos do seu herói' },
      wizard: { title: 'Criar Personagem', sub: 'Monte seu personagem passo a passo' },
      inventario: { title: 'Inventário', sub: 'Organize os itens da sua aventura' },
      magias: { title: 'Magias e Habilidades', sub: 'Consulte os poderes do seu personagem' },
      dados: { title: 'Rolagem de Dados', sub: 'Faça testes e acompanhe os resultados' },
      'inventario-sistemas': { title: 'Inventário', sub: 'Organize os itens da ficha selecionada' },
      sistemas: { title: 'Sistemas', sub: 'Organize fichas por sistema, campanha e personagem' },
      campanhas: { title: 'Campanhas do Mestre', sub: 'Organize grupos e histórias' },
      npcs: { title: 'Monstros', sub: 'Organize fichas de monstros por sistema e campanha' },
      iniciativa: { title: 'Iniciativa e Combate', sub: 'Organize a ordem dos turnos' }
    };

    if (titleEl && subtitleEl && titulos[tabName]) {
      titleEl.innerText = titulos[tabName].title;
      subtitleEl.innerText = titulos[tabName].sub;
    }

    if (tabName === 'sistemas') {
      this.pastaSistemaAtualId = null;
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = false;
      this.criandoFichaGuiada = false;
      this.sistemaFichaEmCriacao = null;
    }

    this.renderCurrentView();
  }

  private updateCharacterSelector(): void {
    const select = document.getElementById('active-character-select') as HTMLSelectElement;
    if (!select) return;

    const fichas = this.sistemaItens.filter(item => item.tipo === 'ficha');
    select.innerHTML = this.personagens.map(p => 
      `<option value="${p.idPersonagem}" ${p.idPersonagem === this.personagemAtivoId ? 'selected' : ''}>${p.nomePersonagem} (${p.classe})</option>`
    ).join('') + fichas.map(ficha =>
      `<option value="ficha:${ficha.id}" ${ficha.id === this.fichaRolagemSelecionadaId ? 'selected' : ''}>${ficha.nome} (${ficha.sistema})</option>`
    ).join('');

    if (this.personagens.length === 0 && fichas.length === 0) {
      select.innerHTML = `<option value="">Nenhum Personagem</option>`;
    }
  }

  private renderCurrentView(): void {
    const container = document.getElementById('content-area');
    if (!container) return;

    switch (this.currentTab) {
      case 'dashboard':
        container.innerHTML = DashboardView.render(this.personagens, this.campanhas, this.npcs);
        break;

      case 'personagens':
        container.innerHTML = JogadorView.renderFichas(this.personagens, this.personagemAtivo);
        this.bindFichaEvents();
        break;

      case 'wizard':
        container.innerHTML = JogadorView.renderWizard();
        this.wizardStep = 1;
        this.bindWizardEvents();
        break;

      case 'inventario':
        container.innerHTML = JogadorView.renderInventario(this.personagemAtivo);
        this.bindInventarioEvents();
        break;

      case 'inventario-sistemas':
        container.innerHTML = JogadorView.renderInventarioSistemas(this.sistemaItens.filter(item => item.tipo === 'ficha'), this.fichaInventarioSelecionadaId);
        this.bindInventarioSistemasEvents();
        break;

      case 'magias':
        container.innerHTML = JogadorView.renderMagias(this.personagemAtivo);
        this.bindMagiasEvents();
        break;

      case 'dados':
        container.innerHTML = JogadorView.renderRoladorDados(this.personagemAtivo, this.sistemaItens.filter(item => item.tipo === 'ficha'), this.fichaRolagemSelecionadaId, this.historicoDados);
        this.bindDadosEvents();
        break;

      case 'sistemas':
        if (this.criandoFichaGuiada) {
          container.innerHTML = JogadorView.renderFichaGuiada(this.sistemaItens, this.pastaSistemaAtualId);
        } else if (this.criandoFichaSistema && !this.sistemaFichaEmCriacao) {
          container.innerHTML = JogadorView.renderSeletorFicha();
        } else {
          container.innerHTML = JogadorView.renderSistemas(
            this.sistemaItens,
            this.pastaSistemaAtualId,
            this.fichaSistemaEmEdicaoId
              ? this.sistemaItens.find(item => item.id === this.fichaSistemaEmEdicaoId) || null
              : this.criandoFichaSistema
                ? {
                  id: '', nome: '', tipo: 'ficha', sistema: this.sistemaFichaEmCriacao || 'Call of Cthulhu', descricao: '',
                  parentId: this.pastaSistemaAtualId, dataCriacao: '', dados: {}
                }
                : null
          );
        }
        this.bindSistemasEvents();
        break;

      case 'campanhas':
        container.innerHTML = MestreView.renderCampanhas(
          this.campanhas,
          this.personagens,
          this.npcs,
          this.sistemaItens.filter(item => item.tipo === 'ficha'),
          this.monstroItens
        );
        this.bindCampanhasEvents();
        break;

      case 'npcs':
        container.innerHTML = MestreView.renderMonstros(this.monstroItens, this.pastaMonstroAtualId, this.monstroEmEdicaoId ? this.monstroItens.find(item => item.id === this.monstroEmEdicaoId) || null : null, this.criandoMonstro);
        this.bindMonstrosEvents();
        break;

      case 'iniciativa':
        container.innerHTML = MestreView.renderIniciativa(
          this.mestre,
          this.personagens,
          this.npcs,
          this.sistemaItens.filter(item => item.tipo === 'ficha'),
          this.monstroItens
        );
        this.bindIniciativaEvents();
        break;

      default:
        container.innerHTML = DashboardView.render(this.personagens, this.campanhas, this.npcs);
    }
  }

  /* ================= INVENTARIO DE FICHAS EVENTS ================= */
  private bindInventarioSistemasEvents(): void {
    const fichas = this.sistemaItens.filter(item => item.tipo === 'ficha');
    const select = document.getElementById('inventory-sheet-select') as HTMLSelectElement | null;
    if (select) {
      if (!this.fichaInventarioSelecionadaId || !fichas.some(ficha => ficha.id === this.fichaInventarioSelecionadaId)) {
        this.fichaInventarioSelecionadaId = select.value || null;
      }
      select.addEventListener('change', event => {
        this.fichaInventarioSelecionadaId = (event.target as HTMLSelectElement).value || null;
        this.renderCurrentView();
      });
    }

    const ficha = fichas.find(item => item.id === this.fichaInventarioSelecionadaId) || fichas[0];
    if (!ficha) return;
    ficha.inventario ||= [];

    document.querySelectorAll<HTMLButtonElement>('.btn-remove-system-item').forEach(button => {
      button.addEventListener('click', () => {
        ficha.inventario = ficha.inventario?.filter(item => item.id !== button.dataset.id) || [];
        StorageService.salvarSistemaPastas(this.sistemaItens);
        this.renderCurrentView();
      });
    });

    document.getElementById('form-add-system-item')?.addEventListener('submit', event => {
      event.preventDefault();
      const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() || '';
      const nome = value('system-item-name');
      if (!nome) return;
      ficha.inventario ||= [];
      ficha.inventario.push({
        id: crypto.randomUUID(),
        nome,
        quantidade: Math.max(1, Number(value('system-item-quantity')) || 1),
        peso: Math.max(0, Number(value('system-item-weight')) || 0),
        descricao: value('system-item-description')
      });
      StorageService.salvarSistemaPastas(this.sistemaItens);
      this.showToast(`Item "${nome}" adicionado ao inventário.`);
      this.renderCurrentView();
    });
  }

  /* ================= SISTEMAS EVENTS ================= */
  private bindSistemasEvents(): void {
    const guidedForm = document.getElementById('form-ficha-guided') as HTMLFormElement | null;
    if (guidedForm) {
      const guidedSystem = document.getElementById('guided-system') as HTMLSelectElement | null;
      const updateGuidedTemplate = () => {
        const template = guidedSystem?.value === 'D&D' ? 'dnd' : guidedSystem?.value === 'Vampiro: A Máscara' ? 'vampire' : 'coc';
        document.querySelectorAll('.guided-template').forEach(element => element.classList.add('hidden'));
        document.getElementById(`guided-template-${template}`)?.classList.remove('hidden');
      };
      guidedSystem?.addEventListener('change', updateGuidedTemplate);
      updateGuidedTemplate();

      const setGuidedValue = (id: string, value: number): void => {
        const field = document.getElementById(id) as HTMLInputElement | null;
        if (field) field.value = String(value);
      };
      const rollGuidedDnd = () => {
        const values = Array.from({ length: 6 }, () => {
          const rolls = Array.from({ length: 4 }, () => DiceService.sortearNumero(1, 6)).sort((a, b) => a - b);
          return rolls.slice(1).reduce((sum, value) => sum + value, 0);
        });
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((attribute, index) => setGuidedValue(`guided-dnd-${attribute}`, values[index]));
      };
      const rollGuidedCoc = () => {
        const roll = (count: number, bonus = 0) => {
          let total = bonus;
          for (let index = 0; index < count; index++) total += DiceService.sortearNumero(1, 6);
          return total * 5;
        };
        ['str', 'con', 'dex', 'app', 'pow', 'edu'].forEach(attribute => setGuidedValue(`guided-coc-${attribute}`, roll(3)));
        setGuidedValue('guided-coc-siz', roll(2, 6));
        setGuidedValue('guided-coc-int', roll(2, 6));
        setGuidedValue('guided-coc-luck', roll(3));
      };
      const distributeGuidedVampire = () => {
        const groups = [
          ['strength', 'dexterity', 'stamina'],
          ['charisma', 'manipulation', 'composure'],
          ['intelligence', 'wits', 'resolve']
        ];
        [7, 5, 3].forEach((points, groupIndex) => {
          const group = groups[groupIndex];
          group.forEach(attribute => setGuidedValue(`guided-vampire-${attribute}`, 1));
          for (let point = 0; point < points; point++) {
            const attribute = group[point % group.length];
            const field = document.getElementById(`guided-vampire-${attribute}`) as HTMLInputElement | null;
            if (field) field.value = String(Number(field.value || 1) + 1);
          }
        });
      };
      document.getElementById('btn-guided-roll-dnd')?.addEventListener('click', rollGuidedDnd);
      document.getElementById('btn-guided-roll-coc')?.addEventListener('click', rollGuidedCoc);
      document.getElementById('btn-guided-roll-vampire')?.addEventListener('click', distributeGuidedVampire);

      document.getElementById('btn-cancel-ficha-guided')?.addEventListener('click', () => {
        this.criandoFichaGuiada = false;
        this.criandoFichaSistema = false;
        this.renderCurrentView();
      });

      guidedForm.addEventListener('submit', event => {
        event.preventDefault();
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';
        const destination = value('guided-destination');
        const sistema = value('guided-system');
        const prefixo = sistema === 'D&D' ? 'guided-dnd' : sistema === 'Vampiro: A Máscara' ? 'guided-vampire' : 'guided-coc';
        const nome = value(`${prefixo}-name`);
        if (!nome) {
          this.showToast('Informe o nome do personagem para continuar.');
          return;
        }
        if (!destination) {
          this.showToast('Escolha uma pasta para salvar a ficha.');
          return;
        }

        const dados: Record<string, string | number> = {
          guidedConcept: value(`${prefixo}-concept`),
          guidedGoal: value(`${prefixo}-goal`),
          guidedBackground: value(`${prefixo}-background`) || value(`${prefixo}-story`),
          guidedOccupation: value(`${prefixo}-occupation`),
          guidedAge: value(`${prefixo}-age`),
          guidedClass: value(`${prefixo}-class`),
          guidedRace: value(`${prefixo}-race`),
          guidedLevel: value(`${prefixo}-level`),
          guidedClan: value(`${prefixo}-clan`),
          guidedGeneration: value(`${prefixo}-generation`),
          guidedPredator: value(`${prefixo}-predator`)
        };
        guidedForm.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(input => {
          if (input.id === 'guided-system' || input.id === 'guided-destination' || input.id === `${prefixo}-name`) return;
          if (input.value.trim()) dados[input.id] = input.value.trim();
        });
        this.sistemaItens.push({
          id: crypto.randomUUID(),
          nome,
          tipo: 'ficha',
          sistema,
          descricao: dados.guidedConcept?.toString() || '',
          parentId: destination,
          dataCriacao: new Date().toLocaleDateString('pt-BR'),
          dados
        });
        StorageService.salvarSistemaPastas(this.sistemaItens);
        this.updateCharacterSelector();
        this.criandoFichaGuiada = false;
        this.criandoFichaSistema = false;
        this.showToast('Ficha criada. Você pode completar os detalhes no editor completo.');
        this.renderCurrentView();
      });
      return;
    }

    const inlineForm = document.getElementById('form-ficha-inline') as HTMLFormElement | null;
    if (inlineForm) {
      const cocTabs = inlineForm.querySelectorAll<HTMLButtonElement>('.coc-sheet-tab');
      cocTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.cocTab;
          if (!target) return;
          cocTabs.forEach(item => item.classList.toggle('active', item === tab));
          inlineForm.querySelectorAll<HTMLElement>('.coc-sheet-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.cocPanel === target);
          });
        });
      });

      const setFieldValue = (id: string, value: number): void => {
        const field = document.getElementById(id) as HTMLInputElement | null;
        if (field) field.value = String(value);
      };
      const rollDice = (sides: number, count: number, bonus = 0): number => {
        let total = bonus;
        for (let index = 0; index < count; index++) total += DiceService.sortearNumero(1, sides);
        return total;
      };
      const rollDndAttributes = () => {
        const values = Array.from({ length: 6 }, () => {
          const rolls = Array.from({ length: 4 }, () => DiceService.sortearNumero(1, 6)).sort((a, b) => a - b);
          return rolls.slice(1).reduce((sum, value) => sum + value, 0);
        });
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((attribute, index) => setFieldValue(`inline-dnd-${attribute}`, values[index]));
        this.showToast(`D&D: atributos rolados com 4d6, descartando o menor: ${values.join(', ')}.`);
      };
      const rollCocAttributes = () => {
        const standard = ['str', 'con', 'dex', 'app', 'pow', 'edu'].map(() => rollDice(6, 3) * 5);
        const size = rollDice(6, 2, 6) * 5;
        const intelligence = rollDice(6, 2, 6) * 5;
        ['str', 'con', 'dex', 'app', 'pow', 'edu'].forEach((attribute, index) => setFieldValue(`inline-coc-${attribute}`, standard[index]));
        setFieldValue('inline-coc-siz', size);
        setFieldValue('inline-coc-int', intelligence);
        setFieldValue('inline-coc-luck', rollDice(6, 3) * 5);
        this.showToast('Call of Cthulhu: atributos rolados pelas fórmulas oficiais da ficha.');
      };
      const distributeVampireAttributes = () => {
        const groups = [
          ['strength', 'dexterity', 'stamina'],
          ['charisma', 'manipulation', 'composure'],
          ['intelligence', 'wits', 'resolve']
        ];
        const points = [7, 5, 3];
        groups.forEach((group, groupIndex) => {
          const shuffled = [...group].sort(() => DiceService.sortearNumero(0, 1) === 0 ? -1 : 1);
          shuffled.forEach(attribute => setFieldValue(`inline-vampire-${attribute}`, 1));
          for (let point = 0; point < points[groupIndex]; point++) {
            const target = shuffled[point % shuffled.length];
            const field = document.getElementById(`inline-vampire-${target}`) as HTMLInputElement | null;
            if (field) field.value = String(Number(field.value || 1) + 1);
          }
        });
        this.showToast('Vampiro: atributos distribuídos pela regra V5 (7/5/3).');
      };
      document.getElementById('btn-roll-dnd-attributes')?.addEventListener('click', rollDndAttributes);
      document.getElementById('btn-roll-coc-attributes')?.addEventListener('click', rollCocAttributes);
      document.getElementById('btn-roll-vampire-attributes')?.addEventListener('click', distributeVampireAttributes);

      document.getElementById('btn-cancel-ficha-inline')?.addEventListener('click', () => {
        this.fichaSistemaEmEdicaoId = null;
        this.criandoFichaSistema = false;
        this.criandoFichaGuiada = false;
        this.sistemaFichaEmCriacao = null;
        this.renderCurrentView();
      });

      inlineForm.addEventListener('submit', event => {
        event.preventDefault();
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';
        const destinationId = value('inline-ficha-destination');
        const destination = this.sistemaItens.find(item => item.id === destinationId && item.tipo === 'pasta');
        if (!destination) {
          this.showToast('Escolha uma pasta válida para salvar a ficha.');
          return;
        }
        const fichaAtual = this.fichaSistemaEmEdicaoId
          ? this.sistemaItens.find(item => item.id === this.fichaSistemaEmEdicaoId)
          : undefined;
        const dados: Record<string, string | number> = {};
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('#form-ficha-inline input, #form-ficha-inline textarea').forEach(input => {
          if (input.id === 'inline-ficha-name' || input.id === 'inline-ficha-description') return;
          const key = input.id.replace(/^inline-/, '');
          if (input.value.trim()) dados[key] = input.value.trim();
        });

        if (fichaAtual) {
          fichaAtual.nome = value('inline-ficha-name') || fichaAtual.nome;
          fichaAtual.descricao = value('inline-ficha-description');
          fichaAtual.parentId = destination.id;
          fichaAtual.dados = dados;
        } else {
          this.sistemaItens.push({
            id: crypto.randomUUID(),
            nome: value('inline-ficha-name') || 'Novo investigador',
            tipo: 'ficha',
            sistema: this.sistemaFichaEmCriacao || 'Call of Cthulhu',
            descricao: value('inline-ficha-description'),
            parentId: destination.id,
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            dados
          });
        }

        StorageService.salvarSistemaPastas(this.sistemaItens);
        this.updateCharacterSelector();
        this.fichaSistemaEmEdicaoId = null;
        this.criandoFichaSistema = false;
        this.sistemaFichaEmCriacao = null;
        this.showToast('Ficha salva com sucesso.');
        this.renderCurrentView();
      });
      return;
    }

    const modal = document.getElementById('modal-sistema-item');
    const form = document.getElementById('form-sistema-item') as HTMLFormElement | null;
    const itemIdInput = document.getElementById('sistema-item-id') as HTMLInputElement | null;
    const itemTypeInput = document.getElementById('sistema-item-type') as HTMLInputElement | null;
    const nameInput = document.getElementById('sistema-item-name') as HTMLInputElement | null;
    const descriptionInput = document.getElementById('sistema-item-description') as HTMLTextAreaElement | null;
    const folderDestinationGroup = document.getElementById('sistema-folder-destination-group');
    const folderDestinationSelect = document.getElementById('sistema-folder-destination') as HTMLSelectElement | null;
    const saveFolderButton = document.getElementById('btn-salvar-pasta');
    const modalTitle = document.getElementById('modal-sistema-title');

    const getFolderPath = (folder: SistemaPasta): string => {
      const path: string[] = [folder.nome];
      let parentId = folder.parentId;
      while (parentId) {
        const parent = this.sistemaItens.find(item => item.id === parentId && item.tipo === 'pasta');
        if (!parent) break;
        path.unshift(parent.nome);
        parentId = parent.parentId;
      }
      return path.join(' / ');
    };

    const isDescendant = (folderId: string, possibleAncestorId: string): boolean => {
      let parentId = this.sistemaItens.find(item => item.id === folderId)?.parentId || null;
      while (parentId) {
        if (parentId === possibleAncestorId) return true;
        parentId = this.sistemaItens.find(item => item.id === parentId)?.parentId || null;
      }
      return false;
    };

    const updateFolderDestinations = (selectedId: string | null, editingId = '') => {
      if (!folderDestinationSelect) return;
      const folders = this.sistemaItens.filter(folder =>
        folder.tipo === 'pasta' && folder.id !== editingId && !isDescendant(folder.id, editingId)
      );
      folderDestinationSelect.innerHTML = [
        '<option value="">🗂️ Sistemas (pasta raiz)</option>',
        ...folders.map(folder => `<option value="${folder.id}" ${folder.id === selectedId ? 'selected' : ''}>📁 ${this.escapeHtml(getFolderPath(folder))}</option>`)
      ].join('');
      if (selectedId && !folders.some(folder => folder.id === selectedId)) {
        folderDestinationSelect.value = '';
      }
    };

    const closeModal = () => modal?.classList.add('hidden');
    const openModal = (tipo: 'pasta', item?: SistemaPasta) => {
      if (itemIdInput) itemIdInput.value = item?.id || '';
      if (itemTypeInput) itemTypeInput.value = item?.tipo || tipo;
      if (nameInput) nameInput.value = item?.nome || '';
      if (descriptionInput) descriptionInput.value = item?.descricao || '';
      if (modalTitle) modalTitle.textContent = item ? `Editar ${item.tipo}` : `Nova ${tipo}`;
      if (saveFolderButton) saveFolderButton.textContent = item ? 'Salvar alterações' : 'Criar pasta';
      folderDestinationGroup?.classList.toggle('hidden', tipo !== 'pasta');
      if (tipo === 'pasta') {
        updateFolderDestinations(item?.parentId ?? this.pastaSistemaAtualId, item?.id || '');
      }
      modal?.classList.remove('hidden');
      nameInput?.focus();
    };

    document.getElementById('btn-close-sistema-modal')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-open-sistema-item').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id || null;
        this.pastaSistemaAtualId = id;
        this.fichaSistemaEmEdicaoId = null;
        this.criandoFichaSistema = false;
        this.criandoFichaGuiada = false;
        this.sistemaFichaEmCriacao = null;
        this.renderCurrentView();
      });
    });

    document.getElementById('btn-sistema-up')?.addEventListener('click', () => {
      const pastaAtual = this.sistemaItens.find(item => item.id === this.pastaSistemaAtualId);
      this.pastaSistemaAtualId = pastaAtual?.parentId || null;
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = false;
      this.criandoFichaGuiada = false;
      this.sistemaFichaEmCriacao = null;
      this.renderCurrentView();
    });

    document.getElementById('btn-new-sistema-folder')?.addEventListener('click', () => openModal('pasta'));
    document.getElementById('btn-new-sistema-sheet')?.addEventListener('click', () => {
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = true;
      this.sistemaFichaEmCriacao = null;
      this.renderCurrentView();
    });

    document.getElementById('btn-open-ficha-guided')?.addEventListener('click', () => {
      this.criandoFichaGuiada = true;
      this.criandoFichaSistema = false;
      this.renderCurrentView();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-select-sistema-inline').forEach(button => {
      button.addEventListener('click', () => {
        this.sistemaFichaEmCriacao = button.dataset.sistema || 'Call of Cthulhu';
        this.renderCurrentView();
      });
    });


    document.querySelectorAll<HTMLButtonElement>('.btn-edit-sistema-item').forEach(button => {
      button.addEventListener('click', () => {
        const item = this.sistemaItens.find(entry => entry.id === button.dataset.id);
        if (!item) return;
        if (item.tipo === 'ficha') {
          this.fichaSistemaEmEdicaoId = item.id;
          this.criandoFichaSistema = false;
          this.sistemaFichaEmCriacao = null;
          this.renderCurrentView();
        } else {
          openModal('pasta', item);
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-delete-sistema-item').forEach(button => {
      button.addEventListener('click', () => {
        const item = this.sistemaItens.find(entry => entry.id === button.dataset.id);
        if (!item || !confirm(`Excluir ${item.tipo} "${item.nome}"?`)) return;

        const idsParaExcluir = new Set([item.id]);
        let encontrouFilho = true;
        while (encontrouFilho) {
          encontrouFilho = false;
          this.sistemaItens.forEach(entry => {
            if (entry.parentId && idsParaExcluir.has(entry.parentId) && !idsParaExcluir.has(entry.id)) {
              idsParaExcluir.add(entry.id);
              encontrouFilho = true;
            }
          });
        }

        this.sistemaItens = this.sistemaItens.filter(entry => !idsParaExcluir.has(entry.id));
        StorageService.salvarSistemaPastas(this.sistemaItens);
        this.showToast(`${item.tipo === 'pasta' ? 'Pasta' : 'Ficha'} excluída.`);
        this.renderCurrentView();
      });
    });

    form?.addEventListener('submit', event => {
      event.preventDefault();
      const nome = nameInput?.value.trim() || '';
      const descricao = descriptionInput?.value.trim() || '';
      const id = itemIdInput?.value || '';
      const tipo = itemTypeInput?.value as 'pasta' | 'ficha';
      const folderParentId = folderDestinationSelect?.value || null;
      const destinationFolder = folderParentId
        ? this.sistemaItens.find(item => item.id === folderParentId && item.tipo === 'pasta')
        : undefined;
      if (!nome) return;

      if (id) {
        const item = this.sistemaItens.find(entry => entry.id === id);
        if (item) {
          item.nome = nome;
          item.descricao = descricao;
          if (tipo === 'pasta') {
            item.parentId = folderParentId;
            item.sistema = destinationFolder?.sistema || item.sistema;
          }
        }
      } else {
        this.sistemaItens.push({
          id: crypto.randomUUID(),
          nome,
          tipo,
          sistema: destinationFolder?.sistema || 'Personalizado',
          descricao,
          parentId: tipo === 'pasta' ? folderParentId : this.pastaSistemaAtualId,
          dataCriacao: new Date().toLocaleDateString('pt-BR')
        });
      }

      StorageService.salvarSistemaPastas(this.sistemaItens);
      closeModal();
      this.showToast(`${tipo === 'pasta' ? 'Pasta' : 'Ficha'} salva com sucesso.`);
      this.renderCurrentView();
    });
  }

  /* ================= FICHA EVENTS ================= */
  private bindFichaEvents(): void {
    const p = this.personagemAtivo;
    if (!p) {
      document.getElementById('btn-goto-wizard')?.addEventListener('click', () => this.switchTab('wizard'));
      return;
    }

    // Subir nível
    document.getElementById('btn-subir-nivel')?.addEventListener('click', () => {
      p.subirNivel();
      StorageService.salvarPersonagens(this.personagens);
      this.showToast(`⭐ Parabéns! ${p.nomePersonagem} alcançou o Nível ${p.nivel}! PV Máximo aumentado.`);
      this.renderCurrentView();
    });

    // Excluir Personagem
    document.getElementById('btn-excluir-personagem')?.addEventListener('click', () => {
      if (confirm(`Deseja realmente excluir a ficha de ${p.nomePersonagem}?`)) {
        this.personagens = this.personagens.filter(item => item.idPersonagem !== p.idPersonagem);
        this.jogador.removerPersonagem(p.idPersonagem);
        StorageService.salvarPersonagens(this.personagens);
        this.personagemAtivoId = this.personagens[0]?.idPersonagem || null;
        this.updateCharacterSelector();
        this.showToast(`Personagem excluído com sucesso.`);
        this.renderCurrentView();
      }
    });

    // Ajuste de PV (+/-)
    document.querySelectorAll('.btn-hp-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        p.atualizarVida(delta);
        StorageService.salvarPersonagens(this.personagens);
        this.renderCurrentView();
      });
    });

    // Ajuste de Mana (+/-)
    document.querySelectorAll('.btn-mana-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        p.pontosMana = Math.max(0, Math.min(p.pontosManaMax, p.pontosMana + delta));
        StorageService.salvarPersonagens(this.personagens);
        this.renderCurrentView();
      });
    });

    // Adicionar XP
    document.querySelectorAll('.btn-xp-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const xp = parseInt(btn.getAttribute('data-xp') || '0', 10);
        const subiu = p.adicionarXP(xp);
        StorageService.salvarPersonagens(this.personagens);
        if (subiu) {
          this.showToast(`⭐ ${p.nomePersonagem} acumulou XP suficiente e subiu para o Nível ${p.nivel}!`);
        } else {
          this.showToast(`+${xp} XP adicionados.`);
        }
        this.renderCurrentView();
      });
    });

    // Rolagem rápida ao clicar no box do atributo
    document.querySelectorAll('.btn-roll-attr').forEach(box => {
      box.addEventListener('click', () => {
        const attr = box.getAttribute('data-attr') || 'Atributo';
        const mod = parseInt(box.getAttribute('data-mod') || '0', 10);
        this.executarRolagemD20(`Teste de ${attr.toUpperCase()}`, mod, p.nomePersonagem);
      });
    });

    // Botões de atalho para Inventário / Magias completos
    document.getElementById('btn-goto-inventario-full')?.addEventListener('click', () => this.switchTab('inventario'));
    document.getElementById('btn-goto-magias-full')?.addEventListener('click', () => this.switchTab('magias'));
  }

  /* ================= WIZARD EVENTS ================= */
  private bindWizardEvents(): void {
    const btnNext = document.getElementById('btn-wizard-next') as HTMLButtonElement;
    const btnPrev = document.getElementById('btn-wizard-prev') as HTMLButtonElement;
    const btnFinish = document.getElementById('btn-wizard-finish') as HTMLButtonElement;

    const racaSelect = document.getElementById('w-raca') as HTMLSelectElement;
    const classeSelect = document.getElementById('w-classe') as HTMLSelectElement;
    const bonusText = document.getElementById('w-bonus-text');

    const updateBonusPreview = () => {
      if (bonusText && racaSelect && classeSelect) {
        bonusText.innerHTML = `
          <strong>Raça ${racaSelect.value}:</strong> Aplica modificadores raciais e traços biológicos.<br/>
          <strong>Classe ${classeSelect.value}:</strong> Define o Dado de Vida básico, equipamentos iniciais e competências arcanas/marciais.
        `;
      }
    };

    racaSelect?.addEventListener('change', updateBonusPreview);
    classeSelect?.addEventListener('change', updateBonusPreview);
    updateBonusPreview();

    btnNext?.addEventListener('click', () => {
      if (this.wizardStep === 1) {
        const nome = (document.getElementById('w-nome') as HTMLInputElement)?.value.trim();
        if (!nome) {
          alert('Por favor, informe o nome do personagem.');
          return;
        }
        this.wizardStep = 2;
      } else if (this.wizardStep === 2) {
        this.wizardStep = 3;
      } else if (this.wizardStep === 3) {
        // Validação dos atributos informados pelo jogador.
        const forca = parseInt((document.getElementById('w-forca') as HTMLInputElement).value, 10);
        const destreza = parseInt((document.getElementById('w-destreza') as HTMLInputElement).value, 10);
        const constituicao = parseInt((document.getElementById('w-constituicao') as HTMLInputElement).value, 10);
        const inteligencia = parseInt((document.getElementById('w-inteligencia') as HTMLInputElement).value, 10);
        const sabedoria = parseInt((document.getElementById('w-sabedoria') as HTMLInputElement).value, 10);
        const carisma = parseInt((document.getElementById('w-carisma') as HTMLInputElement).value, 10);

        const atributos = [forca, destreza, constituicao, inteligencia, sabedoria, carisma];
        const invalidos = atributos.some(val => isNaN(val) || val < 8 || val > 18);

        const errBox = document.getElementById('w-attr-error');
        if (invalidos) {
          errBox?.classList.remove('hidden');
          return;
        }
        errBox?.classList.add('hidden');

        // Gerar resumo no Passo 4
        this.wizardStep = 4;
        this.generateWizardSummary();
      }

      this.updateWizardStepUI();
    });

    btnPrev?.addEventListener('click', () => {
      if (this.wizardStep > 1) {
        this.wizardStep--;
        this.updateWizardStepUI();
      }
    });

    btnFinish?.addEventListener('click', () => {
      const nome = (document.getElementById('w-nome') as HTMLInputElement).value.trim();
      const sistema = (document.getElementById('w-sistema') as HTMLSelectElement).value;
      const raca = (document.getElementById('w-raca') as HTMLSelectElement).value;
      const classe = (document.getElementById('w-classe') as HTMLSelectElement).value;

      const forca = parseInt((document.getElementById('w-forca') as HTMLInputElement).value, 10);
      const destreza = parseInt((document.getElementById('w-destreza') as HTMLInputElement).value, 10);
      const constituicao = parseInt((document.getElementById('w-constituicao') as HTMLInputElement).value, 10);
      const inteligencia = parseInt((document.getElementById('w-inteligencia') as HTMLInputElement).value, 10);
      const sabedoria = parseInt((document.getElementById('w-sabedoria') as HTMLInputElement).value, 10);
      const carisma = parseInt((document.getElementById('w-carisma') as HTMLInputElement).value, 10);

      const novo = new Personagem(nome, classe, raca, sistema, {
        forca, destreza, constituicao, inteligencia, sabedoria, carisma
      });

      // Itens iniciais padrão
      novo.inventario.adicionarItem(new Item('Mochila de Aventureiro', 2.0, 1));
      novo.inventario.adicionarItem(new Item('Cantil de Água', 1.0, 1));
      novo.inventario.adicionarItem(new Item('Adaga Curta', 0.5, 1));

      this.personagens.push(novo);
      this.jogador.adicionarPersonagem(novo);
      StorageService.salvarPersonagens(this.personagens);

      this.personagemAtivoId = novo.idPersonagem;
      this.updateCharacterSelector();
      this.showToast(`✨ Personagem "${novo.nomePersonagem}" criado com sucesso!`);
      this.switchTab('personagens');
    });
  }

  private updateWizardStepUI(): void {
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`wizard-step-${i}`);
      const stepItem = document.querySelector(`.step-item[data-step="${i}"]`);

      if (panel) {
        panel.classList.toggle('hidden', i !== this.wizardStep);
      }
      if (stepItem) {
        stepItem.classList.toggle('active', i === this.wizardStep);
        stepItem.classList.toggle('completed', i < this.wizardStep);
      }
    }

    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnFinish = document.getElementById('btn-wizard-finish');

    if (btnPrev) btnPrev.classList.toggle('hidden', this.wizardStep === 1);
    if (btnNext) btnNext.classList.toggle('hidden', this.wizardStep === 4);
    if (btnFinish) btnFinish.classList.toggle('hidden', this.wizardStep !== 4);
  }

  private generateWizardSummary(): void {
    const summaryBox = document.getElementById('w-summary-box');
    if (!summaryBox) return;

    const nome = (document.getElementById('w-nome') as HTMLInputElement).value;
    const sistema = (document.getElementById('w-sistema') as HTMLSelectElement).value;
    const raca = (document.getElementById('w-raca') as HTMLSelectElement).value;
    const classe = (document.getElementById('w-classe') as HTMLSelectElement).value;

    const forca = parseInt((document.getElementById('w-forca') as HTMLInputElement).value, 10);
    const destreza = parseInt((document.getElementById('w-destreza') as HTMLInputElement).value, 10);
    const constituicao = parseInt((document.getElementById('w-constituicao') as HTMLInputElement).value, 10);
    const inteligencia = parseInt((document.getElementById('w-inteligencia') as HTMLInputElement).value, 10);
    const sabedoria = parseInt((document.getElementById('w-sabedoria') as HTMLInputElement).value, 10);
    const carisma = parseInt((document.getElementById('w-carisma') as HTMLInputElement).value, 10);

    const temp = new Personagem(nome, classe, raca, sistema, {
      forca, destreza, constituicao, inteligencia, sabedoria, carisma
    });
    const mods = temp.calcularModificadores();

    summaryBox.innerHTML = `
      <div style="margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); color: #fde047;">${temp.nomePersonagem}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">${temp.raca} ${temp.classe} • Sistema: ${temp.sistema}</p>
      </div>

      <div class="grid-3" style="margin-bottom: 16px;">
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">PV CALCULADO</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">❤️ ${temp.pontosVidaMax}</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">CA CALCULADA</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #60a5fa;">🛡️ ${temp.ca}</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">LIMITE DE CARGA</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #34d399;">🎒 ${temp.inventario.limiteCarga} kg</div>
        </div>
      </div>

      <h5 style="color: #818cf8; margin-bottom: 8px;">Atributos e Modificadores Derivados:</h5>
      <div class="attr-grid" style="margin-bottom: 12px;">
        <div class="attr-box"><div class="attr-name">FOR</div><div class="attr-value">${forca}</div><div class="attr-mod">${mods.forca >= 0 ? '+' : ''}${mods.forca}</div></div>
        <div class="attr-box"><div class="attr-name">DES</div><div class="attr-value">${destreza}</div><div class="attr-mod">${mods.destreza >= 0 ? '+' : ''}${mods.destreza}</div></div>
        <div class="attr-box"><div class="attr-name">CON</div><div class="attr-value">${constituicao}</div><div class="attr-mod">${mods.constituicao >= 0 ? '+' : ''}${mods.constituicao}</div></div>
        <div class="attr-box"><div class="attr-name">INT</div><div class="attr-value">${inteligencia}</div><div class="attr-mod">${mods.inteligencia >= 0 ? '+' : ''}${mods.inteligencia}</div></div>
        <div class="attr-box"><div class="attr-name">SAB</div><div class="attr-value">${sabedoria}</div><div class="attr-mod">${mods.sabedoria >= 0 ? '+' : ''}${mods.sabedoria}</div></div>
        <div class="attr-box"><div class="attr-name">CAR</div><div class="attr-value">${carisma}</div><div class="attr-mod">${mods.carisma >= 0 ? '+' : ''}${mods.carisma}</div></div>
      </div>
    `;
  }

  /* ================= INVENTÁRIO EVENTS ================= */
  private bindInventarioEvents(): void {
    const p = this.personagemAtivo;
    if (!p) return;

    const modal = document.getElementById('modal-add-item');
    document.getElementById('btn-add-item-modal')?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    document.getElementById('btn-close-item-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-novo-item')?.addEventListener('click', () => {
      const nome = (document.getElementById('item-nome') as HTMLInputElement)?.value.trim();
      const peso = parseFloat((document.getElementById('item-peso') as HTMLInputElement)?.value || '0');
      const qtd = parseInt((document.getElementById('item-qtd') as HTMLInputElement)?.value || '1', 10);

      if (!nome) {
        alert('Informe o nome do item.');
        return;
      }

      p.inventario.adicionarItem(new Item(nome, peso, qtd));
      StorageService.salvarPersonagens(this.personagens);
      modal?.classList.add('hidden');
      this.showToast(`Item "${nome}" adicionado ao inventário.`);
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id && p.inventario.removerItem(id)) {
          StorageService.salvarPersonagens(this.personagens);
          this.showToast('Item removido do inventário.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= MAGIAS EVENTS ================= */
  private bindMagiasEvents(): void {
    const p = this.personagemAtivo;
    if (!p) return;

    const modal = document.getElementById('modal-add-spell');
    document.getElementById('btn-add-spell-modal')?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    document.getElementById('btn-close-spell-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-nova-magia')?.addEventListener('click', () => {
      const nome = (document.getElementById('spell-nome') as HTMLInputElement)?.value.trim();
      const mana = parseInt((document.getElementById('spell-mana') as HTMLInputElement)?.value || '0', 10);
      const tempo = (document.getElementById('spell-tempo') as HTMLInputElement)?.value.trim() || '1 Ação';
      const efeito = (document.getElementById('spell-efeito') as HTMLTextAreaElement)?.value.trim();

      if (!nome || !efeito) {
        alert('Preencha o nome e a descrição do efeito da magia.');
        return;
      }

      p.magiasHabilidades.push(new MagiaHabilidade(nome, mana, tempo, efeito));
      StorageService.salvarPersonagens(this.personagens);
      modal?.classList.add('hidden');
      this.showToast(`Habilidade "${nome}" cadastrada com sucesso.`);
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-spell').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          p.magiasHabilidades = p.magiasHabilidades.filter(m => m.id !== id);
          StorageService.salvarPersonagens(this.personagens);
          this.showToast('Habilidade removida.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= DADOS EVENTS ================= */
  private bindDadosEvents(): void {
    const p = this.personagemAtivo;

    document.getElementById('dice-sheet-select')?.addEventListener('change', event => {
      const selected = (event.target as HTMLSelectElement).value;
      this.fichaRolagemSelecionadaId = selected === 'legacy' ? null : selected || null;
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-roll-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.getAttribute('data-attr') || 'Atributo';
        const valor = parseInt(btn.getAttribute('data-value') || '0', 10);
        const sistema = btn.getAttribute('data-system') || 'D&D';
        const nome = this.fichaRolagemSelecionadaId
          ? this.sistemaItens.find(ficha => ficha.id === this.fichaRolagemSelecionadaId)?.nome
          : p?.nomePersonagem;
        if (sistema === 'Call of Cthulhu') {
          const resultado = DiceService.rolarGenerico(100, 1, 0);
          this.showToast(`🎲 ${attr}: d100(${resultado.total}) contra ${valor}%.`);
        } else if (sistema === 'Vampiro: A Máscara') {
          const resultado = DiceService.rolarGenerico(10, Math.max(1, valor), 0);
          this.showToast(`🎲 ${attr}: ${valor}d10 = ${resultado.dados.join(', ')} | Sucessos: ${resultado.dados.filter(dado => dado >= 6).length}.`);
        } else {
          const modificador = Math.floor((valor - 10) / 2);
          this.executarRolagemD20(`Teste de ${attr}`, modificador, nome);
        }
      });
    });

    document.querySelectorAll('.btn-roll-dice').forEach(btn => {
      btn.addEventListener('click', () => {
        const sides = parseInt(btn.getAttribute('data-sides') || '20', 10);
        if (sides === 20) {
          this.executarRolagemD20('d20 Puro', 0, p?.nomePersonagem);
        } else {
          const resultado = DiceService.rolarGenerico(sides, 1, 0);
          this.showToast(`🎲 Rolagem d${sides}: Resultado = ${resultado.total}`);
        }
      });
    });

    document.getElementById('btn-limpar-historico-dados')?.addEventListener('click', () => {
      this.historicoDados = [];
      StorageService.salvarHistoricoDados(this.historicoDados);
      this.renderCurrentView();
    });
  }

  private executarRolagemD20(rotulo: string, mod: number, nomePers?: string): void {
    const res = DiceService.rolarD20(rotulo, mod, nomePers);
    this.historicoDados.unshift(res);
    StorageService.salvarHistoricoDados(this.historicoDados);

    // Modal Popup com Animação
    const modal = document.getElementById('dice-modal');
    const modalBody = document.getElementById('dice-modal-body');

    if (modal && modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px 10px;">
          <div style="font-size: 0.9rem; color: var(--text-muted);">${res.periciaOuAtributo} ${res.nomePersonagem ? `(${res.nomePersonagem})` : ''}</div>
          <div style="font-family: var(--font-mono); font-size: 3.5rem; font-weight: 900; margin: 12px 0; color: ${
            res.tipoResultado === 'critico' ? 'var(--gold)' :
            res.tipoResultado === 'falha' ? 'var(--danger)' : 'white'
          }; text-shadow: 0 0 25px ${
            res.tipoResultado === 'critico' ? 'var(--gold-glow)' :
            res.tipoResultado === 'falha' ? 'var(--danger)' : 'var(--primary-glow)'
          };">
            ${res.total}
          </div>
          
          <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">
            ${res.tipoResultado === 'critico' ? '🌟 ACERTO CRÍTICO! (Natural 20)' :
              res.tipoResultado === 'falha' ? '💀 FALHA CRÍTICA! (Natural 1)' : 'Rolagem Normal'}
          </div>
          
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm); display: inline-block;">
            ${res.detalheCalculo}
          </div>
        </div>
      `;
      modal.classList.remove('hidden');
    }

    if (this.currentTab === 'dados') {
      this.renderCurrentView();
    }
  }

  /* ================= CAMPANHAS EVENTS ================= */
  private bindCampanhasEvents(): void {
    const modal = document.getElementById('modal-add-campanha');
    const nomeInput = document.getElementById('camp-nome') as HTMLInputElement | null;
    const loreInput = document.getElementById('camp-lore') as HTMLTextAreaElement | null;
    const modalTitle = document.getElementById('camp-modal-title');
    const saveButton = document.getElementById('btn-salvar-nova-campanha');

    const prepararModal = (campanha?: Campanha) => {
      this.campanhaEmEdicaoId = campanha?.idCampanha || null;
      if (nomeInput) nomeInput.value = campanha?.nomeCampanha || '';
      if (loreInput) loreInput.value = campanha?.lore || '';
      if (modalTitle) modalTitle.textContent = campanha ? '📜 Editar Campanha' : '📜 Criar Nova Campanha';
      if (saveButton) saveButton.textContent = campanha ? 'Salvar alterações' : 'Salvar Campanha';
      document.querySelectorAll<HTMLInputElement>('.chk-camp-personagem').forEach(check => {
        check.checked = campanha?.personagens.some(personagem => personagem.idPersonagem === check.value) || false;
      });
      document.querySelectorAll<HTMLInputElement>('.chk-camp-ficha').forEach(check => {
        check.checked = campanha?.fichas.some(ficha => ficha.id === check.value) || false;
      });
      document.querySelectorAll<HTMLInputElement>('.chk-camp-monstro').forEach(check => {
        check.checked = campanha?.monstros.some(monstro => monstro.id === check.value) || false;
      });
      modal?.classList.remove('hidden');
    };

    document.getElementById('btn-add-campanha-modal')?.addEventListener('click', () => {
      prepararModal();
    });

    document.getElementById('btn-close-campanha-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-nova-campanha')?.addEventListener('click', () => {
      const nome = (document.getElementById('camp-nome') as HTMLInputElement)?.value.trim();
      const lore = (document.getElementById('camp-lore') as HTMLTextAreaElement)?.value.trim();

      if (!nome || !lore) {
        alert('Preencha o nome e a história (lore) da campanha.');
        return;
      }

      const checks = document.querySelectorAll<HTMLInputElement>('.chk-camp-personagem:checked');
      const selecionados = Array.from(checks).map(c => this.personagens.find(p => p.idPersonagem === c.value)).filter(Boolean) as Personagem[];
      const fichaChecks = document.querySelectorAll<HTMLInputElement>('.chk-camp-ficha:checked');
      const fichas = Array.from(fichaChecks).map(c => this.sistemaItens.find(item => item.id === c.value)).filter(Boolean) as SistemaPasta[];
      const monstroChecks = document.querySelectorAll<HTMLInputElement>('.chk-camp-monstro:checked');
      const monstros = Array.from(monstroChecks).map(c => this.monstroItens.find(item => item.id === c.value)).filter(Boolean) as MonstroPasta[];

      const campanhaExistente = this.campanhaEmEdicaoId
        ? this.campanhas.find(campanha => campanha.idCampanha === this.campanhaEmEdicaoId)
        : undefined;
      if (campanhaExistente) {
        campanhaExistente.nomeCampanha = nome;
        campanhaExistente.lore = lore;
        campanhaExistente.personagens = selecionados;
        campanhaExistente.fichas = fichas;
        campanhaExistente.monstros = monstros;
      } else {
        const nova = new Campanha(nome, lore, undefined, selecionados, [], undefined, fichas, monstros);
        this.campanhas.push(nova);
        this.mestre.adicionarCampanha(nova);
      }
      StorageService.salvarCampanhas(this.campanhas);

      modal?.classList.add('hidden');
      this.campanhaEmEdicaoId = null;
      this.showToast(campanhaExistente ? `Campanha "${nome}" atualizada.` : `Campanha "${nome}" criada com sucesso!`);
      this.renderCurrentView();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-edit-campanha').forEach(button => {
      button.addEventListener('click', () => {
        const campanha = this.campanhas.find(item => item.idCampanha === button.dataset.id);
        if (campanha) prepararModal(campanha);
      });
    });

    document.querySelectorAll('.btn-remove-campanha').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id && confirm('Deseja realmente remover esta campanha?')) {
          this.campanhas = this.campanhas.filter(c => c.idCampanha !== id);
          if (this.campanhaEmEdicaoId === id) this.campanhaEmEdicaoId = null;
          this.mestre.removerCampanha(id);
          StorageService.salvarCampanhas(this.campanhas);
          this.showToast('Campanha removida.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= NPCS EVENTS ================= */
  private bindMonstrosEvents(): void {
    const inlineForm = document.getElementById('form-monstro-inline') as HTMLFormElement | null;
    if (inlineForm) {
      document.getElementById('btn-cancel-monstro')?.addEventListener('click', () => {
        this.monstroEmEdicaoId = null;
        this.criandoMonstro = false;
        this.renderCurrentView();
      });
      inlineForm.addEventListener('submit', event => {
        event.preventDefault();
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';
        const destination = value('monstro-destination');
        const dados: Record<string, string | number> = {};
        inlineForm.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(input => {
          if (input.value.trim()) dados[input.id] = input.value.trim();
        });
        const atual = this.monstroEmEdicaoId ? this.monstroItens.find(item => item.id === this.monstroEmEdicaoId) : undefined;
        if (atual) {
          atual.nome = value('monstro-nome') || atual.nome;
          atual.descricao = value('monstro-description');
          atual.parentId = destination || null;
          atual.dados = dados;
        } else {
          this.monstroItens.push({ id: crypto.randomUUID(), nome: value('monstro-nome') || 'Novo monstro', tipo: 'ficha', sistema: 'D&D', descricao: value('monstro-description'), parentId: destination || null, dataCriacao: new Date().toLocaleDateString('pt-BR'), dados });
        }
        StorageService.salvarMonstroPastas(this.monstroItens);
        this.monstroEmEdicaoId = null;
        this.criandoMonstro = false;
        this.showToast('Ficha de monstro salva.');
        this.renderCurrentView();
      });
      return;
    }

    document.querySelectorAll<HTMLButtonElement>('.btn-open-monstro').forEach(button => button.addEventListener('click', () => {
      this.pastaMonstroAtualId = button.dataset.id || null;
      this.monstroEmEdicaoId = null;
      this.criandoMonstro = false;
      this.renderCurrentView();
    }));
    document.getElementById('btn-monstro-up')?.addEventListener('click', () => {
      const atual = this.monstroItens.find(item => item.id === this.pastaMonstroAtualId);
      this.pastaMonstroAtualId = atual?.parentId || null;
      this.renderCurrentView();
    });
    document.getElementById('btn-new-monstro-sheet')?.addEventListener('click', () => {
      this.monstroEmEdicaoId = null;
      this.criandoMonstro = true;
      this.renderCurrentView();
    });
    document.querySelectorAll<HTMLButtonElement>('.btn-edit-monstro').forEach(button => button.addEventListener('click', () => {
      const item = this.monstroItens.find(entry => entry.id === button.dataset.id);
      if (item) { this.monstroEmEdicaoId = item.id; this.criandoMonstro = false; this.renderCurrentView(); }
    }));
    document.querySelectorAll<HTMLButtonElement>('.btn-delete-monstro').forEach(button => button.addEventListener('click', () => {
      const item = this.monstroItens.find(entry => entry.id === button.dataset.id);
      if (!item || !confirm(`Excluir ${item.tipo === 'pasta' ? 'pasta' : 'ficha'} "${item.nome}"?`)) return;
      const ids = new Set([item.id]);
      let changed = true;
      while (changed) { changed = false; this.monstroItens.forEach(entry => { if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.id)) { ids.add(entry.id); changed = true; } }); }
      this.monstroItens = this.monstroItens.filter(entry => !ids.has(entry.id));
      StorageService.salvarMonstroPastas(this.monstroItens);
      this.renderCurrentView();
    }));
    const modal = document.getElementById('modal-monstro-folder');
    document.getElementById('btn-new-monstro-folder')?.addEventListener('click', () => modal?.classList.remove('hidden'));
    document.getElementById('btn-close-monstro-modal')?.addEventListener('click', () => modal?.classList.add('hidden'));
    document.getElementById('form-monstro-folder')?.addEventListener('submit', event => {
      event.preventDefault();
      const name = (document.getElementById('monstro-folder-name') as HTMLInputElement).value.trim();
      if (!name) return;
      const parentId = (document.getElementById('monstro-folder-parent') as HTMLSelectElement).value || null;
      this.monstroItens.push({ id: crypto.randomUUID(), nome: name, tipo: 'pasta', sistema: 'D&D', descricao: (document.getElementById('monstro-folder-description') as HTMLTextAreaElement).value.trim(), parentId, dataCriacao: new Date().toLocaleDateString('pt-BR') });
      StorageService.salvarMonstroPastas(this.monstroItens);
      modal?.classList.add('hidden');
      this.renderCurrentView();
    });
  }

  /* ================= INICIATIVA EVENTS ================= */
  private bindIniciativaEvents(): void {
    document.getElementById('btn-add-init-personagem')?.addEventListener('click', () => {
      const sel = document.getElementById('select-init-personagem') as HTMLSelectElement;
      const selected = sel?.value || '';
      const ficha = selected.startsWith('ficha:')
        ? this.sistemaItens.find(item => item.id === selected.slice('ficha:'.length))
        : undefined;
      const p = this.personagens.find(item => item.idPersonagem === selected);
      if (ficha) {
        const dados = ficha.dados || {};
        const prefixo = ficha.sistema === 'D&D' ? 'dnd' : ficha.sistema === 'Vampiro: A Máscara' ? 'vampire' : 'coc';
        const ler = (campo: string, alternativo = '') => Number(dados[`${prefixo}-${campo}`] || dados[`inline-${prefixo}-${campo}`] || dados[`guided-${prefixo}-${campo}`] || dados[alternativo] || 0);
        const destreza = ler(ficha.sistema === 'Vampiro: A Máscara' ? 'dexterity' : 'dex');
        const pontosVida = ler(ficha.sistema === 'D&D' ? 'current-hp' : ficha.sistema === 'Vampiro: A Máscara' ? 'health' : 'hp') || 1;
        const iniciativa = DiceService.sortearNumero(1, 20) + (ficha.sistema === 'D&D' ? Math.floor((destreza - 10) / 2) : Math.floor(destreza / 10));
        this.mestre.adicionarCombatente({ id: crypto.randomUUID(), nome: ficha.nome, tipo: 'Personagem', iniciativa, vidaAtual: pontosVida, vidaMax: pontosVida, ca: ler('ac') || undefined });
        this.showToast(`⚔️ ${ficha.nome} entrou na iniciativa.`);
        this.renderCurrentView();
        return;
      }
      if (p) {
        const modDes = p.obterModificador('destreza');
        const d20 = DiceService.sortearNumero(1, 20);
        const init = d20 + modDes;

        const combatente: CombatenteIniciativa = {
          id: crypto.randomUUID(),
          nome: p.nomePersonagem,
          tipo: 'Personagem',
          iniciativa: init,
          vidaAtual: p.pontosVida,
          vidaMax: p.pontosVidaMax,
          ca: p.ca
        };
        this.mestre.adicionarCombatente(combatente);
        this.showToast(`⚔️ ${p.nomePersonagem} rolou iniciativa: d20(${d20}) + ${modDes} = ${init}`);
        this.renderCurrentView();
      }
    });

    document.getElementById('btn-add-init-npc')?.addEventListener('click', () => {
      const sel = document.getElementById('select-init-npc') as HTMLSelectElement;
      const selected = sel?.value || '';
      const fichaMonstro = selected.startsWith('monstro:')
        ? this.monstroItens.find(item => item.id === selected.slice('monstro:'.length))
        : undefined;
      const n = this.npcs.find(item => item.idNpc === selected);
      if (fichaMonstro) {
        const dados = fichaMonstro.dados || {};
        const ler = (campo: string) => Number(dados[`inline-${campo}`] || dados[campo] || 0);
        const vida = ler('monstro-current-hp') || ler('monstro-hp') || 1;
        const destreza = ler('monstro-dex');
        const iniciativa = DiceService.sortearNumero(1, 20) + Math.floor((destreza - 10) / 2);
        this.mestre.adicionarCombatente({ id: crypto.randomUUID(), nome: fichaMonstro.nome, tipo: 'NPC', iniciativa, vidaAtual: vida, vidaMax: vida, ca: ler('monstro-ac') || undefined });
        this.showToast(`🐉 ${fichaMonstro.nome} entrou na iniciativa.`);
        this.renderCurrentView();
        return;
      }
      if (n) {
        const d20 = DiceService.sortearNumero(1, 20);
        const init = d20;

        const combatente: CombatenteIniciativa = {
          id: crypto.randomUUID(),
          nome: n.nome,
          tipo: 'NPC',
          iniciativa: init,
          vidaAtual: n.vida,
          vidaMax: n.vidaMax
        };
        this.mestre.adicionarCombatente(combatente);
        this.showToast(`🐉 ${n.nome} rolou iniciativa: ${init}`);
        this.renderCurrentView();
      }
    });

    document.getElementById('btn-limpar-iniciativa')?.addEventListener('click', () => {
      this.mestre.limparIniciativa();
      this.showToast('Fila de iniciativa limpa.');
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-init').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          this.mestre.removerCombatente(id);
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= TOAST SYSTEM ================= */
  private showToast(mensagem: string, tipo: 'normal' | 'critico' | 'falha' = 'normal'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo === 'critico' ? 'toast-critico' : tipo === 'falha' ? 'toast-falha' : ''}`;
    toast.innerHTML = `<span>💬 ${mensagem}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
