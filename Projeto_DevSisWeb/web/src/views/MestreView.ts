import { Campanha } from '../models/Campanha';
import { NPC } from '../models/NPC';
import { Personagem } from '../models/Personagem';
import { Mestre } from '../models/Mestre';
import type { MonstroPasta } from '../models/MonstroPasta';
import type { SistemaPasta } from '../models/SistemaPasta';
import type {
  ApiCampaignCharacter,
  ApiCampaignCharacterRequest,
  ApiCampaignInviteInfo,
  ApiCampaignJoinRequest,
  ApiCampaignMember,
  ApiCampaignUser,
  ApiCampaignUserInvitation
} from '../shared/types/campaignApi';
import type { ApiFriend } from '../features/friendships/types';

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
    authenticatedUserId = '',
    campaignInviteStatuses: Record<string, ApiCampaignInviteInfo | null> = {},
    campaignInviteCodes: Record<string, string> = {},
    campaignInviteQrCodes: Record<string, string> = {},
    _campaignJoinRequests: Record<string, ApiCampaignJoinRequest[]> = {},
    campaignUserInvitations: Record<string, ApiCampaignUserInvitation[]> = {},
    campaignSearchResults: Record<string, ApiCampaignUser> = {},
    campaignDetailsLoading: Set<string> = new Set(),
    friendshipFriends: ApiFriend[] = [],
    myCharacterLinks: Record<string, { characterLinks: ApiCampaignCharacterRequest[]; activeCharacter: { id: string } | null }> = {},
    campaignCharacterRequests: Record<string, ApiCampaignCharacterRequest[]> = {},
    campaignCharacterOptions: Array<{
      id: string;
      label: string;
      backendId?: string | null;
      localId?: string;
      backendIdsByWorkspace?: Partial<Record<'player' | 'master', string>>;
    }> = []
  ): string {
    const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] || character);
    const formatDate = (value?: string): string => {
      if (!value) return 'Data não informada';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR');
    };
    const fallbackCharacterOptions = new Map<string, {
      id: string;
      label: string;
      backendId?: string | null;
      localId?: string;
      backendIdsByWorkspace?: Partial<Record<'player' | 'master', string>>;
    }>();
    for (const personagem of personagens) {
      const optionId = personagem.backendId || personagem.idPersonagem;
      fallbackCharacterOptions.set(optionId, {
        id: optionId,
        label: `${personagem.nomePersonagem}${personagem.classe ? ` (${personagem.classe})` : ''}${personagem.sistema ? ` — ${personagem.sistema}` : ''}`,
        backendId: personagem.backendId || null,
        localId: personagem.idPersonagem,
        backendIdsByWorkspace: personagem.backendIdsByWorkspace,
      });
    }
    for (const ficha of fichas.filter(item => item.tipo === 'ficha')) {
      const optionId = ficha.backendId || ficha.id;
      if (fallbackCharacterOptions.has(optionId)) continue;
      fallbackCharacterOptions.set(optionId, {
        id: optionId,
        label: `${ficha.nome}${ficha.sistema ? ` — ${ficha.sistema}` : ''}`,
        backendId: ficha.backendId || null,
        localId: ficha.id,
        backendIdsByWorkspace: ficha.backendIdsByWorkspace,
      });
    }
    const normalizedCampaignCharacterOptions = (campaignCharacterOptions.length ? campaignCharacterOptions : Array.from(fallbackCharacterOptions.values()))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
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
          ` : campanhas.map(c => {
            const campaignDetailsVisible = openCampaignIds.has(c.idCampanha)
              || Boolean(c.backendId && ((campaignMembers[c.backendId] || []).length || (campaignCharacters[c.backendId] || []).length || (myCharacterLinks[c.backendId]?.characterLinks?.length) || (campaignCharacterRequests[c.backendId]?.length)));

            return `
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
                    ${campaignDetailsVisible ? `
                      <div class="grid-2" style="margin-top: 12px;">
                        <section class="glass-card" style="padding: 14px;">
                          <h5>Participantes (${(campaignMembers[c.backendId] || []).length})</h5>
                          <ul style="list-style: none; padding: 8px 0; display: flex; flex-direction: column; gap: 8px;">
                            ${campaignDetailsLoading.has(c.backendId) ? '<li class="field-help" role="status">Carregando participantes...</li>' : (campaignMembers[c.backendId] || []).map(member => `
                              <li style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span>
                                  ${escape(member.name || member.username || `Usuário ${member.userId}`)}
                                  ${member.username ? `(@${escape(member.username)})` : ''}
                                  — ${escape(member.role)}
                                  ${member.joinedAt ? `<small class="field-help">Entrou em ${escape(formatDate(member.joinedAt))}</small>` : ''}
                                </span>
                                ${String(member.userId) !== c.ownerId && c.ownerId === String(authenticatedUserId) ? `
                                  <input class="form-control campaign-member-role" data-campaign-id="${escape(c.backendId || '')}" data-user-id="${escape(member.userId)}" value="${escape(member.role)}" maxlength="30" aria-label="Papel do membro" style="max-width: 140px;" />
                                  <button class="btn btn-secondary btn-save-campaign-role" data-campaign-id="${escape(c.backendId || '')}" data-user-id="${escape(member.userId)}">Salvar papel</button>
                                  <button class="btn btn-danger btn-remove-campaign-member" data-campaign-id="${escape(c.backendId || '')}" data-user-id="${escape(member.userId)}">Remover</button>
                                ` : String(member.userId) === c.ownerId ? '<span class="badge">Proprietário</span>' : ''}
                              </li>
                            `).join('')}
                          </ul>
                          ${!campaignDetailsLoading.has(c.backendId) && !(campaignMembers[c.backendId] || []).length ? '<p class="field-help">Nenhum participante encontrado.</p>' : ''}
                          ${c.ownerId === String(authenticatedUserId) ? `
                            <section class="campaign-invitation-manager" style="margin-top: 18px; border-top: 1px solid var(--border-color); padding-top: 14px;">
                              <h5>Gerenciar jogadores</h5>
                              <p class="field-help">${campaignInviteStatuses[c.backendId]?.status === 'active' ? 'Código ativo. O código completo só é exibido quando gerado ou renovado.' : 'Nenhum código ativo.'}</p>
                              <button class="btn btn-secondary btn-generate-campaign-code" data-campaign-id="${escape(c.backendId)}">${campaignInviteStatuses[c.backendId]?.status === 'active' ? 'Renovar código' : 'Gerar código'}</button>
                              ${campaignInviteStatuses[c.backendId]?.status === 'active' ? `<button class="btn btn-danger btn-revoke-campaign-code" data-campaign-id="${escape(c.backendId)}">Revogar</button>` : ''}
                              ${campaignInviteCodes[c.backendId] ? `
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;">
                                  <code>${escape(campaignInviteCodes[c.backendId])}</code>
                                  ${campaignInviteQrCodes[c.backendId] ? `<img src="${escape(campaignInviteQrCodes[c.backendId])}" alt="QR Code do convite" style="width: 180px; height: 180px; background: white; padding: 6px;" />` : ''}
                                  <button class="btn btn-secondary btn-copy-campaign-code" data-campaign-id="${escape(c.backendId)}">Copiar código</button>
                                  <button class="btn btn-secondary btn-share-campaign-code" data-campaign-id="${escape(c.backendId)}">Compartilhar</button>
                                  ${campaignInviteQrCodes[c.backendId] ? `<a class="btn btn-secondary" href="${escape(campaignInviteQrCodes[c.backendId])}" download="convite-${escape(c.backendId)}.png">Baixar QR Code</a>` : ''}
                                </div>
                                <p class="field-help">O QR Code contém o mesmo código aceito pelo Mobile. Ler ou informar o código envia uma solicitação, sujeita à aprovação do Mestre.</p>
                              ` : ''}
                              <form class="form-campaign-search-user" data-campaign-id="${escape(c.backendId)}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;">
                                <input class="form-control" name="username" type="text" placeholder="Username do jogador" aria-label="Username do jogador" required maxlength="50" style="max-width: 240px;" />
                                <button class="btn btn-secondary" type="submit">Pesquisar usuário</button>
                              </form>
                              ${campaignSearchResults[c.backendId] ? `
                                <div class="campaign-search-result" style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                                  <span>${escape(campaignSearchResults[c.backendId].name)} (@${escape(campaignSearchResults[c.backendId].username)})</span>
                                  <button class="btn btn-primary btn-send-campaign-invitation" data-campaign-id="${escape(c.backendId)}">Enviar convite</button>
                                </div>
                              ` : ''}
                              <h6 style="margin-top: 16px;">Adicionar amigos</h6>
                              ${friendshipFriends.length ? `
                                <form class="form-campaign-invite-friends" data-campaign-id="${escape(c.backendId)}">
                                  <input class="form-control campaign-friend-filter" type="search" placeholder="Pesquisar amigos pelo username" aria-label="Pesquisar amigos pelo username" style="max-width: 320px; margin: 8px 0;" />
                                  <ul style="list-style:none;padding:8px 0;display:flex;flex-direction:column;gap:8px;">
                                    ${friendshipFriends.map(friend => {
                                      const member = (campaignMembers[c.backendId || ''] || []).some(participant => participant.userId === friend.userId);
                                      const pending = (campaignUserInvitations[c.backendId || ''] || []).some(invitation => invitation.userId === friend.userId && invitation.status === 'pending');
                                      return `
                                        <li class="campaign-friend-option" data-username="${escape(friend.username.toLowerCase())}">
                                          <label style="display:flex;gap:8px;align-items:center;">
                                            <input type="checkbox" name="friendIds" value="${escape(friend.userId)}" ${member || pending ? 'disabled' : ''} />
                                            <span>${escape(friend.name)} (@${escape(friend.username)})</span>
                                            ${member ? '<small class="field-help">Já participa</small>' : ''}
                                            ${pending ? '<small class="field-help">Convite pendente</small>' : ''}
                                          </label>
                                        </li>
                                      `;
                                    }).join('')}
                                  </ul>
                                  <button class="btn btn-primary" type="submit">Convidar selecionados</button>
                                </form>
                              ` : '<p class="field-help">Nenhum amigo disponível para convite.</p>'}
                            </section>
                          ` : ''}
                        </section>

                        ${c.ownerId !== String(authenticatedUserId) && c.backendId ? (() => {
                          const linkData = myCharacterLinks[c.backendId] || { characterLinks: [], activeCharacter: null };
                          const pendingRequest = (linkData.characterLinks || []).find(item => item.status === 'pending');
                          const rejectedRequest = (linkData.characterLinks || []).find(item => item.status === 'rejected');
                          const activeCharacter = linkData.activeCharacter
                            ? normalizedCampaignCharacterOptions.find(option =>
                                (option.backendId || option.id) === linkData.activeCharacter?.id
                                || Object.values(option.backendIdsByWorkspace || {}).includes(linkData.activeCharacter?.id || '')) || null
                            : null;

                          return `
                            <section class="glass-card" style="padding: 14px;">
                              <h5>Meu personagem na campanha</h5>
                              ${pendingRequest ? `
                                <p><strong>${escape(pendingRequest.characterName || 'Personagem')}</strong></p>
                                <p class="field-help">Aguardando aprovação do Mestre.</p>
                                <button class="btn btn-danger btn-cancel-player-character-request" data-campaign-id="${escape(c.backendId || '')}" data-request-id="${escape(pendingRequest.id)}">Cancelar solicitação</button>
                              ` : rejectedRequest ? `
                                <p class="field-help">Sua solicitação foi rejeitada.</p>
                                <form class="form-player-character-link" data-campaign-id="${escape(c.backendId || '')}" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                                  <select class="form-control" name="characterId" aria-label="Personagem" required>
                                    <option value="">Selecione seu personagem</option>
                                    ${normalizedCampaignCharacterOptions.map(option =>
                                      `<option value="${escape(option.id)}">${escape(option.label)}</option>`
                                    ).join('')}
                                  </select>
                                  <button class="btn btn-primary" type="submit">Adicionar meu personagem</button>
                                </form>
                              ` : activeCharacter ? `
                                <p><strong>${escape(activeCharacter.label)}</strong></p>
                                <p class="field-help">Status do vínculo: aprovado</p>
                                <button class="btn btn-secondary btn-view-campaign-character-sheet" data-campaign-id="${escape(c.backendId || '')}" data-character-id="${escape(linkData.activeCharacter?.id || '')}">Consultar ficha</button>
                              ` : `
                                <p class="field-help">Você ainda não possui personagem na campanha.</p>
                                <form class="form-player-character-link" data-campaign-id="${escape(c.backendId || '')}" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                                  <select class="form-control" name="characterId" aria-label="Personagem" required>
                                    <option value="">Selecione seu personagem</option>
                                    ${normalizedCampaignCharacterOptions.map(option =>
                                      `<option value="${escape(option.id)}">${escape(option.label)}</option>`
                                    ).join('')}
                                  </select>
                                  <button class="btn btn-primary" type="submit">Adicionar meu personagem</button>
                                </form>
                              `}
                            </section>
                          `;
                        })() : ''}

                        ${c.ownerId === String(authenticatedUserId) ? (() => {
                          const requests = (campaignCharacterRequests[c.backendId || ''] || []).filter(request => request.status === 'pending');
                          return `
                            <section class="glass-card" style="padding: 14px;">
                              <h5>Solicitações de personagens</h5>
                              ${requests.length ? `
                                <ul style="list-style: none; padding: 8px 0; display: flex; flex-direction: column; gap: 8px;">
                                  ${requests.map(request => `
                                    <li style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                      <span>
                                        <strong>${escape(request.characterName || 'Personagem')}</strong>
                                        — ${escape(request.playerName || 'Jogador')}
                                        ${request.requestedAt ? `<small class="field-help">${escape(formatDate(request.requestedAt))}</small>` : ''}
                                      </span>
                                      ${request.characterSheet ? `
                                        <details class="campaign-request-character-sheet" style="flex-basis:100%;">
                                          <summary>Ver ficha (${escape(request.characterSheet.system?.name || 'Sistema')})</summary>
                                          <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0;">
                                            ${Object.entries(request.characterSheet.data).map(([key, value]) => `
                                              <div>
                                                <dt class="field-help">${escape(key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' '))}</dt>
                                                <dd style="white-space:pre-wrap;overflow-wrap:anywhere;">${escape(typeof value === 'string' ? value : JSON.stringify(value))}</dd>
                                              </div>
                                            `).join('')}
                                          </dl>
                                        </details>
                                      ` : ''}
                                      <button class="btn btn-primary btn-review-character-link-request" data-campaign-id="${escape(c.backendId || '')}" data-request-id="${escape(request.id)}" data-action="approve">Aprovar</button>
                                      <button class="btn btn-danger btn-review-character-link-request" data-campaign-id="${escape(c.backendId || '')}" data-request-id="${escape(request.id)}" data-action="reject">Rejeitar</button>
                                    </li>
                                  `).join('')}
                                </ul>
                              ` : '<p class="field-help">Nenhuma solicitação pendente de personagem.</p>'}
                            </section>
                          `;
                        })() : ''}

                        <section class="glass-card" style="padding: 14px;">
                          <h5>Personagens (${(campaignCharacters[c.backendId] || []).length})</h5>
                          ${(campaignCharacters[c.backendId] || []).length ? `
                            <ul style="list-style: none; padding: 8px 0; display: flex; flex-direction: column; gap: 8px;">
                              ${(campaignCharacters[c.backendId] || []).map(character => `
                                <li style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                  <span>${escape(character.name)}${character.system ? ` (${escape(character.system.name)})` : ''}</span>
                                  ${personagens.some(personagem => personagem.backendId === character.id) ? '<small class="field-help">Proprietário: personagem local</small>' : '<small class="field-help">Proprietário: ficha vinculada</small>'}
                                  ${c.ownerId === String(authenticatedUserId) || personagens.some(personagem => personagem.backendId === character.id) ? `<button class="btn btn-danger btn-remove-campaign-character" data-campaign-id="${escape(c.backendId || '')}" data-character-id="${escape(character.id)}">Desvincular</button>` : ''}
                                  <button class="btn btn-secondary btn-view-campaign-character-sheet" data-campaign-id="${escape(c.backendId || '')}" data-character-id="${escape(character.id)}">Consultar ficha</button>
                                </li>
                              `).join('')}
                            </ul>
                          ` : '<p class="field-help">Nenhum personagem vinculado à campanha.</p>'}
                          <form class="form-campaign-add-character" data-campaign-id="${escape(c.backendId)}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                            <select class="form-control" name="characterId" aria-label="Personagem" required>
                              <option value="">Selecione um personagem seu</option>
                              ${normalizedCampaignCharacterOptions.map(option =>
                                `<option value="${escape(option.id)}">${escape(option.label)}</option>`
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
            `;
          }).join('')}
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
