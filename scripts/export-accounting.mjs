#!/usr/bin/env node
// Accounting export: payments and refunds for a period, as CSV, plus per-currency totals.
// Usage: node scripts/export-accounting.mjs --from 2026-01-01 --to 2026-12-31 [--db data/app.db] [--out exports/2026.csv] [--with-email]
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from '../server/db.mjs';
import { ledgerRows, ledgerTotals, toCsv } from '../server/ledger.mjs';

const arg = (name, def = null) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const dbFile = arg('db', process.env.DB_FILE || 'data/app.db');
if (!existsSync(dbFile)) { console.error(`Database not found: ${dbFile}`); process.exit(1); }
const from = arg('from'); const to = arg('to');
for (const d of [from, to]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) { console.error('Dates must be YYYY-MM-DD'); process.exit(1); }
const db = openDb(dbFile);
const rows = ledgerRows(db, { from, to, withEmail: process.argv.includes('--with-email') });
const out = arg('out', `exports/accounting-${from || 'start'}-${to || 'now'}.csv`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, toCsv(rows), 'utf8');
console.log(`${rows.length} rows → ${out}`);
for (const [cur, t] of Object.entries(ledgerTotals(rows))) {
  console.log(`${cur}: payments ${(t.payments / 100).toFixed(2)}, refunds ${(t.refunds / 100).toFixed(2)}, known fees ${(t.fees / 100).toFixed(2)}, fees to reconcile: ${t.feesToReconcile}`);
}
db.close();
