import type { ApiCampaign, ApiCampaignCharacter, ApiCampaignMember } from '../../../shared/types/campaignApi';
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

  public static async adicionarMembro(campaignId: string, userId: string, role: string, token: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/members`, token, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
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
