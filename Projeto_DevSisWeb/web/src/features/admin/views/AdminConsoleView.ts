import { AdminService, type AdminIdentity, type AdminPlan } from '../services/AdminService';

const resourceKeys = ['campaigns', 'characters', 'monsters', 'notes', 'missions'] as const;
const resourceLabels: Record<(typeof resourceKeys)[number], string> = {
  campaigns: 'Campanhas',
  characters: 'Personagens',
  monsters: 'Monstros',
  notes: 'Notas',
  missions: 'Missões',
};

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const money = (value: unknown, currency: unknown): string => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const code = String(currency || '');
  return code ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: code }).format(amount) : amount.toFixed(2);
};

const decimal = (value: unknown): string => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(amount)
    : '—';
};

const date = (value: unknown): string => {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pt-BR');
};

const table = (headers: string[], rows: string[], empty = 'Nenhum registro encontrado.'): string => (
  `<div class="admin-table-scroll"><table class="admin-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="admin-empty">${empty}</td></tr>`}</tbody></table></div>`
);

const card = (label: string, value: unknown, detail = ''): string => (
  `<article class="admin-metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</article>`
);

const planForm = (plan: AdminPlan | null): string => {
  const disabledPeriod = plan?.slug === 'freemium' ? 'disabled' : '';
  return `<form class="admin-form admin-plan-form" data-plan-id="${plan ? escapeHtml(plan.id) : ''}">
    <div class="admin-form-grid">
      <label>Nome<input name="name" required maxlength="120" value="${escapeHtml(plan?.name ?? '')}"></label>
      <label>Periodicidade<select name="billingPeriod" ${disabledPeriod}>
        <option value="monthly" ${plan?.billingPeriod === 'monthly' ? 'selected' : ''}>Mensal</option>
        <option value="annual" ${plan?.billingPeriod === 'annual' ? 'selected' : ''}>Anual</option>
        ${plan?.billingPeriod === 'free' ? '<option value="free" selected>Freemium</option>' : ''}
      </select></label>
      <label>Preço<input name="price" type="number" min="0" step="0.01" value="${escapeHtml(plan?.price ?? '')}" ${plan?.billingPeriod === 'free' ? 'disabled' : ''}></label>
      <label>Moeda<input name="currency" maxlength="3" pattern="[A-Z]{3}" placeholder="BRL" value="${escapeHtml(plan?.currency ?? '')}" ${plan?.billingPeriod === 'free' ? 'disabled' : ''}></label>
      <label>Status<select name="status" ${plan?.slug === 'freemium' ? 'disabled' : ''}>
        <option value="draft" ${plan?.status === 'draft' || !plan ? 'selected' : ''}>Rascunho</option>
        <option value="active" ${plan?.status === 'active' ? 'selected' : ''}>Ativo</option>
        <option value="inactive" ${plan?.status === 'inactive' ? 'selected' : ''}>Inativo</option>
      </select></label>
      <label class="admin-form-wide">Descrição<textarea name="description" rows="2" maxlength="2000">${escapeHtml(plan?.description ?? '')}</textarea></label>
    </div>
    <fieldset class="admin-fieldset"><legend>Benefícios disponíveis</legend><div class="admin-checkbox-grid">
      ${resourceKeys.map((key) => `<label><input type="checkbox" name="benefit-${key}" ${(plan?.benefits[key] !== false) ? 'checked' : ''}> ${resourceLabels[key]}</label>`).join('')}
    </div></fieldset>
    <fieldset class="admin-fieldset"><legend>Limites por conta (vazio = ilimitado)</legend><div class="admin-form-grid">
      ${resourceKeys.map((key) => `<label>${resourceLabels[key]}<input name="limit-${key}" type="number" min="0" step="1" value="${escapeHtml(plan?.limits[key] ?? '')}" placeholder="Ilimitado"></label>`).join('')}
    </div></fieldset>
    <button class="btn btn-primary" type="submit">${plan ? 'Salvar plano' : 'Criar plano'}</button>
  </form>`;
};

