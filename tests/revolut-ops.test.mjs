// Revolut operations: fee reconciliation, manual refund recording, sandbox-only check script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { openDb } from '../server/db.mjs';
import { parseFeeCsv, applyFees, FeeImportError } from '../server/fees.mjs';

const run = (args, env = {}) => new Promise((resolve) => {
  const c = spawn(process.execPath, args, { env: { PATH: process.env.PATH, ...env } }); let out = '', err = '';
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (err += d)); c.on('close', (status) => resolve({ status, stdout: out, stderr: err }));
});

function seed(file) {
  const db = openDb(file);
  const t = new Date().toISOString();
  const ins = db.prepare(`INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, terms_accepted_at, digital_waiver_at, provider_session_id)
    VALUES (?, ?, ?, 'fr', 'b@example.com', '[]', ?, 'EUR', 'paid', 'revolut', ?, ?, ?)`);
  ins.run('ordA', t, t, 1990, t, t, 'rv-A');
  ins.run('ordB', t, t, 990, t, t, 'rv-B');
  db.prepare("INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status, created_at) VALUES ('ordA','revolut','rv-A',1990,'EUR','succeeded',?)").run(t);
  db.prepare("INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status, created_at) VALUES ('ordB','revolut','rv-B',990,'EUR','succeeded',?)").run(t);
  return db;
}

test('fee CSV: columns are required; decimals become cents; bad rows are flagged, not guessed', () => {
  assert.throws(() => parseFeeCsv('ref,amount\nordA,1'), (e) => e instanceof FeeImportError && /missing column: reference/.test(e.message));
  const rows = parseFeeCsv('Reference,Fee,Currency\nordA,0.55,eur\n"ordB","x",EUR\n');
  assert.equal(rows[0].feeCents, 55);
  assert.equal(rows[0].currency, 'EUR');
  assert.equal(rows[1].error, 'bad_row');
});

test('fee apply: updates only matching Revolut payments; mismatched currency or unknown reference are skipped', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'aina-fee-')), 'app.db');
  const db = seed(file);
  const res = applyFees(db, parseFeeCsv('reference,fee,currency\nordA,0.55,EUR\nordB,0.10,USD\nghost,1.00,EUR\n'));
  assert.equal(res.updated, 1);
  assert.deepEqual(res.skipped.map((s) => s.reason), ['currency_mismatch', 'unknown_reference']);
  const pa = db.prepare("SELECT fee_cents, net_cents, fee_currency FROM payments WHERE order_id = 'ordA'").get();
  assert.deepEqual({ ...pa }, { fee_cents: 55, net_cents: 1935, fee_currency: 'EUR' });
  assert.equal(db.prepare("SELECT fee_cents FROM payments WHERE order_id = 'ordB'").get().fee_cents, null);
  db.close();
});

test('fee import script: dry run writes nothing; --apply writes; unknown database is refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aina-fee2-'));
  const file = join(dir, 'app.db'); seed(file).close();
  const csv = join(dir, 's.csv'); writeFileSync(csv, 'reference,fee,currency\nordA,0.55,EUR\n');
  const dry = await run(['scripts/import-revolut-fees.mjs', csv], { DB_FILE: file });
  assert.match(dry.stdout, /DRY RUN/);
  const db1 = openDb(file);
  assert.equal(db1.prepare("SELECT fee_cents FROM payments WHERE order_id='ordA'").get().fee_cents, null, 'dry run wrote nothing');
  db1.close();
  const ap = await run(['scripts/import-revolut-fees.mjs', csv, '--apply'], { DB_FILE: file });
  assert.match(ap.stdout, /fees applied: 1/);
  const none = await run(['scripts/import-revolut-fees.mjs', csv], { DB_FILE: join(dir, 'nope.db') });
  assert.equal(none.status, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('manual refund: recorded once per Revolut refund id, cannot exceed the paid amount, full refund revokes links', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aina-rf-'));
  const file = join(dir, 'app.db');
  const db = seed(file);
  db.prepare("INSERT INTO downloads (token_hash, order_id, sku, created_at, expires_at, max_downloads) VALUES ('h1','ordA','g','x','2099-01-01',5)").run();
  db.close();
  const env = { DB_FILE: file, OWNER_EMAIL: 'owner@example.com' };
  const part = await run(['scripts/record-refund.mjs', '--order', 'ordA', '--amount', '5.00', '--ref', 'rf_1'], env);
  assert.match(part.stdout, /partial/);
  const again = await run(['scripts/record-refund.mjs', '--order', 'ordA', '--amount', '5.00', '--ref', 'rf_1'], env);
  assert.match(again.stdout, /already recorded/);
  const over = await run(['scripts/record-refund.mjs', '--order', 'ordA', '--amount', '100.00', '--ref', 'rf_2'], env);
  assert.equal(over.status, 1);
  assert.match(over.stderr, /refund_exceeds_payment/);
  const full = await run(['scripts/record-refund.mjs', '--order', 'ordA', '--amount', '14.90', '--ref', 'rf_3'], env);
  assert.match(full.stdout, /full/);
  const check = openDb(file);
  assert.equal(check.prepare("SELECT status FROM orders WHERE id='ordA'").get().status, 'refunded');
  assert.equal(check.prepare("SELECT revoked FROM downloads WHERE token_hash='h1'").get().revoked, 1);
  assert.equal(check.prepare('SELECT COUNT(*) n FROM refunds').get().n, 2);
  check.close();
  rmSync(dir, { recursive: true, force: true });
});

test('sandbox check script: refuses production and missing keys before any network call', async () => {
  const prod = await run(['scripts/revolut-test.mjs', 'check'], { REVOLUT_ENV: 'production', REVOLUT_SANDBOX_API_KEY: 'k' });
  assert.equal(prod.status, 2);
  assert.match(prod.stderr, /REFUSED/);
  const nokey = await run(['scripts/revolut-test.mjs', 'check'], {});
  assert.equal(nokey.status, 1);
  assert.match(nokey.stderr, /not set/);
});

test('accounting export includes Revolut payments with the fee marked as to-reconcile until imported', async () => {
  const { ledgerRows } = await import('../server/ledger.mjs');
  const file = join(mkdtempSync(join(tmpdir(), 'aina-led-')), 'app.db');
  const db = seed(file);
  const rows = ledgerRows(db, {});
  const a = rows.find((r) => r.order_id === 'ordA');
  assert.equal(a.provider, 'revolut');
  assert.equal(a.fee_status, 'TO_RECONCILE');
  applyFees(db, parseFeeCsv('reference,fee,currency\nordA,0.55,EUR\n'));
  const after = ledgerRows(db, {}).find((r) => r.order_id === 'ordA');
  assert.equal(after.fee, '0.55');
  assert.equal(after.net, '19.35');
  assert.equal(after.fee_status, 'ok');
  db.close();
});
