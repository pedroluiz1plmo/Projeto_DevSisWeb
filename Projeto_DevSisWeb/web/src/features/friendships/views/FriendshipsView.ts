import type {
  ApiFriendshipData,
  ApiFriendshipSearchResult
} from '../types';

export class FriendshipsView {
  private static escape(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] || character);
  }

  private static person(name: string, username: string): string {
    return `<strong>${this.escape(name)}</strong> <span class="field-help">(@${this.escape(username)})</span>`;
  }

  private static relationshipLabel(result: ApiFriendshipSearchResult): string {
    return ({
      friend: 'Já é seu amigo',
      request_sent: 'Solicitação enviada',
      request_received: 'Enviou uma solicitação para você',
      none: ''
    })[result.relationship];
  }

  public static render(
    data: ApiFriendshipData | null,
    results: ApiFriendshipSearchResult[],
    searchTerm: string,
    loading: boolean,
    error: string | null,
    message: string | null
  ): string {
    const esc = (value: string): string => this.escape(value);
    return `
      <div class="friendships-page">
        <section class="glass-card">
          <div class="glass-card-header">
            <div>
              <h2>Amizades</h2>
              <p class="field-help">Pesquise pessoas pelo username e gerencie suas solicitações.</p>
            </div>
          </div>
          ${message ? `<p class="friendships-notice" role="status">${esc(message)}</p>` : ''}
          ${error ? `<p class="friendships-error" role="alert">${esc(error)}</p>` : ''}
          <form class="friendship-search-form" style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">
            <input class="form-control" name="username" type="search" maxlength="50"
              minlength="2" required value="${esc(searchTerm)}" placeholder="Pesquisar username"
              aria-label="Pesquisar username" style="max-width:320px;" />
            <button class="btn btn-primary" type="submit" ${loading ? 'disabled' : ''}>
              ${loading ? 'Pesquisando…' : 'Pesquisar'}
            </button>
          </form>
          <h3>Resultados</h3>
          ${loading ? '<p class="field-help" role="status">Pesquisando usuários…</p>' : ''}
          ${!loading && !error && searchTerm && results.length === 0 ? '<p class="field-help">Nenhum usuário encontrado.</p>' : ''}
          <ul class="friendship-list">
            ${results.map(result => `
              <li>
                <span>${this.person(result.name, result.username)}</span>
                ${result.relationship === 'none'
                  ? `<button class="btn btn-secondary btn-send-friend-request" data-user-id="${esc(result.id)}">Adicionar</button>`
                  : `<span class="field-help">${esc(this.relationshipLabel(result))}</span>`}
              </li>
            `).join('')}
          </ul>
        </section>

        <div class="friendships-columns">
          <section class="glass-card">
            <h3>Solicitações recebidas</h3>
            ${!data && !error ? '<p class="field-help">Carregando solicitações…</p>' : ''}
            ${data && data.received.length === 0 ? '<p class="field-help">Nenhuma solicitação recebida.</p>' : ''}
            <ul class="friendship-list">
              ${(data?.received || []).map(request => `
                <li>
                  <span>${this.person(request.name, request.username)}</span>
                  ${request.status === 'pending' ? `
                    <span class="friendship-actions">
                      <button class="btn btn-primary btn-respond-friend-request" data-id="${esc(request.id)}" data-action="accept">Aceitar</button>
                      <button class="btn btn-danger btn-respond-friend-request" data-id="${esc(request.id)}" data-action="reject">Recusar</button>
                    </span>
                  ` : `<span class="badge">${request.status === 'accepted' ? 'Aceita' : 'Recusada'}</span>`}
                </li>
              `).join('')}
            </ul>
          </section>
          <section class="glass-card">
            <h3>Solicitações enviadas</h3>
            ${!data && !error ? '<p class="field-help">Carregando solicitações…</p>' : ''}
            ${data && data.sent.length === 0 ? '<p class="field-help">Nenhuma solicitação enviada.</p>' : ''}
            <ul class="friendship-list">
              ${(data?.sent || []).map(request => `
                <li>
                  <span>${this.person(request.name, request.username)}</span>
                  <span class="badge">${request.status === 'pending' ? 'Pendente' : request.status === 'accepted' ? 'Aceita' : 'Recusada'}</span>
                </li>
              `).join('')}
            </ul>
          </section>
        </div>

        <section class="glass-card">
          <h3>Meus amigos</h3>
          ${!data && !error ? '<p class="field-help">Carregando amigos…</p>' : ''}
          ${data && data.friends.length === 0 ? '<p class="field-help">Você ainda não tem amizades. Pesquise um username acima para começar.</p>' : ''}
          <ul class="friendship-list">
            ${(data?.friends || []).map(friend => `
              <li>
                <span>${this.person(friend.name, friend.username)}</span>
                <button class="btn btn-danger btn-remove-friend" data-id="${esc(friend.id)}">Remover</button>
              </li>
            `).join('')}
          </ul>
        </section>
      </div>
    `;
  }
}