const renderDashboard = (data: Record<string, unknown>): string => {
  const dashboard = data.dashboard as Record<string, unknown>;
  const users = dashboard.users as Record<string, unknown>;
  const spaces = dashboard.workspaces as Record<string, unknown>;
  const journeys = dashboard.journeys as Record<string, unknown>;
  const resources = dashboard.resources as Record<string, unknown>;
  const resourceUsage = dashboard.resourceUsage as Record<string, unknown>;
  const finance = dashboard.financials as Array<Record<string, unknown>>;
  const subscriptionMetrics = dashboard.subscriptionMetrics as Record<string, unknown>;
  const subscriptionRows = (dashboard.subscriptions as Array<Record<string, unknown>>).map((item) =>
    `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.count)}</td></tr>`);
  const financialRows = finance.map((item) =>
    `<tr><td>${escapeHtml(item.currency)}</td><td>${money(item.gross, item.currency)}</td><td>${money(item.averageTicket, item.currency)}</td><td>${escapeHtml(item.paidTransactions)}</td><td>${money(item.refunds, item.currency)}</td><td>${money(item.providerFees, item.currency)}</td><td>${money(item.paidExpenses, item.currency)}</td><td>${money(item.net, item.currency)}</td></tr>`);
  return `<div class="admin-view-heading"><div><p class="admin-eyebrow">ADMINISTRAÇÃO</p><h2>Painel geral</h2><p>Atividade recente: ${escapeHtml(dashboard.activityWindowDays)} dias. Jogador e Mestre não são papéis exclusivos.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
    <div class="admin-metrics">
      ${card('Contas cadastradas', users.total)}${card('Ativos', users.active, `Janela de ${dashboard.activityWindowDays} dias`)}
      ${card('Inativos', users.inactive)}${card('Bloqueados', users.blocked)}${card('Novos (30 dias)', users.new_30d)}
      ${card('Total de UC', journeys?.uc ?? 0)}${card('Total de UP', journeys?.up ?? 0)}
      ${card('Total de UE', journeys?.ue ?? 0)}${card('Total de UA', journeys?.ua ?? 0)}
      ${card('Espaços Jogador usados', spaces.players)}${card('Espaços Mestre usados', spaces.masters)}
      ${card('Mestres Freemium', spaces.freemium_masters)}${card('Mestres Premium', spaces.premium_masters)}
      ${card('Total de recursos', resourceUsage?.total ?? resources.total ?? 0)}
      ${card('Média de uso por usuário', decimal(resourceUsage?.averagePerUser ?? 0), 'recursos por conta')}
      ${card('Cancelamentos (30 dias)', subscriptionMetrics.canceled30d, `${subscriptionMetrics.cancellationRatePercent}% das novas assinaturas`)}
    </div>
    <section class="admin-panel"><h3>Conteúdo cadastrado</h3><div class="admin-metrics admin-metrics-compact">
      ${Object.entries(resources).map(([key, value]) => card(key, value)).join('')}
    </div></section>
    <section class="admin-panel"><h3>Financeiro por moeda</h3>${table(['Moeda', 'Bruto pago', 'Ticket médio', 'Transações', 'Reembolsos', 'Tarifas', 'Despesas pagas', 'Líquido'], financialRows, 'Ainda não há pagamentos confirmados.')}</section>
    <section class="admin-panel"><h3>Assinaturas por status</h3>${table(['Status', 'Quantidade'], subscriptionRows)}</section>
    <p class="admin-notice">Receita líquida contabiliza somente pagamentos confirmados. Valores não são convertidos entre moedas; Freemium não tem limites quantitativos por padrão.</p>`;
};

