import {
  PlanService,
  type AvailablePlan,
  type CurrentPlanAccess,
  type UserSubscription,
} from '../services/PlanService';

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const featureLabels: Record<string, string> = {
  campaigns: 'Campanhas',
  characters: 'Personagens',
  monsters: 'Monstros',
  notes: 'Notas',
  missions: 'Missões',
};

const labelFor = (key: string): string => featureLabels[key] || key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, (letter) => letter.toLocaleUpperCase());

const periodLabel = (period: string): string => ({
  free: 'Gratuito',
  monthly: 'Mensal',
  annual: 'Anual',
}[period] || period);

const planTier = (plan: Pick<AvailablePlan, 'billingPeriod' | 'slug' | 'name'>): string => {
  if (plan.billingPeriod === 'free' || plan.slug === 'freemium') return 'Freemium';
  return 'Premium';
};

const money = (price: string | null, currency: string | null): string => {
  if (price === null || !currency) return 'Preço ainda não configurado';
  const amount = Number(price);
  if (!Number.isFinite(amount)) return 'Preço ainda não configurado';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount);
};

const displayDate = (value: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('pt-BR');
};

const benefitsHtml = (benefits: Record<string, boolean>, limits: Record<string, number | null>): string => {
  const enabled = Object.entries(benefits).filter(([, value]) => value === true);
  const configuredLimits = Object.entries(limits).filter(([, value]) => value !== null && value !== undefined);
  const rows = [
    ...enabled.map(([key]) => `<li>${escapeHtml(labelFor(key))}</li>`),
    ...configuredLimits.map(([key, value]) => `<li>${escapeHtml(labelFor(key))}: até ${escapeHtml(value)}</li>`),
  ];
  return rows.length
    ? `<ul class="my-plan-benefits">${rows.join('')}</ul>`
    : '<p class="my-plan-muted">Nenhum benefício ou limite adicional configurado.</p>';
};

const planCard = (plan: AvailablePlan, currentId: string): string => {
  const isCurrent = plan.id === currentId;
  const isPaid = plan.billingPeriod !== 'free';
  return `<article class="my-plan-card ${isCurrent ? 'is-current' : ''}">
    <header><div><span class="my-plan-tier">${escapeHtml(planTier(plan))}</span><h3>${escapeHtml(plan.name)}</h3></div>
      <div class="my-plan-badges">
        ${isCurrent ? '<span class="my-plan-current-badge">Seu plano atual</span>' : ''}
        ${isPaid ? '<span class="my-plan-coming-soon">Em breve</span>' : ''}
      </div></header>
    ${plan.description ? `<p>${escapeHtml(plan.description)}</p>` : ''}
    <p class="my-plan-price">${escapeHtml(plan.billingPeriod === 'free' ? 'Gratuito' : money(plan.price, plan.currency))}<small>${escapeHtml(periodLabel(plan.billingPeriod))}</small></p>
    <h4>Benefícios configurados</h4>
    ${benefitsHtml(plan.benefits || {}, plan.limits || {})}
  </article>`;
};

export class MyPlanView {
  static async render(container: HTMLElement, token: string): Promise<void> {
    container.innerHTML = '<div class="my-plan-loading" role="status">Carregando seu plano…</div>';
    try {
      const [access, plans, subscriptions] = await Promise.all([
        PlanService.currentAccess(token),
        PlanService.availablePlans(token),
        PlanService.subscriptions(token),
      ]);
      container.innerHTML = this.renderContent(access, plans, subscriptions);
      container.querySelector<HTMLButtonElement>('[data-my-plan-retry]')?.addEventListener('click', () => void this.render(container, token));
    } catch (error) {
      container.innerHTML = `<section class="my-plan-error"><h2>Não foi possível carregar os planos</h2><p>${escapeHtml(error instanceof Error ? error.message : 'Erro inesperado.')}</p><button class="btn btn-secondary" data-my-plan-retry>Tentar novamente</button></section>`;
      container.querySelector<HTMLButtonElement>('[data-my-plan-retry]')?.addEventListener('click', () => void this.render(container, token));
    }
  }

  private static renderContent(
    access: CurrentPlanAccess,
    plans: AvailablePlan[],
    subscriptions: UserSubscription[],
  ): string {
    const selected = plans.find((plan) => plan.id === access.plan.id);
    const activeSubscription = subscriptions.find((subscription) =>
      subscription.status === 'active' && subscription.planId === access.plan.id);
    const currentPrice = activeSubscription
      ? money(activeSubscription.contractedPrice, activeSubscription.currency)
      : selected
      ? selected.billingPeriod === 'free' ? 'Gratuito' : money(selected.price, selected.currency)
        : 'Preço contratado preservado no histórico';
    const currentPeriod = activeSubscription?.billingPeriod || access.plan.billingPeriod;
    const currentDetails = activeSubscription
      ? `<p>Valor contratado: <strong>${escapeHtml(currentPrice)}</strong> · ${escapeHtml(periodLabel(currentPeriod))}</p>
         <p>Início: ${escapeHtml(displayDate(activeSubscription.startsAt))} · Renovação: ${escapeHtml(displayDate(activeSubscription.renewsAt))}</p>`
      : `<p>${escapeHtml(currentPrice)} · ${escapeHtml(periodLabel(currentPeriod))}</p>`;
    const planCards = plans.length
      ? plans.map((plan) => planCard(plan, access.plan.id)).join('')
      : '<p class="my-plan-muted">Nenhum plano disponível para consulta.</p>';
    const hasPremium = plans.some((plan) => plan.billingPeriod !== 'free');
    const historical = subscriptions.filter((subscription) =>
      subscription.id !== activeSubscription?.id);

    return `<section class="my-plan-view">
      <div class="my-plan-heading"><div><p class="my-plan-eyebrow">CONTA</p><h2>Meu Plano</h2><p>Consulte seu plano e as opções disponíveis para sua conta.</p></div>
        <button class="btn btn-secondary" data-my-plan-retry>Atualizar</button></div>
      <section class="my-plan-current">
        <div><span class="my-plan-tier">${escapeHtml(planTier(access.plan))}</span><h3>${escapeHtml(access.plan.name)}</h3></div>
        ${currentDetails}
        ${benefitsHtml(access.benefits || {}, access.limits || {})}
      </section>
      <div class="my-plan-list-heading"><h3>Planos disponíveis</h3><span>Preços e moedas conforme configurados.</span></div>
      <div class="my-plan-grid">${planCards}</div>
      ${hasPremium ? '<p class="my-plan-unavailable">Você já pode consultar os detalhes e benefícios deste plano. A contratação estará disponível assim que a plataforma concluir a integração com o serviço de pagamentos.</p>' : ''}
      ${historical.length ? `<section class="my-plan-history"><h3>Histórico de assinaturas</h3>${historical.map((subscription) => `<article>
        <strong>${escapeHtml(subscription.planName)}</strong><span>${escapeHtml(subscription.status)}</span>
        <span>${escapeHtml(money(subscription.contractedPrice, subscription.currency))} · ${escapeHtml(periodLabel(subscription.billingPeriod))}</span>
        <small>Data do contrato: ${escapeHtml(displayDate(subscription.createdAt))}</small>
      </article>`).join('')}</section>` : ''}
    </section>`;
  }
}
