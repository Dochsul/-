// Notification outbox. Messages are written to the DB in the same transaction as the business event,
// then delivered by a worker. Delivery status is honest:
//   sent    — the transport confirmed delivery (e.g. Telegram API returned ok)
//   stored  — written to a local file only (development); NOT delivered to a person
//   failed  — gave up after several attempts; visible in the database for follow-up
// The client confirmation is queued only after the owner notification for the same lead is 'sent'.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nowIso } from './db.mjs';
import { sendSmtp } from './smtp.mjs';

const MAX_ATTEMPTS = 8;

const ACK = {
  ru: { subject: 'AINA Évidence: заявка получена', body: 'Спасибо! Ваша заявка получена. Я отвечу вам по этому email. Если у вас срочный вопрос, напишите мне в WhatsApp или Telegram.' },
  fr: { subject: 'AINA Évidence : demande reçue', body: 'Merci ! Votre demande est bien reçue. Je vous répondrai à cette adresse e-mail. Pour une question urgente, écrivez-moi sur WhatsApp ou Telegram.' },
  en: { subject: 'AINA Évidence: request received', body: 'Thank you! Your request has been received. I will reply to this email address. For an urgent question, write to me on WhatsApp or Telegram.' },
};

export function enqueue(db, { kind, recipient, subject, body, relatedId = null }) {
  db.prepare(`INSERT INTO outbox (created_at, kind, recipient, subject, body, related_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(nowIso(), kind, recipient, subject, body, relatedId);
}

// Transports: each returns { status: 'sent' | 'stored' } or throws.
export function createTransports({ dataDir, telegram, smtp, fetchImpl = fetch }) {
  return {
    file: async (msg) => {
      const dir = join(dataDir, 'outbox');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${msg.id}.json`), JSON.stringify({ to: msg.recipient, subject: msg.subject, body: msg.body, kind: msg.kind }, null, 2), 'utf8');
      return { status: 'stored' };
    },
    // Real email delivery through any SMTP relay. 'sent' means the relay accepted the message.
    smtp: async (msg) => {
      if (!smtp?.host) throw new Error('smtp_not_configured');
      await sendSmtp({
        host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, pass: smtp.pass,
        from: { name: smtp.fromName, address: smtp.fromAddress }, replyTo: smtp.replyTo || undefined,
        to: msg.recipient, subject: msg.subject, text: msg.body, tlsOptions: smtp.tlsOptions || {},
      });
      return { status: 'sent' };
    },
    telegram: async (msg) => {
      if (!telegram?.token || !telegram?.chatId) throw new Error('telegram_not_configured');
      const res = await fetchImpl(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegram.chatId, text: `${msg.subject}\n\n${msg.body}`.slice(0, 4000), disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(`telegram_error_${res.status}`);
      return { status: 'sent' };
    },
  };
}

// Channel per message kind. Owner messages go to the owner channel; client messages to the client mail channel.
export function channelFor(kind, config) {
  if (kind.endsWith('_owner')) return config.ownerChannel;
  return config.clientChannel;
}

export async function processOutbox(db, transports, config, { limit = 20 } = {}) {
  // 1) Client acknowledgements for leads whose owner notification was really sent.
  const needAck = db.prepare(`
    SELECT l.id, l.email, l.locale FROM leads l
    JOIN outbox o ON o.related_id = l.id AND o.kind = 'lead_owner' AND o.status = 'sent'
    WHERE NOT EXISTS (SELECT 1 FROM outbox c WHERE c.related_id = l.id AND c.kind = 'lead_client')
  `).all();
  for (const lead of needAck) {
    const t = ACK[lead.locale] || ACK.en;
    enqueue(db, { kind: 'lead_client', recipient: lead.email, subject: t.subject, body: t.body, relatedId: lead.id });
  }

  // 2) Deliver pending messages.
  const pending = db.prepare(`SELECT * FROM outbox WHERE status = 'pending' ORDER BY id LIMIT ?`).all(limit);
  let sent = 0, failed = 0;
  for (const msg of pending) {
    const channel = channelFor(msg.kind, config);
    try {
      const transport = transports[channel];
      if (!transport) throw new Error(`no_transport_${channel}`);
      const result = await transport(msg);
      db.prepare(`UPDATE outbox SET status = ?, attempts = attempts + 1, sent_at = ?, last_error = NULL WHERE id = ?`)
        .run(result.status, nowIso(), msg.id);
      sent++;
    } catch (e) {
      const attempts = msg.attempts + 1;
      db.prepare(`UPDATE outbox SET attempts = ?, last_error = ?, status = ? WHERE id = ?`)
        .run(attempts, String(e.message).slice(0, 200), attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', msg.id);
      failed++;
    }
  }
  return { sent, failed };
}
