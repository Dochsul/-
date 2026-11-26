// Revolut Merchant integration: request shape, webhook signature, authoritative re-check, sanctions, idempotency.
// A fake Revolut API (same routes and fields as the documentation) stands in for the network. No real money moves.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { createTransports } from '../server/outbox.mjs';
import { loadConfig, assertProductionConfig } from '../server/config.mjs';
import {
  createRevolutOrder, getRevolutOrder, verifyRevolutSignature, parseRevolutEvent, checkRevolutOrder, revolutCountry, REVOLUT_BASE,
} from '../server/revolut.mjs';

const WSK = 'wsk_test_signing_secret_123456';
const sign = (raw, ts = Date.now()) => `v1=${createHmac('sha256', WSK).update(`v1.${ts}.${raw}`, 'utf8').digest('hex')}`;

// ---------- signature ----------
test('signature: valid signature over "v1.<timestamp>.<raw body>" is accepted', () => {
  const raw = '{"event":"ORDER_COMPLETED","order_id":"x"}';
  const ts = String(Date.now());
  assert.equal(verifyRevolutSignature(raw, ts, sign(raw, Number(ts)), WSK), true);
});

test('signature: a changed body, a wrong secret, a stale timestamp and a missing header are all rejected', () => {
  const raw = '{"event":"ORDER_COMPLETED"}';
  const ts = String(Date.now());
  const sig = sign(raw, Number(ts));
  assert.equal(verifyRevolutSignature(raw + ' ', ts, sig, WSK), false, 'body tampered');
  assert.equal(verifyRevolutSignature(raw, ts, sig, 'wsk_other_secret_123456'), false, 'wrong secret');
  const old = String(Date.now() - 10 * 60 * 1000);
  assert.equal(verifyRevolutSignature(raw, old, sign(raw, Number(old)), WSK), false, 'older than 5 minutes');
  assert.equal(verifyRevolutSignature(raw, undefined, sig, WSK), false);
  assert.equal(verifyRevolutSignature(raw, ts, undefined, WSK), false);
});

test('signature: during secret rotation several v1 values may be present; any match is accepted', () => {
  const raw = '{"event":"ORDER_COMPLETED"}';
  const ts = String(Date.now());
  const good = sign(raw, Number(ts));
  const header = `v1=${'0'.repeat(64)}, ${good}`;
  assert.equal(verifyRevolutSignature(raw, ts, header, WSK), true);
  assert.equal(verifyRevolutSignature(raw, ts, `v1=${'0'.repeat(64)}`, WSK), false);
});

test('signature: the timestamp is part of what is signed', () => {
  const raw = '{"event":"ORDER_COMPLETED"}';
  const ts = Date.now();
  const sig = sign(raw, ts);
  assert.equal(verifyRevolutSignature(raw, String(ts + 1), sig, WSK), false);
});

// ---------- request shape ----------
test('createRevolutOrder sends the exact amount, our reference, auth and API version to the right environment', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: randomUUID(), state: 'pending', checkout_url: 'https://checkout.revolut.com/pay/abc' }), { status: 200 });
  };
  const o = await createRevolutOrder({ env: 'sandbox', apiKey: 'sk_fake_key_for_test', version: '2024-05-01', fetchImpl, amountCents: 1990, currency: 'EUR', description: 'Bundle', reference: 'ord_123', email: 'b@example.com', redirectUrl: 'https://tilda.test/fr/merci?order=ord_123' });
  assert.equal(calls[0].url, `${REVOLUT_BASE.sandbox}/api/orders`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk_fake_key_for_test');
  assert.equal(calls[0].init.headers['Revolut-Api-Version'], '2024-05-01');
  assert.equal(calls[0].body.amount, 1990, 'amount in minor units, exactly as priced on the server');
  assert.equal(calls[0].body.currency, 'EUR');
  assert.equal(calls[0].body.merchant_order_data.reference, 'ord_123');
  assert.equal(calls[0].body.customer.email, 'b@example.com');
  assert.match(o.checkoutUrl, /^https:\/\//);
});