export class AdminConsoleView {
  static async render(container: HTMLElement, tab: string, token: string, identity: AdminIdentity): Promise<void> {
    container.dataset.adminTab = tab;
    container.innerHTML = '<div class="admin-loading" role="status">Carregando dados administrativos…</div>';
    try {
      let html: string;
      switch (tab) {
        case 'admin-dashboard': html = renderDashboard(await AdminService.dashboard(token)); break;
        case 'admin-users': html = await this.renderUsers(token, identity); break;
        case 'admin-plans': html = await this.renderPlans(token, identity); break;
        case 'admin-systems': html = await this.renderSystems(token, identity); break;
        case 'admin-subscriptions': html = await this.renderSubscriptions(token, identity); break;
        case 'admin-payments': html = await this.renderPayments(token); break;
        case 'admin-expenses': html = await this.renderExpenses(token, identity); break;
        case 'admin-reports': html = await this.renderReports(token); break;
        case 'admin-settings': html = await this.renderSettings(token); break;
        case 'admin-audit': html = await this.renderAudit(token); break;
        default: html = '<p class="admin-notice">Esta seção administrativa não está disponível.</p>';
      }
      if (container.dataset.adminTab !== tab) return;
      container.innerHTML = html;
      this.bindEvents(container, token, identity);
    } catch (error) {
      if (container.dataset.adminTab !== tab) return;
      container.innerHTML = `<section class="admin-panel admin-error"><h2>Falha ao carregar</h2><p>${escapeHtml(error instanceof Error ? error.message : 'Erro administrativo inesperado.')}</p><button class="btn btn-secondary" data-admin-refresh>Tentar novamente</button></section>`;
      this.bindEvents(container, token, identity);
    }
  }

  private static async renderUsers(token: string, identity: AdminIdentity): Promise<string> {
    const data = await AdminService.users(token);
    const users = data.users as Array<Record<string, unknown>>;
    const canManageUsers = identity.permissions.includes('users.manage');
    const rows = users.map((user) => `<tr>
      <td>${escapeHtml(user.name)}<small>@${escapeHtml(user.username)}</small></td>
      <td>${escapeHtml(user.email)}</td><td>${user.playerWorkspace ? 'Jogador' : '—'}${user.masterWorkspace ? ' / Mestre' : ''}</td>
      <td>${user.isActive ? 'Ativa' : 'Bloqueada'}</td><td>${date(user.lastLoginAt)}</td>
      <td>${canManageUsers ? `<button class="btn btn-secondary admin-small-button" data-user-active="${escapeHtml(user.id)}" data-active="${String(!user.isActive)}">${user.isActive ? 'Bloquear' : 'Desbloquear'}</button>` : '—'}</td></tr>`);
    const permissionForm = identity.permissions.includes('admin.permissions.manage') ? `
      <form class="admin-form admin-inline-form" id="admin-permission-form">
        <h3>Administrar permissões ADM</h3>
        <label>ID do usuário<input name="userId" required inputmode="numeric" pattern="[0-9]+"></label>
        <label>Permissão<select name="permission">${identity.availablePermissions.map((permission) => `<option value="${escapeHtml(permission)}">${escapeHtml(permission)}</option>`).join('')}</select></label>
        <label>Ação<select name="granted"><option value="true">Conceder</option><option value="false">Revogar</option></select></label>
        <button class="btn btn-secondary" type="submit">Aplicar</button>
      </form>` : '';
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">CONTAS</p><h2>Usuários</h2><p>Bloqueios impedem login e chamadas autenticadas; não apagam dados.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      <form class="admin-search-form" id="admin-user-search"><label for="admin-user-query">Buscar</label><input id="admin-user-query" name="search" placeholder="Nome, usuário ou e-mail"><button class="btn btn-secondary">Buscar</button></form>
      ${table(['Usuário', 'E-mail', 'Espaços utilizados', 'Status', 'Último acesso', 'Ação'], rows)}
      ${permissionForm}`;
  }

  private static async renderPlans(token: string, identity: AdminIdentity): Promise<string> {
    const data = await AdminService.plans(token);
    const plans = data.plans;
    const canManage = identity.permissions.includes('plans.manage');
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">PRODUTO E ENTITLEMENTS</p><h2>Planos</h2><p>Freemium sem limites configurados significa ilimitado. Histórico de assinatura preserva preço e moeda contratados.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      ${canManage ? `<details class="admin-panel admin-plan-create"><summary>Criar plano pago</summary>${planForm(null)}</details>` : ''}
      ${plans.map((plan) => `<details class="admin-panel admin-plan-card"><summary><strong>${escapeHtml(plan.name)}</strong><span>${escapeHtml(plan.billingPeriod)} · ${escapeHtml(plan.status)} · ${plan.price === null ? 'Preço pendente' : money(plan.price, plan.currency)}</span></summary>${canManage ? planForm(plan) : `<p>${escapeHtml(plan.description)}</p>`}</details>`).join('')}`;
  }

