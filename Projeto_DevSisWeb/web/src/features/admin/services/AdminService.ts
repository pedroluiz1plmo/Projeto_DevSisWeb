const API_BASE = 'http://localhost:3000/api';

export class AdminApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

export type AdminPermission = string;

export type AdminIdentity = {
  user: { id: string; name: string; username: string; email: string };
  permissions: AdminPermission[];
  availablePermissions: AdminPermission[];
};

export type AdminPlan = {
  id: string;
  slug: string;
  name: string;
  description: string;
  billingPeriod: 'free' | 'monthly' | 'annual';
  status: 'draft' | 'active' | 'inactive';
  price: string | null;
  currency: string | null;
  benefits: Record<string, boolean>;
  limits: Record<string, number | null>;
};

export class AdminService {
  private static async request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    const data = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || data.success === false) {
      throw new AdminApiError(data.message || `A API administrativa respondeu com status ${response.status}.`, response.status);
    }
    return data as T;
  }

  static identity(token: string): Promise<AdminIdentity & { success: boolean }> {
    return this.request('/admin/me', token);
  }

  static dashboard(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/dashboard', token);
  }

  static users(token: string, search = ''): Promise<Record<string, unknown>> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/admin/users${query}`, token);
  }

  static setUserActive(token: string, userId: string, isActive: boolean): Promise<unknown> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/active`, token, {
      method: 'PATCH', body: JSON.stringify({ isActive }),
    });
  }

  static setPermission(token: string, userId: string, permission: string, granted: boolean): Promise<unknown> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/permissions`, token, {
      method: 'PUT', body: JSON.stringify({ permission, granted }),
    });
  }

  static plans(token: string): Promise<{ plans: AdminPlan[] }> {
    return this.request('/admin/plans', token);
  }

  static systems(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/systems', token);
  }

  static saveSystem(token: string, systemId: string | null, payload: Record<string, unknown>): Promise<unknown> {
    return this.request(systemId ? `/admin/systems/${encodeURIComponent(systemId)}` : '/admin/systems', token, {
      method: systemId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  }

  static saveSystemVersion(
    token: string,
    systemId: string,
    versionId: string | null,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    const path = `/admin/systems/${encodeURIComponent(systemId)}/versions${versionId ? `/${encodeURIComponent(versionId)}` : ''}`;
    return this.request(path, token, {
      method: versionId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  }

  static savePlan(token: string, planId: string | null, payload: Record<string, unknown>): Promise<unknown> {
    return this.request(planId ? `/admin/plans/${encodeURIComponent(planId)}` : '/admin/plans', token, {
      method: planId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  }

  static subscriptions(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/subscriptions', token);
  }

  static freeTrials(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/free-trials', token);
  }

  static subscriptionNotifications(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/subscription-notifications', token);
  }

  static retrySubscriptionNotification(token: string, notificationId: string): Promise<unknown> {
    return this.request(
      `/admin/subscription-notifications/${encodeURIComponent(notificationId)}/retry`,
      token,
      { method: 'POST' },
    );
  }

  static cancelSubscription(token: string, subscriptionId: string): Promise<unknown> {
    return this.request(`/admin/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, token, { method: 'POST' });
  }

  static payments(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/payments', token);
  }

  static expenses(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/expenses', token);
  }

  static saveExpense(token: string, expenseId: string | null, payload: Record<string, unknown>): Promise<unknown> {
    return this.request(expenseId ? `/admin/expenses/${encodeURIComponent(expenseId)}` : '/admin/expenses', token, {
      method: expenseId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
  }

  static voidExpense(token: string, expenseId: string): Promise<unknown> {
    return this.request(`/admin/expenses/${encodeURIComponent(expenseId)}`, token, { method: 'DELETE' });
  }

  static reports(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/reports', token);
  }

  static settings(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/settings', token);
  }

  static updateSettings(token: string, activeUserWindowDays: number): Promise<unknown> {
    return this.request('/admin/settings', token, {
      method: 'PUT',
      body: JSON.stringify({ activeUserWindowDays }),
    });
  }

  static audit(token: string): Promise<Record<string, unknown>> {
    return this.request('/admin/audit', token);
  }
}
