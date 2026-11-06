export type RpgSystem = { id: string; name: string; slug: string; description?: string | null };
export type RpgSystemVersion = {
  id: string;
  systemId?: string;
  name: string;
  slug: string;
  description?: string | null;
};

export class SystemService {
  private static readonly baseUrl = 'http://localhost:3000/api';

  private static async request<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    const body = await response.json() as { success?: boolean; message?: string } & T;
    if (!response.ok || !body.success) {
      throw new Error(body.message || 'Não foi possível carregar os sistemas.');
    }
    return body;
  }

  public static async listar(): Promise<RpgSystem[]> {
    const body = await this.request<{ systems?: RpgSystem[] }>('/systems');
    if (!body.systems) throw new Error('A API não retornou sistemas.');
    return body.systems;
  }

  public static async listarVersoes(systemId: string): Promise<RpgSystemVersion[]> {
    const body = await this.request<{ versions?: RpgSystemVersion[] }>(
      `/systems/${encodeURIComponent(systemId)}/versions`,
    );
    if (!body.versions) throw new Error('A API não retornou versões para o sistema.');
    return body.versions;
  }

  public static async obterVersao(versionId: string): Promise<RpgSystemVersion> {
    const body = await this.request<{ version?: RpgSystemVersion }>(
      `/system-versions/${encodeURIComponent(versionId)}`,
    );
    if (!body.version) throw new Error('A API não retornou a versão solicitada.');
    return body.version;
  }
}