  private static async renderSystems(token: string, identity: AdminIdentity): Promise<string> {
    const data = await AdminService.systems(token);
    const systems = data.systems as Array<Record<string, unknown>>;
    const canManage = identity.permissions.includes('systems.manage');
    const systemForm = (system?: Record<string, unknown>) => `<form class="admin-form admin-system-form" data-system-id="${escapeHtml(system?.id || '')}">
      <div class="admin-form-grid">
        <label>Nome<input name="name" required maxlength="120" value="${escapeHtml(system?.name || '')}"></label>
        <label>Slug<input name="slug" required maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(system?.slug || '')}"></label>
        <label>Status<select name="isActive"><option value="true" ${system?.isActive !== false ? 'selected' : ''}>Ativo</option><option value="false" ${system?.isActive === false ? 'selected' : ''}>Inativo</option></select></label>
        <label class="admin-form-wide">Descrição<textarea name="description" rows="2" maxlength="2000">${escapeHtml(system?.description || '')}</textarea></label>
      </div><button class="btn btn-primary">${system ? 'Salvar sistema' : 'Criar sistema'}</button>
    </form>`;
    const versionForm = (systemId: string, version?: Record<string, unknown>) => `<form class="admin-form admin-version-form" data-system-id="${escapeHtml(systemId)}" data-version-id="${escapeHtml(version?.id || '')}">
      <div class="admin-form-grid"><label>Versão<input name="name" required maxlength="120" value="${escapeHtml(version?.name || '')}"></label>
      <label>Slug<input name="slug" required maxlength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(version?.slug || '')}"></label>
      <label>Descrição<input name="description" maxlength="2000" value="${escapeHtml(version?.description || '')}"></label></div>
      <button class="btn btn-secondary admin-small-button">${version ? 'Salvar versão' : 'Adicionar versão'}</button>
    </form>`;
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">CATÁLOGO</p><h2>Sistemas e versões RPG</h2><p>Itens referenciados por fichas não são excluídos; use Inativo para retirar um sistema do catálogo.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      ${canManage ? `<section class="admin-panel"><h3>Novo sistema</h3>${systemForm()}</section>` : ''}
      ${systems.map((system) => `<details class="admin-panel"><summary><strong>${escapeHtml(system.name)}</strong><span>${escapeHtml(system.slug)} · ${system.isActive ? 'ativo' : 'inativo'}</span></summary>
        ${canManage ? systemForm(system) : `<p>${escapeHtml(system.description || '')}</p>`}
        <h4>Versões</h4>
        ${(system.versions as Array<Record<string, unknown>>).map((version) => canManage
          ? versionForm(String(system.id), version)
          : `<p>${escapeHtml(version.name)} · ${escapeHtml(version.slug)}</p>`).join('')}
        ${canManage ? versionForm(String(system.id)) : ''}
      </details>`).join('')}`;
  }

  private static async renderSubscriptions(token: string, identity: AdminIdentity): Promise<string> {
    const data = await AdminService.subscriptions(token);
    const canManage = identity.permissions.includes('subscriptions.manage');
    const rows = (data.subscriptions as Array<Record<string, unknown>>).map((item) => `<tr>
      <td>${escapeHtml(item.user && (item.user as Record<string, unknown>).username)}<small>${escapeHtml(item.user && (item.user as Record<string, unknown>).email)}</small></td>
      <td>${escapeHtml(item.planName)} (${escapeHtml(item.billingPeriod)})</td>
      <td>${money(item.contractedPrice, item.currency)}</td><td>${escapeHtml(item.status)}</td>
      <td>${date(item.startsAt)}<small>Até: ${date(item.endsAt)}</small></td>
      <td>${canManage && ['pending', 'active', 'past_due'].includes(String(item.status)) ? `<button class="btn btn-secondary admin-small-button" data-cancel-subscription="${escapeHtml(item.id)}">Cancelar</button>` : '—'}</td></tr>`);
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">ASSINATURAS</p><h2>Contratos</h2><p>Não é permitido marcar pagamentos como confirmados sem integração de provedor.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      ${table(['Conta', 'Plano', 'Preço contratado', 'Status', 'Período', 'Ação'], rows)}`;
  }

