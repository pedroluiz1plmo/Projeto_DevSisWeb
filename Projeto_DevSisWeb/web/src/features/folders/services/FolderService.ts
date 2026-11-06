import { StorageService } from '../../../services/StorageService';

export type ApiFolder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export class FolderService {
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
      throw new Error(body.message || 'Não foi possível concluir a operação com pastas.');
    }
    return body;
  }

  public static async listar(token: string): Promise<ApiFolder[]> {
    const body = await this.request<{ folders: ApiFolder[] }>('/folders', token);
    return body.folders;
  }

  public static async criar(name: string, parentId: string | null, token: string): Promise<ApiFolder> {
    const body = await this.request<{ folder: ApiFolder }>('/folders', token, {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
    return body.folder;
  }

  public static async atualizar(id: string, name: string, parentId: string | null, token: string): Promise<ApiFolder> {
    const body = await this.request<{ folder: ApiFolder }>(`/folders/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify({ name, parentId }),
    });
    return body.folder;
  }

  public static async excluir(id: string, token: string): Promise<void> {
    await this.request(`/folders/${id}`, token, { method: 'DELETE' });
  }
}
