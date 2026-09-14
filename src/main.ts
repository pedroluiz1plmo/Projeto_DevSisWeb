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
import { StorageService } from './services/StorageService';
import { DiceService, type ResultadoRolagem } from './services/DiceService';

import { DashboardView } from './views/DashboardView';
import { JogadorView } from './views/JogadorView';
import { MestreView } from './views/MestreView';

class AppController {
  private personagens: Personagem[] = [];
  private campanhas: Campanha[] = [];
  private npcs: NPC[] = [];
  private historicoDados: ResultadoRolagem[] = [];
  private notas: Nota[] = [];
  private missoes: Missao[] = [];

  private jogador: Jogador;
  private mestre: Mestre;

  private personagemAtivoId: string | null = null;
  private currentTab: string = 'dashboard';
  private wizardStep: number = 1;

  constructor() {
    // Carregar dados salvos ou dados de demonstração
    this.personagens = StorageService.carregarPersonagens();
    this.npcs = StorageService.carregarNPCs();
    this.campanhas = StorageService.carregarCampanhas(this.personagens, this.npcs);
    this.historicoDados = StorageService.carregarHistoricoDados();
    this.notas = StorageService.carregarNotas();
    this.missoes = StorageService.carregarMissoes();

    // Inicializar atores conforme UML
    this.jogador = new Jogador('user-jog-1', 'Jogador Aventureiro', 'jogador@unemat.br', this.personagens);
    this.mestre = new Mestre('user-mestre-1', 'Mestre dos Magos', 'mestre@unemat.br', this.campanhas, this.npcs);

    if (this.personagens.length > 0) {
      this.personagemAtivoId = this.personagens[0].idPersonagem;
    }

    this.initEventListeners();
    this.updateCharacterSelector();
    this.renderCurrentView();
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

    // Seletor de Personagem Ativo no Topbar
    const charSelect = document.getElementById('active-character-select') as HTMLSelectElement;
    if (charSelect) {
      charSelect.addEventListener('change', (e) => {
        this.personagemAtivoId = (e.target as HTMLSelectElement).value;
        this.renderCurrentView();
        this.showToast(`Personagem ativo: ${this.personagemAtivo?.nomePersonagem}`);
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
      campanhas: { title: 'Campanhas do Mestre', sub: 'Organize grupos e histórias' },
      npcs: { title: 'Bestiário e NPCs', sub: 'Gerencie criaturas e personagens da história' },
      iniciativa: { title: 'Iniciativa e Combate', sub: 'Organize a ordem dos turnos' }
    };

    if (titleEl && subtitleEl && titulos[tabName]) {
      titleEl.innerText = titulos[tabName].title;
      subtitleEl.innerText = titulos[tabName].sub;
    }

    this.renderCurrentView();
  }

  private updateCharacterSelector(): void {
    const select = document.getElementById('active-character-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = this.personagens.map(p => 
      `<option value="${p.idPersonagem}" ${p.idPersonagem === this.personagemAtivoId ? 'selected' : ''}>${p.nomePersonagem} (${p.classe})</option>`
    ).join('');

    if (this.personagens.length === 0) {
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

      case 'magias':
        container.innerHTML = JogadorView.renderMagias(this.personagemAtivo);
        this.bindMagiasEvents();
        break;

      case 'dados':
        container.innerHTML = JogadorView.renderRoladorDados(this.personagemAtivo, this.historicoDados);
        this.bindDadosEvents();
        break;

      case 'campanhas':
        container.innerHTML = MestreView.renderCampanhas(this.campanhas, this.personagens, this.npcs);
        this.bindCampanhasEvents();
        break;

      case 'npcs':
        container.innerHTML = MestreView.renderNPCs(this.npcs);
        this.bindNpcsEvents();
        break;

      case 'iniciativa':
        container.innerHTML = MestreView.renderIniciativa(this.mestre, this.personagens, this.npcs);
        this.bindIniciativaEvents();
        break;

      default:
        container.innerHTML = DashboardView.render(this.personagens, this.campanhas, this.npcs);
    }
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

    document.querySelectorAll('.btn-roll-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.getAttribute('data-attr') || 'Atributo';
        const mod = parseInt(btn.getAttribute('data-mod') || '0', 10);
        this.executarRolagemD20(`Teste de ${attr}`, mod, p?.nomePersonagem);
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
    document.getElementById('btn-add-campanha-modal')?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
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

      const nova = new Campanha(nome, lore, undefined, selecionados, this.npcs.slice(0, 2));
      this.campanhas.push(nova);
      this.mestre.adicionarCampanha(nova);
      StorageService.salvarCampanhas(this.campanhas);

      modal?.classList.add('hidden');
      this.showToast(`Campanha "${nome}" criada com sucesso!`);
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-campanha').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id && confirm('Deseja realmente remover esta campanha?')) {
          this.campanhas = this.campanhas.filter(c => c.idCampanha !== id);
          this.mestre.removerCampanha(id);
          StorageService.salvarCampanhas(this.campanhas);
          this.showToast('Campanha removida.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= NPCS EVENTS ================= */
  private bindNpcsEvents(): void {
    const modal = document.getElementById('modal-add-npc');
    document.getElementById('btn-add-npc-modal')?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    document.getElementById('btn-close-npc-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-novo-npc')?.addEventListener('click', () => {
      const nome = (document.getElementById('npc-nome') as HTMLInputElement)?.value.trim();
      const cr = (document.getElementById('npc-cr') as HTMLInputElement)?.value.trim() || 'CR 1';
      const vida = parseInt((document.getElementById('npc-vida') as HTMLInputElement)?.value || '20', 10);
      const ataques = (document.getElementById('npc-ataques') as HTMLTextAreaElement)?.value.trim() || 'Ataque Básico (+3, 1d6)';

      if (!nome) {
        alert('Informe o nome do monstro ou NPC.');
        return;
      }

      const novo = new NPC(nome, cr, vida, ataques);
      this.npcs.push(novo);
      this.mestre.adicionarNPC(novo);
      StorageService.salvarNPCs(this.npcs);

      modal?.classList.add('hidden');
      this.showToast(`Monstro "${nome}" cadastrado no Bestiário.`);
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-npc-hp').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        const npc = this.npcs.find(n => n.idNpc === id);
        if (npc) {
          npc.atualizarVida(delta);
          StorageService.salvarNPCs(this.npcs);
          this.renderCurrentView();
        }
      });
    });

    document.querySelectorAll('.btn-remove-npc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id && confirm('Remover este NPC do Bestiário?')) {
          this.npcs = this.npcs.filter(n => n.idNpc !== id);
          this.mestre.removerNPC(id);
          StorageService.salvarNPCs(this.npcs);
          this.showToast('NPC removido.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= INICIATIVA EVENTS ================= */
  private bindIniciativaEvents(): void {
    document.getElementById('btn-add-init-personagem')?.addEventListener('click', () => {
      const sel = document.getElementById('select-init-personagem') as HTMLSelectElement;
      const p = this.personagens.find(item => item.idPersonagem === sel?.value);
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
      const n = this.npcs.find(item => item.idNpc === sel?.value);
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

    document.getElementById('btn-auto-roll-initiative')?.addEventListener('click', () => {
      this.mestre.limparIniciativa();

      this.personagens.forEach(p => {
        const modDes = p.obterModificador('destreza');
        const init = DiceService.sortearNumero(1, 20) + modDes;
        this.mestre.adicionarCombatente({
          id: crypto.randomUUID(),
          nome: p.nomePersonagem,
          tipo: 'Personagem',
          iniciativa: init,
          vidaAtual: p.pontosVida,
          vidaMax: p.pontosVidaMax,
          ca: p.ca
        });
      });

      this.npcs.forEach(n => {
        const init = DiceService.sortearNumero(1, 20);
        this.mestre.adicionarCombatente({
          id: crypto.randomUUID(),
          nome: n.nome,
          tipo: 'NPC',
          iniciativa: init,
          vidaAtual: n.vida,
          vidaMax: n.vidaMax
        });
      });

      this.showToast('🎲 Todos os combatentes rolaram iniciativa e a ordem de turnos foi gerada!');
      this.renderCurrentView();
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
