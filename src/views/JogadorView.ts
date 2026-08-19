import { Personagem } from '../models/Personagem';
import type { ResultadoRolagem } from '../services/DiceService';

export class JogadorView {
  public static renderFichas(_personagens: Personagem[], personagemAtivo: Personagem | null): string {
    if (!personagemAtivo) {
      return `
        <div class="glass-card" style="text-align: center; padding: 48px 24px;">
          <h3>🧙‍♂️ Nenhum personagem selecionado</h3>
          <p style="color: var(--text-muted); margin: 12px 0 20px 0;">Crie seu primeiro herói através do assistente guiado passo a passo.</p>
          <button id="btn-goto-wizard" class="btn btn-primary">✨ Iniciar Criação Guiada (UC02)</button>
        </div>
      `;
    }

    const mods = personagemAtivo.calcularModificadores();
    const sobrecarregado = personagemAtivo.inventario.estaSobrecarregado();

    return `
      <div class="character-sheet-container">
        <!-- Header / Banner da Ficha -->
        <div class="glass-card" style="margin-bottom: 24px; position: relative; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <h2 style="font-family: var(--font-title); font-size: 1.8rem;">${personagemAtivo.nomePersonagem}</h2>
                <span class="badge" style="background: rgba(99,102,241,0.2); color: #a5b4fc; font-size: 0.85rem;">Nível ${personagemAtivo.nivel}</span>
                <span class="badge badge-unemat">${personagemAtivo.sistema}</span>
              </div>
              <p style="color: var(--text-muted); margin-top: 4px;">
                ${personagemAtivo.raca} • ${personagemAtivo.classe}
              </p>
            </div>

            <div style="display: flex; gap: 10px; align-items: center;">
              <button id="btn-subir-nivel" class="btn btn-glow">⭐ Subir de Nível</button>
              <button id="btn-excluir-personagem" class="btn btn-danger" title="Excluir Personagem">🗑️ Excluir</button>
            </div>
          </div>

          <!-- Combat Stats Quick Row -->
          <div class="grid-4" style="margin-top: 20px;">
            <!-- Pontos de Vida -->
            <div style="background: rgba(0,0,0,0.3); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                <span>PONTOS DE VIDA (PV)</span>
                <span>${personagemAtivo.pontosVida} / ${personagemAtivo.pontosVidaMax}</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 8px 0; overflow: hidden;">
                <div style="height: 100%; width: ${(personagemAtivo.pontosVida / personagemAtivo.pontosVidaMax) * 100}%; background: #ef4444; border-radius: 4px;"></div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-hp-adjust" data-delta="-5" style="padding: 4px 8px; font-size: 0.75rem;">-5</button>
                <button class="btn btn-secondary btn-hp-adjust" data-delta="-1" style="padding: 4px 8px; font-size: 0.75rem;">-1</button>
                <button class="btn btn-secondary btn-hp-adjust" data-delta="1" style="padding: 4px 8px; font-size: 0.75rem;">+1</button>
                <button class="btn btn-secondary btn-hp-adjust" data-delta="5" style="padding: 4px 8px; font-size: 0.75rem;">+5</button>
              </div>
            </div>

            <!-- Pontos de Mana -->
            <div style="background: rgba(0,0,0,0.3); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                <span>MANA / RECURSOS</span>
                <span>${personagemAtivo.pontosMana} / ${personagemAtivo.pontosManaMax}</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 8px 0; overflow: hidden;">
                <div style="height: 100%; width: ${(personagemAtivo.pontosMana / personagemAtivo.pontosManaMax) * 100}%; background: #3b82f6; border-radius: 4px;"></div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-mana-adjust" data-delta="-2" style="padding: 4px 8px; font-size: 0.75rem;">-2</button>
                <button class="btn btn-secondary btn-mana-adjust" data-delta="-1" style="padding: 4px 8px; font-size: 0.75rem;">-1</button>
                <button class="btn btn-secondary btn-mana-adjust" data-delta="1" style="padding: 4px 8px; font-size: 0.75rem;">+1</button>
                <button class="btn btn-secondary btn-mana-adjust" data-delta="2" style="padding: 4px 8px; font-size: 0.75rem;">+2</button>
              </div>
            </div>

            <!-- Classe de Armadura -->
            <div style="background: rgba(0,0,0,0.3); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
              <div style="font-size: 0.8rem; color: var(--text-muted);">CLASSE DE ARMADURA (CA)</div>
              <div style="font-size: 1.8rem; font-weight: 700; font-family: var(--font-mono); color: #60a5fa;">🛡️ ${personagemAtivo.ca}</div>
            </div>

            <!-- Experiência (XP) -->
            <div style="background: rgba(0,0,0,0.3); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                <span>EXPERIÊNCIA (XP)</span>
                <span>${personagemAtivo.XP} / ${personagemAtivo.nivel * 1000}</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 8px 0; overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, (personagemAtivo.XP / (personagemAtivo.nivel * 1000)) * 100)}%; background: #f59e0b; border-radius: 4px;"></div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-xp-add" data-xp="100" style="padding: 4px 8px; font-size: 0.75rem;">+100 XP</button>
                <button class="btn btn-secondary btn-xp-add" data-xp="500" style="padding: 4px 8px; font-size: 0.75rem;">+500 XP</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Atributos Base & Rolagens Rápidas -->
        <div class="glass-card" style="margin-bottom: 24px;">
          <div class="glass-card-header">
            <h3>⚡ Atributos e Testes (Clique para Rolar d20 - UC05)</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Automação de modificadores em tempo real</span>
          </div>

          <div class="attr-grid">
            <div class="attr-box btn-roll-attr" data-attr="forca" data-mod="${mods.forca}" style="cursor: pointer;">
              <div class="attr-name">Força</div>
              <div class="attr-value">${personagemAtivo.atributos.forca}</div>
              <div class="attr-mod">${mods.forca >= 0 ? '+' : ''}${mods.forca}</div>
            </div>

            <div class="attr-box btn-roll-attr" data-attr="destreza" data-mod="${mods.destreza}" style="cursor: pointer;">
              <div class="attr-name">Destreza</div>
              <div class="attr-value">${personagemAtivo.atributos.destreza}</div>
              <div class="attr-mod">${mods.destreza >= 0 ? '+' : ''}${mods.destreza}</div>
            </div>

            <div class="attr-box btn-roll-attr" data-attr="constituicao" data-mod="${mods.constituicao}" style="cursor: pointer;">
              <div class="attr-name">Constituição</div>
              <div class="attr-value">${personagemAtivo.atributos.constituicao}</div>
              <div class="attr-mod">${mods.constituicao >= 0 ? '+' : ''}${mods.constituicao}</div>
            </div>

            <div class="attr-box btn-roll-attr" data-attr="inteligencia" data-mod="${mods.inteligencia}" style="cursor: pointer;">
              <div class="attr-name">Inteligência</div>
              <div class="attr-value">${personagemAtivo.atributos.inteligencia}</div>
              <div class="attr-mod">${mods.inteligencia >= 0 ? '+' : ''}${mods.inteligencia}</div>
            </div>

            <div class="attr-box btn-roll-attr" data-attr="sabedoria" data-mod="${mods.sabedoria}" style="cursor: pointer;">
              <div class="attr-name">Sabedoria</div>
              <div class="attr-value">${personagemAtivo.atributos.sabedoria}</div>
              <div class="attr-mod">${mods.sabedoria >= 0 ? '+' : ''}${mods.sabedoria}</div>
            </div>

            <div class="attr-box btn-roll-attr" data-attr="carisma" data-mod="${mods.carisma}" style="cursor: pointer;">
              <div class="attr-name">Carisma</div>
              <div class="attr-value">${personagemAtivo.atributos.carisma}</div>
              <div class="attr-mod">${mods.carisma >= 0 ? '+' : ''}${mods.carisma}</div>
            </div>
          </div>
        </div>

        <!-- Quick Summary Lists (Inventário & Magias) -->
        <div class="grid-2">
          <!-- Resumo Inventário -->
          <div class="glass-card">
            <div class="glass-card-header">
              <h3>🎒 Inventário Rápido</h3>
              <button id="btn-goto-inventario-full" class="btn btn-secondary" style="font-size: 0.8rem; padding: 4px 10px;">Ver Completo (UC03)</button>
            </div>
            
            <div class="weight-container">
              <div class="weight-header">
                <span>Carga: <strong>${personagemAtivo.inventario.pesoTotal} kg</strong> / ${personagemAtivo.inventario.limiteCarga} kg</span>
                <span>${Math.round((personagemAtivo.inventario.pesoTotal / personagemAtivo.inventario.limiteCarga) * 100)}%</span>
              </div>
              <div class="weight-bar-bg">
                <div class="weight-bar-fill ${sobrecarregado ? 'overloaded' : ''}" style="width: ${Math.min(100, (personagemAtivo.inventario.pesoTotal / personagemAtivo.inventario.limiteCarga) * 100)}%;"></div>
              </div>
              ${sobrecarregado ? `
                <div class="overload-warning">
                  <span>⚠️ <strong>Sobrecarregado!</strong> Redução de movimento em 3m e desvantagem em testes físicos.</span>
                </div>
              ` : ''}
            </div>

            <div style="margin-top: 14px; max-height: 180px; overflow-y: auto;">
              ${personagemAtivo.inventario.itens.length === 0 ? '<p style="color: var(--text-dim); font-size: 0.85rem;">Mochila vazia.</p>' : `
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
                  ${personagemAtivo.inventario.itens.map(i => `
                    <li style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 6px 10px; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm);">
                      <span>${i.quantidade}x ${i.nomeItem}</span>
                      <span style="color: var(--text-muted); font-family: var(--font-mono);">${i.getPesoTotal()} kg</span>
                    </li>
                  `).join('')}
                </ul>
              `}
            </div>
          </div>

          <!-- Resumo Magias -->
          <div class="glass-card">
            <div class="glass-card-header">
              <h3>⚡ Magias e Habilidades</h3>
              <button id="btn-goto-magias-full" class="btn btn-secondary" style="font-size: 0.8rem; padding: 4px 10px;">Gerenciar (UC04)</button>
            </div>
            <div style="max-height: 240px; overflow-y: auto;">
              ${personagemAtivo.magiasHabilidades.length === 0 ? '<p style="color: var(--text-dim); font-size: 0.85rem;">Nenhuma magia ou habilidade cadastrada.</p>' : `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${personagemAtivo.magiasHabilidades.map(m => `
                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm); border-left: 3px solid var(--primary);">
                      <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.9rem;">
                        <span>${m.nome}</span>
                        <span style="color: #93c5fd; font-size: 0.8rem;">${m.custoMana > 0 ? `${m.custoMana} Mana` : 'Passiva / Grátis'} • ${m.tempoConjuracao}</span>
                      </div>
                      <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">${m.efeito}</p>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  public static renderWizard(): string {
    return `
      <div class="glass-card" style="max-width: 800px; margin: 0 auto;">
        <div class="glass-card-header">
          <h3>✨ Assistente de Criação Guiada de Personagem (UC02)</h3>
          <span class="badge badge-unemat">Redução de Carga Cognitiva</span>
        </div>

        <!-- Wizard Stepper Indicator -->
        <div class="wizard-stepper" id="wizard-stepper">
          <div class="step-item active" data-step="1">
            <div class="step-circle">1</div>
            <span class="step-label">Sistema & Nome</span>
          </div>
          <div class="step-item" data-step="2">
            <div class="step-circle">2</div>
            <span class="step-label">Raça & Classe</span>
          </div>
          <div class="step-item" data-step="3">
            <div class="step-circle">3</div>
            <span class="step-label">Atributos</span>
          </div>
          <div class="step-item" data-step="4">
            <div class="step-circle">4</div>
            <span class="step-label">Revisão & Salvar</span>
          </div>
        </div>

        <!-- Wizard Step Containers -->
        <div id="wizard-step-content">
          <!-- Step 1: Sistema e Identidade -->
          <div class="wizard-step-panel" id="wizard-step-1">
            <h4 style="margin-bottom: 16px;">Passo 1: Identidade e Sistema de Regras</h4>
            <div class="form-group">
              <label for="w-nome">Nome do Personagem:</label>
              <input type="text" id="w-nome" class="form-control" placeholder="Ex: Valerius Vento-Prateado" value="Valerius Vento-Prateado" />
            </div>

            <div class="form-group">
              <label for="w-sistema">Sistema de RPG:</label>
              <select id="w-sistema" class="custom-select">
                <option value="D&D 5e">Dungeons & Dragons 5ª Edição</option>
                <option value="Tormenta 20">Tormenta 20</option>
                <option value="Pathfinder 2e">Pathfinder 2ª Edição</option>
                <option value="Custom">Sistema Customizado da Comunidade (UC09)</option>
              </select>
            </div>
          </div>

          <!-- Step 2: Raça e Classe -->
          <div class="wizard-step-panel hidden" id="wizard-step-2">
            <h4 style="margin-bottom: 16px;">Passo 2: Escolha de Raça e Classe</h4>
            <div class="grid-2">
              <div class="form-group">
                <label for="w-raca">Raça do Herói:</label>
                <select id="w-raca" class="custom-select">
                  <option value="Humano">Humano (+1 em todos os atributos)</option>
                  <option value="Elfo">Elfo (+2 Destreza, Visão no Escuro)</option>
                  <option value="Anão">Anão (+2 Constituição, Resiliência a Veneno)</option>
                  <option value="Draconato">Draconato (+2 Força, +1 Carisma, Sopro Elemental)</option>
                  <option value="Tiefling">Tiefling (+2 Carisma, +1 Inteligência)</option>
                  <option value="Lefou">Lefou (Tormenta: +2 em dois atributos, Afinidade Aberrante)</option>
                </select>
              </div>

              <div class="form-group">
                <label for="w-classe">Classe:</label>
                <select id="w-classe" class="custom-select">
                  <option value="Guerreiro">Guerreiro (Dado de Vida d10, Proficiência com Todas as Armas)</option>
                  <option value="Mago">Mago (Dado de Vida d6, Conjurador Arcano Poderoso)</option>
                  <option value="Ladino">Ladino (Dado de Vida d8, Ataque Furtivo e Especialista)</option>
                  <option value="Clérigo">Clérigo (Dado de Vida d8, Canalizar Divindade e Curas)</option>
                  <option value="Bárbaro">Bárbaro (Dado de Vida d12, Fúria Implacável)</option>
                  <option value="Bardo">Bardo (Dado de Vida d8, Inspiração Bárdica e Versatilidade)</option>
                </select>
              </div>
            </div>

            <div id="w-class-bonus-preview" style="margin-top: 12px; padding: 14px; background: rgba(99,102,241,0.1); border-radius: var(--radius-md); border: 1px solid rgba(99,102,241,0.3);">
              <h5 style="color: #818cf8; margin-bottom: 6px;">✨ Bônus Automáticos Derivados:</h5>
              <p id="w-bonus-text" style="font-size: 0.85rem; color: var(--text-muted);">
                A seleção de Raça e Classe atualizará automaticamente os cálculos de Vida Máxima (PV) e Classe de Armadura (CA).
              </p>
            </div>
          </div>

          <!-- Step 3: Distribuição de Atributos -->
          <div class="wizard-step-panel hidden" id="wizard-step-3">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h4>Passo 3: Distribuição de Atributos Base</h4>
              <div id="w-points-badge" class="badge" style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 0.85rem;">
                Pontos de Pool Restantes: <strong id="w-points-remaining">27</strong>
              </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
              Validação de Regras (UC02): Valores permitidos entre <strong>8 e 18</strong>.
            </p>

            <div class="grid-3">
              <div class="form-group">
                <label>Força (FOR):</label>
                <input type="number" id="w-forca" class="form-control w-attr-input" min="8" max="18" value="15" />
              </div>
              <div class="form-group">
                <label>Destreza (DES):</label>
                <input type="number" id="w-destreza" class="form-control w-attr-input" min="8" max="18" value="14" />
              </div>
              <div class="form-group">
                <label>Constituição (CON):</label>
                <input type="number" id="w-constituicao" class="form-control w-attr-input" min="8" max="18" value="13" />
              </div>
              <div class="form-group">
                <label>Inteligência (INT):</label>
                <input type="number" id="w-inteligencia" class="form-control w-attr-input" min="8" max="18" value="12" />
              </div>
              <div class="form-group">
                <label>Sabedoria (SAB):</label>
                <input type="number" id="w-sabedoria" class="form-control w-attr-input" min="8" max="18" value="10" />
              </div>
              <div class="form-group">
                <label>Carisma (CAR):</label>
                <input type="number" id="w-carisma" class="form-control w-attr-input" min="8" max="18" value="8" />
              </div>
            </div>

            <div id="w-attr-error" class="overload-warning hidden" style="margin-top: 12px;">
              <span>❌ <strong>Atributos Inválidos:</strong> Certifique-se de que todos os atributos estão na faixa permitida de 8 a 18.</span>
            </div>
          </div>

          <!-- Step 4: Resumo Final -->
          <div class="wizard-step-panel hidden" id="wizard-step-4">
            <h4 style="margin-bottom: 16px;">Passo 4: Resumo e Confirmação da Ficha</h4>
            <div id="w-summary-box" style="background: rgba(0,0,0,0.3); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <!-- Will be filled dynamically -->
            </div>
          </div>
        </div>

        <!-- Wizard Navigation Controls -->
        <div style="display: flex; justify-content: space-between; margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--border-color);">
          <button id="btn-wizard-prev" class="btn btn-secondary hidden">← Voltar</button>
          <div></div>
          <button id="btn-wizard-next" class="btn btn-primary">Avançar →</button>
          <button id="btn-wizard-finish" class="btn btn-glow hidden">💾 Concluir e Salvar Personagem</button>
        </div>
      </div>
    `;
  }

  public static renderInventario(personagem: Personagem | null): string {
    if (!personagem) {
      return `<div class="glass-card" style="text-align: center; padding: 40px;"><h3>Selecione um personagem primeiro.</h3></div>`;
    }

    const sobrecarregado = personagem.inventario.estaSobrecarregado();

    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3>🎒 Gerenciamento de Inventário (UC03)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Personagem: <strong>${personagem.nomePersonagem}</strong> (Força: ${personagem.atributos.forca})</p>
          </div>
          <button id="btn-add-item-modal" class="btn btn-primary">+ Adicionar Item</button>
        </div>

        <!-- Capacidade de Carga e Barra -->
        <div class="weight-container">
          <div class="weight-header">
            <span>Peso Total: <strong>${personagem.inventario.pesoTotal} kg</strong> / Capacidade Máxima: <strong>${personagem.inventario.limiteCarga} kg</strong></span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: ${sobrecarregado ? 'var(--danger)' : 'var(--success)'};">
              ${Math.round((personagem.inventario.pesoTotal / personagem.inventario.limiteCarga) * 100)}%
            </span>
          </div>
          <div class="weight-bar-bg">
            <div class="weight-bar-fill ${sobrecarregado ? 'overloaded' : ''}" style="width: ${Math.min(100, (personagem.inventario.pesoTotal / personagem.inventario.limiteCarga) * 100)}%;"></div>
          </div>

          ${sobrecarregado ? `
            <div class="overload-warning">
              <span>⚠️ <strong>ALERTA DE SOBRECARGA:</strong> O peso dos itens excede a capacidade de carga da Força (${personagem.inventario.limiteCarga} kg). O personagem sofre desvantagem em testes físicos e penalidade de deslocamento.</span>
            </div>
          ` : ''}
        </div>

        <!-- Tabela de Itens -->
        <div style="margin-top: 24px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.92rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
                <th style="padding: 10px;">Item</th>
                <th style="padding: 10px;">Quantidade</th>
                <th style="padding: 10px;">Peso Unitário</th>
                <th style="padding: 10px;">Peso Acumulado</th>
                <th style="padding: 10px; text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${personagem.inventario.itens.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhum item adicionado ainda.</td>
                </tr>
              ` : personagem.inventario.itens.map(item => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 12px 10px; font-weight: 600;">⚔️ ${item.nomeItem}</td>
                  <td style="padding: 12px 10px;">${item.quantidade}</td>
                  <td style="padding: 12px 10px; color: var(--text-muted);">${item.pesoItem} kg</td>
                  <td style="padding: 12px 10px; font-family: var(--font-mono); font-weight: 600; color: #818cf8;">${item.getPesoTotal()} kg</td>
                  <td style="padding: 12px 10px; text-align: right;">
                    <button class="btn btn-danger btn-remove-item" data-id="${item.idItem}" style="padding: 4px 10px; font-size: 0.8rem;">Remover</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal Adicionar Item -->
      <div id="modal-add-item" class="modal-backdrop hidden">
        <div class="modal-content glass-card">
          <div class="modal-header">
            <h3>🎒 Adicionar Item ao Inventário</h3>
            <button id="btn-close-item-modal" class="btn-icon">✕</button>
          </div>
          <div class="form-group">
            <label for="item-nome">Nome do Item:</label>
            <input type="text" id="item-nome" class="form-control" placeholder="Ex: Armadura de Placas, Poção, Adaga..." />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label for="item-peso">Peso Unitário (kg):</label>
              <input type="number" id="item-peso" class="form-control" step="0.1" min="0" value="1.0" />
            </div>
            <div class="form-group">
              <label for="item-qtd">Quantidade:</label>
              <input type="number" id="item-qtd" class="form-control" min="1" value="1" />
            </div>
          </div>
          <button id="btn-salvar-novo-item" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Adicionar Item</button>
        </div>
      </div>
    `;
  }

  public static renderMagias(personagem: Personagem | null): string {
    if (!personagem) {
      return `<div class="glass-card" style="text-align: center; padding: 40px;"><h3>Selecione um personagem primeiro.</h3></div>`;
    }

    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3>⚡ Gestão de Magias e Habilidades (UC04)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Personagem: <strong>${personagem.nomePersonagem}</strong> (${personagem.classe})</p>
          </div>
          <button id="btn-add-spell-modal" class="btn btn-primary">+ Nova Magia/Habilidade</button>
        </div>

        <div class="grid-2" style="margin-top: 20px;">
          ${personagem.magiasHabilidades.length === 0 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--text-dim);">
              Nenhuma habilidade cadastrada. Clique no botão acima para adicionar magias ou habilidades especiais.
            </div>
          ` : personagem.magiasHabilidades.map(m => `
            <div class="glass-card" style="background: rgba(0,0,0,0.25); border-left: 4px solid var(--primary);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <h4 style="font-size: 1.1rem; color: var(--text-main);">${m.nome}</h4>
                <button class="btn-icon btn-remove-spell" data-id="${m.id}" title="Remover" style="color: #f87171;">✕</button>
              </div>
              <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <span class="badge" style="background: rgba(59,130,246,0.2); color: #60a5fa;">💧 Custo: ${m.custoMana} Mana</span>
                <span class="badge" style="background: rgba(168,85,247,0.2); color: #c084fc;">⏱️ Tempo: ${m.tempoConjuracao}</span>
              </div>
              <p style="font-size: 0.88rem; color: var(--text-muted);">${m.efeito}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Modal Nova Magia -->
      <div id="modal-add-spell" class="modal-backdrop hidden">
        <div class="modal-content glass-card">
          <div class="modal-header">
            <h3>✨ Cadastrar Nova Magia / Habilidade</h3>
            <button id="btn-close-spell-modal" class="btn-icon">✕</button>
          </div>
          <div class="form-group">
            <label for="spell-nome">Nome da Habilidade/Magia:</label>
            <input type="text" id="spell-nome" class="form-control" placeholder="Ex: Raio de Fogo, Fúria Bárbara..." />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label for="spell-mana">Custo em Mana/Pontos:</label>
              <input type="number" id="spell-mana" class="form-control" min="0" value="1" />
            </div>
            <div class="form-group">
              <label for="spell-tempo">Tempo de Conjuração / Ação:</label>
              <input type="text" id="spell-tempo" class="form-control" placeholder="Ex: 1 Ação, Reação, Bônus..." value="1 Ação" />
            </div>
          </div>
          <div class="form-group">
            <label for="spell-efeito">Descrição e Efeito Mecânico:</label>
            <textarea id="spell-efeito" rows="3" class="form-control" placeholder="Descreva o dano, área de efeito ou modificador aplicado..."></textarea>
          </div>
          <button id="btn-salvar-nova-magia" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Cadastrar Habilidade</button>
        </div>
      </div>
    `;
  }

  public static renderRoladorDados(personagem: Personagem | null, historico: ResultadoRolagem[]): string {
    const mods = personagem ? personagem.calcularModificadores() : null;

    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3>🎯 Rolagem de Dados de Alta Fidelidade (UC05)</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Algoritmo Criptográfico <code>crypto.getRandomValues</code> com cálculo automático de modificadores
            </p>
          </div>
        </div>

        <div class="grid-2">
          <!-- Painel de Rolagem de d20 com modificador -->
          <div>
            <h4 style="margin-bottom: 12px; color: #a5b4fc;">Rolagem d20 com Atributo do Personagem Ativo</h4>
            ${personagem ? `
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
                Personagem selecionado: <strong>${personagem.nomePersonagem}</strong>
              </p>
              <div class="grid-3" style="gap: 10px;">
                <button class="btn btn-secondary btn-roll-action" data-attr="Força" data-mod="${mods?.forca}">
                  FOR (${mods && mods.forca >= 0 ? '+' : ''}${mods?.forca})
                </button>
                <button class="btn btn-secondary btn-roll-action" data-attr="Destreza" data-mod="${mods?.destreza}">
                  DES (${mods && mods.destreza >= 0 ? '+' : ''}${mods?.destreza})
                </button>
                <button class="btn btn-secondary btn-roll-action" data-attr="Constituição" data-mod="${mods?.constituicao}">
                  CON (${mods && mods.constituicao >= 0 ? '+' : ''}${mods?.constituicao})
                </button>
                <button class="btn btn-secondary btn-roll-action" data-attr="Inteligência" data-mod="${mods?.inteligencia}">
                  INT (${mods && mods.inteligencia >= 0 ? '+' : ''}${mods?.inteligencia})
                </button>
                <button class="btn btn-secondary btn-roll-action" data-attr="Sabedoria" data-mod="${mods?.sabedoria}">
                  SAB (${mods && mods.sabedoria >= 0 ? '+' : ''}${mods?.sabedoria})
                </button>
                <button class="btn btn-secondary btn-roll-action" data-attr="Carisma" data-mod="${mods?.carisma}">
                  CAR (${mods && mods.carisma >= 0 ? '+' : ''}${mods?.carisma})
                </button>
              </div>
            ` : `
              <p style="color: var(--text-dim); font-size: 0.9rem;">Selecione ou crie um personagem para rolar dados com seus modificadores.</p>
            `}

            <!-- Rolagem Livre de Dados -->
            <h4 style="margin: 24px 0 12px 0; color: #a5b4fc;">Rolagens Rápidas de Dados de Dano / Mestre</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <button class="btn btn-secondary btn-roll-dice" data-sides="4">🎲 d4</button>
              <button class="btn btn-secondary btn-roll-dice" data-sides="6">🎲 d6</button>
              <button class="btn btn-secondary btn-roll-dice" data-sides="8">🎲 d8</button>
              <button class="btn btn-secondary btn-roll-dice" data-sides="10">🎲 d10</button>
              <button class="btn btn-secondary btn-roll-dice" data-sides="12">🎲 d12</button>
              <button class="btn btn-glow btn-roll-dice" data-sides="20">🎲 d20 Puro</button>
              <button class="btn btn-secondary btn-roll-dice" data-sides="100">🎲 d100</button>
            </div>
          </div>

          <!-- Histórico de Rolagens -->
          <div style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="color: #cbd5e1;">📜 Histórico de Rolagens da Sessão</h4>
              <button id="btn-limpar-historico-dados" class="btn btn-secondary" style="font-size: 0.75rem; padding: 2px 8px;">Limpar</button>
            </div>

            <div id="dice-history-list" style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
              ${historico.length === 0 ? `
                <p style="color: var(--text-dim); font-size: 0.85rem; text-align: center; padding: 24px;">Nenhuma rolagem efetuada ainda.</p>
              ` : historico.map(h => `
                <div style="padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; background: ${
                  h.tipoResultado === 'critico' ? 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(0,0,0,0.3))' :
                  h.tipoResultado === 'falha' ? 'linear-gradient(90deg, rgba(239,68,68,0.2), rgba(0,0,0,0.3))' : 'rgba(255,255,255,0.03)'
                }; border-left: 3px solid ${
                  h.tipoResultado === 'critico' ? 'var(--gold)' :
                  h.tipoResultado === 'falha' ? 'var(--danger)' : 'var(--primary)'
                };">
                  <div>
                    <strong>${h.periciaOuAtributo}</strong> ${h.nomePersonagem ? `<span style="color: var(--text-dim);">(${h.nomePersonagem})</span>` : ''}
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${h.detalheCalculo}</div>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; color: ${
                      h.tipoResultado === 'critico' ? 'var(--gold)' :
                      h.tipoResultado === 'falha' ? 'var(--danger)' : 'white'
                    };">${h.total}</span>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">${h.dataHora}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
