// Integration tests for the API. Run: npm test
// Uses an in-memory SQLite database, a temporary private directory and a fake Stripe fetch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac } from 'node:crypto';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { createTransports, processOutbox } from '../server/outbox.mjs';
import { verifyStripeSignature } from '../server/stripe.mjs';
import { validateLead, validateCheckout, priceOrder } from '../server/validate.mjs';

const SKU = 'test-guide';
const SECRET_KEY = 'sk_test_fake';
const WEBHOOK = 'whsec_test_fake';
const PDF = Buffer.from('%PDF-1.4 test content\n%%EOF');

const catalog = [{
  sku: SKU, currency: 'EUR', priceCents: 1900, published: true, contentConfirmed: true,
  i18n: { ru: { title: 'Тест', summary: 's', topics: [] }, fr: { title: 'Test', summary: 's', topics: [] }, en: { title: 'Test', summary: 's', topics: [] } },
}];

let base, server, db, dir, stripeCalls, sentStripe;

function signed(body, secret = WEBHOOK, t = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

const fakeFetch = async (url, init) => {
  if (String(url).startsWith('https://api.stripe.com/v1/checkout/sessions')) {
    stripeCalls.push({ url, init });
    return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.test/c/cs_test_1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).startsWith('https://api.telegram.org/')) {
    sentStripe.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  throw new Error('unexpected fetch ' + url);
};

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'aina-test-'));
  mkdirSync(join(dir, 'private'), { recursive: true });
  writeFileSync(join(dir, 'private', `${SKU}.pdf`), PDF);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html><title>x</title>');
  db = openDb(':memory:');
  const config = {
    siteUrl: 'https://site.test', ipSalt: 'salt', ownerEmail: 'owner@test.fr', ownerChannel: 'file', clientChannel: 'file',
    trustProxy: false, paymentsEnabled: true, stripeSecretKey: SECRET_KEY, stripeWebhookSecret: WEBHOOK,
    privateDir: join(dir, 'private'), distDir: join(dir, 'dist'), dataDir: dir, catalog, pricesConfirmed: true,
    blockedCountries: ['RU', 'BY'], downloadValidityDays: 7, downloadMaxCount: 5, telegram: {},
  };
  config.transportsFor = () => createTransports({ dataDir: dir, telegram: { token: 't', chatId: '1' }, fetchImpl: fakeFetch });
  const transports = createTransports({ dataDir: dir, telegram: {}, fetchImpl: fakeFetch });
  const app = createApp({ config, db, transports, fetchImpl: fakeFetch });
  server = createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  globalThis.__config = config;
  stripeCalls = [];
  sentStripe = [];
});

after(async () => {
  server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path, body, headers = {}) => fetch(base + path, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const goodLead = () => ({ name: 'Анна Петрова', email: 'anna@example.com', topic: 'consultation-adult', consent: true, locale: 'ru', message: 'Хочу понять, с чего начать' });

// ---------- leads ----------
test('lead: valid request is stored with an owner notification queued', async () => {
  const before = db.prepare('SELECT COUNT(*) n FROM leads').get().n;
  const res = await post('/api/leads', goodLead());
  assert.equal(res.status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n, before + 1);
  const o = db.prepare("SELECT * FROM outbox WHERE kind = 'lead_owner' ORDER BY id DESC LIMIT 1").get();
  assert.equal(o.status, 'pending');
  assert.equal(o.recipient, 'owner@test.fr');
});

test('lead: consent is required', async () => {
  const res = await post('/api/leads', { ...goodLead(), consent: false });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).field, 'consent');
});

test('lead: invalid email and unknown topic are rejected', async () => {
  assert.equal((await post('/api/leads', { ...goodLead(), email: 'not-an-email' })).status, 422);
  assert.equal((await post('/api/leads', { ...goodLead(), topic: 'drop table' })).status, 422);
});

test('lead: health data in free text is refused and not stored', async () => {
  const before = db.prepare('SELECT COUNT(*) n FROM leads').get().n;
  const res = await post('/api/leads', { ...goodLead(), message: 'Мой гемоглобин 90, диагноз анемия' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).message, 'health_data_not_allowed');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n, before);
});

