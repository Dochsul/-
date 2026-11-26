// The thank-you page checks the order status on the server. Returning to the page is not proof of payment. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { loadConfig } from '../server/config.mjs';
import { createTransports } from '../server/outbox.mjs';

const ID_PAID = 'aa'.repeat(12);
const ID_PENDING = 'bb'.repeat(12);
const ID_FAILED = 'cc'.repeat(12);
const ID_REVIEW = 'dd'.repeat(12);
let server, base, db, dir;

function order(id, status) {
  const t = new Date().toISOString();
  db.prepare(`INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, provider_session_id, customer_country, terms_accepted_at, digital_waiver_at, paid_at)
              VALUES (?, ?, ?, 'ru', 'buyer@example.test', '[{"sku":"guide-a","qty":1}]', 990, 'EUR', ?, 'revolut', ?, 'FR', ?, ?, ?)`)
    .run(id, t, t, status, `rv-${id}`, t, t, status === 'paid' ? t : null);
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'status-test-'));
  const config = loadConfig({ DB_FILE: ':memory:', DATA_DIR: dir, WORKER: 'off', REGISTRATION_FILE: 'off' });
  config.dataDir = dir;
  db = openDb(':memory:');
  order(ID_PAID, 'paid');
  order(ID_PENDING, 'pending_payment');
  order(ID_FAILED, 'failed');
  order(ID_REVIEW, 'review_sanctions');
  const app = createApp({ config, db, transports: createTransports({ dataDir: dir, telegram: {}, smtp: {} }) });
  server = createServer((req, res) => { app(req, res); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

const status = (id) => fetch(`${base}/api/orders/${id}/status`);

test('a paid order reports paid; a pending order does not', async () => {
  const paid = await (await status(ID_PAID)).json();
  assert.deepEqual(paid, { status: 'paid', paid: true });
  const pending = await (await status(ID_PENDING)).json();
  assert.deepEqual(pending, { status: 'pending', paid: false });
});

test('failed and sanctions-review orders are never reported as paid', async () => {
  assert.deepEqual(await (await status(ID_FAILED)).json(), { status: 'unpaid', paid: false });
  assert.deepEqual(await (await status(ID_REVIEW)).json(), { status: 'review', paid: false });
});

test('the response carries only the status: no e-mail, items, amounts or provider identifiers', async () => {
  const text = await (await status(ID_PAID)).text();
  assert.doesNotMatch(text, /@|guide-a|990|rv-|provider|token/);
});

test('an unknown or malformed order id gives 404 and reveals nothing', async () => {
  assert.equal((await status('ee'.repeat(12))).status, 404);
  assert.equal((await status('not-an-id')).status, 404);
  assert.equal((await fetch(`${base}/api/orders/${ID_PAID}/status?x=1`)).status, 200);
});

test('the status response is not cached', async () => {
  const res = await status(ID_PAID);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('the status route is GET only', async () => {
  const res = await fetch(`${base}/api/orders/${ID_PAID}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.notEqual(res.status, 200);
});