  private static async renderPayments(token: string): Promise<string> {
    const data = await AdminService.payments(token);
    const rows = (data.payments as Array<Record<string, unknown>>).map((payment) => `<tr>
      <td>${date(payment.occurredAt)}</td><td>${escapeHtml(payment.user && (payment.user as Record<string, unknown>).username)}</td>
      <td>${escapeHtml(payment.status)}</td><td>${money(payment.amount, payment.currency)}</td>
      <td>${money(payment.refundedAmount, payment.currency)}</td><td>${money(payment.providerFee, payment.currency)}</td>
      <td>${escapeHtml(payment.provider || '—')}</td></tr>`);
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">FINANCEIRO</p><h2>Pagamentos</h2><p>Somente eventos provenientes de provedor confirmado poderão gerar lançamentos.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      ${table(['Data', 'Conta', 'Status', 'Valor', 'Reembolsado', 'Tarifa', 'Provedor'], rows)}`;
  }

  private static async renderExpenses(token: string, identity: AdminIdentity): Promise<string> {
    const data = await AdminService.expenses(token);
    const canManage = identity.permissions.includes('expenses.manage');
    const rows = (data.expenses as Array<Record<string, unknown>>).map((expense) => `<tr>
      <td>${escapeHtml(expense.description)}<small>${escapeHtml(expense.category)}</small></td>
      <td>${date(expense.occurredOn)}</td><td>${money(expense.amount, expense.currency)}</td><td>${escapeHtml(expense.status)}</td>
      <td>${canManage && expense.status !== 'void' ? `<button class="btn btn-secondary admin-small-button" data-void-expense="${escapeHtml(expense.id)}">Estornar</button>` : '—'}</td></tr>`);
    const today = new Date().toISOString().slice(0, 10);
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">FINANCEIRO</p><h2>Despesas</h2><p>Registros estornados permanecem no histórico de auditoria.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      ${canManage ? `<form class="admin-form admin-panel admin-expense-form" id="admin-expense-form"><h3>Registrar despesa</h3>
        <div class="admin-form-grid">
          <label>Descrição<input name="description" required maxlength="240"></label>
          <label>Categoria<input name="category" required maxlength="60"></label>
          <label>Valor<input name="amount" required type="number" min="0.01" step="0.01"></label>
          <label>Moeda<input name="currency" required maxlength="3" pattern="[A-Z]{3}" placeholder="BRL"></label>
          <label>Data<input name="occurredOn" required type="date" value="${today}"></label>
          <label>Status<select name="status"><option value="paid">Pago</option><option value="pending">Pendente</option></select></label>
          <label class="admin-form-wide">Observações<textarea name="notes" rows="2" maxlength="4000"></textarea></label>
        </div><button class="btn btn-primary" type="submit">Registrar</button></form>` : ''}
      ${table(['Despesa', 'Data', 'Valor', 'Status', 'Ação'], rows)}`;
  }