test('createRevolutOrder targets production only when asked, and rejects bad input before any request', async () => {
  let hits = 0;
  const ok = async (url) => { hits++; return new Response(JSON.stringify({ id: randomUUID(), state: 'pending', checkout_url: 'https://c.test/x' }), { status: 200 }); };
  await createRevolutOrder({ env: 'production', apiKey: 'k', fetchImpl: ok, amountCents: 990, currency: 'EUR', description: 'x', reference: 'ord_1', email: 'a@b.fr', redirectUrl: 'https://s.test' });
  assert.equal(hits, 1);
  const base = { env: 'sandbox', apiKey: 'k', fetchImpl: ok, currency: 'EUR', description: 'x', reference: 'ord_1', email: 'a@b.fr', redirectUrl: 'https://s.test' };
  await assert.rejects(createRevolutOrder({ ...base, amountCents: 9.5 }), (e) => e.code === 'invalid_amount');
  await assert.rejects(createRevolutOrder({ ...base, amountCents: 0 }), (e) => e.code === 'invalid_amount');
  await assert.rejects(createRevolutOrder({ ...base, amountCents: 990, currency: 'eur' }), (e) => e.code === 'invalid_currency');
  await assert.rejects(createRevolutOrder({ ...base, amountCents: 990, reference: 'bad ref;drop' }), (e) => e.code === 'invalid_reference');
  await assert.rejects(createRevolutOrder({ ...base, amountCents: 990, redirectUrl: 'http://insecure.test' }), (e) => e.code === 'config');
  await assert.rejects(createRevolutOrder({ ...base, env: 'staging', amountCents: 990 }), (e) => e.code === 'config');
  assert.equal(hits, 1, 'no request was sent for invalid input');
});

test('createRevolutOrder refuses a response without a valid order id or checkout link', async () => {
  const bad = async () => new Response(JSON.stringify({ id: 'not-a-uuid', checkout_url: 'javascript:alert(1)' }), { status: 200 });
  await assert.rejects(createRevolutOrder({ env: 'sandbox', apiKey: 'k', fetchImpl: bad, amountCents: 990, currency: 'EUR', description: 'x', reference: 'ord_1', email: 'a@b.fr', redirectUrl: 'https://s.test' }), (e) => e.code === 'revolut_response');
});

test('getRevolutOrder refuses non-UUID ids (no path injection)', async () => {
  await assert.rejects(getRevolutOrder({ env: 'sandbox', apiKey: 'k', fetchImpl: fetch, id: '../../admin' }), (e) => e.code === 'invalid_order_id');
});

test('checkRevolutOrder: only a completed order with our reference, amount and currency passes', () => {
  const ours = { id: 'ord_1', amount_cents: 1990, currency: 'EUR' };
  const good = { state: 'completed', amount: 1990, currency: 'EUR', merchant_order_data: { reference: 'ord_1' } };
  assert.deepEqual(checkRevolutOrder(good, ours), { ok: true });
  assert.equal(checkRevolutOrder({ ...good, state: 'pending' }, ours).reason, 'not_completed');
  assert.equal(checkRevolutOrder({ ...good, amount: 1980 }, ours).reason, 'amount_mismatch');
  assert.equal(checkRevolutOrder({ ...good, currency: 'USD' }, ours).reason, 'currency_mismatch');
  assert.equal(checkRevolutOrder({ ...good, merchant_order_data: { reference: 'other' } }, ours).reason, 'reference_mismatch');
  assert.equal(revolutCountry({ billing_address: { country: 'RU' } }), 'RU');
  assert.equal(revolutCountry({}), null);
  assert.equal(parseRevolutEvent('{"event":"ORDER_COMPLETED","order_id":"' + randomUUID() + '"}').type, 'ORDER_COMPLETED');
  assert.equal(parseRevolutEvent('{"event":"X","order_id":"nope"}').orderId, null);
});