test('lead: honeypot returns success but stores nothing', async () => {
  const before = db.prepare('SELECT COUNT(*) n FROM leads').get().n;
  const res = await post('/api/leads', { ...goodLead(), website: 'http://spam.example' });
  assert.equal(res.status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leads').get().n, before);
});

test('lead: wrong content type and malformed JSON are refused', async () => {
  const ct = await fetch(base + '/api/leads', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(ct.status, 415);
  assert.equal((await post('/api/leads', '{bad json')).status, 400);
});

test('lead: control characters are rejected', () => {
  assert.throws(() => validateLead({ ...goodLead(), name: 'Анна\u0000' }), /invalid characters/);
});

test('lead: client gets success only after storage; rate limit applies per IP', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await post('/api/leads', { ...goodLead(), email: `u${i}@example.com` });
  assert.equal(last.status, 429);
});

// ---------- outbox honesty ----------
test('outbox: file transport stores but does not count as delivered; client ack waits for owner delivery', async () => {
  const transportsFile = createTransports({ dataDir: dir, telegram: {}, fetchImpl: fakeFetch });
  await processOutbox(db, transportsFile, globalThis.__config);
  const owner = db.prepare("SELECT status FROM outbox WHERE kind = 'lead_owner' ORDER BY id LIMIT 1").get();
  assert.equal(owner.status, 'stored');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM outbox WHERE kind = 'lead_client' AND status IN ('sent','stored')").get().n, 0);
});

test('outbox: after real owner delivery (telegram) the client acknowledgement is queued and stored', async () => {
  const telegram = createTransports({ dataDir: dir, telegram: { token: 't', chatId: '1' }, fetchImpl: fakeFetch });
  const cfg = { ...globalThis.__config, ownerChannel: 'telegram' };
  // Re-queue one lead owner message as pending so telegram delivers it.
  db.prepare("UPDATE outbox SET status = 'pending', attempts = 0 WHERE kind = 'lead_owner' AND status = 'stored'").run();
  await processOutbox(db, telegram, cfg, { limit: 100 });
  assert.ok(sentStripe.length > 0, 'telegram called');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM outbox WHERE kind = 'lead_owner' AND status = 'sent'").get().n >= 1, true);
  await processOutbox(db, telegram, cfg, { limit: 100 });
  const ack = db.prepare("SELECT status, recipient FROM outbox WHERE kind = 'lead_client' ORDER BY id LIMIT 1").get();
  assert.ok(ack, 'client ack exists');
  assert.equal(ack.status, 'stored'); // client channel is file: never claimed as sent
});

// ---------- checkout ----------
test('checkout: returns 503 while payments are disabled', async () => {
  const cfg = globalThis.__config;
  cfg.paymentsEnabled = false;
  const res = await post('/api/checkout', { locale: 'en', email: 'b@example.com', items: [{ sku: SKU, qty: 1 }], acceptTerms: true, acceptDigital: true });
  assert.equal(res.status, 503);
  cfg.paymentsEnabled = true;
});

test('checkout: requires both legal acceptances', async () => {
  const res = await post('/api/checkout', { locale: 'en', email: 'b@example.com', items: [{ sku: SKU, qty: 1 }], acceptTerms: true, acceptDigital: false });
  assert.equal(res.status, 422);
});

test('checkout: unknown or unpublished product cannot be bought', async () => {
  const res = await post('/api/checkout', { locale: 'en', email: 'b@example.com', items: [{ sku: 'nope', qty: 1 }], acceptTerms: true, acceptDigital: true });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'product_unavailable');
});

