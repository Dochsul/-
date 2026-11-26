// Reconciliation of Revolut fees. Revolut does not put the fee into the order response we use, so fees are
// imported from a statement CSV that the owner exports from Revolut Business. The CSV must be reviewed before import.
// Required columns (case-insensitive): reference (= our order id), fee (decimal, in the payment currency), currency.
// Rows whose currency or reference do not match a Revolut payment are reported and skipped, never guessed.

export class FeeImportError extends Error {}

export function parseFeeCsv(text) {
  const lines = String(text).replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new FeeImportError('empty_csv');
  const head = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const col = (n) => { const i = head.indexOf(n); if (i < 0) throw new FeeImportError(`missing column: ${n}`); return i; };
  const ci = { ref: col('reference'), fee: col('fee'), cur: col('currency') };
  return lines.slice(1).map((l, n) => {
    const c = l.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    const fee = Number(c[ci.fee]);
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(c[ci.ref] || '') || !Number.isFinite(fee) || fee < 0) return { line: n + 2, error: 'bad_row' };
    return { line: n + 2, reference: c[ci.ref], feeCents: Math.round(fee * 100), currency: (c[ci.cur] || '').toUpperCase() };
  });
}

export function applyFees(db, rows) {
  const out = { updated: 0, skipped: [] };
  for (const r of rows) {
    if (r.error) { out.skipped.push({ line: r.line, reason: r.error }); continue; }
    const order = db.prepare("SELECT * FROM orders WHERE id = ? AND provider = 'revolut'").get(r.reference);
    if (!order) { out.skipped.push({ line: r.line, reason: 'unknown_reference' }); continue; }
    if (order.currency !== r.currency) { out.skipped.push({ line: r.line, reason: 'currency_mismatch' }); continue; }
    if (r.feeCents > order.amount_cents) { out.skipped.push({ line: r.line, reason: 'fee_exceeds_amount' }); continue; }
    const res = db.prepare(`UPDATE payments SET fee_cents = ?, net_cents = ?, fee_currency = ? WHERE order_id = ? AND provider = 'revolut'`)
      .run(r.feeCents, order.amount_cents - r.feeCents, r.currency, order.id);
    if (res.changes === 1) out.updated++; else out.skipped.push({ line: r.line, reason: 'no_payment_row' });
  }
  return out;
}