// ---------- configuration guard ----------
test('production guard: Revolut needs a key, a wsk_ secret, and the explicit owner switch for production', () => {
  const base = { NODE_ENV: 'production', SITE_URL: 'https://api.aina.test', IP_SALT: 'z'.repeat(32), TRUST_PROXY: 'true', OWNER_CHANNEL: 'smtp', CLIENT_CHANNEL: 'smtp', SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'o@aina.test', PAYMENTS_ENABLED: 'true' };
  const errs = (env) => assertProductionConfig(loadConfig(env), env);
  assert.match(errs(base).join('|'), /REVOLUT_API_KEY/);
  const ok = { ...base, REVOLUT_API_KEY: 'k', REVOLUT_WEBHOOK_SECRET: WSK, REVOLUT_ENV: 'sandbox' };
  assert.deepEqual(errs(ok), []);
  assert.match(errs({ ...ok, REVOLUT_WEBHOOK_SECRET: 'not-wsk' }).join('|'), /REVOLUT_WEBHOOK_SECRET/);
  assert.match(errs({ ...ok, REVOLUT_ENV: 'production' }).join('|'), /LIVE_PAYMENTS_APPROVED/);
  assert.deepEqual(errs({ ...ok, REVOLUT_ENV: 'production', LIVE_PAYMENTS_APPROVED: 'owner-approved' }), []);
  assert.match(errs({ ...ok, PAYMENT_PROVIDER: 'paypal' }).join('|'), /PAYMENT_PROVIDER/);
});

// ---------- full flow through the server ----------
let base, server, db, dir, orders; // orders: Map<revolutOrderId, remote state>
let apiCalls = [];
const countries = {};
async function fakeRevolut(url, init) {
  const u = String(url);
  if (u.startsWith(`${REVOLUT_BASE.sandbox}/api/orders/`)) {
    // a real network round trip: lets concurrent webhook deliveries overlap (this is what makes a race possible)
    await new Promise((r) => setTimeout(r, 60));
    apiCalls.push({ method: 'GET', id: u.split('/').pop() });
    const id = u.split('/').pop();
    const remote = orders.get(id);
    if (!remote) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(remote), { status: 200 });
  }
  if (u === `${REVOLUT_BASE.sandbox}/api/orders` && init?.method === 'POST') {
    const body = JSON.parse(init.body);
    const id = randomUUID();
    orders.set(id, { id, state: 'pending', amount: body.amount, currency: body.currency, merchant_order_data: { reference: body.merchant_order_data.reference }, billing_address: null });
    apiCalls.push({ method: 'POST', body });
    return new Response(JSON.stringify({ id, state: 'pending', checkout_url: `https://checkout.revolut.com/pay/${id}` }), { status: 200 });
  }
  throw new Error('unexpected fetch ' + u);
}

const SKU = 'rv-guide';
const SKU2 = 'rv-guide-2';
const BUNDLE = 'rv-bundle';
const i18n = (t) => ({ ru: { title: t, summary: 's', topics: [] }, fr: { title: t, summary: 's', topics: [] }, en: { title: t, summary: 's', topics: [] } });
const catalog = [
  { sku: SKU, prices: { EUR: 990, RUB: 100000 }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU], i18n: i18n('Guide 1') },
  { sku: SKU2, prices: { EUR: 790, RUB: 80000 }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU2], i18n: i18n('Guide 2') },
  { sku: BUNDLE, prices: { EUR: 1990, RUB: 200000 }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU, SKU2], i18n: i18n('Bundle') },
];
const WH = 'http://127.0.0.1';
const webhook = (body, ts = Date.now()) => fetch(`${base}/api/webhooks/revolut`, { method: 'POST', headers: { 'content-type': 'application/json', 'revolut-request-timestamp': String(ts), 'revolut-signature': sign(body, ts) }, body });
const evt = (type, orderId) => JSON.stringify({ event: type, order_id: orderId, timestamp: Date.now() });
const buy = (sku, country = 'FR') => fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale: 'fr', email: 'buyer@example.com', items: [{ sku }], acceptTerms: true, acceptDigital: true, country }) });
const orderRow = (ref) => db.prepare('SELECT * FROM orders WHERE id = ?').get(ref);

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'aina-rv-'));
  mkdirSync(join(dir, 'private')); mkdirSync(join(dir, 'dist'));
  for (const f of [SKU, SKU2]) writeFileSync(join(dir, 'private', `${f}.pdf`), `%PDF-${f}`);
  db = openDb(':memory:');
  orders = new Map();
  const config = { ...loadConfig({}), siteUrl: 'https://api.aina.test', dataDir: dir, privateDir: join(dir, 'private'), distDir: join(dir, 'dist'),
    paymentsEnabled: true, paymentProvider: 'revolut', revolut: { env: 'sandbox', apiKey: 'sk_fake_key_for_test', webhookSecret: WSK, version: '2024-05-01' },
    catalog, fileSkus: [SKU, SKU2], enabledCurrencies: ['EUR'], allowedOrigins: [], blockedCountries: ['RU', 'BY'],
    checkoutSuccessUrl: 'https://tilda.test/{locale}/merci', checkoutCancelUrl: 'https://tilda.test/{locale}/panier' };
  server = createServer(createApp({ config, db, transports: createTransports({ dataDir: dir, telegram: {} }), fetchImpl: fakeRevolut }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `${WH}:${server.address().port}`;
});
after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

