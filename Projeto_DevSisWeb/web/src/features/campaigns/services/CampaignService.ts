import type {
  ApiCampaign,
  ApiCampaignCharacter,
  ApiCampaignCharacterRequest,
  ApiCampaignCharacterSheet,
  ApiCampaignInviteInfo,
  ApiCampaignInvitePreview,
  ApiCampaignJoinRequest,
  ApiCampaignMember,
  ApiCampaignPublicCharacter,
  ApiMasterDashboard,
  ApiCampaignUser,
  ApiCampaignUserInvitation
} from '../../../shared/types/campaignApi';
import { StorageService } from '../../../services/StorageService';

export class CampaignService {
  private static readonly baseUrl = 'http://localhost:3000/api';

  private static async request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    init = StorageService.withWorkspace(init);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    const body = await response.json() as { success?: boolean; message?: string } & T;
    if (!response.ok || !body.success) {
      throw new Error(body.message || 'Não foi possível concluir a operação com campanhas.');
    }
    return body;
  }

  public static async listar(token: string): Promise<ApiCampaign[]> {
    const body = await this.request<{ campaigns: ApiCampaign[] }>('/campaigns', token);
    return body.campaigns;
  }

  public static async resumoMestre(token: string): Promise<ApiMasterDashboard> {
    const body = await this.request<{ dashboard: ApiMasterDashboard }>('/dashboard/master', token);
    return body.dashboard;
  }

  public static async criar(payload: { name: string; description: string }, token: string): Promise<ApiCampaign> {
    const body = await this.request<{ campaign: ApiCampaign }>('/campaigns', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return body.campaign;
  }

  public static async atualizar(id: string, payload: { name: string; description: string }, token: string): Promise<ApiCampaign> {
    const body = await this.request<{ campaign: ApiCampaign }>(`/campaigns/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return body.campaign;
  }

  public static async excluir(id: string, token: string): Promise<void> {
    await this.request(`/campaigns/${id}`, token, { method: 'DELETE' });
  }

  public static async listarMembros(campaignId: string, token: string): Promise<ApiCampaignMember[]> {
    const body = await this.request<{ members: ApiCampaignMember[] }>(`/campaigns/${campaignId}/members`, token);
    return body.members;
  }

  public static async statusConvite(campaignId: string, token: string): Promise<ApiCampaignInviteInfo | null> {
    const body = await this.request<{ invite: ApiCampaignInviteInfo | null }>(`/campaigns/${campaignId}/invite-code`, token);
    return body.invite;
  }

  public static async gerarCodigoConvite(campaignId: string, token: string): Promise<ApiCampaignInviteInfo> {
    const body = await this.request<{ invite: ApiCampaignInviteInfo }>(`/campaigns/${campaignId}/invite-code`, token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return body.invite;
  }

  public static async revogarCodigoConvite(campaignId: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/invite-code`, token, { method: 'DELETE' });
  }

  public static async pesquisarUsuario(campaignId: string, username: string, token: string): Promise<ApiCampaignUser> {
    const query = new URLSearchParams({ username }).toString();
    const body = await this.request<{ user: ApiCampaignUser }>(`/campaigns/${campaignId}/users/search?${query}`, token);
    return body.user;
  }

  public static async enviarConviteUsuario(campaignId: string, username: string, token: string): Promise<ApiCampaignUserInvitation> {
    const body = await this.request<{ invitation: ApiCampaignUserInvitation }>(`/campaigns/${campaignId}/user-invitations`, token, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    return body.invitation;
  }

  public static async listarConvitesEnviados(campaignId: string, token: string): Promise<ApiCampaignUserInvitation[]> {
    const body = await this.request<{ invitations: ApiCampaignUserInvitation[] }>(`/campaigns/${campaignId}/user-invitations`, token);
    return body.invitations;
  }

  public static async cancelarConviteUsuario(campaignId: string, invitationId: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/user-invitations/${invitationId}`, token, { method: 'DELETE' });
  }

  public static async listarSolicitacoes(campaignId: string, token: string): Promise<ApiCampaignJoinRequest[]> {
    const body = await this.request<{ requests: ApiCampaignJoinRequest[] }>(`/campaigns/${campaignId}/join-requests`, token);
    return body.requests;
  }

  public static async revisarSolicitacao(
    campaignId: string,
    requestId: string,
    action: 'approve' | 'reject',
    token: string
  ): Promise<ApiCampaignJoinRequest> {
    const body = await this.request<{ request: ApiCampaignJoinRequest }>(
      `/campaigns/${campaignId}/join-requests/${requestId}`,
      token,
      { method: 'PATCH', body: JSON.stringify({ action }) }
    );
    return body.request;
  }

  public static async visualizarCodigoConvite(code: string, token: string): Promise<ApiCampaignInvitePreview> {
    const body = await this.request<{ campaign: ApiCampaignInvitePreview }>('/campaign-invites/preview', token, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return body.campaign;
  }

  public static async solicitarParticipacao(code: string, token: string): Promise<ApiCampaignJoinRequest> {
    const body = await this.request<{ request: ApiCampaignJoinRequest }>('/campaign-invites/requests', token, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return body.request;
  }

  public static async minhasSolicitacoes(token: string): Promise<ApiCampaignJoinRequest[]> {
    const body = await this.request<{ requests: ApiCampaignJoinRequest[] }>('/me/campaign-join-requests', token);
    return body.requests;
  }

  public static async cancelarSolicitacao(requestId: string, token: string): Promise<void> {
    await this.request(`/campaign-join-requests/${requestId}`, token, { method: 'DELETE' });
  }

  public static async meusConvites(token: string): Promise<ApiCampaignUserInvitation[]> {
    const body = await this.request<{ invitations: ApiCampaignUserInvitation[] }>('/me/campaign-invitations', token);
    return body.invitations;
  }

  public static async responderConvite(
    invitationId: string,
    action: 'accept' | 'decline',
    token: string
  ): Promise<ApiCampaignUserInvitation> {
    const body = await this.request<{ invitation: ApiCampaignUserInvitation }>(
      `/campaign-user-invitations/${invitationId}/respond`,
      token,
      { method: 'POST', body: JSON.stringify({ action }) }
    );
    return body.invitation;
  }

  public static async atualizarPapel(campaignId: string, userId: string, role: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/members/${userId}`, token, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  public static async removerMembro(campaignId: string, userId: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/members/${userId}`, token, { method: 'DELETE' });
  }

  public static async listarPersonagensPublicos(campaignId: string, token: string): Promise<ApiCampaignPublicCharacter[]> {
    const body = await this.request<{ characters: ApiCampaignPublicCharacter[] }>(`/campaigns/${campaignId}/characters`, token);
    return body.characters;
  }

  public static async listarMinhasLinksPersonagem(campaignId: string, token: string): Promise<{
    characterLinks: ApiCampaignCharacterRequest[];
    activeCharacter: { id: string } | null;
  }> {
    const body = await this.request<{ characterLinks: ApiCampaignCharacterRequest[]; activeCharacter: { id: string } | null }>(
      `/campaigns/${campaignId}/my-character-links`,
      token,
    );
    return body;
  }

  public static async listarSolicitacoesPersonagens(campaignId: string, token: string): Promise<ApiCampaignCharacterRequest[]> {
    const body = await this.request<{ requests: ApiCampaignCharacterRequest[] }>(`/campaigns/${campaignId}/character-link-requests`, token);
    return body.requests;
  }

  public static async solicitarVinculoPersonagem(
    campaignId: string,
    characterId: string,
    token: string,
    reason?: string,
  ): Promise<{ request: ApiCampaignCharacterRequest }> {
    const body = await this.request<{ request: ApiCampaignCharacterRequest }>(`/campaigns/${campaignId}/character-link-requests`, token, {
      method: 'POST',
      body: JSON.stringify({ characterId, reason }),
    });
    return body;
  }

  public static async cancelarSolicitacaoPersonagem(campaignId: string, requestId: string, token: string): Promise<ApiCampaignCharacterRequest> {
    const body = await this.request<{ request: ApiCampaignCharacterRequest }>(`/campaigns/${campaignId}/character-link-requests/${requestId}`, token, {
      method: 'DELETE',
    });
    return body.request;
  }

  public static async revisarSolicitacaoPersonagem(
    campaignId: string,
    requestId: string,
    action: 'approve' | 'reject',
    token: string,
    reason?: string,
  ): Promise<ApiCampaignCharacterRequest> {
    const body = await this.request<{ request: ApiCampaignCharacterRequest }>(`/campaigns/${campaignId}/character-link-requests/${requestId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ action, reason }),
    });
    return body.request;
  }

  public static async consultarFichaPersonagem(campaignId: string, characterId: string, token: string): Promise<ApiCampaignCharacterSheet> {
    const body = await this.request<{ character: ApiCampaignCharacterSheet }>(`/campaigns/${campaignId}/characters/${characterId}`, token);
    return body.character;
  }

  public static async listarPersonagens(campaignId: string, token: string): Promise<ApiCampaignCharacter[]> {
    const body = await this.request<{ characters: ApiCampaignCharacter[] }>(`/campaigns/${campaignId}/characters`, token);
    return body.characters;
  }

  public static async adicionarPersonagem(campaignId: string, characterId: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/characters`, token, {
      method: 'POST',
      body: JSON.stringify({ characterId }),
    });
  }

  public static async removerPersonagem(campaignId: string, characterId: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/characters/${characterId}`, token, { method: 'DELETE' });
  }
}
