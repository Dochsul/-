// Accounting ledger queries and CSV export. Amounts are stored in minor units; the export shows decimals.
// The buyer's email is excluded by default (data minimisation); pass { withEmail: true } when an invoice needs it.

const dec = (cents) => (cents == null ? '' : (cents / 100).toFixed(2));

export function ledgerRows(db, { from, to, withEmail = false } = {}) {
  const start = from || '0000-01-01';
  const end = to ? `${to}T23:59:59.999Z` : '9999-12-31';
  const payments = db.prepare(`
    SELECT p.created_at, p.order_id, p.provider, p.provider_payment_id AS provider_id, p.currency, p.amount_cents,
           p.fee_cents, p.fee_currency, p.net_cents, o.customer_country, o.items_json, o.status, o.email
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.created_at >= ? AND p.created_at <= ? ORDER BY p.created_at`).all(start, end);
  const refunds = db.prepare(`
    SELECT r.created_at, r.order_id, r.provider, r.provider_refund_id AS provider_id, r.currency, r.amount_cents, r.reason,
           o.customer_country, o.items_json, o.status, o.email
    FROM refunds r JOIN orders o ON o.id = r.order_id
    WHERE r.created_at >= ? AND r.created_at <= ? ORDER BY r.created_at`).all(start, end);
  const items = (json) => JSON.parse(json).map((i) => i.sku).join(' + ');
  const rows = [
    ...payments.map((p) => ({
      type: 'payment', date: p.created_at, order_id: p.order_id, provider: p.provider, provider_id: p.provider_id,
      currency: p.currency, gross: dec(p.amount_cents), fee: dec(p.fee_cents), fee_currency: p.fee_currency || '',
      net: dec(p.net_cents), fee_status: p.fee_cents == null ? 'TO_RECONCILE' : 'ok', country: p.customer_country || '',
      items: items(p.items_json), order_status: p.status, reason: '', ...(withEmail ? { email: p.email } : {}),
    })),
    ...refunds.map((r) => ({
      type: 'refund', date: r.created_at, order_id: r.order_id, provider: r.provider, provider_id: r.provider_id,
      currency: r.currency, gross: dec(-r.amount_cents), fee: '', fee_currency: '', net: '', fee_status: '',
      country: r.customer_country || '', items: items(r.items_json), order_status: r.status, reason: r.reason || '',
      ...(withEmail ? { email: r.email } : {}),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

// Totals per currency: gross payments, refunds, known fees, and how many fees still need reconciliation.
export function ledgerTotals(rows) {
  const t = {};
  for (const r of rows) {
    const c = (t[r.currency] ||= { payments: 0, refunds: 0, fees: 0, feesToReconcile: 0 });
    if (r.type === 'payment') {
      c.payments += Math.round(Number(r.gross) * 100);
      if (r.fee_status === 'TO_RECONCILE') c.feesToReconcile += 1; else c.fees += Math.round(Number(r.fee) * 100);
    } else c.refunds += Math.round(-Number(r.gross) * 100);
  }
  return t;
}

// RFC 4180 CSV. Cells that a spreadsheet could execute as a formula are prefixed with an apostrophe.
export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}
