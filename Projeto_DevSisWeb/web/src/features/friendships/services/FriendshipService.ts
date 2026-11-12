import { StorageService } from '../../../services/StorageService';
import type {
  ApiFriend,
  ApiFriendshipData,
  ApiFriendshipRequest,
  ApiFriendshipSearchResult
} from '../types';

export class FriendshipService {
  private static readonly baseUrl = 'http://localhost:3000/api';

  private static async request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    init = StorageService.withWorkspace(init);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
    const body = await response.json() as { success?: boolean; message?: string } & T;
    if (!response.ok || !body.success) {
      throw new Error(body.message || 'Não foi possível concluir a operação de amizades.');
    }
    return body;
  }

  public static async search(username: string, token: string): Promise<ApiFriendshipSearchResult[]> {
    const query = new URLSearchParams({ username }).toString();
    const body = await this.request<{ users: ApiFriendshipSearchResult[] }>(`/users/search?${query}`, token);
    return body.users;
  }

  public static async list(token: string): Promise<ApiFriendshipData> {
    const [friends, received, sent] = await Promise.all([
      this.request<{ friends: ApiFriend[] }>('/friendships', token),
      this.request<{ requests: ApiFriendshipRequest[] }>('/friendships/requests/received', token),
      this.request<{ requests: ApiFriendshipRequest[] }>('/friendships/requests/sent', token)
    ]);
    return {
      friends: friends.friends,
      received: received.requests,
      sent: sent.requests
    };
  }

  public static async sendRequest(recipientId: string, token: string): Promise<void> {
    await this.request('/friendships/requests', token, {
      method: 'POST',
      body: JSON.stringify({ recipientId })
    });
  }

  public static async respond(requestId: string, action: 'accept' | 'reject', token: string): Promise<void> {
    await this.request(`/friendships/requests/${requestId}/${action}`, token, { method: 'PATCH' });
  }

  public static async remove(friendshipId: string, token: string): Promise<void> {
    await this.request(`/friendships/${friendshipId}`, token, { method: 'DELETE' });
  }
}
