import { requireAuth } from '../../middleware/auth.js';
import { pool } from '../../config/database.js';
import * as adminService from './admin.service.js';
import { activateMyTrial, getMyTrial, listTrialsForAdmin } from '../free-trials/free-trials.service.js';
import {
  deliverSubscriptionEmailNotification,
  listSubscriptionEmailNotifications,
} from '../billing/subscription_notifications.service.js';

const unauthorized = { status: 401, body: { success: false, message: 'Não autorizado.' } };
const forbidden = { status: 403, body: { success: false, message: 'Você não possui permissão para esta operação.' } };
const pathname = (request) => new URL(request.url, 'http://localhost').pathname;
const queryParams = (request) => Object.fromEntries(new URL(request.url, 'http://localhost').searchParams);

const permissionFor = (method, url) => {
  if (url === '/api/admin/me') return 'any';
  if (url === '/api/admin/dashboard') return 'dashboard.read';
  if (url === '/api/admin/permissions') return 'admin.permissions.manage';
  if (url === '/api/admin/users') return method === 'GET' ? 'users.read' : 'users.manage';
  if (/^\/api\/admin\/users\/\d+\/active$/.test(url)) return 'users.manage';
  if (/^\/api\/admin\/users\/\d+\/permissions$/.test(url)) return 'admin.permissions.manage';
  if (url === '/api/admin/plans' || /^\/api\/admin\/plans\/\d+$/.test(url)) {
    return method === 'GET' ? 'plans.read' : 'plans.manage';
  }
  if (url === '/api/admin/systems' || /^\/api\/admin\/systems\/\d+$/.test(url)
    || /^\/api\/admin\/systems\/\d+\/versions$/.test(url)
    || /^\/api\/admin\/systems\/\d+\/versions\/\d+$/.test(url)) {
    return method === 'GET' ? 'systems.read' : 'systems.manage';
  }
  if (url === '/api/admin/subscriptions' || /^\/api\/admin\/subscriptions\/\d+\/cancel$/.test(url)) {
    return method === 'GET' ? 'subscriptions.read' : 'subscriptions.manage';
  }
  if (url === '/api/admin/free-trials') return 'subscriptions.read';
  if (url === '/api/admin/subscription-notifications') return 'subscriptions.read';
  if (/^\/api\/admin\/subscription-notifications\/\d+\/retry$/.test(url)) return 'subscriptions.manage';
  if (url === '/api/admin/payments') return 'payments.read';
  if (url === '/api/admin/expenses') return method === 'GET' ? 'expenses.read' : 'expenses.manage';
  if (/^\/api\/admin\/expenses\/\d+$/.test(url)) return method === 'GET' ? 'expenses.read' : 'expenses.manage';
  if (url === '/api/admin/reports') return 'reports.read';
  if (url === '/api/admin/audit') return 'admin.audit.read';
  if (url === '/api/admin/settings') return 'settings.manage';
  return null;
};

const authorize = async (request, permission) => {
  const token = requireAuth(request);
  if (!token) return { error: unauthorized };
  const user = await pool.query('SELECT is_active FROM users WHERE id = $1', [token.sub]);
  if (!user.rowCount || !user.rows[0].is_active) return { error: unauthorized };
  const permissions = await pool.query(
    'SELECT permission FROM admin_permissions WHERE user_id = $1',
    [token.sub],
  );
  const granted = permissions.rows.map((row) => row.permission);
  if (!granted.length || (permission !== 'any' && !granted.includes(permission))) return { error: forbidden };
  return { token, permissions: granted };
};

