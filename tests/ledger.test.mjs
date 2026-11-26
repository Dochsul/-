// Accounting ledger and CSV export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.mjs';
import { ledgerRows, ledgerTotals, toCsv } from '../server/ledger.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function seed(db) {
  const ins = db.prepare(`INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider,
    customer_country, terms_accepted_at, digital_waiver_at) VALUES (?, ?, ?, 'fr', ?, ?, ?, ?, ?, 'stripe', 'FR', ?, ?)`);
  ins.run('o1', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z', 'a@example.com', JSON.stringify([{ sku: 'parent-guides-bundle' }]), 1990, 'EUR', 'paid', '2026-03-01T10:00:00Z', '2026-03-01T10:00:00Z');
  ins.run('o2', '2026-03-05T10:00:00Z', '2026-03-05T10:00:00Z', '=HYPERLINK("x")@example.com', JSON.stringify([{ sku: 'parent-guides-bundle' }]), 1990, 'EUR', 'refunded', '2026-03-05T10:00:00Z', '2026-03-05T10:00:00Z');
  const pay = db.prepare(`INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, fee_cents, net_cents, fee_currency, status, created_at)
    VALUES (?, 'stripe', ?, ?, 'EUR', ?, ?, ?, 'succeeded', ?)`);
  pay.run('o1', 'pi_1', 1990, 55, 1935, 'EUR', '2026-03-01T10:00:01Z');
  pay.run('o2', 'pi_2', 1990, null, null, null, '2026-03-05T10:00:01Z');
  db.prepare(`INSERT INTO refunds (order_id, provider, provider_refund_id, amount_cents, currency, reason, created_at)
    VALUES ('o2', 'stripe', 're_1', 1990, 'EUR', 'requested_by_customer', '2026-03-06T09:00:00Z')`).run();
}

test('ledger rows: payments and refunds in date order, refund as negative amount', () => {
  const db = openDb(':memory:'); seed(db);
  const rows = ledgerRows(db, {});
  assert.deepEqual(rows.map((r) => r.type), ['payment', 'payment', 'refund']);
  assert.equal(rows[0].gross, '19.90');
  assert.equal(rows[0].fee, '0.55');
  assert.equal(rows[0].net, '19.35');
  assert.equal(rows[1].fee_status, 'TO_RECONCILE');
  assert.equal(rows[2].gross, '-19.90');
});

test('ledger rows: period filter is inclusive of the end date', () => {
  const db = openDb(':memory:'); seed(db);
  assert.equal(ledgerRows(db, { from: '2026-03-01', to: '2026-03-01' }).length, 1);
  assert.equal(ledgerRows(db, { from: '2026-03-02', to: '2026-03-31' }).length, 2);
  assert.equal(ledgerRows(db, { from: '2026-04-01' }).length, 0);
});

test('ledger totals per currency, with fees still to reconcile counted separately', () => {
  const db = openDb(':memory:'); seed(db);
  const t = ledgerTotals(ledgerRows(db, {}));
  assert.deepEqual(t.EUR, { payments: 3980, refunds: 1990, fees: 55, feesToReconcile: 1 });
});

test('CSV: no email by default; formula-like cells are neutralised; quoting is RFC 4180', () => {
  const db = openDb(':memory:'); seed(db);
  const plain = toCsv(ledgerRows(db, {}));
  assert.equal(plain.includes('@example.com'), false);
  const withEmail = toCsv(ledgerRows(db, { withEmail: true }));
  assert.match(withEmail, /'=HYPERLINK\(""x""\)@example\.com/);
  assert.match(withEmail.split('\r\n')[0], /,email$/);
  assert.match(plain, /,-19\.90,/); // negative numbers stay numbers
  assert.ok(toCsv([{ a: 'x,y', b: 'say "hi"' }]).includes('"x,y","say ""hi"""'));
});

test('CLI export writes a CSV and prints totals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aina-ledger-'));
  const dbFile = join(dir, 'app.db');
  const db = openDb(dbFile); seed(db); db.close();
  const out = join(dir, 'out.csv');
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'export-accounting.mjs'), '--db', dbFile, '--from', '2026-03-01', '--to', '2026-03-31', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /EUR: payments 39\.80, refunds 19\.90, known fees 0\.55, fees to reconcile: 1/);
  assert.equal(readFileSync(out, 'utf8').trim().split('\r\n').length, 4);
  rmSync(dir, { recursive: true, force: true });
});
