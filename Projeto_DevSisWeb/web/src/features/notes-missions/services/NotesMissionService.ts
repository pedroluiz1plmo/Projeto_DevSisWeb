import { StorageService } from '../../../services/StorageService';

export type ApiNote = {
  id: string;
  clientId: string;
  ownerId: string;
  workspaceType: 'player' | 'master';
  folderId: string | null;
  campaignId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiMission = {
  id: string;
  clientId: string;
  ownerId: string;
  workspaceType: 'player' | 'master';
  folderId: string | null;
  campaignId: string | null;
  title: string;
  description: string;
  reward: string;
  status: 'em_progresso' | 'concluida';
  createdAt: string;
  updatedAt: string;
};

export type NotePayload = {
  clientId: string;
  folderId: string | null;
  campaignId: string | null;
  title: string;
  content: string;
};

export type MissionPayload = {
  clientId: string;
  folderId: string | null;
  campaignId: string | null;
  title: string;
  description: string;
  reward: string;
  status: 'em_progresso' | 'concluida';
};

export class NotesMissionApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'NotesMissionApiError';
    this.statusCode = statusCode;
  }
}

export class NotesMissionService {
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
      throw new NotesMissionApiError(
        body.message || 'Não foi possível sincronizar notas e missões.',
        response.status
      );
    }
    return body;
  }

  public static async listarNotas(token: string): Promise<ApiNote[]> {
    const body = await this.request<{ notes: ApiNote[] }>('/notes', token);
    return body.notes;
  }

  public static async salvarNota(payload: NotePayload, token: string, id?: string): Promise<ApiNote> {
    const body = await this.request<{ note: ApiNote }>(id ? `/notes/${id}` : '/notes', token, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    return body.note;
  }

  public static async excluirNota(id: string, token: string): Promise<void> {
    await this.request(`/notes/${id}`, token, { method: 'DELETE' });
  }

  public static async listarMissoes(token: string): Promise<ApiMission[]> {
    const body = await this.request<{ missions: ApiMission[] }>('/missions', token);
    return body.missions;
  }

  public static async salvarMissao(payload: MissionPayload, token: string, id?: string): Promise<ApiMission> {
    const body = await this.request<{ mission: ApiMission }>(id ? `/missions/${id}` : '/missions', token, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    return body.mission;
  }

  public static async excluirMissao(id: string, token: string): Promise<void> {
    await this.request(`/missions/${id}`, token, { method: 'DELETE' });
  }
}
