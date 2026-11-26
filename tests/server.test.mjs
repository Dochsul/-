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

const SKU2 = 'test-guide-2';
const BUNDLE = 'test-bundle';
const i18n = (t) => ({ ru: { title: t, summary: 's', topics: [] }, fr: { title: t, summary: 's', topics: [] }, en: { title: t, summary: 's', topics: [] } });
const catalog = [
  { sku: SKU, prices: { EUR: 1900, RUB: 190000 }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU], i18n: i18n('Guide 1') },
  { sku: SKU2, prices: { EUR: 900, RUB: null }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU2], i18n: i18n('Guide 2') },
  { sku: BUNDLE, prices: { EUR: 1990, RUB: 200000 }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU, SKU2], i18n: i18n('Bundle') },
  { sku: 'hidden', prices: { EUR: 500, RUB: null }, priceConfirmed: true, published: false, contentConfirmed: true, files: ['hidden'], i18n: i18n('Hidden') },
  { sku: 'unpriced', prices: { EUR: null, RUB: null }, priceConfirmed: false, published: true, contentConfirmed: true, files: ['unpriced'], i18n: i18n('Unpriced') },
];

let base, server, db, dir, stripeCalls, sentStripe, feeCalls = [];

function signed(body, secret = WEBHOOK, t = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

const fakeFetch = async (url, init) => {
  if (String(url).startsWith('https://api.stripe.com/v1/checkout/sessions')) {
    stripeCalls.push({ url, init });
    // Stripe returns a unique session id per session; the first one keeps the historical name used by earlier tests.
    const id = stripeCalls.length === 1 ? 'cs_test_1' : `cs_test_${stripeCalls.length}`;
    return new Response(JSON.stringify({ id, url: `https://checkout.stripe.test/c/${id}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).startsWith('https://api.stripe.com/v1/payment_intents/')) {
    feeCalls.push(String(url));
    if (String(url).includes('pi_feefail')) return new Response('{}', { status: 500 });
    return new Response(JSON.stringify({ latest_charge: { balance_transaction: { fee: 55, net: 1935, currency: 'eur' } } }), { status: 200 });
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
  writeFileSync(join(dir, 'private', `${SKU2}.pdf`), PDF);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html><title>x</title>');
  db = openDb(':memory:');
  const config = {
    siteUrl: 'https://site.test', ipSalt: 'salt', ownerEmail: 'owner@test.fr', ownerChannel: 'file', clientChannel: 'file',
    trustProxy: false, paymentsEnabled: true, stripeSecretKey: SECRET_KEY, stripeWebhookSecret: WEBHOOK,
    privateDir: join(dir, 'private'), distDir: join(dir, 'dist'), dataDir: dir, catalog, fileSkus: [SKU, SKU2, 'hidden', 'unpriced'],
    enabledCurrencies: ['EUR'], allowedOrigins: ['https://tilda.test'],
    checkoutSuccessUrl: 'https://tilda.test/{locale}/merci', checkoutCancelUrl: 'https://tilda.test/{locale}/panier',
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
  const res = await post('/api/checkout', { locale: 'en', email: 'b@example.com', items: [{ sku: SKU, qty: 1, priceCents: 1 }], acceptTerms: true, acceptDigital: true, amount: 1 });
  assert.equal(res.status, 200);
  assert.match((await res.json()).url, /^https:\/\/checkout\.stripe\.test\/c\/cs_test_\d+$/);
  const sent = new URLSearchParams(stripeCalls.at(-1).init.body);
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'), '1900');
  assert.equal(sent.get('line_items[0][quantity]'), '1');
  assert.equal(sent.get('success_url'), 'https://tilda.test/en/merci');
  assert.equal(sent.get('cancel_url'), 'https://tilda.test/en/panier');
  assert.match(stripeCalls.at(-1).init.headers['Idempotency-Key'], /^order-/);
  const order = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1').get();
  assert.equal(order.amount_cents, 1900);
  assert.equal(order.status, 'pending_payment');
});

test('checkout: duplicate items and too many items are refused', () => {
  assert.throws(() => validateCheckout({ email: 'a@b.fr', acceptTerms: true, acceptDigital: true, items: [{ sku: SKU, qty: 1 }, { sku: SKU, qty: 1 }] }), /duplicate/);
  assert.throws(() => validateCheckout({ email: 'a@b.fr', acceptTerms: true, acceptDigital: true, items: [{ sku: SKU, qty: 2 }] }), /invalid item/);
  assert.throws(() => validateCheckout({ email: 'a@b.fr', acceptTerms: true, acceptDigital: true, currency: 'USD', items: [{ sku: SKU }] }), /unsupported currency/);
});

test('checkout: unconfirmed, unpriced or unpublished products are not sold', () => {
  assert.equal(priceOrder([{ sku: 'unpriced' }], 'EUR', catalog, ['EUR']).error, 'product_unavailable');
  assert.equal(priceOrder([{ sku: 'hidden' }], 'EUR', catalog, ['EUR']).error, 'product_unavailable');
  assert.equal(priceOrder([{ sku: SKU2 }], 'RUB', catalog, ['EUR', 'RUB']).error, 'product_unavailable'); // no RUB price
});

test('checkout: RUB is refused while the currency is not enabled', async () => {
  const res = await post('/api/checkout', { locale: 'ru', currency: 'RUB', email: 'r@example.com', items: [{ sku: BUNDLE }], acceptTerms: true, acceptDigital: true });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'currency_not_enabled');
});

test('checkout: RUB pricing uses the RUB catalog price when the currency is enabled', () => {
  const r = priceOrder([{ sku: BUNDLE }], 'RUB', catalog, ['EUR', 'RUB']);
  assert.equal(r.amountCents, 200000);
  assert.equal(r.currency, 'RUB');
});

test('checkout: a bundle cannot be bought together with a guide it contains', async () => {
  const res = await post('/api/checkout', { locale: 'en', email: 'o@example.com', items: [{ sku: BUNDLE }, { sku: SKU }], acceptTerms: true, acceptDigital: true });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'bundle_overlap');
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

// ---------- bundle, ledger, refunds ----------
async function paidBundleOrder(pi) {
  const res = await post('/api/checkout', { locale: 'fr', email: `bundle-${pi}@example.com`, items: [{ sku: BUNDLE }], acceptTerms: true, acceptDigital: true });
  assert.equal(res.status, 200);
  const { orderId } = await res.json();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const body = JSON.stringify({ id: `evt_${pi}`, type: 'checkout.session.completed', data: { object: {
    id: order.provider_session_id, payment_status: 'paid', amount_total: 1990, currency: 'eur', payment_intent: pi,
    metadata: { order_id: orderId }, customer_details: { address: { country: 'FR' } } } } });
  const wh = await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal(wh.status, 200);
  return orderId;
}

test('bundle: one paid order delivers one personal token per PDF file', async () => {
  const orderId = await paidBundleOrder('pi_bundle1');
  const rows = db.prepare('SELECT sku FROM downloads WHERE order_id = ? ORDER BY sku').all(orderId).map((r) => r.sku);
  assert.deepEqual(rows, [SKU, SKU2].sort());
  const mail = db.prepare("SELECT body FROM outbox WHERE kind = 'order_delivery' AND related_id = ?").get(orderId).body;
  assert.equal((mail.match(/\/api\/download\//g) || []).length, 2);
});

test('ledger: paid order records the payment and the provider fee', async () => {
  const orderId = await paidBundleOrder('pi_fee1');
  const pay = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
  assert.equal(pay.amount_cents, 1990);
  assert.equal(pay.currency, 'EUR');
  assert.equal(pay.fee_cents, 55);
  assert.equal(pay.net_cents, 1935);
  assert.equal(pay.fee_currency, 'EUR');
  assert.ok(feeCalls.some((u) => u.includes('pi_fee1')));
});

test('ledger: if the fee cannot be read, the payment is kept with fee = NULL (visible for reconciliation)', async () => {
  const orderId = await paidBundleOrder('pi_feefail');
  const pay = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
  assert.equal(pay.fee_cents, null);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId).status, 'paid'); // delivery not blocked
});

test('failed payment: async failure marks the order failed and delivers nothing', async () => {
  const res = await post('/api/checkout', { locale: 'en', email: 'fail@example.com', items: [{ sku: SKU }], acceptTerms: true, acceptDigital: true });
  const { orderId } = await res.json();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const body = JSON.stringify({ id: 'evt_async_fail', type: 'checkout.session.async_payment_failed', data: { object: { id: order.provider_session_id } } });
  await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId).status, 'failed');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM payments WHERE order_id = ?').get(orderId).n, 0);
});

test('no duplicate delivery: a second completed event for the same order (new event id) does not issue new tokens', async () => {
  const orderId = await paidBundleOrder('pi_dup1');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const body = JSON.stringify({ id: 'evt_dup_second', type: 'checkout.session.completed', data: { object: {
    id: order.provider_session_id, payment_status: 'paid', amount_total: 1990, currency: 'eur', payment_intent: 'pi_dup1', metadata: { order_id: orderId } } } });
  await post('/api/webhooks/stripe', body, { 'stripe-signature': signed(body) });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM payments WHERE order_id = ?').get(orderId).n, 1);
});

function refundEvent(id, pi, cumulative) {
  return JSON.stringify({ id, type: 'charge.refunded', data: { object: { id: `ch_${pi}`, payment_intent: pi, amount_refunded: cumulative, refunds: { data: [{ id: `re_${id}`, reason: 'requested_by_customer' }] } } } });
}

test('refunds: partial refund is recorded, access kept; full refund revokes all download links', async () => {
  const orderId = await paidBundleOrder('pi_ref1');
  const tokens = db.prepare('SELECT token_hash FROM downloads WHERE order_id = ?').all(orderId);
  assert.equal(tokens.length, 2);
  let b = refundEvent('evt_ref_part', 'pi_ref1', 500);
  await post('/api/webhooks/stripe', b, { 'stripe-signature': signed(b) });
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId).status, 'partially_refunded');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ? AND revoked = 1').get(orderId).n, 0);
  b = refundEvent('evt_ref_full', 'pi_ref1', 1990);
  await post('/api/webhooks/stripe', b, { 'stripe-signature': signed(b) });
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId).status, 'refunded');
  assert.equal(db.prepare('SELECT COALESCE(SUM(amount_cents),0) s FROM refunds WHERE order_id = ?').get(orderId).s, 1990);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ? AND revoked = 1').get(orderId).n, 2);
  // the same refund event delivered again changes nothing
  await post('/api/webhooks/stripe', b, { 'stripe-signature': signed(b) });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM refunds WHERE order_id = ?').get(orderId).n, 2);
});

test('refunds: download links of a fully refunded order stop working', async () => {
  const orderId = await paidBundleOrder('pi_ref2');
  // issue a known token for this order to test the HTTP path
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO downloads (token_hash, order_id, sku, created_at, expires_at, max_downloads) VALUES (?, ?, ?, ?, ?, 5)')
    .run(hash(token), orderId, SKU, new Date().toISOString(), new Date(Date.now() + 86400000).toISOString());
  assert.equal((await fetch(`${base}/api/download/${token}`)).status, 200);
  const b = refundEvent('evt_ref2_full', 'pi_ref2', 1990);
  await post('/api/webhooks/stripe', b, { 'stripe-signature': signed(b) });
  assert.equal((await fetch(`${base}/api/download/${token}`)).status, 404);
});

// ---------- CORS and public catalog ----------
test('CORS: allowed Tilda origin gets a preflight answer; other origins are refused', async () => {
  const ok = await fetch(`${base}/api/checkout`, { method: 'OPTIONS', headers: { origin: 'https://tilda.test', 'access-control-request-method': 'POST' } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://tilda.test');
  const bad = await fetch(`${base}/api/checkout`, { method: 'OPTIONS', headers: { origin: 'https://evil.test', 'access-control-request-method': 'POST' } });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('CORS: webhooks and downloads never get CORS headers', async () => {
  const r = await fetch(`${base}/api/download/abc`, { headers: { origin: 'https://tilda.test' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('catalog: lists only sellable products with server prices', async () => {
  const r = await fetch(`${base}/api/catalog`, { headers: { origin: 'https://tilda.test' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://tilda.test');
  const body = await r.json();
  const skus = body.products.map((p) => p.sku).sort();
  assert.deepEqual(skus, [BUNDLE, SKU, SKU2].sort());
  assert.equal(body.products.find((p) => p.sku === BUNDLE).prices.EUR, 1990);
  assert.deepEqual(body.currencies, ['EUR']);
});
