import {
  isSupportTicketEmailConfigured,
  sendSupportTicketEmail,
} from '../../services/email_service.js';

const ticketCategories = new Set(['Problema técnico', 'Conta e acesso', 'Sugestão', 'Outro']);
const ticketLimits = new Map();
const ticketWindowMs = 15 * 60 * 1000;
const maxTicketsPerWindow = 3;
const maxAttachments = 3;
const maxAttachmentBytes = 2 * 1024 * 1024;
const maxTotalAttachmentBytes = 5 * 1024 * 1024;
const imageTypes = new Map([
  ['image/jpeg', { extension: /\.(jpe?g)$/i, signature: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ['image/png', { extension: /\.png$/i, signature: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
]);

const validateAttachments = (attachments) => {
  if (!Array.isArray(attachments) || attachments.length > maxAttachments) {
    return `Anexe no máximo ${maxAttachments} imagens JPG ou PNG.`;
  }

  const validated = [];
  let totalBytes = 0;
  for (const [index, attachment] of attachments.entries()) {
    if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
      return 'Uma das imagens anexadas é inválida.';
    }
    const type = imageTypes.get(attachment.mimeType);
    if (!type || typeof attachment.name !== 'string' || !type.extension.test(attachment.name)) {
      return 'São permitidas somente imagens JPG ou PNG com extensão correspondente.';
    }
    if (
      typeof attachment.content !== 'string'
      || !attachment.content
      || attachment.content.length > Math.ceil(maxAttachmentBytes / 3) * 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(attachment.content)
    ) return 'Uma das imagens anexadas possui conteúdo inválido.';

    const content = Buffer.from(attachment.content, 'base64');
    if (
      content.length === 0
      || content.length > maxAttachmentBytes
      || content.toString('base64') !== attachment.content
      || !type.signature(content)
    ) return 'Uma das imagens está corrompida ou excede o limite de 2 MB.';
    totalBytes += content.length;
    if (totalBytes > maxTotalAttachmentBytes) return 'O tamanho total das imagens não pode ultrapassar 5 MB.';

    const safeName = attachment.name
      .split(/[\\/]/)
      .pop()
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .slice(-100) || `imagem-${index + 1}${attachment.mimeType === 'image/png' ? '.png' : '.jpg'}`;
    validated.push({
      filename: safeName,
      contentType: attachment.mimeType,
      content,
    });
  }
  return validated;
};

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
  const attachments = validateAttachments(body.attachments ?? []);
  if (typeof attachments === 'string') return attachments;
  return { name, email, category, subject, description, attachments };
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
