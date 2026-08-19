import { Personagem } from '../models/Personagem';
import { Campanha } from '../models/Campanha';
import { NPC } from '../models/NPC';

export class DashboardView {
  public static render(
    personagens: Personagem[],
    campanhas: Campanha[],
    npcs: NPC[]
  ): string {
    const totalItens = personagens.reduce((acc, p) => acc + p.inventario.itens.length, 0);
    const sobrecarregados = personagens.filter(p => p.inventario.estaSobrecarregado()).length;

    return `
      <div class="dashboard-grid">
        <!-- Quick Stats Cards -->
        <div class="grid-4" style="margin-bottom: 28px;">
          <div class="glass-card" style="border-left: 4px solid var(--primary);">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Personagens Ativos</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${personagens.length}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">UC01 & UC02 cadastrados</div>
          </div>

          <div class="glass-card" style="border-left: 4px solid var(--gold);">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Campanhas no Hub</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${campanhas.length}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">UC06 (Visão do Mestre)</div>
          </div>

          <div class="glass-card" style="border-left: 4px solid var(--gm-accent);">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">NPCs & Ameaças</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${npcs.length}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">UC07 (Bestiário do Mestre)</div>
          </div>

          <div class="glass-card" style="border-left: 4px solid ${sobrecarregados > 0 ? 'var(--danger)' : 'var(--success)'};">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Itens & Inventário</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${totalItens} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">itens</span></div>
            <div style="font-size: 0.75rem; color: ${sobrecarregados > 0 ? 'var(--danger)' : 'var(--success)'};">
              ${sobrecarregados > 0 ? `⚠️ ${sobrecarregados} personagem sobrecarregado` : '✓ Cargas equilibradas'}
            </div>
          </div>
        </div>

        <!-- Metodologias & Engenharia de Software -->
        <div class="glass-card" style="margin-bottom: 28px;">
          <div class="glass-card-header">
            <h3>📖 Metodologia e Fundamentação de Engenharia de Software</h3>
            <span class="badge badge-unemat">UNEMAT - Ciência da Computação</span>
          </div>

          <p style="color: var(--text-muted); margin-bottom: 16px;">
            Este sistema foi projetado com base nas <strong>3 Ondas Metodológicas</strong> da Engenharia de Software, adotando a metodologia ágil <strong>b_thinking (UX + Agile/Scrumban)</strong> da terceira onda.
          </p>

          <div class="grid-3">
            <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="color: #93c5fd; margin-bottom: 8px;">1ª Onda: RUP / Tradicional</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted);">
                Modelos rígidos e documentais (concepção, elaboração, construção, transição). Forneceu a base formal dos <strong>Diagramas de Casos de Uso e Classes</strong>.
              </p>
            </div>

            <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="color: #a7f3d0; margin-bottom: 8px;">2ª Onda: Scrum & XP</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted);">
                Foco em ciclos incrementais (Sprints), entrega contínua de software funcional e adaptação contínua a novos cenários e regras de RPG.
              </p>
            </div>

            <div style="background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.15)); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(99,102,241,0.4);">
              <h4 style="color: #c084fc; margin-bottom: 8px;">3ª Onda: b_thinking (Adotada) 🌟</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted);">
                Integração profunda de <strong>UX, Design Thinking e Lean UX</strong> para diminuir a carga cognitiva do jogador através de wizards guiados (UC02) e cálculos instantâneos.
              </p>
            </div>
          </div>
        </div>

        <!-- Mapeamento dos 10 Casos de Uso -->
        <div class="glass-card">
          <div class="glass-card-header">
            <h3>🎯 Casos de Uso Implementados no Sistema</h3>
          </div>
          <div class="grid-2">
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem;">
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(99,102,241,0.2); color: #818cf8;">UC01</span>
                <strong>Manter Personagem:</strong> CRUD completo com recalculo de PV, CA e XP.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(99,102,241,0.2); color: #818cf8;">UC02</span>
                <strong>Criar Personagem Guiado:</strong> Assistente passo a passo com regras oficiais.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(99,102,241,0.2); color: #818cf8;">UC03</span>
                <strong>Gerenciar Inventário:</strong> Controle de peso unitário, carga e alerta de sobrecarga.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(99,102,241,0.2); color: #818cf8;">UC04</span>
                <strong>Gerenciar Magias & Habilidades:</strong> Consulta, custos de mana e efeitos.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(99,102,241,0.2); color: #818cf8;">UC05</span>
                <strong>Realizar Rolagem de Dados:</strong> Algoritmo criptográfico com detecção de críticos.
              </li>
            </ul>

            <ul style="list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem;">
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(244,63,94,0.2); color: #fb7185;">UC06</span>
                <strong>Manter Campanha:</strong> Organização do grupo de jogadores e lore pelo Mestre.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(244,63,94,0.2); color: #fb7185;">UC07</span>
                <strong>Manter NPCs e Criaturas:</strong> Fichas simplificadas para gestão rápida.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(244,63,94,0.2); color: #fb7185;">UC08</span>
                <strong>Gerenciar Iniciativa:</strong> Painel tático para ordenação de turnos de combate.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(16,185,129,0.2); color: #34d399;">UC09</span>
                <strong>Customizar Sistema de RPG:</strong> Suporte flexível para D&D 5e e Tormenta 20.
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="background: rgba(16,185,129,0.2); color: #34d399;">UC10</span>
                <strong>Histórico de Evolução:</strong> Registro de XP e marcos de progressão.
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }
}
