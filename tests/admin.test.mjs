// Owner admin panel: login, sessions, rate limit, read-only data, page security. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { loadConfig, assertProductionConfig } from '../server/config.mjs';
import { createTransports } from '../server/outbox.mjs';
import { hashPassword, verifyPassword, createSession, isValidSession, SESSION_MS } from '../server/admin.mjs';

const PASSWORD = 'correct horse battery staple';
let server, base, db, dir, hash;

before(async () => {
  hash = await hashPassword(PASSWORD, { N: 1024 }); // small cost keeps the test fast; production uses the default
  dir = mkdtempSync(join(tmpdir(), 'admin-test-'));
  const config = loadConfig({ DB_FILE: ':memory:', DATA_DIR: dir, ADMIN_PASSWORD_HASH: hash, WORKER: 'off', REGISTRATION_FILE: 'off' });
  config.dataDir = dir;
  db = openDb(':memory:');
  const transports = createTransports({ dataDir: dir, telegram: {}, smtp: {} });
  const app = createApp({ config, db, transports });
  server = createServer((req, res) => { app(req, res); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const login = (password) => fetch(`${base}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
});
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('password hash: correct password verifies, wrong or malformed does not', async () => {
  assert.equal(await verifyPassword(PASSWORD, hash), true);
  assert.equal(await verifyPassword('wrong password here', hash), false);
  assert.equal(await verifyPassword(PASSWORD, 'not-a-hash'), false);
  assert.equal(await verifyPassword(PASSWORD, null), false);
  assert.match(hash, /^scrypt:/);
  assert.ok(!hash.includes(PASSWORD), 'the hash must not contain the password');
});

test('hash refuses short and oversized passwords', async () => {
  await assert.rejects(hashPassword('short'));
  await assert.rejects(hashPassword('x'.repeat(201)));
});

test('config refuses a plain password in ADMIN_PASSWORD_HASH', () => {
  const config = loadConfig({ ADMIN_PASSWORD_HASH: PASSWORD, REGISTRATION_FILE: 'off' });
  const errors = assertProductionConfig({ ...config, siteUrl: 'https://example.test', ipSalt: 'x'.repeat(20), trustProxy: true, ownerChannel: 'telegram', telegram: { token: 't', chatId: 'c' } }, { NODE_ENV: 'production' });
  assert.ok(errors.some((e) => e.includes('ADMIN_PASSWORD_HASH')), errors.join('; '));
});

test('the admin page and API are unavailable without a session', async () => {
  const page = await fetch(`${base}/admin`);
  assert.equal(page.status, 200);
  const summary = await fetch(`${base}/api/admin/summary`);
  assert.equal(summary.status, 401);
  const orders = await fetch(`${base}/api/admin/orders`);
  assert.equal(orders.status, 401);
  const csv = await fetch(`${base}/api/admin/ledger.csv`);
  assert.equal(csv.status, 401);
});

test('a wrong password is refused without a cookie', async () => {
  const res = await login('definitely wrong password');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('correct password sets a HttpOnly, SameSite=Strict session cookie', async () => {
  const res = await login(PASSWORD);
  assert.equal(res.status, 200);
  const raw = res.headers.get('set-cookie');
  assert.match(raw, /aina_admin=[A-Za-z0-9_-]{43}/);
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /SameSite=Strict/);
  assert.match(raw, /Path=\//);
  // The test server runs over http, so the Secure flag is off here; production (https SITE_URL) adds it.
  assert.doesNotMatch(raw, /Secure/);
  assert.match(raw, new RegExp(`Max-Age=${SESSION_MS / 1000}`));
});

test('with the session cookie the summary and lists are readable', async () => {
  const cookie = cookieOf(await login(PASSWORD));
  const summary = await fetch(`${base}/api/admin/summary`, { headers: { cookie } });
  assert.equal(summary.status, 200);
  const s = await summary.json();
  for (const k of ['orders', 'leads', 'leadsLast7Days', 'outbox', 'money', 'generatedAt']) assert.ok(k in s, `summary has ${k}`);
  const orders = await (await fetch(`${base}/api/admin/orders`, { headers: { cookie } })).json();
  assert.deepEqual(orders.orders, []);
  const leads = await (await fetch(`${base}/api/admin/leads?limit=5`, { headers: { cookie } })).json();
  assert.deepEqual(leads.leads, []);
});

test('the ledger CSV is an attachment and leaves out buyer emails', async () => {
  const cookie = cookieOf(await login(PASSWORD));
  const res = await fetch(`${base}/api/admin/ledger.csv?from=2026-01-01&to=2026-12-31`, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment/);
  const text = await res.text();
  // The buyer e-mail must never be in the export (the file has no rows in this empty test database).
  assert.doesNotMatch(text, /@/);
  assert.doesNotMatch(text.split('\n')[0], /email/);
  const bad = await fetch(`${base}/api/admin/ledger.csv?from=yesterday`, { headers: { cookie } });
  assert.equal(bad.status, 422);
});

test('the page carries a strict CSP, noindex, and no inline script or handlers', async () => {
  const res = await fetch(`${base}/admin`);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /default-src 'self'/);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const html = await res.text();
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)/i, 'no inline <script> blocks');
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no on*= handlers');
  assert.doesNotMatch(html, /\sstyle\s*=/i, 'no style= attributes');
  const js = await fetch(`${base}/admin/admin.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
});

test('admin files outside the whitelist are not served', async () => {
  assert.equal((await fetch(`${base}/admin/../server/admin.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/admin/index.html`)).status, 404);
  const cookie = cookieOf(await login(PASSWORD));
  assert.equal((await fetch(`${base}/api/admin/unknown`, { headers: { cookie } })).status, 404);
});

test('logout revokes the session', async () => {
  const cookie = cookieOf(await login(PASSWORD));
  assert.equal((await fetch(`${base}/api/admin/summary`, { headers: { cookie } })).status, 200);
  const out = await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: '{}' });
  assert.equal(out.status, 200);
  assert.equal((await fetch(`${base}/api/admin/summary`, { headers: { cookie } })).status, 401);
});

test('a form post from another site cannot log in or change state (JSON only)', async () => {
  const res = await fetch(`${base}/api/admin/logout`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: `password=${encodeURIComponent(PASSWORD)}`,
  });
  assert.equal(res.status, 415);
});

