// Refund bookkeeping, shared by all providers. Amounts are cumulative per order and can never exceed the paid amount.
import { nowIso } from './db.mjs';
import { enqueue } from './outbox.mjs';

export function applyRefund(db, { order, providerName, providerRefundId, amountCents, reason = null, ownerEmail }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('invalid_refund_amount');
  const already = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM refunds WHERE order_id = ?').get(order.id).s;
  if (already + amountCents > order.amount_cents) throw new Error('refund_exceeds_payment');
  // Idempotent on the provider's refund id: the same refund reported twice is recorded once.
  const inserted = db.prepare(`INSERT OR IGNORE INTO refunds (order_id, provider, provider_refund_id, amount_cents, currency, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(order.id, providerName, providerRefundId, amountCents, order.currency, reason, nowIso());
  if (inserted.changes !== 1) return { recorded: false };
  const total = already + amountCents;
  const full = total >= order.amount_cents;
  const t = nowIso();
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(full ? 'refunded' : 'partially_refunded', t, order.id);
  if (full) db.prepare('UPDATE downloads SET revoked = 1 WHERE order_id = ?').run(order.id);
  enqueue(db, { kind: 'order_owner', recipient: ownerEmail, subject: full ? 'Возврат: полный' : 'Возврат: частичный',
    body: `Заказ ${order.id}: возвращено ${(total / 100).toFixed(2)} ${order.currency} из ${(order.amount_cents / 100).toFixed(2)}.${full ? ' Доступ к файлам отозван.' : ''}`, relatedId: order.id });
  return { recorded: true, full, total };
}