test('checkout: creates a Revolut order for the exact server price and returns its hosted checkout link', async () => {
  const r = await buy(BUNDLE);
  assert.equal(r.status, 200);
  const { url, orderId } = await r.json();
  assert.match(url, /^https:\/\/checkout\.revolut\.com\/pay\//);
  const row = orderRow(orderId);
  assert.equal(row.status, 'pending_payment');
  assert.equal(row.provider, 'revolut');
  assert.equal(row.amount_cents, 1990);
  assert.match(row.provider_session_id, /^[0-9a-f-]{36}$/);
  const post = apiCalls.find((c) => c.method === 'POST' && c.body.merchant_order_data.reference === orderId);
  assert.equal(post.body.amount, 1990, 'Revolut receives exactly the amount we computed');
});

test('checkout: a blocked country is refused before any order or Revolut call is made', async () => {
  const before = apiCalls.length;
  const count = db.prepare('SELECT COUNT(*) n FROM orders').get().n;
  const r = await buy(SKU, 'RU');
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, 'country_not_supported');
  assert.equal(apiCalls.length, before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n, count);
});

test('webhook: a signed ORDER_COMPLETED is settled only after Revolut confirms it: files, exact amount, accounting', async () => {
  const r = await buy(BUNDLE);
  const { orderId } = await r.json();
  const row = orderRow(orderId);
  orders.get(row.provider_session_id).state = 'completed';
  const body = evt('ORDER_COMPLETED', row.provider_session_id);
  assert.equal((await webhook(body)).status, 200);
  assert.equal(orderRow(orderId).status, 'paid');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 2, 'bundle: one link per PDF');
  const pay = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
  assert.equal(pay.provider, 'revolut');
  assert.equal(pay.provider_payment_id, row.provider_session_id);
  assert.equal(pay.amount_cents, 1990);
  assert.equal(pay.fee_cents, null, 'fee is unknown until reconciled: flagged, not invented');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM outbox WHERE kind = 'order_delivery' AND related_id = ?").get(orderId).n, 1);
});

test('webhook: the same event delivered again changes nothing; a different body for the same paid order issues no new links', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  orders.get(rid).state = 'completed';
  const body = evt('ORDER_COMPLETED', rid);
  assert.equal((await (await webhook(body)).json()).received, true);
  assert.equal((await (await webhook(body)).json()).duplicate, true);
  // a second, differently formatted event for the same order (e.g. extra whitespace): settled once
  await webhook(body + ' ');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM payments WHERE order_id = ?').get(orderId).n, 1);
});

test('race: two DIFFERENT signed events for the same order arrive at the same time -> files are issued once', async () => {
  const r = await buy(BUNDLE);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  orders.get(rid).state = 'completed';
  const a = evt('ORDER_COMPLETED', rid);
  const b = evt('ORDER_COMPLETED', rid) + ' ';
  const [x, y] = await Promise.all([webhook(a), webhook(b)]);
  assert.ok([x.status, y.status].every((c) => c === 200 || c === 500));
  assert.equal(orderRow(orderId).status, 'paid');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 2, 'one link per PDF, not four');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM payments WHERE order_id = ?').get(orderId).n, 1);
});

