#!/usr/bin/env node
// Records a refund that was made in the Revolut Business dashboard (automatic refund sync is not implemented).
// Usage: DB_FILE=data/app.db node scripts/record-refund.mjs --order <order-id> --amount 9.90 --ref <revolut-refund-id> [--reason text]
// The amount is cumulative-checked: it cannot exceed what was paid. A repeated --ref is recorded only once.
import { existsSync } from 'node:fs';
import { openDb } from '../server/db.mjs';
import { applyRefund } from '../server/refunds.mjs';
import { loadConfig } from '../server/config.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const orderId = arg('order'); const amount = Number(arg('amount')); const ref = arg('ref'); const reason = arg('reason');
if (!orderId || !Number.isFinite(amount) || amount <= 0 || !ref || !/^[A-Za-z0-9_-]{4,80}$/.test(ref)) {
  console.error('Usage: node scripts/record-refund.mjs --order <id> --amount <decimal> --ref <refund-id> [--reason text]'); process.exit(1);
}
const dbFile = process.env.DB_FILE || 'data/app.db';
if (!existsSync(dbFile)) { console.error(`Database not found: ${dbFile}`); process.exit(1); }
const db = openDb(dbFile);
try {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('unknown order');
  const res = applyRefund(db, { order, providerName: order.provider, providerRefundId: ref, amountCents: Math.round(amount * 100), reason, ownerEmail: loadConfig(process.env).ownerEmail });
  console.log(res.recorded ? `refund recorded: ${res.full ? 'full' : 'partial'}, total refunded ${(res.total / 100).toFixed(2)} ${order.currency}` : 'already recorded (same refund id): nothing changed');
} catch (e) {
  console.error(`RECORD FAILED: ${e.message}`); process.exitCode = 1;
} finally { db.close(); }