test('sessions expire and store only a hash of the token', () => {
  const t0 = Date.now();
  const token = createSession(db, t0);
  assert.equal(isValidSession(db, token, t0 + 1000), true);
  assert.equal(isValidSession(db, token, t0 + SESSION_MS + 1000), false, 'expired session is refused');
  const stored = db.prepare('SELECT token_hash FROM admin_sessions').all().map((r) => r.token_hash).join(' ');
  assert.ok(!stored.includes(token), 'the raw token is not stored');
});


test('with real rows: money per currency, order list without tokens, lead list', async () => {
  const t = new Date().toISOString();
  db.prepare(`INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, provider_session_id, customer_country, terms_accepted_at, digital_waiver_at, paid_at)
              VALUES ('ord_admin_1', ?, ?, 'fr', 'buyer@example.test', '[{"sku":"guide-a","qty":1}]', 990, 'EUR', 'paid', 'revolut', 'rv-admin-1', 'FR', ?, ?, ?)`).run(t, t, t, t, t);
  db.prepare(`INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, fee_cents, net_cents, fee_currency, status, created_at)
              VALUES ('ord_admin_1', 'revolut', 'pay-admin-1', 990, 'EUR', NULL, NULL, NULL, 'paid', ?)`).run(t);
  db.prepare(`INSERT INTO leads (id, created_at, locale, name, email, phone, topic, message, consent_at, ip_hash, status)
              VALUES ('lead_admin_1', ?, 'ru', 'Тест', 'lead@example.test', NULL, 'consult', 'Вопрос', ?, 'hash', 'new')`).run(t, t);
  const cookie = cookieOf(await login(PASSWORD));
  const s = await (await fetch(`${base}/api/admin/summary`, { headers: { cookie } })).json();
  assert.equal(s.orders.paid, 1);
  assert.equal(s.money.EUR.payments, 990);
  assert.equal(s.money.EUR.feesToReconcile, 1, 'a payment without an imported fee is counted for reconciliation, not guessed');
  assert.equal(s.leads.new, 1);
  const orders = await (await fetch(`${base}/api/admin/orders`, { headers: { cookie } })).json();
  assert.equal(orders.orders.length, 1);
  assert.deepEqual(orders.orders[0].items, ['guide-a']);
  const raw = JSON.stringify(orders);
  assert.doesNotMatch(raw, /provider_session_id|token|rv-admin-1/, 'no provider or token identifiers in the list');
  const leads = await (await fetch(`${base}/api/admin/leads`, { headers: { cookie } })).json();
  assert.equal(leads.leads[0].topic, 'consult');
});

// Keep the lock-out test last: it blocks logins for 15 minutes.
test('too many failed logins are rate limited', async () => {
  const fresh = await login('wrong one 1234567890');
  assert.ok([401, 429].includes(fresh.status));
  let last = null;
  for (let i = 0; i < 8; i++) last = await login(`wrong attempt number ${i}`);
  assert.equal(last.status, 429);
  // even the right password is refused while locked out
  assert.equal((await login(PASSWORD)).status, 429);
});
