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
  remainingSeconds: number;
};

export type FreeTrialStatus = {
  eligible: boolean;
  trial: FreeTrial | null;
  premiumPlans: AvailablePlan[];
  hasActiveSubscription: boolean;
};

const API_BASE = 'http://localhost:3000/api';

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

  static async freeTrial(token: string): Promise<FreeTrialStatus> {
    return request<FreeTrialStatus>('/free-trial/me', token);
  }

  static async activateFreeTrial(token: string, planId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/free-trial/activate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer '.concat(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId }),
    });
    const data = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `A API respondeu com status ${response.status}.`);
    }
  }
}
