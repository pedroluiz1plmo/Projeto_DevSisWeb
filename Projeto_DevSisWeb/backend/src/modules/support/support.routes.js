import {
  isSupportTicketEmailConfigured,
  sendSupportTicketEmail,
} from '../../services/email_service.js';

const ticketCategories = new Set(['Problema técnico', 'Conta e acesso', 'Sugestão', 'Outro']);
const ticketLimits = new Map();
const ticketWindowMs = 15 * 60 * 1000;
const maxTicketsPerWindow = 3;

const validateTicket = (body) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!name || name.length > 120) return 'Informe seu nome (até 120 caracteres).';
  if (
    email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || /[\r\n]/.test(email)
  ) return 'Informe um endereço de e-mail válido.';
  if (!ticketCategories.has(category)) return 'Selecione uma categoria válida.';
  if (!subject || subject.length > 160 || /[\r\n]/.test(subject)) {
    return 'Informe um assunto (até 160 caracteres, sem quebras de linha).';
  }
  if (!description || description.length > 5000) {
    return 'Descreva o problema (até 5000 caracteres).';
  }
  return { name, email, category, subject, description };
};

const isRateLimited = (key) => {
  const now = Date.now();
  if (ticketLimits.size > 1000) {
    for (const [ip, limit] of ticketLimits) {
      if (limit.expiresAt <= now) ticketLimits.delete(ip);
    }
  }

  const current = ticketLimits.get(key);
  if (!current || current.expiresAt <= now) {
    ticketLimits.set(key, { count: 1, expiresAt: now + ticketWindowMs });
    return false;
  }
  if (current.count >= maxTicketsPerWindow) return true;
  current.count += 1;
  return false;
};

export const handleSupportRoute = async (
  request,
  body = {},
  { isEmailConfigured = isSupportTicketEmailConfigured, sendEmail = sendSupportTicketEmail } = {},
) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== '/api/support/tickets' || request.method !== 'POST') return null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, body: { success: false, message: 'Informe os dados do chamado.' } };
  }

  const ticket = validateTicket(body);
  if (typeof ticket === 'string') {
    return { status: 400, body: { success: false, message: ticket } };
  }

  if (!isEmailConfigured()) {
    return {
      status: 503,
      body: { success: false, message: 'O envio de chamados está temporariamente indisponível.' },
    };
  }

  const ip = request.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return {
      status: 429,
      body: { success: false, message: 'Muitos chamados enviados. Aguarde alguns minutos e tente novamente.' },
    };
  }

  try {
    await sendEmail(ticket);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : error?.name || 'unknown';
    console.error(`Falha ao enviar chamado por e-mail (${code}).`);
    return {
      status: 502,
      body: { success: false, message: 'Não foi possível enviar o chamado. Tente novamente mais tarde.' },
    };
  }

  return {
    status: 200,
    body: { success: true, message: 'Chamado enviado com sucesso.' },
  };
};
