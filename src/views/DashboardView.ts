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
            <div style="font-size: 0.75rem; color: var(--text-dim);">Heróis prontos para a aventura</div>
          </div>

          <div class="glass-card" style="border-left: 4px solid var(--gold);">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Campanhas no Hub</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${campanhas.length}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Mesas disponíveis no hub</div>
          </div>

          <div class="glass-card" style="border-left: 4px solid var(--gm-accent);">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">NPCs & Ameaças</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${npcs.length}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">Ameaças catalogadas</div>
          </div>

          <div class="glass-card" style="border-left: 4px solid ${sobrecarregados > 0 ? 'var(--danger)' : 'var(--success)'};">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Itens & Inventário</div>
            <div style="font-size: 2rem; font-weight: 700; font-family: var(--font-mono); margin: 6px 0;">${totalItens} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">itens</span></div>
            <div style="font-size: 0.75rem; color: ${sobrecarregados > 0 ? 'var(--danger)' : 'var(--success)'};">
              ${sobrecarregados > 0 ? `⚠️ ${sobrecarregados} personagem sobrecarregado` : '✓ Cargas equilibradas'}
            </div>
          </div>
        </div>

        <div class="glass-card" style="margin-bottom: 28px;">
          <div class="glass-card-header">
            <div>
              <h2>Bem-vindo ao RPG Hub</h2>
              <p style="color: var(--text-muted); margin-top: 6px;">Um espaço simples para criar seu personagem e começar a jogar.</p>
            </div>
            <span class="badge badge-unemat">Sua aventura começa aqui</span>
          </div>
          <p style="color: var(--text-muted); line-height: 1.7; margin-bottom: 18px;">
            Escolha um sistema de RPG, monte seu herói, acompanhe suas informações e role os dados durante a aventura. Use o menu ao lado para acessar cada recurso.
          </p>
          <div class="grid-3">
            <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="color: #93c5fd; margin-bottom: 8px;">Crie seu personagem</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted);">Escolha seu sistema, conceito, atributos e habilidades.</p>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="color: #a7f3d0; margin-bottom: 8px;">Prepare sua mesa</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted);">Organize campanhas, criaturas e informações da história.</p>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <h4 style="color: #fde68a; margin-bottom: 8px;">Jogue sua aventura</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted);">Faça rolagens e acompanhe cada momento da sessão.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