  private static async renderReports(token: string): Promise<string> {
    const data = await AdminService.reports(token);
    const financial = data.financial as Record<string, unknown>;
    const payments = (financial.payments as Array<Record<string, unknown>>).map((row) => `<tr><td>${escapeHtml(row.period)}</td><td>${escapeHtml(row.currency)}</td><td>${money(row.gross, row.currency)}</td><td>${money(row.refunds, row.currency)}</td><td>${money(row.fees, row.currency)}</td><td>${escapeHtml(row.transactions)}</td></tr>`);
    const expenses = (financial.expenses as Array<Record<string, unknown>>).map((row) => `<tr><td>${escapeHtml(row.period)}</td><td>${escapeHtml(row.currency)}</td><td>${money(row.expenses, row.currency)}</td><td>${escapeHtml(row.entries)}</td></tr>`);
    const subscriptionRows = (data.subscriptions as Array<Record<string, unknown>>).map((row) => `<tr><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.billing_period)}</td><td>${escapeHtml(row.currency || '—')}</td><td>${escapeHtml(row.count)}</td><td>${row.contracted_total ? money(row.contracted_total, row.currency) : '—'}</td></tr>`);
    const contentRows = (data.contentCreation as Array<Record<string, unknown>>).map((row) => `<tr><td>${escapeHtml(row.resource)}</td><td>${escapeHtml(row.count)}</td></tr>`);
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">RELATÓRIOS</p><h2>Relatórios operacionais e financeiros</h2><p>${escapeHtml(data.financialNote)}</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      <section class="admin-panel"><h3>Pagamentos confirmados</h3>${table(['Mês', 'Moeda', 'Bruto', 'Reembolsos', 'Tarifas', 'Transações'], payments)}</section>
      <section class="admin-panel"><h3>Despesas pagas</h3>${table(['Mês', 'Moeda', 'Despesas', 'Lançamentos'], expenses)}</section>
      <section class="admin-panel"><h3>Assinaturas criadas no período</h3>${table(['Status', 'Periodicidade', 'Moeda', 'Quantidade', 'Valor contratado'], subscriptionRows)}</section>
      <section class="admin-panel"><h3>Criação de conteúdo no período</h3>${table(['Tipo', 'Quantidade'], contentRows)}</section>`;
  }

  private static async renderSettings(token: string): Promise<string> {
    const data = await AdminService.settings(token);
    const settings = data.settings as Record<string, unknown>;
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">CONFIGURAÇÃO</p><h2>Parâmetros administrativos</h2></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      <form class="admin-form admin-panel" id="admin-settings-form"><h3>Métrica de usuários ativos</h3>
        <p>Uma conta ativa é aquela habilitada com último login dentro da janela. Bloqueadas são contabilizadas separadamente.</p>
        <label>Dias da janela (1–365)<input name="activeUserWindowDays" type="number" required min="1" max="365" step="1" value="${escapeHtml(settings.activeUserWindowDays)}"></label>
        <button class="btn btn-primary">Salvar configuração</button>
      </form>
      <p class="admin-notice">Nenhum provedor de pagamentos está configurado. Checkout e confirmação automática permanecem indisponíveis.</p>`;
  }

