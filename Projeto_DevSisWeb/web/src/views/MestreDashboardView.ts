import type {
  ApiMasterDashboard,
  ApiMasterDashboardActivity,
  ApiMasterDashboardCampaign
} from '../shared/types/campaignApi';

type DashboardOptions = {
  userName: string;
  summary: ApiMasterDashboard | null;
  loading: boolean;
  error: string | null;
  offline: boolean;
  localCampaigns: Array<{ name: string; createdAt?: string }>;
  date: Date;
};

export class MestreDashboardView {
  private static escape(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] || character);
  }

  private static formatDate(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Data indisponível'
      : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
  }

  private static metricCard(
    label: string,
    value: number | null,
    note: string,
    accent: string,
    loading: boolean
  ): string {
    const displayedValue = value === null
      ? `<span class="${loading ? 'master-dashboard-loading-value' : ''}" aria-label="${loading ? 'Carregando' : 'Indisponível'}">—</span>`
      : String(value);
    return `
      <article class="master-dashboard-metric" style="--metric-accent:${accent}">
        <span class="master-dashboard-metric-label">${label}</span>
        <strong>${displayedValue}</strong>
        <small>${note}</small>
      </article>
    `;
  }

  private static unavailableDataMessage(loading: boolean, error: string | null, offline: boolean): string {
    if (loading) return 'Carregando dados do gráfico…';
    if (offline) return 'Dados remotos indisponíveis no modo offline.';
    if (error) return 'Não foi possível carregar os dados deste gráfico.';
    return 'Os dados do gráfico ainda não foram carregados.';
  }

  private static statusChart(
    summary: ApiMasterDashboard | null,
    loading: boolean,
    error: string | null,
    offline: boolean
  ): string {
    if (!summary) {
      return `<div class="master-dashboard-chart-empty" role="status">${this.unavailableDataMessage(loading, error, offline)}</div>`;
    }

    const { activeCampaigns, inactiveCampaigns, totalCampaigns } = summary.metrics;
    if (totalCampaigns === 0) {
      return '<div class="master-dashboard-chart-empty">Crie uma campanha para visualizar sua distribuição por status.</div>';
    }

    const activeShare = Math.round((activeCampaigns / totalCampaigns) * 100);
    return `
      <div class="master-dashboard-status-chart">
        <div class="master-dashboard-donut" style="--active-share:${activeShare}%" role="img"
          aria-label="${activeCampaigns} campanhas ativas e ${inactiveCampaigns} inativas"
          title="Ativas: ${activeCampaigns} · Inativas: ${inactiveCampaigns}">
          <strong>${totalCampaigns}</strong><span>campanhas</span>
        </div>
        <ul class="master-dashboard-legend">
          <li title="${activeCampaigns} campanhas ativas"><span class="legend-dot is-active"></span>Ativas <strong>${activeCampaigns}</strong></li>
          <li title="${inactiveCampaigns} campanhas inativas"><span class="legend-dot is-inactive"></span>Inativas <strong>${inactiveCampaigns}</strong></li>
        </ul>
      </div>
    `;
  }

  private static participantChart(
    summary: ApiMasterDashboard | null,
    loading: boolean,
    error: string | null,
    offline: boolean
  ): string {
    if (!summary) {
      return `<div class="master-dashboard-chart-empty" role="status">${this.unavailableDataMessage(loading, error, offline)}</div>`;
    }
    if (summary.campaigns.length === 0) {
      return '<div class="master-dashboard-chart-empty">Não há campanhas para comparar participantes.</div>';
    }

    const campaigns = summary.campaigns.slice(0, 6);
    const maxParticipants = Math.max(1, ...campaigns.map(campaign => campaign.participantCount));
    return `
      <div class="master-dashboard-bars" role="img" aria-label="Vínculos de participantes por campanha">
        ${campaigns.map(campaign => {
          const width = Math.round((campaign.participantCount / maxParticipants) * 100);
          const name = this.escape(campaign.name);
          return `
            <div class="master-dashboard-bar-row" title="${name}: ${campaign.participantCount} participantes">
              <span>${name}</span>
              <div class="master-dashboard-bar-track"><i style="width:${width}%"></i></div>
              <strong>${campaign.participantCount}</strong>
            </div>
          `;
        }).join('')}
      </div>
      ${summary.campaigns.length > campaigns.length
        ? `<p class="master-dashboard-chart-footnote">Exibindo 6 de ${summary.campaigns.length} campanhas, ordenadas pela atualização mais recente.</p>`
        : ''}
    `;
  }

  private static campaignCard(campaign: ApiMasterDashboardCampaign): string {
    const name = this.escape(campaign.name);
    const systems = campaign.systems.length
      ? campaign.systems.map(system => this.escape(system)).join(', ')
      : 'Sem fichas com sistema associado';
    const status = campaign.isActive ? 'Ativa' : 'Inativa';
    return `
      <article class="master-dashboard-campaign">
        <div class="master-dashboard-campaign-heading">
          <div>
            <h3>${name}</h3>
            <p>Sistemas nas fichas vinculadas: ${systems}</p>
          </div>
          <span class="master-dashboard-status ${campaign.isActive ? 'is-active' : 'is-inactive'}">${status}</span>
        </div>
        <div class="master-dashboard-campaign-meta">
          <span title="Vínculos na tabela de membros">👥 ${campaign.participantCount} participantes</span>
          <span title="Personagens associados à campanha">🧙 ${campaign.characterCount} personagens</span>
          <span title="Combates registrados">⚔️ ${campaign.combatCount} combates</span>
          <span title="Última atualização">${this.formatDate(campaign.updatedAt)}</span>
        </div>
        <button class="btn btn-secondary" type="button" data-master-dashboard-manage>
          Gerenciar campanha
        </button>
      </article>
    `;
  }

  private static activityLabel(activity: ApiMasterDashboardActivity): string {
    const actor = activity.actorName ? this.escape(activity.actorName) : 'Jogador';
    const statusLabels: Record<string, string> = {
      pending: 'pendente',
      approved: 'aprovada',
      rejected: 'recusada',
      cancelled: 'cancelada',
      accepted: 'aceito',
      declined: 'recusado'
    };
    const detailValue = activity.detail
      ? statusLabels[activity.detail] || activity.detail
      : '';
    const detail = detailValue ? ` · ${this.escape(detailValue)}` : '';
    const descriptions: Record<ApiMasterDashboardActivity['type'], string> = {
      campaign_created: 'Campanha criada',
      campaign_updated: 'Campanha atualizada',
      participant_added: `${actor} foi adicionado(a) à campanha`,
      join_request: `${actor} enviou uma solicitação${detail}`,
      invitation_sent: `Convite enviado para ${actor}${detail}`,
      combat_created: `Combate registrado${detail}`
    };
    return descriptions[activity.type];
  }

  private static activityList(
    summary: ApiMasterDashboard | null,
    loading: boolean,
    error: string | null,
    offline: boolean
  ): string {
    if (loading && !summary) {
      return '<p class="master-dashboard-chart-empty" role="status">Carregando atividades recentes…</p>';
    }
    if (offline && !summary) {
      return '<p class="master-dashboard-chart-empty">Atividades remotas indisponíveis no modo offline.</p>';
    }
    if (error && !summary) {
      return '<p class="master-dashboard-chart-empty">Não foi possível carregar as atividades recentes.</p>';
    }
    if (!summary || summary.activities.length === 0) {
      return '<p class="master-dashboard-chart-empty">Ainda não há atividades registradas para exibir.</p>';
    }
    return `
      <ol class="master-dashboard-activity-list">
        ${summary.activities.map(activity => `
          <li>
            <span class="master-dashboard-activity-marker" aria-hidden="true"></span>
            <div>
              <strong>${this.activityLabel(activity)}</strong>
              <span>${this.escape(activity.campaignName)}</span>
            </div>
            <time datetime="${this.escape(activity.occurredAt)}">${this.formatDate(activity.occurredAt)}</time>
          </li>
        `).join('')}
      </ol>
    `;
  }

  public static render(options: DashboardOptions): string {
    const { userName, summary, loading, error, offline, localCampaigns, date } = options;
    const metricsLoading = loading && !summary;
    const value = (metric: keyof ApiMasterDashboard['metrics']): number | null =>
      summary ? summary.metrics[metric] : null;
    const localCampaignList = offline && !summary && localCampaigns.length
      ? `
        <div class="master-dashboard-offline-list">
          <h3>Campanhas salvas neste dispositivo</h3>
          <ul>${localCampaigns.map(campaign => `
            <li>${this.escape(campaign.name)}
              ${campaign.createdAt ? `<small>${this.formatDate(campaign.createdAt)}</small>` : ''}
            </li>
          `).join('')}</ul>
        </div>
      `
      : '';
    const campaignList = summary?.campaigns.length
      ? `<div class="master-dashboard-campaign-list">${summary.campaigns.map(campaign => this.campaignCard(campaign)).join('')}</div>`
      : summary
        ? '<div class="master-dashboard-empty">Nenhuma campanha encontrada. Crie sua primeira campanha para começar.</div>'
        : '';

    return `
      <main class="master-dashboard">
        <header class="master-dashboard-header">
          <div>
            <p class="master-dashboard-eyebrow">${this.formatDate(date)}</p>
            <h1>Olá, ${this.escape(userName)}.</h1>
            <p>Acompanhe suas campanhas, participantes e combates em um só lugar.</p>
          </div>
          <div class="master-dashboard-actions">
            <button type="button" class="btn btn-glow" data-master-dashboard-create>＋ Nova campanha</button>
            <button type="button" class="btn btn-secondary" data-master-dashboard-manage>Gerenciar campanhas</button>
            <button type="button" class="btn btn-icon" data-master-dashboard-refresh aria-label="Atualizar dashboard" title="Atualizar">↻</button>
          </div>
        </header>

        ${offline ? `
          <div class="master-dashboard-notice" role="status">
            Acesso local/offline: os indicadores e atividades remotos não estão sincronizados.
          </div>
        ` : ''}
        ${loading && summary ? `
          <div class="master-dashboard-notice" role="status">Atualizando os dados do dashboard…</div>
        ` : ''}
        ${error ? `
          <div class="master-dashboard-error" role="alert">
            <span>${this.escape(error)}</span>
            <button type="button" class="btn btn-secondary" data-master-dashboard-refresh>Tentar novamente</button>
          </div>
        ` : ''}

        <section class="master-dashboard-metrics" aria-label="Indicadores das campanhas">
          ${this.metricCard('Campanhas', value('totalCampaigns'), 'Campanhas próprias no workspace Mestre', 'var(--primary)', metricsLoading)}
          ${this.metricCard('Campanhas ativas', value('activeCampaigns'), summary ? `${summary.metrics.inactiveCampaigns} inativas` : 'Status das campanhas', 'var(--success)', metricsLoading)}
          ${this.metricCard('Participantes', value('participantLinks'), 'Vínculos de membros nas campanhas', 'var(--gold)', metricsLoading)}
          ${this.metricCard('Personagens vinculados', value('characterLinks'), 'Associações com campanhas', 'var(--gm-accent)', metricsLoading)}
          ${this.metricCard('Combates', value('totalCombats'), 'Combates registrados nas campanhas', '#38bdf8', metricsLoading)}
          ${this.metricCard('Solicitações pendentes', value('pendingJoinRequests'), 'Aguardando revisão', '#c084fc', metricsLoading)}
        </section>

        <section class="master-dashboard-chart-grid" aria-label="Gráficos das campanhas">
          <article class="glass-card master-dashboard-panel">
            <div class="master-dashboard-panel-heading">
              <div><h2>Campanhas por status</h2><p>Distribuição atual das suas campanhas</p></div>
            </div>
            ${this.statusChart(summary, loading, error, offline)}
          </article>
          <article class="glass-card master-dashboard-panel">
            <div class="master-dashboard-panel-heading">
              <div><h2>Participantes por campanha</h2><p>Vínculos de membros, por campanha</p></div>
            </div>
            ${this.participantChart(summary, loading, error, offline)}
          </article>
        </section>

        <section class="master-dashboard-lower-grid">
          <article class="glass-card master-dashboard-panel">
            <div class="master-dashboard-panel-heading">
              <div><h2>Suas campanhas</h2><p>Sistemas associados às fichas, participantes e combates</p></div>
              <button type="button" class="btn btn-secondary" data-master-dashboard-manage>Ver gerenciamento</button>
            </div>
            ${loading && !summary ? '<p class="master-dashboard-chart-empty" role="status">Carregando campanhas…</p>' : ''}
            ${campaignList}
            ${localCampaignList}
            ${offline && !localCampaigns.length && !summary ? '<p class="master-dashboard-chart-empty">Nenhuma campanha em cache local.</p>' : ''}
          </article>
          <article class="glass-card master-dashboard-panel">
            <div class="master-dashboard-panel-heading">
              <div><h2>Atividades recentes</h2><p>Eventos registrados nas suas campanhas</p></div>
            </div>
            ${this.activityList(summary, loading, error, offline)}
            ${summary && summary.activities.length === 0
              ? '<p class="master-dashboard-chart-footnote">O sistema não mantém um histórico de sessões; esta lista usa apenas campanhas, membros, solicitações, convites e combates.</p>'
              : ''}
          </article>
        </section>
      </main>
    `;
  }
}
