export type AvailablePlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  billingPeriod: 'free' | 'monthly' | 'annual';
  price: string | null;
  currency: string | null;
  benefits: Record<string, boolean>;
  limits: Record<string, number | null>;
};

export type CurrentPlanAccess = {
  plan: {
    id: string;
    slug: string;
    name: string;
    billingPeriod: 'free' | 'monthly' | 'annual';
  };
  subscriptionStatus: string;
  trial?: { endsAt: string };
  benefits: Record<string, boolean>;
  limits: Record<string, number | null>;
};

export type UserSubscription = {
  id: string;
  planId: string;
  planName: string;
  billingPeriod: 'monthly' | 'annual';
  contractedPrice: string;
  currency: string;
  status: string;
  startsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentProvider: string | null;
  createdAt: string;
};

export type FreeTrial = {
  id: string;
  planId: string;
  planName: string;
  planSlug: string;
  status: 'active' | 'expired';
  activatedAt: string;
  startsAt: string;
  endsAt: string;
  durationDays: number;
  isLaunchOffer: boolean;
  remainingSeconds: number;
};

export type FreeTrialStatus = {
  eligible: boolean;
  trial: FreeTrial | null;
  premiumPlans: AvailablePlan[];
  hasActiveSubscription: boolean;
  launchOffer: { spotsRemaining: number; durationDays: number };
};

export type PaymentSimulatorStatus = {
  enabled: boolean;
  mode: string;
  message: string;
};

export type SimulatedCheckout = {
  subscriptionId: string;
  paymentId: string;
  planName: string;
  billingPeriod: 'monthly' | 'annual';
  amount: string;
  currency: string;
  mode: 'simulator';
};

import { API_BASE } from '../../../config/api';

const request = async <T>(path: string, token: string): Promise<T> => {
  const headers: HeadersInit = {};
  if (path !== '/plans') headers.Authorization = 'Bearer '.concat(token);
  const response = await fetch(`${API_BASE}${path}`, { headers });
  const data = await response.json() as { success?: boolean; message?: string };
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `A API respondeu com status ${response.status}.`);
  }
  return data as T;
};

export class PlanService {
  static async availablePlans(token: string): Promise<AvailablePlan[]> {
    const data = await request<{ plans: AvailablePlan[] }>('/plans', token);
    return data.plans;
  }

  static async currentAccess(token: string): Promise<CurrentPlanAccess> {
    const data = await request<{ authenticated: boolean; planAccess?: CurrentPlanAccess }>('/auth/me', token);
    if (!data.authenticated || !data.planAccess) throw new Error('Não foi possível identificar seu plano atual.');
    return data.planAccess;
  }

  static async subscriptions(token: string): Promise<UserSubscription[]> {
    const data = await request<{ subscriptions: UserSubscription[] }>('/subscriptions/me', token);
    return data.subscriptions;
  }

  static async paymentSimulatorStatus(token: string): Promise<PaymentSimulatorStatus> {
    return request<PaymentSimulatorStatus>('/payment-simulator/status', token);
  }

  static async createCheckout(token: string, planId: string): Promise<SimulatedCheckout> {
    const response = await fetch(`${API_BASE}/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer '.concat(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId }),
    });
    const data = await response.json() as { success?: boolean; message?: string; checkout?: SimulatedCheckout };
    if (!response.ok || data.success === false || !data.checkout) {
      throw new Error(data.message || `A API respondeu com status ${response.status}.`);
    }
    return data.checkout;
  }

  static async completeSimulatedPayment(
    token: string,
    paymentId: string,
    outcome: 'approved' | 'declined',
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/payment-simulator/payments/${encodeURIComponent(paymentId)}/complete`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer '.concat(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ outcome }),
    });
    const data = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `A API respondeu com status ${response.status}.`);
    }
  }

  static async freeTrial(token: string): Promise<FreeTrialStatus> {
    return request<FreeTrialStatus>('/free-trial/me', token);
  }

  static async activateFreeTrial(token: string, planId: string, launchOffer: boolean): Promise<void> {
    const response = await fetch(`${API_BASE}/free-trial/activate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer '.concat(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId, launchOffer }),
    });
    const data = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `A API respondeu com status ${response.status}.`);
    }
  }

  static async cancelFreeTrial(token: string): Promise<string> {
    const response = await fetch(`${API_BASE}/free-trial/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer '.concat(token) },
    });
    const data = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `A API respondeu com status ${response.status}.`);
    }
    return data.message || 'Período gratuito cancelado.';
  }

  static async cancelSubscription(token: string, subscriptionId: string): Promise<string> {
    const response = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer '.concat(token) },
    });
    const data = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `A API respondeu com status ${response.status}.`);
    }
    return data.message || 'Contrato cancelado.';
  }
}
