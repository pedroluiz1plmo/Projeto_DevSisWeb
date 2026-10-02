import { Personagem } from '../models/Personagem';
import type { SistemaInventarioItem, SistemaPasta } from '../models/SistemaPasta';
import type { ResultadoRolagem } from '../services/DiceService';

export class JogadorView {
  public static renderFichas(_personagens: Personagem[], personagemAtivo: Personagem | null): string {
    if (!personagemAtivo) {
      return `
        <div class="glass-card" style="text-align: center; padding: 48px 24px;">
          <h3>🧙‍♂️ Nenhum personagem selecionado</h3>
          <p style="color: var(--text-muted); margin: 12px 0 20px 0;">Crie seu primeiro herói através do assistente guiado passo a passo.</p>
          <button id="btn-goto-wizard" class="btn btn-primary">✨ Criar meu personagem</button>
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
            <h3>⚡ Atributos e Testes (clique para rolar d20)</h3>
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
              <button id="btn-goto-inventario-full" class="btn btn-secondary" style="font-size: 0.8rem; padding: 4px 10px;">Ver completo</button>
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
              <button id="btn-goto-magias-full" class="btn btn-secondary" style="font-size: 0.8rem; padding: 4px 10px;">Gerenciar</button>
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
          <h3>✨ Criação guiada de personagem</h3>
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
              <input type="text" id="w-nome" class="form-control" placeholder="Ex: Aria Ventobravo" value="" />
            </div>

            <div class="form-group">
              <label for="w-sistema">Sistema de RPG:</label>
              <select id="w-sistema" class="custom-select">
                <option value="D&D 5e">Dungeons & Dragons 5ª Edição</option>
                <option value="Tormenta 20">Tormenta 20</option>
                <option value="Pathfinder 2e">Pathfinder 2ª Edição</option>
                <option value="Custom">Sistema customizado da comunidade</option>
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
              Distribua os atributos entre <strong>8 e 18</strong>.
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
            <h3>🎒 Gerenciamento de Inventário</h3>
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
            <h3>⚡ Gestão de Magias e Habilidades</h3>
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

  public static renderSistemas(itens: SistemaPasta[], pastaAtualId: string | null, fichaEmEdicao: SistemaPasta | null = null): string {
    const pastaAtual = pastaAtualId ? itens.find(item => item.id === pastaAtualId && item.tipo === 'pasta') : undefined;
    const itensVisiveis = itens.filter(item => item.parentId === pastaAtualId);
    const caminho: SistemaPasta[] = [];
    let cursor = pastaAtual;

    while (cursor) {
      caminho.unshift(cursor);
      cursor = cursor.parentId ? itens.find(item => item.id === cursor?.parentId && item.tipo === 'pasta') : undefined;
    }

    const titulo = pastaAtual?.nome || 'Sistemas de RPG';
    const sistema = pastaAtual?.sistema || '';
    const renderItem = (item: SistemaPasta) => `
      <article class="system-drive-item ${item.tipo === 'ficha' ? 'system-sheet-item' : ''}">
        <button class="system-drive-open btn-open-sistema-item" data-id="${item.id}" ${item.tipo === 'ficha' ? 'disabled' : ''}>
          <span class="system-drive-icon">${item.tipo === 'pasta' ? '📁' : '📄'}</span>
          <span class="system-drive-name">${this.escapeHtml(item.nome)}</span>
          <span class="system-drive-description">${this.escapeHtml(item.descricao || 'Sem descrição')}</span>
        </button>
        <div class="system-drive-actions">
          <button class="btn-icon btn-edit-sistema-item" data-id="${item.id}" title="Editar">✏️</button>
          <button class="btn-icon btn-delete-sistema-item" data-id="${item.id}" title="Excluir">🗑️</button>
        </div>
      </article>
    `;

    return `
      <div class="systems-workspace">
        <div class="systems-heading">
          <div>
            <span class="systems-kicker">Biblioteca do jogador</span>
            <h2>🗂️ ${this.escapeHtml(titulo)}</h2>
            <p>${this.escapeHtml(pastaAtual?.descricao || 'Organize fichas por sistema, campanha e personagem.')}</p>
          </div>
          <div class="systems-actions">
            ${pastaAtual ? '<button id="btn-sistema-up" class="btn btn-secondary">← Voltar</button>' : ''}
            <button id="btn-new-sistema-folder" class="btn btn-secondary">📁 Nova pasta</button>
            <button id="btn-new-sistema-sheet" class="btn btn-primary">📄 Nova ficha</button>
          </div>
        </div>

        <nav class="systems-breadcrumb" aria-label="Navegação dos sistemas">
          <button class="btn-breadcrumb btn-open-sistema-item" data-id="">Sistemas</button>
          ${caminho.map(item => `<span>/</span><button class="btn-breadcrumb btn-open-sistema-item" data-id="${item.id}">${this.escapeHtml(item.nome)}</button>`).join('')}
        </nav>

        ${pastaAtual && sistema ? `<div class="system-context"><strong>${this.escapeHtml(sistema)}</strong><span>Crie subpastas para campanhas, mesas ou personagens.</span></div>` : ''}

        ${fichaEmEdicao ? this.renderFichaEditor(fichaEmEdicao, itens) : ''}

        <div class="systems-drive-grid ${fichaEmEdicao ? 'hidden' : ''}">
          ${itensVisiveis.length === 0 ? '<div class="systems-empty"><span>📂</span><strong>Esta pasta está vazia</strong><p>Crie uma pasta ou ficha para começar a organizar este sistema.</p></div>' : itensVisiveis.map(renderItem).join('')}
        </div>
      </div>

      <div id="modal-sistema-item" class="modal-backdrop hidden">
        <div class="modal-content glass-card">
          <div class="modal-header">
            <h3 id="modal-sistema-title">Novo item</h3>
            <button id="btn-close-sistema-modal" class="btn-icon">✕</button>
          </div>
          <form id="form-sistema-item">
            <input type="hidden" id="sistema-item-id" />
            <input type="hidden" id="sistema-item-type" />
            <div class="form-group">
              <label for="sistema-item-name">Nome:</label>
              <input id="sistema-item-name" class="form-control" required maxlength="80" placeholder="Ex: Campanha principal" />
            </div>
            <div class="form-group">
              <label for="sistema-item-description">Descrição:</label>
              <textarea id="sistema-item-description" class="form-control" rows="3" maxlength="240" placeholder="Adicione uma descrição curta"></textarea>
            </div>
            <div id="sistema-folder-destination-group" class="form-group">
              <label for="sistema-folder-destination">Salvar pasta em:</label>
              <select id="sistema-folder-destination" class="custom-select"></select>
              <small class="field-help">Escolha a pasta-pai. A pasta poderá ser movida novamente depois.</small>
            </div>
            <button id="btn-salvar-pasta" type="submit" class="btn btn-primary" style="width: 100%;">Criar pasta</button>
          </form>
        </div>
      </div>
    `;
  }

  public static renderSeletorFicha(): string {
    return `
      <section class="sheet-editor sheet-system-picker">
        <div class="sheet-editor-header">
          <div><span class="systems-kicker">Nova ficha</span><h3>Escolha o sistema</h3><p>Selecione o modelo que será usado para montar sua ficha.</p></div>
          <button type="button" id="btn-cancel-ficha-inline" class="btn btn-secondary">Cancelar</button>
        </div>
        <div class="guided-entry">
          <div><strong>🧭 Quer ajuda para começar?</strong><span>Use a criação guiada para responder perguntas simples antes de abrir a ficha completa.</span></div>
          <button type="button" id="btn-open-ficha-guided" class="btn btn-secondary">🧭 Criar ficha guiada</button>
        </div>
        <p class="system-form-intro">Ou escolha um sistema para preencher a ficha completa:</p>
        <div class="system-options system-options-inline">
          <button type="button" class="system-option btn-select-sistema-inline" data-sistema="Call of Cthulhu"><span>🕯️</span><strong>Call of Cthulhu</strong><small>Investigação e horror cósmico</small></button>
          <button type="button" class="system-option btn-select-sistema-inline" data-sistema="Vampiro: A Máscara"><span>🩸</span><strong>Vampiro: A Máscara</strong><small>Criação de personagem</small></button>
          <button type="button" class="system-option btn-select-sistema-inline" data-sistema="D&D"><span>🐉</span><strong>D&D 5e</strong><small>Criação de personagem</small></button>
        </div>
      </section>
    `;
  }

  public static renderFichaGuiada(itens: SistemaPasta[], pastaAtualId: string | null): string {
    const pastas = itens.filter(item => item.tipo === 'pasta');
    const caminho = (pasta: SistemaPasta): string => {
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

    return `
      <form id="form-ficha-guided" class="sheet-editor guided-builder">
        <div class="sheet-editor-header">
          <div><span class="systems-kicker">Criação guiada</span><h3>🧭 Vamos criar sua ficha</h3><p>Responda às perguntas com suas próprias ideias. Você poderá completar os detalhes depois.</p></div>
          <div class="systems-actions"><button type="button" id="btn-cancel-ficha-guided" class="btn btn-secondary">Cancelar</button><button type="submit" class="btn btn-primary">Continuar para ficha</button></div>
        </div>
        <div class="sheet-editor-section"><h4>1. Escolha o sistema</h4><div class="form-group"><label for="guided-system">Sistema da ficha:</label><select id="guided-system" class="custom-select" required><option value="Call of Cthulhu">🕯️ Call of Cthulhu</option><option value="Vampiro: A Máscara">🩸 Vampiro: A Máscara</option><option value="D&D">🐉 D&D 5e</option></select></div></div>
        <div id="guided-template-coc" class="guided-template"><div class="sheet-editor-section"><h4>2. Quem é seu investigador?</h4><p class="guided-question">Escolha um nome, uma ocupação e a idade que combinam com alguém que se envolve com o inexplicável.</p><div class="grid-2"><div class="form-group"><label for="guided-coc-name">Nome do investigador:</label><input id="guided-coc-name" class="form-control" placeholder="Ex: Helena Duarte" /></div><div class="form-group"><label for="guided-coc-occupation">Ocupação:</label><input id="guided-coc-occupation" class="form-control" placeholder="Ex: Jornalista" /></div><div class="form-group"><label for="guided-coc-age">Idade:</label><input id="guided-coc-age" class="form-control" placeholder="Ex: 32" /></div><div class="form-group"><label for="guided-coc-concept">Conceito:</label><input id="guided-coc-concept" class="form-control" placeholder="Ex: Repórter obcecada por mistérios" /></div></div></div><div class="sheet-editor-section"><div class="sheet-section-heading"><div><h4>3. Atributos do investigador</h4><p class="attribute-rule-hint">3d6 × 5; TAM e INT usam 2d6+6 × 5.</p></div><button type="button" id="btn-guided-roll-coc" class="btn btn-secondary">🎲 Rolar atributos</button></div><div class="grid-3 coc-attribute-grid">${['str:FOR','con:CON','siz:TAM','dex:DES','app:APA','int:INT','pow:POD','edu:EDU','luck:Sorte'].map(item => { const [id, label] = item.split(':'); return `<div class="form-group"><label for="guided-coc-${id}">${label}</label><input id="guided-coc-${id}" class="form-control" type="number" min="0" max="100" /></div>`; }).join('')}</div></div><div class="sheet-editor-section"><h4>4. O que trouxe você ao horror?</h4><p class="guided-question">Conte o objetivo e o acontecimento que iniciou sua investigação.</p><div class="form-group"><label for="guided-coc-goal">Objetivo:</label><input id="guided-coc-goal" class="form-control" /></div><div class="form-group"><label for="guided-coc-background">História inicial:</label><textarea id="guided-coc-background" class="form-control" rows="4"></textarea></div></div></div>
        <div id="guided-template-dnd" class="guided-template hidden"><div class="sheet-editor-section"><h4>2. Quem é seu aventureiro?</h4><p class="guided-question">Escolha um nome, uma raça, uma classe e um nível para imaginar seu papel no grupo.</p><div class="grid-2"><div class="form-group"><label for="guided-dnd-name">Nome do personagem:</label><input id="guided-dnd-name" class="form-control" placeholder="Ex: Kael" /></div><div class="form-group"><label for="guided-dnd-class">Classe:</label><input id="guided-dnd-class" class="form-control" placeholder="Ex: Guerreiro" /></div><div class="form-group"><label for="guided-dnd-race">Raça:</label><input id="guided-dnd-race" class="form-control" placeholder="Ex: Humano" /></div><div class="form-group"><label for="guided-dnd-level">Nível:</label><input id="guided-dnd-level" class="form-control" placeholder="Ex: 1" /></div><div class="form-group"><label for="guided-dnd-background">Antecedente:</label><input id="guided-dnd-background" class="form-control" placeholder="Ex: Soldado" /></div><div class="form-group"><label for="guided-dnd-concept">Conceito:</label><input id="guided-dnd-concept" class="form-control" placeholder="Ex: Protetor do vilarejo" /></div></div></div><div class="sheet-editor-section"><div class="sheet-section-heading"><div><h4>3. Atributos do aventureiro</h4><p class="attribute-rule-hint">4d6, descartando o menor dado.</p></div><button type="button" id="btn-guided-roll-dnd" class="btn btn-secondary">🎲 Rolar atributos</button></div><div class="grid-3 coc-attribute-grid">${['str:FOR','dex:DES','con:CON','int:INT','wis:SAB','cha:CAR'].map(item => { const [id, label] = item.split(':'); return `<div class="form-group"><label for="guided-dnd-${id}">${label}</label><input id="guided-dnd-${id}" class="form-control" type="number" min="1" max="30" /></div>`; }).join('')}</div></div><div class="sheet-editor-section"><h4>4. O que move sua aventura?</h4><p class="guided-question">Escolha um objetivo e escreva um pouco da sua origem.</p><div class="form-group"><label for="guided-dnd-goal">Objetivo:</label><input id="guided-dnd-goal" class="form-control" /></div><div class="form-group"><label for="guided-dnd-story">História inicial:</label><textarea id="guided-dnd-story" class="form-control" rows="4"></textarea></div></div></div>
        <div id="guided-template-vampire" class="guided-template hidden"><div class="sheet-editor-section"><h4>2. Quem você se tornou?</h4><p class="guided-question">Defina o nome, conceito, clã e geração que moldam sua existência na noite.</p><div class="grid-2"><div class="form-group"><label for="guided-vampire-name">Nome do personagem:</label><input id="guided-vampire-name" class="form-control" placeholder="Ex: Bianca" /></div><div class="form-group"><label for="guided-vampire-concept">Conceito:</label><input id="guided-vampire-concept" class="form-control" placeholder="Ex: Herdeira exilada" /></div><div class="form-group"><label for="guided-vampire-clan">Clã:</label><input id="guided-vampire-clan" class="form-control" placeholder="Ex: Toreador" /></div><div class="form-group"><label for="guided-vampire-generation">Geração:</label><input id="guided-vampire-generation" class="form-control" placeholder="Ex: 12ª" /></div><div class="form-group"><label for="guided-vampire-predator">Tipo de predador:</label><input id="guided-vampire-predator" class="form-control" /></div></div></div><div class="sheet-editor-section"><div class="sheet-section-heading"><div><h4>3. Atributos da criatura</h4><p class="attribute-rule-hint">Distribuição V5: 7/5/3 pontos sobre atributos iniciados em 1.</p></div><button type="button" id="btn-guided-roll-vampire" class="btn btn-secondary">🎲 Distribuir atributos</button></div><div class="grid-3 coc-attribute-grid">${['strength:Força','dexterity:Destreza','stamina:Vigor','charisma:Carisma','manipulation:Manipulação','composure:Compostura','intelligence:Inteligência','wits:Raciocínio','resolve:Determinação'].map(item => { const [id, label] = item.split(':'); return `<div class="form-group"><label for="guided-vampire-${id}">${label}</label><input id="guided-vampire-${id}" class="form-control" type="number" min="1" max="5" /></div>`; }).join('')}</div></div><div class="sheet-editor-section"><h4>4. O que ainda importa?</h4><p class="guided-question">Escolha uma ambição e conte a história que trouxe você até esta crônica.</p><div class="form-group"><label for="guided-vampire-goal">Ambição:</label><input id="guided-vampire-goal" class="form-control" /></div><div class="form-group"><label for="guided-vampire-story">História inicial:</label><textarea id="guided-vampire-story" class="form-control" rows="4"></textarea></div></div></div>
        <div class="sheet-editor-section"><h4>4. Onde guardar?</h4><div class="form-group"><label for="guided-destination">Salvar ficha em:</label><select id="guided-destination" class="custom-select">${pastas.map(pasta => `<option value="${pasta.id}" ${pasta.id === pastaAtualId ? 'selected' : ''}>📁 ${this.escapeHtml(caminho(pasta))}</option>`).join('')}</select></div></div>
      </form>
    `;
  }

  private static renderFichaEditor(ficha: SistemaPasta, itens: SistemaPasta[]): string {
    const dados = ficha.dados || {};
    const pastas = itens.filter(item => item.tipo === 'pasta');
    const pastaCaminho = (pasta: SistemaPasta): string => {
      const caminho: string[] = [pasta.nome];
      let parentId = pasta.parentId;
      while (parentId) {
        const parent = itens.find(item => item.id === parentId && item.tipo === 'pasta');
        if (!parent) break;
        caminho.unshift(parent.nome);
        parentId = parent.parentId;
      }
      return caminho.join(' / ');
    };
    const savedValue = (id: string): string => {
      if (dados[id] !== undefined) return dados[id]?.toString() || '';
      const normalizedId = id.replace(/^inline-/, '');
      if (dados[normalizedId] !== undefined) return dados[normalizedId]?.toString() || '';
      const savedKey = Object.keys(dados).find(key => key.endsWith(`-${normalizedId}`));
      return savedKey ? dados[savedKey]?.toString() || '' : '';
    };
    const field = (id: string, label: string, type = 'text', placeholder = '') => `
      <div class="form-group"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="${type}" value="${this.escapeHtml(savedValue(id))}" placeholder="${placeholder}" /></div>
    `;
    const area = (id: string, label: string, rows: number) => `
      <div class="form-group"><label for="${id}">${label}</label><textarea id="${id}" class="form-control" rows="${rows}">${this.escapeHtml(savedValue(id))}</textarea></div>
    `;
    const sistema = ficha.sistema;
    const sistemaConfig = sistema === 'D&D'
      ? { icone: '🐉', titulo: 'D&D 5e' }
      : sistema === 'Vampiro: A Máscara'
        ? { icone: '🩸', titulo: 'Vampiro: A Máscara' }
        : { icone: '🕯️', titulo: 'Call of Cthulhu' };
    let conteudo = '';
    if (sistema === 'D&D') {
      conteudo = `
        <nav class="coc-sheet-tabs dnd-sheet-tabs" aria-label="Seções da ficha de D&D 5e"><button type="button" class="coc-sheet-tab active" data-coc-tab="principal">Principal</button><button type="button" class="coc-sheet-tab" data-coc-tab="equipamento">Equipamento</button><button type="button" class="coc-sheet-tab" data-coc-tab="magias">Magias</button><button type="button" class="coc-sheet-tab" data-coc-tab="detalhes">Detalhes</button></nav>
        <div class="sheet-editor-section coc-sheet-panel active" data-coc-panel="principal"><h4>Identidade</h4><div class="grid-2">
          ${field('inline-ficha-name', 'Nome do personagem', 'text', 'Nome usado na ficha')}${field('inline-dnd-player', 'Nome do jogador')}${field('inline-dnd-class', 'Classe')}${field('inline-dnd-level', 'Nível', 'number')}${field('inline-dnd-race', 'Raça')}${field('inline-dnd-background', 'Antecedente')}${field('inline-dnd-alignment', 'Alinhamento')}${field('inline-dnd-xp', 'Pontos de experiência', 'number')}${area('inline-ficha-description', 'Descrição e conceito', 2)}
        </div><div class="sheet-section-heading"><div><h4>Atributos e modificadores</h4><p class="attribute-rule-hint">Distribuição automática: 4d6, descartando o menor dado.</p></div><button type="button" id="btn-roll-dnd-attributes" class="btn btn-secondary">🎲 Rolar atributos</button></div><div class="grid-3 coc-attribute-grid">
          ${field('inline-dnd-str', 'FOR', 'number')}${field('inline-dnd-dex', 'DES', 'number')}${field('inline-dnd-con', 'CON', 'number')}${field('inline-dnd-int', 'INT', 'number')}${field('inline-dnd-wis', 'SAB', 'number')}${field('inline-dnd-cha', 'CAR', 'number')}
        </div><h4>Combate</h4><div class="grid-3">
          ${field('inline-dnd-ac', 'Classe de armadura', 'number')}${field('inline-dnd-initiative', 'Iniciativa')}${field('inline-dnd-speed', 'Deslocamento')}${field('inline-dnd-hp', 'Pontos de vida máximos', 'number')}${field('inline-dnd-current-hp', 'Pontos de vida atuais', 'number')}${field('inline-dnd-temp-hp', 'PV temporários', 'number')}${field('inline-dnd-hit-dice', 'Dados de vida')}${field('inline-dnd-proficiency', 'Bônus de proficiência')}
        </div></div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="equipamento"><h4>Equipamento</h4>${area('inline-dnd-equipment', 'Equipamentos e tesouros', 7)}${area('inline-dnd-attacks', 'Armas e ataques', 5)}</div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="magias"><h4>Magias</h4>${area('inline-dnd-spells', 'Lista de magias e espaços', 8)}${area('inline-dnd-attacks', 'Ataques e conjuração', 4)}</div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="detalhes"><h4>Detalhes</h4>${area('inline-dnd-skills', 'Perícias e salvaguardas', 4)}${area('inline-dnd-personality', 'Traços de personalidade, ideais, vínculos e defeitos', 4)}${area('inline-dnd-backstory', 'História, aliados e organizações', 5)}</div>
      `;
    } else if (sistema === 'Vampiro: A Máscara') {
      conteudo = `
        <nav class="coc-sheet-tabs vampire-sheet-tabs" aria-label="Seções da ficha de Vampiro: A Máscara"><button type="button" class="coc-sheet-tab active" data-coc-tab="ficha">Ficha</button><button type="button" class="coc-sheet-tab" data-coc-tab="habilidade">Habilidade</button><button type="button" class="coc-sheet-tab" data-coc-tab="historia">História</button></nav>
        <div class="sheet-editor-section coc-sheet-panel active" data-coc-panel="ficha"><h4>Identidade e crônica</h4><div class="grid-2">
          ${field('inline-ficha-name', 'Nome do personagem', 'text', 'Nome usado na ficha')}${field('inline-vampire-player', 'Jogador')}${field('inline-vampire-chronicle', 'Crônica')}${field('inline-vampire-concept', 'Conceito')}${field('inline-vampire-clan', 'Clã')}${field('inline-vampire-generation', 'Geração')}${field('inline-vampire-sire', 'Senhor')}${field('inline-vampire-predator', 'Tipo de predador')}${field('inline-vampire-ambition', 'Ambição')}${field('inline-vampire-desire', 'Desejo')}${area('inline-ficha-description', 'Descrição do personagem', 2)}
        </div><div class="sheet-section-heading"><div><h4>Atributos</h4><p class="attribute-rule-hint">Distribuição V5: atributos começam em 1 e recebem 7/5/3 pontos.</p></div><button type="button" id="btn-roll-vampire-attributes" class="btn btn-secondary">🎲 Distribuir atributos</button></div><div class="grid-3 coc-attribute-grid">
          ${field('inline-vampire-strength', 'Força', 'number')}${field('inline-vampire-dexterity', 'Destreza', 'number')}${field('inline-vampire-stamina', 'Vigor', 'number')}${field('inline-vampire-charisma', 'Carisma', 'number')}${field('inline-vampire-manipulation', 'Manipulação', 'number')}${field('inline-vampire-composure', 'Compostura', 'number')}${field('inline-vampire-intelligence', 'Inteligência', 'number')}${field('inline-vampire-wits', 'Raciocínio', 'number')}${field('inline-vampire-resolve', 'Determinação', 'number')}
        </div><h4>Recursos e estado</h4><div class="grid-3">
          ${field('inline-vampire-health', 'Saúde', 'number')}${field('inline-vampire-willpower', 'Força de vontade', 'number')}${field('inline-vampire-humanity', 'Humanidade', 'number')}${field('inline-vampire-hunger', 'Fome', 'number')}${field('inline-vampire-stains', 'Manchas', 'number')}${field('inline-vampire-blood-potency', 'Potência de sangue', 'number')}
        </div></div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="habilidade"><h4>Habilidades</h4>${area('inline-vampire-abilities', 'Perícias e habilidades', 4)}${area('inline-vampire-disciplines', 'Disciplinas', 4)}${area('inline-vampire-advantages', 'Vantagens e defeitos', 4)}</div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="historia"><h4>História</h4>${area('inline-vampire-touchstones', 'Âncoras e convicções', 4)}${area('inline-vampire-backstory', 'História e anotações da crônica', 6)}</div>
      `;
    } else {
      conteudo = `
        <div class="sheet-editor-section"><h4>Identidade do investigador</h4><div class="grid-2">
          ${field('inline-ficha-name', 'Nome do investigador', 'text', 'Nome usado na ficha')}${field('inline-coc-player', 'Jogador')}${field('inline-coc-occupation', 'Ocupação', 'text', 'Ex: Jornalista')}${field('inline-coc-age', 'Idade', 'number')}${field('inline-coc-sex', 'Sexo')}${field('inline-coc-residence', 'Residência')}${field('inline-coc-birthplace', 'Local de nascimento')}${area('inline-ficha-description', 'Descrição da ficha', 2)}
        </div></div>
        <nav class="coc-sheet-tabs" aria-label="Seções da ficha de Call of Cthulhu"><button type="button" class="coc-sheet-tab active" data-coc-tab="caracteristicas">Características</button><button type="button" class="coc-sheet-tab" data-coc-tab="pericias">Perícias</button><button type="button" class="coc-sheet-tab" data-coc-tab="combate">Combate</button><button type="button" class="coc-sheet-tab" data-coc-tab="historico">Histórico</button><button type="button" class="coc-sheet-tab" data-coc-tab="posses">Posses</button></nav>
        <div class="sheet-editor-section coc-sheet-panel active" data-coc-panel="caracteristicas"><div class="sheet-section-heading"><div><h4>Características</h4><p class="attribute-rule-hint">Rolagem automática: características em 3d6 × 5 e atributos especiais em 2d6+6 × 5.</p></div><button type="button" id="btn-roll-coc-attributes" class="btn btn-secondary">🎲 Rolar atributos</button></div><div class="grid-3 coc-attribute-grid">
          ${field('inline-coc-str', 'FOR', 'number')}${field('inline-coc-con', 'CON', 'number')}${field('inline-coc-siz', 'TAM', 'number')}${field('inline-coc-dex', 'DES', 'number')}${field('inline-coc-app', 'APA', 'number')}${field('inline-coc-int', 'INT', 'number')}${field('inline-coc-pow', 'POD', 'number')}${field('inline-coc-edu', 'EDU', 'number')}${field('inline-coc-luck', 'Sorte', 'number')}
        </div></div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="combate"><h4>Combate</h4><div class="grid-3">
          ${field('inline-coc-hp', 'Pontos de vida', 'number')}${field('inline-coc-sanity', 'SAN', 'number')}${field('inline-coc-mp', 'Pontos de magia', 'number')}${field('inline-coc-move', 'Movimento')}${field('inline-coc-build', 'Construção')}${field('inline-coc-damage', 'Bônus de dano')}
        </div></div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="pericias"><h4>Perícias</h4>${area('inline-coc-skills', 'Perícias e valores', 6)}</div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="historico"><h4>Histórico</h4>${area('inline-coc-backstory', 'Antecedentes, aliados e anotações', 7)}</div>
        <div class="sheet-editor-section coc-sheet-panel" data-coc-panel="posses"><h4>Posses</h4>${area('inline-coc-equipment', 'Equipamentos, armas e objetos importantes', 6)}${area('inline-coc-finances', 'Dinheiro e recursos', 3)}</div>
      `;
    }

    return `
      <form id="form-ficha-inline" class="sheet-editor">
        <div class="sheet-editor-header">
          <div><span class="systems-kicker">Ficha original do sistema</span><h3>${sistemaConfig.icone} ${sistemaConfig.titulo}</h3></div>
          <div class="sheet-save-actions">
            <div class="sheet-destination-control"><label for="inline-ficha-destination">Salvar ficha em:</label><select id="inline-ficha-destination" class="custom-select" required>${pastas.map(pasta => `<option value="${pasta.id}" ${pasta.id === ficha.parentId ? 'selected' : ''}>📁 ${this.escapeHtml(pastaCaminho(pasta))}</option>`).join('')}</select></div>
            <button type="button" id="btn-cancel-ficha-inline" class="btn btn-secondary">Cancelar</button><button type="submit" class="btn btn-primary">💾 Salvar ficha</button>
          </div>
        </div>
        ${conteudo}
      </form>
    `;
  }

  public static renderRoladorDados(personagem: Personagem | null, fichas: SistemaPasta[], fichaSelecionadaId: string | null, historico: ResultadoRolagem[]): string {
    const fichaSistema = fichaSelecionadaId ? fichas.find(ficha => ficha.id === fichaSelecionadaId) || null : null;
    const nomeFicha = fichaSistema?.nome || personagem?.nomePersonagem || '';
    const sistema = fichaSistema?.sistema || (personagem ? 'D&D' : '');
    const dados = fichaSistema?.dados || {};
    const atributos = sistema === 'D&D'
      ? [['FOR', 'str'], ['DES', 'dex'], ['CON', 'con'], ['INT', 'int'], ['SAB', 'wis'], ['CAR', 'cha']]
      : sistema === 'Vampiro: A Máscara'
        ? [['Força', 'strength'], ['Destreza', 'dexterity'], ['Vigor', 'stamina'], ['Carisma', 'charisma'], ['Manipulação', 'manipulation'], ['Compostura', 'composure'], ['Inteligência', 'intelligence'], ['Raciocínio', 'wits'], ['Determinação', 'resolve']]
        : [['FOR', 'str'], ['CON', 'con'], ['TAM', 'siz'], ['DES', 'dex'], ['APA', 'app'], ['INT', 'int'], ['POD', 'pow'], ['EDU', 'edu'], ['Sorte', 'luck']];
    const valorDoAtributo = (chave: string): number => {
      if (fichaSistema) {
        const prefixo = sistema === 'D&D' ? 'dnd' : sistema === 'Vampiro: A Máscara' ? 'vampire' : 'coc';
        return Number(
          dados[`${prefixo}-${chave}`] ||
          dados[`inline-${prefixo}-${chave}`] ||
          dados[`guided-${prefixo}-${chave}`] ||
          dados[chave] ||
          0
        );
      }
      const valores = { str: personagem?.atributos.forca, dex: personagem?.atributos.destreza, con: personagem?.atributos.constituicao, int: personagem?.atributos.inteligencia, wis: personagem?.atributos.sabedoria, cha: personagem?.atributos.carisma } as Record<string, number | undefined>;
      return valores[chave] || 0;
    };
    const botoesAtributos = atributos.map(([label, chave]) => {
      const valor = valorDoAtributo(chave);
      const modificador = sistema === 'D&D' || !fichaSistema ? Math.floor((valor - 10) / 2) : valor;
      const exibicao = sistema === 'D&D' || !fichaSistema ? `${modificador >= 0 ? '+' : ''}${modificador}` : `${valor}`;
      return `<button class="btn btn-secondary btn-roll-action" data-attr="${label}" data-value="${valor}" data-system="${sistema}">${label} (${exibicao})</button>`;
    }).join('');

    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3>🎯 Rolagem de Dados</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Algoritmo Criptográfico <code>crypto.getRandomValues</code> com cálculo automático de modificadores
            </p>
          </div>
        </div>

        <div class="grid-2">
          <!-- Painel de Rolagem de d20 com modificador -->
          <div>
            <h4 style="margin-bottom: 12px; color: #a5b4fc;">Escolha a ficha</h4>
            <select id="dice-sheet-select" class="custom-select" style="margin-bottom: 14px;">
              ${personagem ? `<option value="legacy">${personagem.nomePersonagem} (D&D)</option>` : ''}
              ${fichas.map(ficha => `<option value="${ficha.id}" ${ficha.id === fichaSelecionadaId ? 'selected' : ''}>${ficha.nome} (${ficha.sistema})</option>`).join('')}
            </select>
            ${nomeFicha ? `
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
                Ficha selecionada: <strong>${nomeFicha}</strong> <span class="badge">${sistema || 'Sem sistema'}</span>
              </p>
              <div class="grid-3" style="gap: 10px;">
                ${botoesAtributos}
              </div>
            ` : `
              <p style="color: var(--text-dim); font-size: 0.9rem;">Crie uma ficha para habilitar as rolagens pelos atributos do sistema.</p>
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

  public static renderInventarioSistemas(fichas: SistemaPasta[], fichaSelecionadaId: string | null): string {
    const ficha = fichas.find(item => item.id === fichaSelecionadaId) || fichas[0] || null;
    const itens: SistemaInventarioItem[] = ficha?.inventario || [];
    const pesoTotal = itens.reduce((total, item) => total + item.peso * item.quantidade, 0);

    return `
      <div class="systems-workspace inventory-workspace">
        <div class="systems-heading"><div><span class="systems-kicker">Inventário das fichas</span><h2>🎒 Inventário</h2><p>Escolha uma ficha criada nos Sistemas para consultar e organizar seus itens.</p></div></div>
        ${fichas.length === 0 ? '<div class="systems-empty"><span>📄</span><strong>Nenhuma ficha criada</strong><p>Crie uma ficha em Sistemas para habilitar seu inventário.</p></div>' : `
          <div class="inventory-sheet-selector"><label for="inventory-sheet-select">Escolha a ficha:</label><select id="inventory-sheet-select" class="custom-select">${fichas.map(item => `<option value="${item.id}" ${item.id === ficha?.id ? 'selected' : ''}>${this.escapeHtml(item.nome)} (${this.escapeHtml(item.sistema)})</option>`).join('')}</select></div>
          <div class="system-context"><strong>${this.escapeHtml(ficha?.nome || '')}</strong><span>${this.escapeHtml(ficha?.sistema || '')} • Peso total: ${pesoTotal.toFixed(2)} kg</span></div>
          <div class="glass-card"><div class="glass-card-header"><div><h3>Itens carregados</h3><p style="font-size: 0.85rem; color: var(--text-muted);">Os itens ficam salvos dentro da ficha selecionada.</p></div></div>
            <div class="systems-drive-grid inventory-item-grid">${itens.length === 0 ? '<div class="systems-empty"><span>🧺</span><strong>Inventário vazio</strong><p>Adicione o primeiro item abaixo.</p></div>' : itens.map(item => `<article class="inventory-item-card"><div><strong>${this.escapeHtml(item.nome)}</strong><span>${item.quantidade}x • ${(item.peso * item.quantidade).toFixed(2)} kg</span>${item.descricao ? `<small>${this.escapeHtml(item.descricao)}</small>` : ''}</div><button class="btn btn-danger btn-remove-system-item" data-id="${item.id}">Remover</button></article>`).join('')}</div>
          </div>
          <form id="form-add-system-item" class="glass-card inventory-add-form"><div class="glass-card-header"><h3>Adicionar item</h3></div><div class="grid-3"><div class="form-group"><label for="system-item-name">Nome:</label><input id="system-item-name" class="form-control" required placeholder="Ex: Lanterna" /></div><div class="form-group"><label for="system-item-quantity">Quantidade:</label><input id="system-item-quantity" class="form-control" type="number" min="1" value="1" /></div><div class="form-group"><label for="system-item-weight">Peso unitário (kg):</label><input id="system-item-weight" class="form-control" type="number" min="0" step="0.01" value="0" /></div></div><div class="form-group"><label for="system-item-description">Descrição:</label><input id="system-item-description" class="form-control" placeholder="Opcional" /></div><button type="submit" class="btn btn-primary">Adicionar ao inventário</button></form>
        `}
      </div>
    `;
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
