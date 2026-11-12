import nodemailer from 'nodemailer';

const smtpSettings = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const username = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Digital Master Shield';

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !username ||
    !password ||
    !from
  ) {
    return null;
  }
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: username, pass: password },
    from,
    fromName,
  };
};

const createTransporter = () => {
  const settings = smtpSettings();
  if (!settings) throw new Error('Configuração SMTP ausente.');

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.auth,
  });
};

export const isSmtpConfigured = () => smtpSettings() !== null;

export const sendWelcomeEmail = async ({ email, name }) => {
  const transporter = createTransporter();
  const safeName = typeof name === 'string' && name.trim() ? name.trim() : 'Jogador';

  await transporter.sendMail({
    from: smtpSettings().from,
    to: email,
    subject: 'Boas-vindas ao RPG Manager! Sua próxima aventura começa aqui',
    text: [
      `Olá, ${safeName}!`,
      '',
      'Seja muito bem-vindo(a) ao RPG Manager!',
      '',
      'Estamos felizes por ter você conosco!',
      '',
      'O RPG Manager é um espaço desenvolvido para ajudar você a organizar suas aventuras de RPG, criar personagens e gerenciar suas campanhas em diferentes sistemas.',
      '',
      'Por aqui, você poderá:',
      '- Criar e organizar fichas de personagens.',
      '- Gerenciar inventários, atributos e habilidades.',
      '- Consultar magias e habilidades no grimório.',
      '- Realizar rolagens de dados.',
      '- Organizar campanhas e acompanhar suas aventuras.',
      '',
      'Prepare seus dados, reúna seu grupo e comece a construir suas histórias!',
      '',
      'Boas aventuras!',
      '',
      'Equipe RPG Manager',
      'suporte.rpgmanager@gmail.com',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #f5f5f5; background: #0b1020; padding: 32px;">
        <div style="max-width: 640px; margin: 0 auto; background: #141d33; border: 1px solid #2a3a5c; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #1f6feb, #6d5efc); padding: 28px 32px;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px;">RPG Manager</h1>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 18px; margin-top: 0;">Olá, <strong>${safeName}</strong>!</p>
            <p style="font-size: 16px; line-height: 1.7;">
              Seja muito bem-vindo(a) ao RPG Manager!<br><br>
              Estamos felizes por ter você conosco!
            </p>
            <p style="font-size: 16px; line-height: 1.7;">
              O RPG Manager é um espaço desenvolvido para ajudar você a organizar suas aventuras de RPG,
              criar personagens e gerenciar suas campanhas em diferentes sistemas.
            </p>
            <p style="font-size: 16px; line-height: 1.7;">
              Por aqui, você poderá:
            </p>
            <ul style="font-size: 16px; line-height: 1.8; padding-left: 20px; margin: 0 0 24px;">
              <li>Criar e organizar fichas de personagens.</li>
              <li>Gerenciar inventários, atributos e habilidades.</li>
              <li>Consultar magias e habilidades no grimório.</li>
              <li>Realizar rolagens de dados.</li>
              <li>Organizar campanhas e acompanhar suas aventuras.</li>
            </ul>
            <p style="font-size: 16px; line-height: 1.7;">
              Nosso objetivo é tornar suas sessões mais organizadas e proporcionar uma experiência prática para jogadores e mestres.
            </p>
            <p style="font-size: 16px; line-height: 1.7;">
              Prepare seus dados, reúna seu grupo e comece a construir suas histórias!
            </p>
            <p style="font-size: 18px; margin: 24px 0 12px; font-weight: bold;">Boas aventuras!</p>
            <p style="margin: 0; font-size: 15px; color: #d7def3;">Equipe RPG Manager</p>
            <p style="margin: 8px 0 0; font-size: 15px; color: #d7def3;">
              <a href="mailto:suporte.rpgmanager@gmail.com" style="color: #8cc2ff; text-decoration: none;">suporte.rpgmanager@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    `,
  });
};

export const sendAccountDeletionEmail = async ({ email, name }) => {
  const transporter = createTransporter();
  const safeName = typeof name === 'string' && name.trim() ? name.trim() : 'Jogador';
  const htmlName = safeName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  await transporter.sendMail({
    from: smtpSettings().from,
    to: email,
    subject: 'Sua conta RPG Manager foi excluída',
    text: [
      `Olá, ${safeName}.`,
      '',
      'Informamos que sua conta no RPG Manager foi excluída com sucesso.',
      '',
      'Agradecemos por ter utilizado nossa plataforma e por ter compartilhado suas aventuras conosco.',
      '',
      'Esperamos que você tenha aproveitado sua experiência criando personagens, organizando campanhas e explorando diferentes sistemas de RPG.',
      '',
      'Caso não tenha solicitado essa exclusão, entre em contato conosco pelo endereço:',
      'suporte.rpgmanager@gmail.com',
      '',
      'Atenciosamente,',
      '',
      'Equipe RPG Manager',
    ].join('\n'),
    html: `
      <div style="box-sizing: border-box; width: 100%; padding: 32px 16px; background: #0b1020; color: #f5f5f5; font-family: Arial, sans-serif;">
        <div style="box-sizing: border-box; width: 100%; max-width: 640px; margin: 0 auto; overflow: hidden; border: 1px solid #2a3a5c; border-radius: 16px; background: #141d33;">
          <div style="padding: 28px 32px; background: linear-gradient(135deg, #1f6feb, #6d5efc);">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px;">RPG Manager</h1>
          </div>
          <div style="padding: 32px;">
            <p style="margin-top: 0; font-size: 18px;">Olá, <strong>${htmlName}</strong>.</p>
            <p style="font-size: 16px; line-height: 1.7;">
              Informamos que sua conta no RPG Manager foi excluída com sucesso.
            </p>
            <p style="font-size: 16px; line-height: 1.7;">
              Agradecemos por ter utilizado nossa plataforma e por ter compartilhado suas aventuras conosco.
            </p>
            <p style="font-size: 16px; line-height: 1.7;">
              Esperamos que você tenha aproveitado sua experiência criando personagens, organizando campanhas e explorando diferentes sistemas de RPG.
            </p>
            <p style="font-size: 16px; line-height: 1.7;">
              Caso não tenha solicitado essa exclusão, entre em contato conosco pelo endereço:
              <a href="mailto:suporte.rpgmanager@gmail.com" style="color: #8cc2ff; text-decoration: none;">suporte.rpgmanager@gmail.com</a>
            </p>
            <p style="margin-bottom: 8px; font-size: 16px; line-height: 1.7;">Atenciosamente,</p>
            <p style="margin: 0; font-size: 15px; color: #d7def3;">Equipe RPG Manager</p>
          </div>
        </div>
      </div>
    `,
  });
};

export const sendPasswordRecoveryEmail = async ({ email, token }) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: smtpSettings().from,
    to: email,
    subject: 'Código de recuperação de senha — RPG Manager',
    text: [
      'Recebemos uma solicitação de recuperação de senha para sua conta.',
      '',
      `Código temporário: ${token}`,
      'O código expira em 30 minutos e pode ser usado uma única vez.',
      'Se você não solicitou a recuperação, ignore esta mensagem.',
    ].join('\n'),
  });
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(date)
    : null;
};

const formatAmount = (amount, currency) => {
  if (amount === null || amount === undefined || !currency) return null;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(amount));
  } catch {
    throw new Error('Moeda inválida para notificação de assinatura.');
  }
};

const notificationTitle = (type) => ({
  subscription_confirmed: 'Sua assinatura foi confirmada',
  subscription_renewed: 'Sua assinatura foi renovada',
  plan_changed: 'Seu plano foi atualizado',
}[type] || 'Atualização da sua assinatura');

export const buildSubscriptionConfirmationEmail = ({
  name,
  planName,
  notificationType,
  confirmedAt,
  amount,
  currency,
  billingPeriod,
  renewsAt,
  status,
  planUrl,
  supportEmail,
}) => {
  const safeName = typeof name === 'string' && name.trim() ? name.trim() : 'Jogador';
  const title = notificationTitle(notificationType);
  const confirmationDate = formatDate(confirmedAt);
  const renewalDate = formatDate(renewsAt);
  const formattedAmount = formatAmount(amount, currency);
  const cycle = billingPeriod === 'annual'
    ? 'Anual'
    : billingPeriod === 'monthly'
      ? 'Mensal'
      : 'Conforme o contrato';
  const statusLabel = status === 'active' ? 'Ativa' : String(status || 'Confirmada');
  const dateLine = confirmationDate ? `Data da confirmação: ${confirmationDate}` : null;
  const amountLine = formattedAmount ? `Valor confirmado: ${formattedAmount}` : null;
  const renewalLine = renewalDate ? `Próxima renovação: ${renewalDate}` : null;
  const planLink = typeof planUrl === 'string' && /^https?:\/\//i.test(planUrl) ? planUrl : null;
  const safeSupport = typeof supportEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)
    ? supportEmail
    : null;
  const lines = [
    `Olá, ${safeName}!`,
    '',
    `${title} no Digital Master Shield.`,
    '',
    `Plano: ${planName}`,
    amountLine,
    dateLine,
    `Período: ${cycle}`,
    `Status: ${statusLabel}`,
    renewalLine,
    '',
    'Agora você pode aproveitar os recursos disponibilizados pelo seu plano.',
    planLink ? `Consulte seu plano: ${planLink}` : 'Acesse o Digital Master Shield e abra a seção Meu Plano para consultar sua assinatura.',
    safeSupport ? `Suporte: ${safeSupport}` : null,
    '',
    'Obrigado por fazer parte da nossa comunidade!',
    'Equipe Digital Master Shield',
  ].filter((line) => line !== null);
  const details = [
    ['Plano', planName],
    ...(formattedAmount ? [['Valor confirmado', formattedAmount]] : []),
    ...(dateLine ? [['Data da confirmação', confirmationDate]] : []),
    ['Período', cycle],
    ['Status', statusLabel],
    ...(renewalLine ? [['Próxima renovação', renewalDate]] : []),
  ];

  return {
    subject: 'Confirmação da sua assinatura — Digital Master Shield',
    text: lines.join('\n'),
    html: `
      <div style="background:#0b1020;color:#f5f5f5;font-family:Arial,sans-serif;padding:32px 16px">
        <div style="max-width:640px;margin:0 auto;background:#141d33;border:1px solid #2a3a5c;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#1f6feb,#6d5efc);padding:28px 32px">
            <h1 style="margin:0;color:#fff;font-size:26px">Digital Master Shield</h1>
          </div>
          <div style="padding:32px">
            <h2 style="margin-top:0;color:#fff">${escapeHtml(title)}</h2>
            <p style="font-size:16px;line-height:1.7">Olá, <strong>${escapeHtml(safeName)}</strong>!<br>
              Sua alteração de assinatura foi confirmada com sucesso.</p>
            <table style="width:100%;border-collapse:collapse;margin:24px 0">
              ${details.map(([label, value]) => `<tr><th style="padding:10px;text-align:left;border-bottom:1px solid #2a3a5c;color:#b8c5df">${escapeHtml(label)}</th><td style="padding:10px;text-align:right;border-bottom:1px solid #2a3a5c">${escapeHtml(value)}</td></tr>`).join('')}
            </table>
            <p style="font-size:16px;line-height:1.7">Agora você pode aproveitar os recursos disponibilizados pelo seu plano no Digital Master Shield.</p>
            ${planLink ? `<p><a href="${escapeHtml(planLink)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Consultar meu plano</a></p>` : '<p>Acesse a plataforma e abra a seção Meu Plano para consultar sua assinatura.</p>'}
            <p style="font-size:14px;color:#d7def3">Obrigado por fazer parte da nossa comunidade!<br>Equipe Digital Master Shield</p>
            ${safeSupport ? `<p style="font-size:14px"><a href="mailto:${escapeHtml(safeSupport)}" style="color:#8cc2ff">${escapeHtml(safeSupport)}</a></p>` : ''}
          </div>
        </div>
      </div>
    `,
  };
};

export const sendSubscriptionConfirmationEmail = async (notification) => {
  const settings = smtpSettings();
  if (!settings) {
    const error = new Error('Configuração SMTP ausente.');
    error.code = 'SMTP_CONFIGURATION_MISSING';
    throw error;
  }
  const message = buildSubscriptionConfirmationEmail({
    ...notification,
    planUrl: process.env.APP_BASE_URL?.trim()
      ? new URL('/', `${process.env.APP_BASE_URL.trim().replace(/\/+$/, '')}/`).toString()
      : null,
    supportEmail: process.env.SUPPORT_EMAIL?.trim() || 'suporte.rpgmanager@gmail.com',
  });
  const transporter = createTransporter();
  return transporter.sendMail({
    from: { name: settings.fromName, address: settings.from },
    to: notification.email,
    ...message,
  });
};
