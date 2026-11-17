import {
  PlanService,
  type AvailablePlan,
  type CurrentPlanAccess,
  type FreeTrialStatus,
  type PaymentSimulatorStatus,
  type SimulatedCheckout,
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
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pt-BR');
};

const remainingTime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}min`;
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

const planCard = (plan: AvailablePlan, currentId: string, simulatorEnabled: boolean): string => {
  const isCurrent = plan.id === currentId;
  const isPaid = plan.billingPeriod !== 'free';
  return `<article class="my-plan-card ${isCurrent ? 'is-current' : ''}">
    <header><div><span class="my-plan-tier">${escapeHtml(planTier(plan))}</span><h3>${escapeHtml(plan.name)}</h3></div>
      <div class="my-plan-badges">
        ${isCurrent ? '<span class="my-plan-current-badge">Seu plano atual</span>' : ''}
        ${isPaid ? simulatorEnabled
          ? '<span class="my-plan-current-badge">Simulador de teste</span>'
          : '<span class="my-plan-coming-soon">Indisponível</span>' : ''}
      </div></header>
    ${plan.description ? `<p>${escapeHtml(plan.description)}</p>` : ''}
    <p class="my-plan-price">${escapeHtml(plan.billingPeriod === 'free' ? 'Gratuito' : money(plan.price, plan.currency))}<small>${escapeHtml(periodLabel(plan.billingPeriod))}</small></p>
    <h4>Benefícios configurados</h4>
    ${benefitsHtml(plan.benefits || {}, plan.limits || {})}
    ${isPaid && simulatorEnabled && !isCurrent
      ? `<button type="button" class="btn btn-primary" data-simulated-checkout="${escapeHtml(plan.id)}">Simular contratação</button>`
      : ''}
  </article>`;
};

export class MyPlanView {
  private static countdownTimer: number | null = null;

  static async render(
    container: HTMLElement,
    token: string,
    pendingCheckout: SimulatedCheckout | null = null,
  ): Promise<void> {
    if (this.countdownTimer !== null) window.clearInterval(this.countdownTimer);
    this.countdownTimer = null;
    container.innerHTML = '<div class="my-plan-loading" role="status">Carregando seu plano…</div>';
    try {
      const [access, plans, subscriptions, trial, simulator] = await Promise.all([
        PlanService.currentAccess(token),
        PlanService.availablePlans(token),
        PlanService.subscriptions(token),
        PlanService.freeTrial(token),
        PlanService.paymentSimulatorStatus(token),
      ]);
      container.innerHTML = this.renderContent(access, plans, subscriptions, trial, simulator, pendingCheckout);
      container.querySelector<HTMLButtonElement>('[data-my-plan-retry]')?.addEventListener('click', () => void this.render(container, token));
      this.bindTrial(container, token, trial);
      this.bindCancellation(container, token, subscriptions);
      this.bindTrialCancellation(container, token, trial);
      this.bindSimulator(container, token, plans, simulator, pendingCheckout);
      if (trial.trial?.status === 'active') {
        this.countdownTimer = window.setInterval(() => {
          const output = container.querySelector<HTMLElement>('[data-trial-countdown]');
          if (!output) return;
          const remaining = Number(output.dataset.remainingSeconds || '0') - 60;
          if (remaining <= 0) {
            void this.render(container, token);
            return;
          }
          output.dataset.remainingSeconds = String(remaining);
          output.textContent = remainingTime(remaining);
        }, 60_000);
      }
    } catch (error) {
      container.innerHTML = `<section class="my-plan-error"><h2>Não foi possível carregar os planos</h2><p>${escapeHtml(error instanceof Error ? error.message : 'Erro inesperado.')}</p><button class="btn btn-secondary" data-my-plan-retry>Tentar novamente</button></section>`;
      container.querySelector<HTMLButtonElement>('[data-my-plan-retry]')?.addEventListener('click', () => void this.render(container, token));
    }
  }

  private static bindTrial(container: HTMLElement, token: string, trial: FreeTrialStatus): void {
    const button = container.querySelector<HTMLButtonElement>('[data-start-free-trial]');
    button?.addEventListener('click', async () => {
      const planId = container.querySelector<HTMLSelectElement>('[data-trial-plan]')?.value;
      const selectedPlan = trial.premiumPlans.find((plan) => plan.id === planId);
      if (!selectedPlan) return;
      const launchOffer = trial.launchOffer.spotsRemaining > 0;
      const durationDays = launchOffer ? trial.launchOffer.durationDays : 7;
      const confirmed = window.confirm(
        `Ativar o Premium gratuitamente por ${durationDays} dias no plano ${selectedPlan.name}? ` +
        'Nenhuma cobrança será feita agora ou automaticamente ao final. Depois do período, ' +
        'sua conta volta ao Freemium, a menos que você contrate o Premium manualmente.',
      );
      if (!confirmed) return;
      button.disabled = true;
      try {
        await PlanService.activateFreeTrial(token, selectedPlan.id, launchOffer);
        window.alert(`Premium ativado por ${durationDays} dias. Nenhuma cobrança automática será realizada.`);
        await this.render(container, token);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível ativar o teste.');
        await this.render(container, token);
      }
    });
  }

  private static bindCancellation(
    container: HTMLElement,
    token: string,
    subscriptions: UserSubscription[],
  ): void {
    container.querySelectorAll<HTMLButtonElement>('[data-cancel-my-subscription]').forEach((button) => {
      button.addEventListener('click', async () => {
      const subscription = subscriptions.find((item) => item.id === button.dataset.cancelMySubscription);
      if (!subscription) return;
      const endDate = displayDate(subscription.endsAt || subscription.renewsAt);
      const preservesAccess = subscription.status === 'active' && endDate !== '—';
      if (!window.confirm(
        preservesAccess
          ? `Cancelar este contrato e impedir novas renovações? O Premium continua disponível até ${endDate}.`
          : `Cancelar este contrato? ${subscription.status === 'pending'
            ? 'O pagamento pendente também será cancelado.'
            : 'Não haverá novas cobranças.'}`,
      )) return;
      button.disabled = true;
      try {
        const message = await PlanService.cancelSubscription(token, subscription.id);
        window.alert(message);
        await this.render(container, token);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível cancelar a renovação.');
        await this.render(container, token);
      }
      });
    });
  }

  private static bindTrialCancellation(
    container: HTMLElement,
    token: string,
    trial: FreeTrialStatus,
  ): void {
    const button = container.querySelector<HTMLButtonElement>('[data-cancel-free-trial]');
    if (!button || trial.trial?.status !== 'active') return;
    button.addEventListener('click', async () => {
      if (!window.confirm(
        'Encerrar agora o período gratuito de Premium? O acesso Premium termina imediatamente e não será restaurado.',
      )) return;
      button.disabled = true;
      try {
        const message = await PlanService.cancelFreeTrial(token);
        window.alert(message);
        await this.render(container, token);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Não foi possível cancelar o período gratuito.');
        await this.render(container, token);
      }
    });
  }

  private static bindSimulator(
    container: HTMLElement,
    token: string,
    plans: AvailablePlan[],
    simulator: PaymentSimulatorStatus,
    pendingCheckout: SimulatedCheckout | null,
  ): void {
    if (!simulator.enabled) return;
    container.querySelectorAll<HTMLButtonElement>('[data-simulated-checkout]').forEach((button) => {
      button.addEventListener('click', async () => {
        const plan = plans.find((item) => item.id === button.dataset.simulatedCheckout);
        if (!plan) return;
        button.disabled = true;
        try {
          const checkout = await PlanService.createCheckout(token, plan.id);
          await this.render(container, token, checkout);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Não foi possível iniciar o teste de pagamento.');
          await this.render(container, token);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-simulated-outcome]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!pendingCheckout) return;
        const outcome = button.dataset.simulatedOutcome;
        if (outcome !== 'approved' && outcome !== 'declined') return;
        button.disabled = true;
        try {
          await PlanService.completeSimulatedPayment(token, pendingCheckout.paymentId, outcome);
          window.alert(outcome === 'approved'
            ? 'Pagamento de teste aprovado. Nenhum dinheiro foi movimentado.'
            : 'Pagamento de teste recusado. Nenhum dinheiro foi movimentado.');
          await this.render(container, token);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Não foi possível concluir a simulação.');
          await this.render(container, token, pendingCheckout);
        }
      });
    });
  }

  private static renderContent(
    access: CurrentPlanAccess,
    plans: AvailablePlan[],
    subscriptions: UserSubscription[],
    trial: FreeTrialStatus,
    simulator: PaymentSimulatorStatus,
    pendingCheckout: SimulatedCheckout | null,
  ): string {
    const selected = plans.find((plan) => plan.id === access.plan.id);
    const activeSubscription = subscriptions.find((subscription) =>
      (subscription.status === 'active'
        || (subscription.status === 'canceled' && subscription.cancelAtPeriodEnd))
      && subscription.planId === access.plan.id);
    const currentPrice = activeSubscription
      ? money(activeSubscription.contractedPrice, activeSubscription.currency)
      : selected
      ? selected.billingPeriod === 'free' ? 'Gratuito' : money(selected.price, selected.currency)
        : 'Preço contratado preservado no histórico';
    const currentPeriod = activeSubscription?.billingPeriod || access.plan.billingPeriod;
    const currentDetails = activeSubscription
      ? `<p>Valor contratado: <strong>${escapeHtml(currentPrice)}</strong> · ${escapeHtml(periodLabel(currentPeriod))}</p>
         <p>Início: ${escapeHtml(displayDate(activeSubscription.startsAt))} · Renovação: ${escapeHtml(displayDate(activeSubscription.renewsAt))}</p>
         ${activeSubscription.cancelAtPeriodEnd
            ? `<p class="my-plan-trial-warning">Renovação cancelada. Seu acesso Premium permanece até ${escapeHtml(displayDate(activeSubscription.endsAt || activeSubscription.renewsAt))}.</p>`
            : activeSubscription.paymentProvider === 'simulator'
              ? `<p class="my-plan-muted">Assinatura de teste. Nenhuma cobrança real será feita.</p>
                 <button type="button" class="btn btn-secondary" data-cancel-my-subscription="${escapeHtml(activeSubscription.id)}">Cancelar contrato de teste</button>`
              : `<button type="button" class="btn btn-secondary" data-cancel-my-subscription="${escapeHtml(activeSubscription.id)}">Cancelar contrato</button>`}`
      : `<p>${escapeHtml(currentPrice)} · ${escapeHtml(periodLabel(currentPeriod))}</p>`;
    const planCards = plans.length
      ? plans.map((plan) => planCard(plan, access.plan.id, simulator.enabled)).join('')
      : '<p class="my-plan-muted">Nenhum plano disponível para consulta.</p>';
    const hasPremium = plans.some((plan) => plan.billingPeriod !== 'free');
    const historical = subscriptions.filter((subscription) => subscription.id !== activeSubscription?.id);
    const trialSection = trial.trial
      ? `<section class="my-plan-trial" aria-live="polite">
          <p class="my-plan-eyebrow">AVALIAÇÃO PREMIUM</p>
          <h3>${trial.trial.status === 'active'
            ? trial.trial.isLaunchOffer ? 'Sua oferta Premium de 30 dias está ativa' : 'Seu teste Premium está ativo'
            : 'Seu período Premium gratuito foi encerrado'}</h3>
          <p>Plano: <strong>${escapeHtml(trial.trial.planName)}</strong></p>
          <p>Duração: <strong>${trial.trial.durationDays} dias</strong></p>
          <p>Ativado em: ${escapeHtml(displayDate(trial.trial.activatedAt))}</p>
          <p>Encerramento: <strong>${escapeHtml(displayDate(trial.trial.endsAt))}</strong></p>
          ${trial.trial.status === 'active'
            ? `<p>Tempo restante: <strong data-trial-countdown data-remaining-seconds="${trial.trial.remainingSeconds}">${escapeHtml(remainingTime(trial.trial.remainingSeconds))}</strong></p>
              ${trial.trial.remainingSeconds <= 172800 ? '<p class="my-plan-trial-warning">Seu teste está próximo do fim. Ao encerrar, o acesso volta ao Freemium, salvo se você contratar o Premium manualmente.</p>' : ''}
              <p>Nenhuma cobrança será feita ao terminar o teste. Sua conta voltará ao Freemium, a menos que você escolha contratar um plano.</p>`
            : '<p>O acesso temporário terminou. Sua conta usa as permissões do Freemium, salvo se houver uma assinatura Premium ativa. O teste não pode ser iniciado novamente.</p>'}
          ${trial.trial.status === 'active'
            ? '<button type="button" class="btn btn-secondary" data-cancel-free-trial>Cancelar período gratuito</button>'
            : ''}
        </section>`
      : trial.eligible
        ? (() => {
          const launchOfferAvailable = trial.launchOffer.spotsRemaining > 0;
          const durationDays = launchOfferAvailable ? trial.launchOffer.durationDays : 7;
          return `<section class="my-plan-trial">
            <p class="my-plan-eyebrow">${launchOfferAvailable ? 'OFERTA DE LANÇAMENTO' : 'EXPERIMENTE O PREMIUM'}</p>
            <h3>${launchOfferAvailable
              ? `Os ${trial.launchOffer.spotsRemaining} primeiros ativam ${durationDays} dias de Premium gratuito.`
              : 'Experimente o Premium gratuitamente por 7 dias.'}</h3>
            <p>Use os benefícios do plano escolhido durante ${durationDays} dias exatos. O período é único por conta e não exige forma de pagamento.</p>
            <label for="my-plan-trial-choice">Plano Premium</label>
            <select id="my-plan-trial-choice" data-trial-plan>
              ${trial.premiumPlans.map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} · ${escapeHtml(money(plan.price, plan.currency))} após o teste (${escapeHtml(periodLabel(plan.billingPeriod))})</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary" data-start-free-trial>Ativar Premium gratuito por ${durationDays} dias</button>
            <p class="my-plan-muted">Ao final, não haverá cobrança nem conversão automática. Você voltará ao Freemium e poderá contratar manualmente pelo preço informado acima.</p>
          </section>`;
        })()
        : trial.hasActiveSubscription
          ? '<section class="my-plan-trial"><h3>Seu plano Premium já está ativo</h3><p>O teste gratuito não está disponível para contas com assinatura ativa.</p></section>'
          : '';
    const simulatorSection = pendingCheckout
      ? `<section class="my-plan-trial" aria-live="polite">
          <p class="my-plan-eyebrow">SIMULADOR DE PAGAMENTO · TESTE</p>
          <h3>Escolha o resultado para “${escapeHtml(pendingCheckout.planName)}”</h3>
          <p>Valor de teste: <strong>${escapeHtml(money(pendingCheckout.amount, pendingCheckout.currency))}</strong> · ${escapeHtml(periodLabel(pendingCheckout.billingPeriod))}</p>
          <p>Nenhuma transação real será realizada. Esta simulação só altera os dados de teste da conta.</p>
          <button type="button" class="btn btn-primary" data-simulated-outcome="approved">Simular aprovação</button>
          <button type="button" class="btn btn-secondary" data-simulated-outcome="declined">Simular recusa</button>
        </section>`
      : '';

    return `<section class="my-plan-view">
      <div class="my-plan-heading"><div><p class="my-plan-eyebrow">CONTA</p><h2>Meu Plano</h2><p>Consulte seu plano e as opções disponíveis para sua conta.</p></div>
        <button class="btn btn-secondary" data-my-plan-retry>Atualizar</button></div>
      <section class="my-plan-current">
        <div><span class="my-plan-tier">${escapeHtml(planTier(access.plan))}</span><h3>${escapeHtml(access.plan.name)}</h3></div>
        ${currentDetails}
        ${benefitsHtml(access.benefits || {}, access.limits || {})}
      </section>
      ${trialSection}
      ${simulator.enabled
        ? `<p class="my-plan-unavailable">${escapeHtml(simulator.message)}</p>`
        : ''}
      ${simulatorSection}
      <div class="my-plan-list-heading"><h3>Planos disponíveis</h3><span>Preços e moedas conforme configurados.</span></div>
      <div class="my-plan-grid">${planCards}</div>
      ${hasPremium && !simulator.enabled ? `<p class="my-plan-unavailable">${escapeHtml(simulator.message)} O checkout real ainda não está integrado.</p>` : ''}
      ${historical.length ? `<section class="my-plan-history"><h3>Histórico de assinaturas</h3>${historical.map((subscription) => `<article>
        <strong>${escapeHtml(subscription.planName)}</strong><span>${escapeHtml(subscription.status)}</span>
        <span>${escapeHtml(money(subscription.contractedPrice, subscription.currency))} · ${escapeHtml(periodLabel(subscription.billingPeriod))}</span>
        <small>Data do contrato: ${escapeHtml(displayDate(subscription.createdAt))}</small>
        ${['pending', 'active', 'past_due'].includes(subscription.status)
          ? `<button type="button" class="btn btn-secondary" data-cancel-my-subscription="${escapeHtml(subscription.id)}">Cancelar contrato</button>`
          : ''}
      </article>`).join('')}</section>` : ''}
    </section>`;
  }
}