test('checkout: price comes from the server catalog, client prices are ignored', async () => {
  const res = await post('/api/checkout', { locale: 'en', email: 'b@example.com', items: [{ sku: SKU, qty: 2 }], acceptTerms: true, acceptDigital: true, priceCents: 1, amount: 1 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, 'https://checkout.stripe.test/c/cs_test_1');
  const sent = new URLSearchParams(stripeCalls.at(-1).init.body);
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'), '1900');
  assert.equal(sent.get('line_items[0][quantity]'), '2');
  assert.match(stripeCalls.at(-1).init.headers['Idempotency-Key'], /^order-/);
  const order = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1').get();
  assert.equal(order.amount_cents, 3800);
  assert.equal(order.status, 'pending_payment');
});

test('checkout: duplicate items and too many items are refused', () => {
  assert.throws(() => validateCheckout({ email: 'a@b.fr', acceptTerms: true, acceptDigital: true, items: [{ sku: SKU, qty: 1 }, { sku: SKU, qty: 1 }] }), /duplicate/);
  assert.throws(() => validateCheckout({ email: 'a@b.fr', acceptTerms: true, acceptDigital: true, items: [{ sku: SKU, qty: 11 }] }), /invalid item/);
});

test('checkout: no prices are confirmed means no sale', () => {
  assert.equal(priceOrder([{ sku: SKU, qty: 1 }], catalog, false).error, 'prices_not_confirmed');
});

// ---------- Stripe webhook ----------
function sessionEvent({ id, orderId, amount, currency = 'eur', country = 'FR', sessionId = 'cs_test_1', paid = 'paid' }) {
  return JSON.stringify({
    id, type: 'checkout.session.completed',
    data: { object: { id: sessionId, payment_status: paid, amount_total: amount, currency, metadata: { order_id: orderId }, client_reference_id: orderId, customer_details: { address: { country } } } },
  });
}

test('webhook: bad signature is rejected', async () => {
  const body = sessionEvent({ id: 'evt_bad', orderId: 'x', amount: 1 });
  const res = await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body, 'whsec_wrong') });
  assert.equal(res.status, 400);
});

test('webhook: signature with an old timestamp is rejected', async () => {
  const body = sessionEvent({ id: 'evt_old', orderId: 'x', amount: 1 });
  const res = await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body, WEBHOOK, Math.floor(Date.now() / 1000) - 3600) });
  assert.equal(res.status, 400);
});

test('webhook: paid order gets download tokens and delivery email; duplicates are ignored', async () => {
  const order = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1').get();
  const body = sessionEvent({ id: 'evt_paid_1', orderId: order.id, amount: order.amount_cents, sessionId: order.provider_session_id });
  const res = await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal(res.status, 200);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id).status, 'paid');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(order.id).n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM outbox WHERE kind = 'order_delivery' AND related_id = ?").get(order.id).n, 1);
  const again = await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal((await again.json()).duplicate, true);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(order.id).n, 1);
});

test('webhook: amount mismatch means no files are delivered', async () => {
  db.prepare("INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, provider_session_id, terms_accepted_at, digital_waiver_at) VALUES ('ord_amt', ?, ?, 'en', 'c@x.fr', ?, 1900, 'EUR', 'pending_payment', 'stripe', 'cs_amt', ?, ?)")
    .run(new Date().toISOString(), new Date().toISOString(), JSON.stringify([{ sku: SKU, qty: 1, unitCents: 1900 }]), new Date().toISOString(), new Date().toISOString());
  const body = sessionEvent({ id: 'evt_amt', orderId: 'ord_amt', amount: 100, sessionId: 'cs_amt' });
  await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal(db.prepare("SELECT status FROM orders WHERE id = 'ord_amt'").get().status, 'review_amount');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM downloads WHERE order_id = 'ord_amt'").get().n, 0);
});

test('webhook: buyer from a blocked country is held for review and gets no files', async () => {
  db.prepare("INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, provider_session_id, terms_accepted_at, digital_waiver_at) VALUES ('ord_ru', ?, ?, 'ru', 'c@x.ru', ?, 1900, 'EUR', 'pending_payment', 'stripe', 'cs_ru', ?, ?)")
    .run(new Date().toISOString(), new Date().toISOString(), JSON.stringify([{ sku: SKU, qty: 1, unitCents: 1900 }]), new Date().toISOString(), new Date().toISOString());
  const body = sessionEvent({ id: 'evt_ru', orderId: 'ord_ru', amount: 1900, country: 'RU', sessionId: 'cs_ru' });
  await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  const row = db.prepare("SELECT status, customer_country FROM orders WHERE id = 'ord_ru'").get();
  assert.equal(row.status, 'review_sanctions');
  assert.equal(row.customer_country, 'RU');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM downloads WHERE order_id = 'ord_ru'").get().n, 0);
});

