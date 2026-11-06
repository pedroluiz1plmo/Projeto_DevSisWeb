import { StorageService } from '../../../services/StorageService';

export type ApiCharacter = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  workspaceType: 'player' | 'master';
  system: { id: string; name: string; slug: string };
  version?: { id: string; name: string; slug: string } | null;
};

//type CharacterPayload = { name: string; systemId: string; data: Record<string, unknown> };
type CharacterPayload = {
  name: string;
  systemId: string;
  systemVersionId?: string | null;
  data: Record<string, unknown>;
};

export class CharacterService {
  private static readonly baseUrl = 'http://localhost:3000/api';

  private static async request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    init = StorageService.withWorkspace(init);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
    });
    const body = await response.json() as { success?: boolean; message?: string } & T;
    if (!response.ok || !body.success) throw new Error(body.message || 'Não foi possível concluir a operação com personagens.');
    return body;
  }

  public static async listar(token: string): Promise<ApiCharacter[]> {
    const body = await this.request<{ characters: ApiCharacter[] }>('/characters', token);
    return body.characters;
  }

  public static async obter(id: string, token: string): Promise<ApiCharacter> {
    const body = await this.request<{ character: ApiCharacter }>(`/characters/${id}`, token);
    return body.character;
  }

  public static async criar(payload: CharacterPayload, token: string): Promise<ApiCharacter> {
    const body = await this.request<{ character: ApiCharacter }>('/characters', token, { method: 'POST', body: JSON.stringify(payload) });
    return body.character;
  }

  public static async atualizar(id: string, payload: CharacterPayload, token: string): Promise<ApiCharacter> {
    const body = await this.request<{ character: ApiCharacter }>(`/characters/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) });
    return body.character;
  }

  public static async excluir(id: string, token: string): Promise<void> {
    await this.request(`/characters/${id}`, token, { method: 'DELETE' });
  }
}
