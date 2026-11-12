import { pool } from '../../config/database.js';
import { sendSubscriptionConfirmationEmail } from '../../services/email_service.js';

const notificationTypes = new Set([
  'subscription_confirmed',
  'subscription_renewed',
  'plan_changed',
]);

const validId = (value) => {
  if (!/^\d+$/.test(String(value))) return false;
  try {
    const id = BigInt(value);
    return id > 0n && id <= 9223372036854775807n;
  } catch {
    return false;
  }
};

const validEventPart = (value, maxLength) => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= maxLength
  && !/[\u0000-\u001f]/.test(value)
);

const safeErrorCodes = new Set([
  'SMTP_CONFIGURATION_MISSING',
  'EAUTH',
  'ECONNECTION',
  'ESOCKET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EDNS',
  'EENVELOPE',
  'EMESSAGE',
  'EDATA',
  'EPIPE',
  'ETLS',
]);
const safeErrorCode = (error) => (
  safeErrorCodes.has(error?.code) ? error.code : 'EMAIL_DELIVERY_FAILED'
);

export const enqueueSubscriptionEmailNotification = async (client, {
  provider,
  eventId,
  subscriptionId,
  paymentId = null,
  notificationType,
}) => {
  if (!validEventPart(provider, 80)
    || !validEventPart(eventId, 200)
    || !validId(subscriptionId)
    || (paymentId !== null && !validId(paymentId))
    || !notificationTypes.has(notificationType)) {
    throw new Error('Evento de assinatura inválido para notificação.');
  }
  if (notificationType !== 'plan_changed' && paymentId === null) {
    throw new Error('A confirmação de assinatura ou renovação exige um pagamento identificado.');
  }

  const confirmedEvent = await client.query(
    `SELECT 1
       FROM payment_provider_events
      WHERE provider = $1 AND external_event_id = $2
        AND processing_status = 'processed'
      FOR SHARE`,
    [provider, eventId],
  );
  if (!confirmedEvent.rowCount) {
    throw new Error('O evento de pagamento não foi validado e processado pelo provedor.');
  }

  const payment = paymentId === null
    ? { rowCount: 0, rows: [] }
    : await client.query(
      `SELECT id, amount, currency, paid_at, occurred_at
         FROM payments
        WHERE id = $1 AND subscription_id = $2 AND status = 'paid'
        FOR SHARE`,
      [paymentId, subscriptionId],
    );
  if (paymentId !== null && !payment.rowCount) {
    throw new Error('O pagamento confirmado não existe ou não pertence à assinatura.');
  }

  const inserted = await client.query(
    `INSERT INTO subscription_email_notifications (
       user_id, subscription_id, payment_id, provider, external_event_id,
       notification_type, event_data
     )
     SELECT subscription.user_id, subscription.id, $4, $1, $2, $5,
            jsonb_build_object(
              'name', account.name,
              'planName', subscription.plan_name,
              'billingPeriod', subscription.billing_period,
              'amount', $6::numeric,
              'currency', $7::text,
              'confirmedAt', COALESCE($8::timestamptz, subscription.updated_at),
              'renewsAt', subscription.renews_at,
              'status', subscription.status
            )
       FROM subscriptions subscription
       JOIN users account ON account.id = subscription.user_id
       JOIN plans plan ON plan.id = subscription.plan_id
      WHERE subscription.id = $3
        AND subscription.status = 'active'
     ON CONFLICT (provider, external_event_id, notification_type) DO NOTHING
     RETURNING id`,
    [
      provider,
      eventId,
      subscriptionId,
      paymentId,
      notificationType,
      payment.rows[0]?.amount ?? null,
      payment.rows[0]?.currency ?? null,
      payment.rows[0]?.paid_at ?? payment.rows[0]?.occurred_at ?? null,
    ],
  );

  if (inserted.rowCount) {
    return { id: String(inserted.rows[0].id), created: true };
  }

  const existing = await client.query(
    `SELECT id FROM subscription_email_notifications
      WHERE provider = $1 AND external_event_id = $2 AND notification_type = $3`,
    [provider, eventId, notificationType],
  );
  if (!existing.rowCount) {
    throw new Error('A assinatura não está ativa ou não foi encontrada para notificação.');
  }
  return { id: String(existing.rows[0].id), created: false };
};

