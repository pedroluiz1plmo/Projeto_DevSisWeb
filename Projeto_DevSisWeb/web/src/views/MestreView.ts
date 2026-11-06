import { Campanha } from '../models/Campanha';
import { NPC } from '../models/NPC';
import { Personagem } from '../models/Personagem';
import { Mestre } from '../models/Mestre';
import type { MonstroPasta } from '../models/MonstroPasta';
import type { SistemaPasta } from '../models/SistemaPasta';
import type { ApiCampaignCharacter, ApiCampaignMember } from '../shared/types/campaignApi';

export class MestreView {
  public static renderCampanhas(
    campanhas: Campanha[],
    personagens: Personagem[],
    _npcs: NPC[],
    fichas: SistemaPasta[] = [],
    monstros: MonstroPasta[] = [],
    openCampaignIds: Set<string> = new Set(),
    campaignMembers: Record<string, ApiCampaignMember[]> = {},
    campaignCharacters: Record<string, ApiCampaignCharacter[]> = {},
    remoteAvailable = false,
    authenticatedUserId = ''
  ): string {
    const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] || character);

    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3 style="color: var(--gm-accent);">📜 Gestão de Campanhas e Lore</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Organização dos grupos de jogadores, lore e repositório de aventuras</p>
          </div>
          <button id="btn-add-campanha-modal" class="btn btn-glow">+ Nova Campanha</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 20px;">
          ${campanhas.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">
              Nenhuma campanha criada ainda. Inicie sua primeira mesa clicando no botão acima!
            </div>
          ` : campanhas.map(c => `
            <div class="glass-card" style="background: rgba(0,0,0,0.3); border-left: 4px solid var(--gold);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                  <h4 style="font-family: var(--font-title); font-size: 1.3rem; color: #fde047;">${escape(c.nomeCampanha)}</h4>
                  <span style="font-size: 0.75rem; color: var(--text-dim);">Criada em: ${c.dataCriacao}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                  ${!c.backendId || c.ownerId === String(authenticatedUserId) ? `
                    <button class="btn btn-secondary btn-edit-campanha" data-id="${escape(c.idCampanha)}" style="padding: 4px 10px; font-size: 0.8rem;">Editar</button>
                    <button class="btn btn-danger btn-remove-campanha" data-id="${escape(c.idCampanha)}" style="padding: 4px 10px; font-size: 0.8rem;">Excluir</button>
                  ` : ''}
                </div>
              </div>

              <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <h5 style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 4px;">Lore & Resumo do Enredo:</h5>
                <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6;">${escape(c.lore)}</p>
              </div>

              <div class="grid-2">
                <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: var(--radius-sm);">
                  <strong style="font-size: 0.85rem; color: #a7f3d0;">🗂️ Fichas de Sistemas (${c.fichas.length})</strong>
                  <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; margin-top: 8px;">
                    ${c.fichas.length === 0 ? '<li style="color: var(--text-dim);">Nenhuma ficha vinculada.</li>' : c.fichas.map(f => `<li style="padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; display: flex; justify-content: space-between;"><span>${f.nome}</span><span style="color: var(--text-muted);">${f.sistema}</span></li>`).join('')}
                  </ul>
                </div>

                <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: var(--radius-sm);">
                  <strong style="font-size: 0.85rem; color: #fda4af;">🐲 Fichas de Monstros (${c.monstros.length})</strong>
                  <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; margin-top: 8px;">
                    ${c.monstros.length === 0 ? '<li style="color: var(--text-dim);">Nenhum monstro vinculado.</li>' : c.monstros.map(m => `<li style="padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; display: flex; justify-content: space-between;"><span>${m.nome}</span><span style="color: var(--text-muted);">${m.sistema}</span></li>`).join('')}
                  </ul>
                </div>
              </div>
              ${c.backendId ? `
                <div style="margin-top: 16px;">
                  <button class="btn btn-secondary btn-toggle-campaign-details" data-id="${escape(c.idCampanha)}">
                    ${openCampaignIds.has(c.idCampanha) ? 'Ocultar membros e personagens' : 'Membros e personagens'}
                  </button>
                  ${openCampaignIds.has(c.idCampanha) ? `
                    <div class="grid-2" style="margin-top: 12px;">
                      <section class="glass-card" style="padding: 14px;">
                        <h5>Membros (${(campaignMembers[c.backendId] || []).length})</h5>
                        <ul style="list-style: none; padding: 8px 0; display: flex; flex-direction: column; gap: 8px;">
                          ${(campaignMembers[c.backendId] || []).map(member => `
                            <li style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                              <span>${escape(member.name || member.username || `Usuário ${member.userId}`)} — ${escape(member.role)}</span>
                              ${String(member.userId) !== c.ownerId && c.ownerId === String(authenticatedUserId) ? `
                                <input class="form-control campaign-member-role" data-campaign-id="${escape(c.backendId || '')}" data-user-id="${escape(member.userId)}" value="${escape(member.role)}" maxlength="30" aria-label="Papel do membro" style="max-width: 140px;" />
                                <button class="btn btn-secondary btn-save-campaign-role" data-campaign-id="${escape(c.backendId || '')}" data-user-id="${escape(member.userId)}">Salvar papel</button>
                                <button class="btn btn-danger btn-remove-campaign-member" data-campaign-id="${escape(c.backendId || '')}" data-user-id="${escape(member.userId)}">Remover</button>
                              ` : String(member.userId) === c.ownerId ? '<span class="badge">Proprietário</span>' : ''}
                            </li>
                          `).join('')}
                        </ul>
                        ${c.ownerId === String(authenticatedUserId) ? `
                          <form class="form-campaign-add-member" data-campaign-id="${escape(c.backendId)}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                            <input class="form-control" name="userId" type="number" min="1" step="1" placeholder="ID do usuário" aria-label="ID do usuário" required style="max-width: 150px;" />
                            <input class="form-control" name="role" value="player" maxlength="30" aria-label="Papel do membro" required style="max-width: 150px;" />
                            <button class="btn btn-primary" type="submit">Adicionar membro</button>
                          </form>
                        ` : ''}
                      </section>
                      <section class="glass-card" style="padding: 14px;">
                        <h5>Personagens (${(campaignCharacters[c.backendId] || []).length})</h5>
                        <ul style="list-style: none; padding: 8px 0; display: flex; flex-direction: column; gap: 8px;">
                          ${(campaignCharacters[c.backendId] || []).map(character => `
                            <li style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                              <span>${escape(character.name)}${character.system ? ` (${escape(character.system.name)})` : ''}</span>
                              ${c.ownerId === String(authenticatedUserId) || personagens.some(personagem => personagem.backendId === character.id) ? `<button class="btn btn-danger btn-remove-campaign-character" data-campaign-id="${escape(c.backendId || '')}" data-character-id="${escape(character.id)}">Desvincular</button>` : ''}
                            </li>
                          `).join('')}
                        </ul>
                        <form class="form-campaign-add-character" data-campaign-id="${escape(c.backendId)}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                          <select class="form-control" name="characterId" aria-label="Personagem" required>
                            <option value="">Selecione um personagem seu</option>
                            ${personagens.filter(personagem => personagem.backendId).map(personagem =>
                              `<option value="${escape(personagem.backendId || '')}">${escape(personagem.nomePersonagem)} (${escape(personagem.classe)})</option>`
                            ).join('')}
                          </select>
                          <button class="btn btn-primary" type="submit">Vincular personagem</button>
                        </form>
                      </section>
                    </div>
                    ${remoteAvailable ? '' : '<p class="field-help">API indisponível; os dados locais continuam disponíveis.</p>'}
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Modal Nova Campanha -->
      <div id="modal-add-campanha" class="modal-backdrop hidden">
        <div class="modal-content glass-card">
          <div class="modal-header">
            <h3 id="camp-modal-title">📜 Criar Nova Campanha</h3>
            <button id="btn-close-campanha-modal" class="btn-icon">✕</button>
          </div>
          <div class="form-group">
            <label for="camp-nome">Nome da Campanha:</label>
            <input type="text" id="camp-nome" class="form-control" placeholder="Ex: A Maldição de Strahd, O Templo do Mal Elemental..." />
          </div>
          <div class="form-group">
            <label for="camp-lore">Lore e Ponto de Partida da Aventura:</label>
            <textarea id="camp-lore" rows="4" class="form-control" placeholder="Descreva a sinopse da história, ganchos narrativos e objetivos do grupo..."></textarea>
          </div>

          <div class="form-group">
            <label>Vincular Personagens Existentes:</label>
            <p id="campaign-character-link-note" class="field-help hidden">Para campanhas sincronizadas, gerencie os vínculos no painel “Membros e personagens”.</p>
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; padding: 6px; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm);">
              ${(remoteAvailable ? personagens.filter(personagem => personagem.backendId) : personagens).map(p => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                  <input type="checkbox" class="chk-camp-personagem" value="${p.idPersonagem}" checked />
                  ${p.nomePersonagem} (${p.classe})
                </label>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Vincular Fichas Criadas nos Sistemas:</label>
            <div class="campaign-selection-list">
              ${fichas.length === 0 ? '<span class="field-help">Nenhuma ficha de sistema criada ainda.</span>' : fichas.map(f => `<label><input type="checkbox" class="chk-camp-ficha" value="${f.id}" /> ${f.nome} <span>(${f.sistema})</span></label>`).join('')}
            </div>
          </div>

          <div class="form-group">
            <label>Vincular Fichas de Monstros:</label>
            <div class="campaign-selection-list">
              ${monstros.length === 0 ? '<span class="field-help">Nenhuma ficha de monstro criada ainda.</span>' : monstros.filter(m => m.tipo === 'ficha').map(m => `<label><input type="checkbox" class="chk-camp-monstro" value="${m.id}" /> ${m.nome} <span>(${m.sistema})</span></label>`).join('')}
            </div>
          </div>

          <button id="btn-salvar-nova-campanha" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Salvar Campanha</button>
        </div>
      </div>
    `;
  }

  public static renderNPCs(npcs: NPC[]): string {
    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3 style="color: var(--gm-accent);">🐉 Gestão de NPCs e Bestiário</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Fichas simplificadas para controle tático do Mestre</p>
          </div>
          <button id="btn-add-npc-modal" class="btn btn-primary">+ Novo Monstro/NPC</button>
        </div>

        <div class="grid-3" style="margin-top: 20px;">
          ${npcs.length === 0 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
              Nenhum monstro ou NPC cadastrado. Clique no botão acima para adicionar uma criatura.
            </div>
          ` : npcs.map(n => `
            <div class="glass-card" style="background: rgba(0,0,0,0.3); border-left: 4px solid var(--gm-accent);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <h4 style="font-size: 1.15rem; color: var(--text-main);">${n.nome}</h4>
                <button class="btn-icon btn-remove-npc" data-id="${n.idNpc}" title="Excluir" style="color: #f87171;">✕</button>
              </div>
              <div style="margin-bottom: 12px;">
                <span class="badge" style="background: rgba(244,63,94,0.2); color: #fda4af;">${n.nivelDesafio}</span>
              </div>

              <!-- Controle de PV em tempo real -->
              <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm); margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
                  <span>VIDA (PV):</span>
                  <span><strong>${n.vida}</strong> / ${n.vidaMax}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin: 6px 0; overflow: hidden;">
                  <div style="height: 100%; width: ${(n.vida / n.vidaMax) * 100}%; background: #ef4444; border-radius: 3px;"></div>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-secondary btn-npc-hp" data-id="${n.idNpc}" data-delta="-5" style="padding: 2px 6px; font-size: 0.7rem;">-5</button>
                  <button class="btn btn-secondary btn-npc-hp" data-id="${n.idNpc}" data-delta="-1" style="padding: 2px 6px; font-size: 0.7rem;">-1</button>
                  <button class="btn btn-secondary btn-npc-hp" data-id="${n.idNpc}" data-delta="1" style="padding: 2px 6px; font-size: 0.7rem;">+1</button>
                  <button class="btn btn-secondary btn-npc-hp" data-id="${n.idNpc}" data-delta="5" style="padding: 2px 6px; font-size: 0.7rem;">+5</button>
                </div>
              </div>

              <div>
                <strong style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Ataques e Ações:</strong>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">${n.ataques}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Modal Novo NPC -->
      <div id="modal-add-npc" class="modal-backdrop hidden">
        <div class="modal-content glass-card">
          <div class="modal-header">
            <h3>🐉 Cadastrar Monstro / NPC</h3>
            <button id="btn-close-npc-modal" class="btn-icon">✕</button>
          </div>
          <div class="form-group">
            <label for="npc-nome">Nome da Criatura/NPC:</label>
            <input type="text" id="npc-nome" class="form-control" placeholder="Ex: Orc Guerreiro, Esqueleto Arqueiro, Lich..." />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label for="npc-cr">Nível de Desafio (ND / CR):</label>
              <input type="text" id="npc-cr" class="form-control" placeholder="Ex: CR 1/2, CR 5, ND 3..." value="CR 1" />
            </div>
            <div class="form-group">
              <label for="npc-vida">Pontos de Vida (PV Máx):</label>
              <input type="number" id="npc-vida" class="form-control" min="1" value="25" />
            </div>
          </div>
          <div class="form-group">
            <label for="npc-ataques">Ataques, Armas e Dano:</label>
            <textarea id="npc-ataques" rows="3" class="form-control" placeholder="Ex: Espada Grande (+5 para acertar, 2d6+3 cortante), Arco Longo (+3, 1d8 perfurante)..."></textarea>
          </div>
          <button id="btn-salvar-novo-npc" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Adicionar ao Bestiário</button>
        </div>
      </div>
    `;
  }

  public static renderIniciativa(
    mestre: Mestre,
    personagens: Personagem[],
    npcs: NPC[],
    fichas: SistemaPasta[] = [],
    fichasMonstros: MonstroPasta[] = []
  ): string {
    const lista = mestre.gerenciarIniciativa();

    return `
      <div class="glass-card">
        <div class="glass-card-header">
          <div>
            <h3 style="color: var(--gm-accent);">⚔️ Painel de Ordem de Iniciativa e Combate</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Organização dinâmica de turnos e status de combate</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="btn-limpar-iniciativa" class="btn btn-secondary">Limpar Fila</button>
          </div>
        </div>

        <!-- Seletor de Combatentes para Adicionar -->
        <div class="grid-2" style="margin-bottom: 24px; background: rgba(0,0,0,0.25); padding: 16px; border-radius: var(--radius-md);">
          <div>
            <h5 style="color: #818cf8; margin-bottom: 8px;">+ Adicionar Herói do Grupo:</h5>
            <div style="display: flex; gap: 8px;">
              <select id="select-init-personagem" class="custom-select" style="flex: 1;">
                ${personagens.map(p => `<option value="${p.idPersonagem}">${p.nomePersonagem} (DES: ${p.atributos.destreza})</option>`).join('')}
                ${fichas.map(f => `<option value="ficha:${f.id}">${f.nome} (${f.sistema})</option>`).join('')}
              </select>
              <button id="btn-add-init-personagem" class="btn btn-secondary">Adicionar</button>
            </div>
          </div>

          <div>
            <h5 style="color: #fb7185; margin-bottom: 8px;">+ Adicionar Monstro/NPC:</h5>
            <div style="display: flex; gap: 8px;">
              <select id="select-init-npc" class="custom-select" style="flex: 1;">
                ${npcs.map(n => `<option value="${n.idNpc}">${n.nome} (${n.nivelDesafio})</option>`).join('')}
                ${fichasMonstros.filter(f => f.tipo === 'ficha').map(f => `<option value="monstro:${f.id}">${f.nome} (${f.sistema})</option>`).join('')}
              </select>
              <button id="btn-add-init-npc" class="btn btn-secondary">Adicionar</button>
            </div>
          </div>
        </div>

        <!-- Fila de Turnos Ordenada -->
        <div>
          <h4 style="margin-bottom: 12px;">Ordem Atual de Turnos (Decrescente):</h4>
          ${lista.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: var(--text-dim); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
              Nenhum combatente na arena. Adicione heróis e monstros e role a iniciativa!
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${lista.map((c, index) => `
                <div class="glass-card" style="padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; background: ${
                  index === 0 ? 'linear-gradient(90deg, rgba(99,102,241,0.25), rgba(0,0,0,0.3))' : 'rgba(0,0,0,0.3)'
                }; border-left: 5px solid ${c.tipo === 'Personagem' ? 'var(--primary)' : 'var(--gm-accent)'};">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="font-family: var(--font-mono); font-size: 1.4rem; font-weight: 700; color: ${index === 0 ? 'var(--gold)' : 'var(--text-muted)'}; min-width: 32px;">
                      #${index + 1}
                    </div>
                    <div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <strong style="font-size: 1.05rem;">${c.nome}</strong>
                        <span class="badge" style="background: ${c.tipo === 'Personagem' ? 'rgba(99,102,241,0.2)' : 'rgba(244,63,94,0.2)'}; color: ${c.tipo === 'Personagem' ? '#a5b4fc' : '#fda4af'}; font-size: 0.75rem;">
                          ${c.tipo}
                        </span>
                        ${index === 0 ? '<span class="badge" style="background: rgba(245,158,11,0.2); color: #fde047; font-weight: bold;">⚡ TURNO ATUAL</span>' : ''}
                      </div>
                      <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                        Vida: <strong>${c.vidaAtual} / ${c.vidaMax}</strong> PV
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="text-align: right;">
                      <span style="font-size: 0.75rem; color: var(--text-dim);">INICIATIVA</span>
                      <div style="font-family: var(--font-mono); font-size: 1.3rem; font-weight: 700; color: #34d399;">
                        🎲 ${c.iniciativa}
                      </div>
                    </div>
                    <button class="btn-icon btn-remove-init" data-id="${c.id}" title="Remover da iniciativa" style="color: #f87171;">✕</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }
}