export const handleAdminRoute = async (request, body = {}) => {
  const url = pathname(request);
  const method = request.method;

  if (method === 'GET' && url === '/api/plans') {
    const result = await pool.query(
      `SELECT id, slug, name, description, billing_period, price, currency, benefits, limits
         FROM plans WHERE status = 'active' ORDER BY billing_period, name`,
    );
    return {
      status: 200,
      body: { success: true, plans: result.rows.map((row) => ({
        id: String(row.id), slug: row.slug, name: row.name, description: row.description,
        billingPeriod: row.billing_period, price: row.price, currency: row.currency,
        benefits: row.benefits, limits: row.limits,
      })) },
    };
  }
  if (method === 'POST' && url === '/api/subscriptions/checkout') {
    const token = requireAuth(request);
    if (!token) return unauthorized;
    return adminService.requestCheckout(token.sub, body.planId);
  }
  if (method === 'GET' && url === '/api/subscriptions/me') {
    const token = requireAuth(request);
    if (!token) return unauthorized;
    return adminService.listMySubscriptions(token.sub);
  }
  if (url === '/api/free-trial/me' && method === 'GET') {
    const token = requireAuth(request);
    if (!token) return unauthorized;
    return getMyTrial(token.sub);
  }
  if (url === '/api/free-trial/activate' && method === 'POST') {
    const token = requireAuth(request);
    if (!token) return unauthorized;
    return activateMyTrial(token.sub, body);
  }

  if (!url.startsWith('/api/admin/')) return null;
  const requiredPermission = permissionFor(method, url);
  if (!requiredPermission) return null;
  const access = await authorize(request, requiredPermission);
  if (access.error) return access.error;
  const actorId = access.token.sub;
  const query = queryParams(request);

  if (method === 'GET' && url === '/api/admin/me') {
    const identity = await adminService.getAdminIdentity(actorId);
    return identity
      ? { status: 200, body: { success: true, ...identity, availablePermissions: adminService.listPermissions() } }
      : unauthorized;
  }
  if (method === 'GET' && url === '/api/admin/dashboard') return adminService.getDashboard();
  if (method === 'GET' && url === '/api/admin/permissions') {
    return { status: 200, body: { success: true, permissions: adminService.listPermissions() } };
  }
  if (method === 'GET' && url === '/api/admin/users') {
    return adminService.listUsers(
      query,
      access.permissions.includes('admin.permissions.manage'),
    );
  }

  const activeMatch = url.match(/^\/api\/admin\/users\/(\d+)\/active$/);
  if (activeMatch && method === 'PATCH') {
    return adminService.setUserActive(actorId, activeMatch[1], body.isActive);
  }
  const permissionMatch = url.match(/^\/api\/admin\/users\/(\d+)\/permissions$/);
  if (permissionMatch && method === 'PUT') {
    return adminService.changePermission(actorId, permissionMatch[1], body.permission, body.granted);
  }

  if (url === '/api/admin/plans') {
    if (method === 'GET') return adminService.listPlans();
    if (method === 'POST') return adminService.createPlan(actorId, body);
  }
  if (method === 'GET' && url === '/api/admin/systems') return adminService.listSystems();
  if (url === '/api/admin/systems' && method === 'POST') return adminService.saveSystem(actorId, null, body);
  const versionMatch = url.match(/^\/api\/admin\/systems\/(\d+)\/versions(?:\/(\d+))?$/);
  if (versionMatch && method === 'POST' && !versionMatch[2]) {
    return adminService.saveSystemVersion(actorId, versionMatch[1], null, body);
  }
  if (versionMatch && method === 'PUT' && versionMatch[2]) {
    return adminService.saveSystemVersion(actorId, versionMatch[1], versionMatch[2], body);
  }
  const systemMatch = url.match(/^\/api\/admin\/systems\/(\d+)$/);
  if (systemMatch && method === 'PUT') return adminService.saveSystem(actorId, systemMatch[1], body);
  const planMatch = url.match(/^\/api\/admin\/plans\/(\d+)$/);
  if (planMatch && method === 'PUT') return adminService.updatePlan(actorId, planMatch[1], body);

  if (method === 'GET' && url === '/api/admin/subscriptions') return adminService.listSubscriptions(query);
  if (method === 'GET' && url === '/api/admin/free-trials') return listTrialsForAdmin();
  if (method === 'GET' && url === '/api/admin/subscription-notifications') {
    return listSubscriptionEmailNotifications();
  }
  const notificationRetryMatch = url.match(/^\/api\/admin\/subscription-notifications\/(\d+)\/retry$/);
  if (method === 'POST' && notificationRetryMatch) {
    return deliverSubscriptionEmailNotification(notificationRetryMatch[1]);
  }
  const cancelMatch = url.match(/^\/api\/admin\/subscriptions\/(\d+)\/cancel$/);
  if (cancelMatch && method === 'POST') return adminService.cancelSubscription(actorId, cancelMatch[1]);
  if (method === 'GET' && url === '/api/admin/payments') return adminService.listPayments(query);

  if (url === '/api/admin/expenses') {
    if (method === 'GET') return adminService.listExpenses(query);
    if (method === 'POST') return adminService.saveExpense(actorId, null, body);
  }
  const expenseMatch = url.match(/^\/api\/admin\/expenses\/(\d+)$/);
  if (expenseMatch && method === 'PUT') return adminService.saveExpense(actorId, expenseMatch[1], body);
  if (expenseMatch && method === 'DELETE') return adminService.voidExpense(actorId, expenseMatch[1]);

  if (method === 'GET' && url === '/api/admin/reports') return adminService.getReports(query);
  if (method === 'GET' && url === '/api/admin/audit') return adminService.listAudit(query);
  if (url === '/api/admin/settings') {
    if (method === 'GET') return adminService.getSettings();
    if (method === 'PUT') return adminService.updateSettings(actorId, body);
  }
  return null;
};