export const deliverSubscriptionEmailNotification = async (
  notificationId,
  sendEmail = sendSubscriptionConfirmationEmail,
) => {
  if (!validId(notificationId)) {
    return { status: 400, body: { success: false, message: 'Identificador de notificação inválido.' } };
  }

  const claimed = await pool.query(
    `UPDATE subscription_email_notifications
        SET status = 'sending', attempt_count = attempt_count + 1,
            last_error_code = NULL, updated_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'failed')
      RETURNING id`,
    [notificationId],
  );
  if (!claimed.rowCount) {
    const current = await pool.query(
      'SELECT status FROM subscription_email_notifications WHERE id = $1',
      [notificationId],
    );
    if (!current.rowCount) {
      return { status: 404, body: { success: false, message: 'Notificação não encontrada.' } };
    }
    return {
      status: 409,
      body: { success: false, message: `Notificação não pode ser enviada no status ${current.rows[0].status}.` },
    };
  }

  const message = await pool.query(
    `SELECT notification.id, account.email, notification.event_data
       FROM subscription_email_notifications notification
       JOIN users account ON account.id = notification.user_id
      WHERE notification.id = $1`,
    [notificationId],
  );
  if (!message.rowCount) {
    await pool.query(
      `UPDATE subscription_email_notifications
          SET status = 'failed', last_error_code = 'RECIPIENT_NOT_FOUND', updated_at = NOW()
        WHERE id = $1 AND status = 'sending'`,
      [notificationId],
    );
    return { status: 200, body: { success: true, delivered: false, status: 'failed' } };
  }

  try {
    await sendEmail({ ...message.rows[0].event_data, email: message.rows[0].email });
    await pool.query(
      `UPDATE subscription_email_notifications
          SET status = 'sent', sent_at = NOW(), last_error_code = NULL, updated_at = NOW()
        WHERE id = $1 AND status = 'sending'`,
      [notificationId],
    );
    return { status: 200, body: { success: true, delivered: true, status: 'sent' } };
  } catch (error) {
    const code = safeErrorCode(error);
    await pool.query(
      `UPDATE subscription_email_notifications
          SET status = 'failed', last_error_code = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'sending'`,
      [notificationId, code],
    );
    return { status: 200, body: { success: true, delivered: false, status: 'failed', errorCode: code } };
  }
};

export const deliverNewSubscriptionEmailNotification = async (queuedNotification) => {
  if (!queuedNotification?.created) {
    return {
      status: 200,
      body: { success: true, delivered: false, duplicate: true },
    };
  }
  return deliverSubscriptionEmailNotification(queuedNotification.id);
};

export const processPendingSubscriptionEmailNotifications = async () => {
  const pending = await pool.query(
    `SELECT id
       FROM subscription_email_notifications
      WHERE status = 'pending'
      ORDER BY created_at, id
      LIMIT 20`,
  );
  const results = [];
  for (const notification of pending.rows) {
    results.push(await deliverSubscriptionEmailNotification(String(notification.id)));
  }
  return results;
};

export const listSubscriptionEmailNotifications = async () => {
  const result = await pool.query(
    `SELECT notification.id, notification.user_id, account.username,
            notification.subscription_id, notification.payment_id,
            notification.provider, notification.external_event_id,
            notification.notification_type, notification.status,
            notification.attempt_count, notification.last_error_code,
            notification.sent_at, notification.created_at, notification.updated_at,
            notification.event_data ->> 'planName' AS plan_name
       FROM subscription_email_notifications notification
       LEFT JOIN users account ON account.id = notification.user_id
      ORDER BY notification.created_at DESC, notification.id DESC
      LIMIT 500`,
  );
  return {
    status: 200,
    body: {
      success: true,
      notifications: result.rows.map((row) => ({
        id: String(row.id),
        userId: row.user_id === null ? null : String(row.user_id),
        username: row.username ?? 'Conta removida',
        subscriptionId: String(row.subscription_id),
        paymentId: row.payment_id === null ? null : String(row.payment_id),
        provider: row.provider,
        eventId: row.external_event_id,
        notificationType: row.notification_type,
        planName: row.plan_name,
        status: row.status,
        attempts: row.attempt_count,
        errorCode: row.last_error_code,
        sentAt: row.sent_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    },
  };
};
