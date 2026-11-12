import type { Campanha } from '../models/Campanha';
import type {
  ApiCampaignInvitePreview,
  ApiCampaignJoinRequest,
  ApiCampaignUserInvitation
} from '../shared/types/campaignApi';

export class CampaignJoinView {
  public static render(
    campaigns: Campanha[],
    invitations: ApiCampaignUserInvitation[],
    requests: ApiCampaignJoinRequest[],
    code: string,
    preview: ApiCampaignInvitePreview | null,
    requestSent: boolean,
    isLoading = false
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
    const status = (value: string): string => ({
      pending: 'Pendente',
      approved: 'Aprovada',
      accepted: 'Aceito',
      rejected: 'Recusada',
      declined: 'Recusado',
      cancelled: 'Cancelada'
    }[value] || value);

    return `
      <section class="glass-card">
        <h3>Entrar em campanha</h3>
        <p>Use um código ou QR Code. O código permite solicitar participação; o Mestre ainda precisa aprovar.</p>
        <form id="form-campaign-join-code" style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">
          <input class="form-control" name="code" value="${escape(code)}" placeholder="Código de convite" aria-label="Código de convite" required style="max-width:360px;" />
          <button class="btn btn-primary" type="submit">Verificar código</button>
          <button class="btn btn-secondary" id="btn-scan-campaign-qr" type="button">Ler QR Code</button>
        </form>
        <div id="campaign-qr-reader" class="hidden" style="max-width:420px;margin-bottom:16px;"></div>
        <button class="btn btn-secondary hidden" id="btn-stop-campaign-qr" type="button">Fechar leitor</button>
        ${preview ? `
          <div class="glass-card" style="padding:16px;margin-bottom:18px;">
            <h4>${escape(preview.name)}</h4>
            ${preview.description ? `<p>${escape(preview.description)}</p>` : ''}
            <p>O pedido ficará pendente até a decisão do Mestre.</p>
            <button class="btn btn-primary" id="btn-request-campaign-join" type="button">Solicitar participação</button>
          </div>
        ` : ''}
        ${requestSent ? '<p class="badge">Solicitação enviada; aguarde a aprovação do Mestre.</p>' : ''}
      </section>

      <section class="glass-card" style="margin-top:16px;">
        <h3>Convites diretos</h3>
        ${isLoading ? '<p class="field-help" role="status">Carregando convites e solicitações...</p>' : ''}
        ${isLoading ? '' : invitations.length ? invitations.map(invitation => `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--border-color);">
            <span>
              <strong>${escape(invitation.campaignName || 'Campanha')}</strong>
              — por ${escape(invitation.ownerName || 'Mestre')}
              ${invitation.ownerUsername ? `(@${escape(invitation.ownerUsername)})` : ''}
              — ${status(invitation.status)}
              <small class="field-help">Recebido em ${escape(formatDate(invitation.invitedAt))}</small>
            </span>
            ${invitation.status === 'pending' ? `
              <button class="btn btn-primary btn-respond-campaign-invitation" data-invitation-id="${escape(invitation.id)}" data-action="accept">Aceitar</button>
              <button class="btn btn-danger btn-respond-campaign-invitation" data-invitation-id="${escape(invitation.id)}" data-action="decline">Recusar</button>
            ` : ''}
          </div>
        `).join('') : '<p>Nenhum convite pendente.</p>'}
      </section>

      <section class="glass-card" style="margin-top:16px;">
        <h3>Minhas solicitações</h3>
        ${isLoading ? '' : requests.length ? requests.map(request => `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--border-color);">
            <span>
              <strong>${escape(request.campaignName || 'Campanha')}</strong>
              — ${status(request.status)}
              <small class="field-help">Solicitada em ${escape(formatDate(request.requestedAt))}</small>
            </span>
            ${request.ownerName ? `<span>· Mestre: ${escape(request.ownerName)}</span>` : ''}
            ${request.status === 'pending' ? `<button class="btn btn-danger btn-cancel-campaign-request" data-request-id="${escape(request.id)}">Cancelar</button>` : ''}
          </div>
        `).join('') : '<p>Nenhuma solicitação enviada.</p>'}
      </section>

      <section class="glass-card" style="margin-top:16px;">
        <h3>Campanhas disponíveis para você</h3>
        ${isLoading ? '<p class="field-help" role="status">Atualizando suas campanhas...</p>' : campaigns.length ? campaigns.map(campaign => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border-color);">
            <strong>${escape(campaign.nomeCampanha)}</strong>
            ${campaign.lore ? `<p>${escape(campaign.lore)}</p>` : ''}
          </div>
        `).join('') : '<p>Você ainda não participa de campanhas.</p>'}
      </section>
    `;
  }
}