  private static async renderAudit(token: string): Promise<string> {
    const data = await AdminService.audit(token);
    const rows = (data.entries as Array<Record<string, unknown>>).map((entry) => `<tr>
      <td>${date(entry.createdAt)}</td><td>${escapeHtml(entry.actor && (entry.actor as Record<string, unknown>).username || (entry.actor as Record<string, unknown>)?.source || '—')}</td>
      <td>${escapeHtml(entry.action)}</td><td>${escapeHtml(entry.entityType)} #${escapeHtml(entry.entityId || '')}</td>
      <td><details><summary>Ver detalhes</summary><pre>${escapeHtml(JSON.stringify({ before: entry.before, after: entry.after, metadata: entry.metadata }, null, 2))}</pre></details></td></tr>`);
    return `<div class="admin-view-heading"><div><p class="admin-eyebrow">SEGURANÇA</p><h2>Trilha de auditoria</h2><p>Eventos administrativos registrados como append-only.</p></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
      ${table(['Data', 'Responsável', 'Ação', 'Registro', 'Detalhes'], rows)}`;
  }

  private static bindEvents(container: HTMLElement, token: string, identity: AdminIdentity): void {
    container.querySelectorAll<HTMLButtonElement>('[data-admin-refresh]').forEach((button) => {
      button.addEventListener('click', () => void this.render(container, container.dataset.adminTab || 'admin-dashboard', token, identity));
    });
    container.querySelectorAll<HTMLButtonElement>('[data-user-active]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await AdminService.setUserActive(token, button.dataset.userActive || '', button.dataset.active === 'true');
          await this.render(container, 'admin-users', token, identity);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.');
          button.disabled = false;
        }
      });
    });
    container.querySelector<HTMLFormElement>('#admin-user-search')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = new FormData(event.currentTarget as HTMLFormElement).get('search')?.toString() || '';
      void this.renderUserSearch(container, token, identity, query);
    });
    container.querySelector<HTMLFormElement>('#admin-permission-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const values = new FormData(form);
      try {
        await AdminService.setPermission(token, String(values.get('userId')), String(values.get('permission')), values.get('granted') === 'true');
        window.alert('Permissão atualizada e registrada na auditoria.');
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível alterar a permissão.');
      }
    });
    container.querySelectorAll<HTMLFormElement>('.admin-plan-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const benefits = Object.fromEntries(resourceKeys.map((key) => [`${key}`, values.get(`benefit-${key}`) === 'on']));
        const limits = Object.fromEntries(resourceKeys.map((key) => {
          const value = String(values.get(`limit-${key}`) || '').trim();
          return [key, value === '' ? null : Number(value)];
        }));
        const payload = {
          name: values.get('name'), description: values.get('description'),
          billingPeriod: form.querySelector<HTMLSelectElement>('[name="billingPeriod"]')?.value,
          status: values.get('status'),
          price: String(values.get('price') || '').trim() === '' ? null : Number(values.get('price')),
          currency: String(values.get('currency') || '').trim() || null,
          benefits, limits,
        };
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (button) button.disabled = true;
        try {
          await AdminService.savePlan(token, form.dataset.planId || null, payload);
          await this.render(container, 'admin-plans', token, identity);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Não foi possível salvar o plano.');
          if (button) button.disabled = false;
        }
      });
      container.querySelectorAll<HTMLFormElement>('.admin-system-form').forEach((form) => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(form);
          const payload = {
            name: values.get('name'), slug: values.get('slug'), description: values.get('description'),
            isActive: values.get('isActive') === 'true',
          };
          try {
            await AdminService.saveSystem(token, form.dataset.systemId || null, payload);
            await this.render(container, 'admin-systems', token, identity);
          } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Não foi possível salvar o sistema.');
          }
        });
      });
      container.querySelectorAll<HTMLFormElement>('.admin-version-form').forEach((form) => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(form);
          try {
            await AdminService.saveSystemVersion(
              token,
              form.dataset.systemId || '',
              form.dataset.versionId || null,
              { name: values.get('name'), slug: values.get('slug'), description: values.get('description') },
            );
            await this.render(container, 'admin-systems', token, identity);
          } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Não foi possível salvar a versão.');
          }
        });
      });
    });
    container.querySelectorAll<HTMLButtonElement>('[data-cancel-subscription]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Cancelar imediatamente esta assinatura?')) return;
        try {
          await AdminService.cancelSubscription(token, button.dataset.cancelSubscription || '');
          await this.render(container, 'admin-subscriptions', token, identity);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Não foi possível cancelar a assinatura.');
        }
      });
    });
    container.querySelector<HTMLFormElement>('#admin-expense-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget as HTMLFormElement);
      try {
        await AdminService.saveExpense(token, null, Object.fromEntries(values.entries()));
        await this.render(container, 'admin-expenses', token, identity);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível registrar a despesa.');
      }
    });
    container.querySelectorAll<HTMLButtonElement>('[data-void-expense]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Estornar esta despesa? O lançamento será preservado no histórico.')) return;
        try {
          await AdminService.voidExpense(token, button.dataset.voidExpense || '');
          await this.render(container, 'admin-expenses', token, identity);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Não foi possível estornar a despesa.');
        }
      });
    });
    container.querySelector<HTMLFormElement>('#admin-settings-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget as HTMLFormElement);
      try {
        await AdminService.updateSettings(token, Number(values.get('activeUserWindowDays')));
        await this.render(container, 'admin-settings', token, identity);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível salvar a configuração.');
      }
    });
  }

  private static async renderUserSearch(container: HTMLElement, token: string, identity: AdminIdentity, query: string): Promise<void> {
    const oldTab = container.dataset.adminTab;
    container.dataset.adminTab = 'admin-users';
    container.innerHTML = '<div class="admin-loading">Buscando contas…</div>';
    try {
      const data = await AdminService.users(token, query);
      const users = data.users as Array<Record<string, unknown>>;
      const canManageUsers = identity.permissions.includes('users.manage');
      const rows = users.map((user) => `<tr><td>${escapeHtml(user.name)}<small>@${escapeHtml(user.username)}</small></td><td>${escapeHtml(user.email)}</td><td>${user.playerWorkspace ? 'Jogador' : '—'}${user.masterWorkspace ? ' / Mestre' : ''}</td><td>${user.isActive ? 'Ativa' : 'Bloqueada'}</td><td>${date(user.lastLoginAt)}</td><td>${canManageUsers ? `<button class="btn btn-secondary admin-small-button" data-user-active="${escapeHtml(user.id)}" data-active="${String(!user.isActive)}">${user.isActive ? 'Bloquear' : 'Desbloquear'}</button>` : '—'}</td></tr>`);
      container.innerHTML = `<div class="admin-view-heading"><div><p class="admin-eyebrow">CONTAS</p><h2>Usuários</h2></div><button class="btn btn-secondary" data-admin-refresh>Atualizar</button></div>
        <form class="admin-search-form" id="admin-user-search"><label for="admin-user-query">Buscar</label><input id="admin-user-query" name="search" value="${escapeHtml(query)}" placeholder="Nome, usuário ou e-mail"><button class="btn btn-secondary">Buscar</button></form>
        ${table(['Usuário', 'E-mail', 'Espaços utilizados', 'Status', 'Último acesso', 'Ação'], rows)}
        ${identity.permissions.includes('admin.permissions.manage') ? `<form class="admin-form admin-inline-form" id="admin-permission-form"><h3>Administrar permissões ADM</h3><label>ID do usuário<input name="userId" required inputmode="numeric" pattern="[0-9]+"></label><label>Permissão<select name="permission">${identity.availablePermissions.map((permission) => `<option value="${escapeHtml(permission)}">${escapeHtml(permission)}</option>`).join('')}</select></label><label>Ação<select name="granted"><option value="true">Conceder</option><option value="false">Revogar</option></select></label><button class="btn btn-secondary" type="submit">Aplicar</button></form>` : ''}`;
      this.bindEvents(container, token, identity);
    } catch (error) {
      container.dataset.adminTab = oldTab || 'admin-users';
      container.innerHTML = `<p class="admin-error">${escapeHtml(error instanceof Error ? error.message : 'Não foi possível buscar usuários.')}</p>`;
    }
  }
}