test('webhook: a bad signature is rejected and nothing is settled', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  orders.get(rid).state = 'completed';
  const body = evt('ORDER_COMPLETED', rid);
  const bad = await fetch(`${base}/api/webhooks/revolut`, { method: 'POST', headers: { 'content-type': 'application/json', 'revolut-request-timestamp': String(Date.now()), 'revolut-signature': 'v1=' + '0'.repeat(64) }, body });
  assert.equal(bad.status, 400);
  assert.equal(orderRow(orderId).status, 'pending_payment');
});

test('authoritative check: Revolut reports a different amount than we charged -> held for review, nothing delivered', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  Object.assign(orders.get(rid), { state: 'completed', amount: 980 });
  assert.equal((await webhook(evt('ORDER_COMPLETED', rid))).status, 200);
  assert.equal(orderRow(orderId).status, 'review_amount');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 0);
});

test('authoritative check: Revolut order carries another reference -> held for review', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  Object.assign(orders.get(rid), { state: 'completed', merchant_order_data: { reference: 'someone-else' } });
  await webhook(evt('ORDER_COMPLETED', rid));
  assert.equal(orderRow(orderId).status, 'review_reference');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 0);
});

test('sanctions: the payer country reported by Revolut is blocked after payment -> held, nothing delivered', async () => {
  const r = await buy(SKU, 'FR'); // declared country passes the first control...
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  Object.assign(orders.get(rid), { state: 'completed', billing_address: { country: 'BY' } }); // ...but Revolut reports another one
  await webhook(evt('ORDER_COMPLETED', rid));
  assert.equal(orderRow(orderId).status, 'review_sanctions');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n, 0);
});

test('not yet completed: the order goes back to pending and the webhook fails (Revolut retries), then succeeds once completed', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  orders.get(rid).state = 'pending';
  const first = await webhook(evt('ORDER_COMPLETED', rid));
  assert.equal(first.status, 500, 'failing on purpose so that the event is retried');
  assert.equal(orderRow(orderId).status, 'pending_payment', 'the claim is released');
  orders.get(rid).state = 'completed';
  assert.equal((await webhook(evt('ORDER_COMPLETED', rid))).status, 200);
  assert.equal(orderRow(orderId).status, 'paid');
});

test('declined payment does not close the order: the buyer can retry on the same page and the retry is delivered', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  assert.equal((await webhook(evt('ORDER_PAYMENT_DECLINED', rid))).status, 200);
  assert.equal(orderRow(orderId).status, 'pending_payment');
  orders.get(rid).state = 'completed';
  await webhook(evt('ORDER_COMPLETED', rid));
  assert.equal(orderRow(orderId).status, 'paid');
});

test('cancelled order can still be settled if Revolut confirms the money was received', async () => {
  const r = await buy(SKU);
  const { orderId } = await r.json();
  const rid = orderRow(orderId).provider_session_id;
  await webhook(evt('ORDER_CANCELLED', rid));
  assert.equal(orderRow(orderId).status, 'expired');
  orders.get(rid).state = 'completed';
  await webhook(evt('ORDER_COMPLETED', rid));
  assert.equal(orderRow(orderId).status, 'paid');
});

test('unknown order ids and malformed events are acknowledged or refused without side effects', async () => {
  const unknown = await webhook(evt('ORDER_COMPLETED', randomUUID()));
  assert.equal(unknown.status, 200);
  const bad = await webhook('{not json');
  assert.equal(bad.status, 400);
});

test('stripe fallback module is still available when explicitly selected (not used by default)', async () => {
  assert.equal(loadConfig({}).paymentProvider, 'revolut');
  assert.equal(loadConfig({ PAYMENT_PROVIDER: 'stripe' }).paymentProvider, 'stripe');
});