test('webhook: unpaid session does not settle the order', async () => {
  db.prepare("INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, provider_session_id, terms_accepted_at, digital_waiver_at) VALUES ('ord_np', ?, ?, 'en', 'c@x.fr', ?, 1900, 'EUR', 'pending_payment', 'stripe', 'cs_np', ?, ?)")
    .run(new Date().toISOString(), new Date().toISOString(), JSON.stringify([{ sku: SKU, qty: 1, unitCents: 1900 }]), new Date().toISOString(), new Date().toISOString());
  const body = sessionEvent({ id: 'evt_np', orderId: 'ord_np', amount: 1900, paid: 'unpaid', sessionId: 'cs_np' });
  await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal(db.prepare("SELECT status FROM orders WHERE id = 'ord_np'").get().status, 'pending_payment');
});

test('signature helper: valid, wrong secret, malformed', () => {
  const body = '{"a":1}';
  const now = Math.floor(Date.now() / 1000);
  assert.equal(verifyStripeSignature(body, signed(body, WEBHOOK, now), WEBHOOK, { now }), true);
  assert.equal(verifyStripeSignature(body, signed(body, 'other', now), WEBHOOK, { now }), false);
  assert.equal(verifyStripeSignature(body + ' ', signed(body, WEBHOOK, now), WEBHOOK, { now }), false);
  assert.equal(verifyStripeSignature(body, 'garbage', WEBHOOK, { now }), false);
  assert.equal(verifyStripeSignature(body, undefined, WEBHOOK, { now }), false);
});

// ---------- downloads ----------
function issueToken({ status = 'paid', expires = new Date(Date.now() + 86400000), max = 5, revoked = 0, sku = SKU } = {}) {
  const orderId = `ord_dl_${Math.random().toString(36).slice(2, 8)}`;
  const t = new Date().toISOString();
  db.prepare("INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, terms_accepted_at, digital_waiver_at) VALUES (?, ?, ?, 'en', 'd@x.fr', '[]', 1900, 'EUR', ?, 'stripe', ?, ?)").run(orderId, t, t, status, t, t);
  const token = require_random();
  db.prepare('INSERT INTO downloads (token_hash, order_id, sku, created_at, expires_at, max_downloads, revoked) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(hash(token), orderId, sku, t, expires.toISOString(), max, revoked);
  return token;
}
import { randomBytes, createHash } from 'node:crypto';
function require_random() { return randomBytes(32).toString('base64url'); }
function hash(s) { return createHash('sha256').update(s).digest('hex'); }

test('download: malformed token gets a generic 404', async () => {
  assert.equal((await fetch(base + '/api/download/abc')).status, 404);
});

test('download: valid token streams the PDF with attachment headers and no-store', async () => {
  const token = issueToken();
  const res = await fetch(`${base}/api/download/${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.match(res.headers.get('content-disposition'), /attachment/);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), PDF);
});

test('download: download limit is enforced', async () => {
  const token = issueToken({ max: 2 });
  assert.equal((await fetch(`${base}/api/download/${token}`)).status, 200);
  assert.equal((await fetch(`${base}/api/download/${token}`)).status, 200);
  assert.equal((await fetch(`${base}/api/download/${token}`)).status, 404);
});

test('download: expired, revoked, unpaid orders get 404', async () => {
  assert.equal((await fetch(`${base}/api/download/${issueToken({ expires: new Date(Date.now() - 1000) })}`)).status, 404);
  assert.equal((await fetch(`${base}/api/download/${issueToken({ revoked: 1 })}`)).status, 404);
  assert.equal((await fetch(`${base}/api/download/${issueToken({ status: 'review_sanctions' })}`)).status, 404);
});

test('download: missing file does not consume a download and returns 503', async () => {
  const token = issueToken({ sku: 'missing-sku' });
  // catalog has no such product, so the token resolves to no file
  const res = await fetch(`${base}/api/download/${token}`);
  assert.equal(res.status, 503);
});

// ---------- static serving ----------
test('static: path traversal is not possible', async () => {
  const res = await fetch(base + '/%2e%2e/%2e%2e/etc/passwd');
  assert.notEqual(res.status, 200);
  assert.equal((await res.text()).includes('root:'), false);
});

test('security headers and CSP are sent with pages', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
});

test('health endpoint reports payment status without secrets', async () => {
  const body = await (await fetch(base + '/api/health')).json();
  assert.equal(body.ok, true);
  assert.equal(JSON.stringify(body).includes(SECRET_KEY), false);
});
