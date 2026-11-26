// Production hardening: startup guard, rate limits, body limits, headers, webhook protection.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac, randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadConfig, assertProductionConfig } from '../server/config.mjs';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { createTransports } from '../server/outbox.mjs';

const good = {
  NODE_ENV: 'production', SITE_URL: 'https://api.aina.test', IP_SALT: 'x'.repeat(32), TRUST_PROXY: 'true',
  OWNER_CHANNEL: 'smtp', CLIENT_CHANNEL: 'smtp', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'orders@aina.test',
  ALLOWED_ORIGINS: 'https://www.aina.test',
};
const errs = (env) => assertProductionConfig(loadConfig(env), env);

test('startup guard: a complete production configuration is accepted', () => {
  assert.deepEqual(errs(good), []);
  assert.deepEqual(errs({ NODE_ENV: 'development' }), [], 'development is not restricted');
});

test('startup guard: weak or default settings are refused', () => {
  assert.match(errs({ ...good, IP_SALT: 'short' }).join('|'), /IP_SALT/);
  assert.match(errs({ ...good, SITE_URL: 'http://api.aina.test' }).join('|'), /SITE_URL/);
  assert.match(errs({ ...good, TRUST_PROXY: 'false' }).join('|'), /TRUST_PROXY/);
  assert.match(errs({ ...good, OWNER_CHANNEL: 'file' }).join('|'), /OWNER_CHANNEL/);
  assert.match(errs({ ...good, ALLOWED_ORIGINS: 'https://*.aina.test' }).join('|'), /ALLOWED_ORIGINS/);
  assert.match(errs({ ...good, SMTP_HOST: '' }).join('|'), /SMTP_HOST/);
});

test('startup guard: enabling payments needs both Stripe secrets and email delivery to buyers', () => {
  const pay = { ...good, PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_' + 'a'.repeat(24), STRIPE_WEBHOOK_SECRET: 'whsec_' + 'b'.repeat(24) };
  assert.deepEqual(errs(pay), []);
  assert.match(errs({ ...pay, STRIPE_WEBHOOK_SECRET: '' }).join('|'), /WEBHOOK_SECRET/);
  assert.match(errs({ ...pay, STRIPE_SECRET_KEY: 'not-a-key' }).join('|'), /STRIPE_SECRET_KEY/);
  assert.match(errs({ ...pay, CLIENT_CHANNEL: 'file' }).join('|'), /CLIENT_CHANNEL/);
});

test('startup guard: a LIVE Stripe key and RUB payments each need an explicit owner approval switch', () => {
  const live = { ...good, PAYMENTS_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_live_' + 'a'.repeat(24), STRIPE_WEBHOOK_SECRET: 'whsec_' + 'b'.repeat(24) };
  assert.match(errs(live).join('|'), /LIVE_PAYMENTS_APPROVED/);
  assert.deepEqual(errs({ ...live, LIVE_PAYMENTS_APPROVED: 'owner-approved' }), []);
  assert.match(errs({ ...good, ENABLED_CURRENCIES: 'EUR,RUB' }).join('|'), /RUB_PAYMENTS_APPROVED/);
  assert.deepEqual(errs({ ...good, ENABLED_CURRENCIES: 'EUR,RUB', RUB_PAYMENTS_APPROVED: 'owner-approved' }), []);
});

test('the server process refuses to start with a bad production configuration (exit code 2)', () => {
  const r = spawnSync(process.execPath, ['server/index.mjs'], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: '0' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Refusing to start/);
});

// ---- running app ----
let base, server, db, dir;
const SKU = 'g1';
const WEBHOOK = 'whsec_hardening';
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'aina-hard-'));
  mkdirSync(join(dir, 'private')); mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'private', `${SKU}.pdf`), '%PDF');
  db = openDb(':memory:');
  const i18n = { ru: { title: 'T', summary: 's', topics: [] }, fr: { title: 'T', summary: 's', topics: [] }, en: { title: 'T', summary: 's', topics: [] } };
  const config = { ...loadConfig({}), siteUrl: 'https://api.aina.test', dataDir: dir, privateDir: join(dir, 'private'), distDir: join(dir, 'dist'),
    paymentsEnabled: true, stripeSecretKey: 'sk_test_x', stripeWebhookSecret: WEBHOOK, catalog: [{ sku: SKU, prices: { EUR: 990, RUB: 100000 }, priceConfirmed: true, published: true, contentConfirmed: true, files: [SKU], i18n }],
    fileSkus: [SKU], allowedOrigins: [] };
  let n = 0; // Stripe session ids are unique
  const fetchImpl = async () => { n += 1; return new Response(JSON.stringify({ id: `cs_${n}`, url: `https://checkout.stripe.test/c/${n}` }), { status: 200 }); };
  server = createServer(createApp({ config, db, transports: createTransports({ dataDir: dir, telegram: {} }), fetchImpl }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('HSTS is sent when the public address is https; health checks the database', async () => {
  const r = await fetch(base + '/api/health');
  assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(JSON.stringify(body).includes('sk_test'), false);
});

test('checkout is rate limited per client (20 per 10 minutes)', async () => {
  const body = { locale: 'en', email: 'rl@example.com', items: [{ sku: SKU }], acceptTerms: true, acceptDigital: true };
  const codes = [];
  for (let i = 0; i < 23; i++) codes.push((await post('/api/checkout', body)).status);
  assert.equal(codes.filter((c) => c === 200).length, 20);
  assert.equal(codes.slice(20).every((c) => c === 429), true);
});

test('download endpoint is rate limited (60 per 10 minutes) so tokens cannot be brute-forced', async () => {
  const codes = [];
  for (let i = 0; i < 63; i++) codes.push((await fetch(`${base}/api/download/${randomBytes(32).toString('base64url')}`)).status);
  assert.equal(codes.filter((c) => c === 404).length, 60);
  assert.equal(codes.slice(60).every((c) => c === 429), true);
});

test('oversized request bodies are refused (413) for API and webhook', async () => {
  const big = JSON.stringify({ name: 'x'.repeat(40000) });
  assert.equal((await post('/api/leads', big)).status, 413);
  const wh = await fetch(base + '/api/webhooks/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=00' }, body: 'x'.repeat(70000) });
  assert.equal(wh.status, 413);
});

test('webhook: missing, malformed and replayed signatures are rejected before any parsing', async () => {
  const body = JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object: {} } });
  assert.equal((await post('/api/webhooks/stripe', body)).status, 400);
  assert.equal((await post('/api/webhooks/stripe', body, { 'stripe-signature': 'garbage' })).status, 400);
  const old = Math.floor(Date.now() / 1000) - 3600;
  const sig = `t=${old},v1=${createHmac('sha256', WEBHOOK).update(`${old}.${body}`).digest('hex')}`;
  assert.equal((await post('/api/webhooks/stripe', body, { 'stripe-signature': sig })).status, 400, 'a validly signed but old event is a replay');
  const t = Math.floor(Date.now() / 1000);
  const wrong = `t=${t},v1=${createHmac('sha256', 'whsec_other').update(`${t}.${body}`).digest('hex')}`;
  assert.equal((await post('/api/webhooks/stripe', body, { 'stripe-signature': wrong })).status, 400);
});

test('webhook: malformed JSON with a valid signature is a client error, not a crash', async () => {
  const body = '{not json';
  const t = Math.floor(Date.now() / 1000);
  const sig = `t=${t},v1=${createHmac('sha256', WEBHOOK).update(`${t}.${body}`).digest('hex')}`;
  const r = await post('/api/webhooks/stripe', body, { 'stripe-signature': sig });
  assert.ok([400, 500].includes(r.status));
  assert.equal((await fetch(base + '/api/health')).status, 200, 'server is still up');
});

test('unknown API routes and wrong methods do not leak internals', async () => {
  const r = await fetch(base + '/api/admin');
  assert.equal(r.status, 404);
  assert.equal(JSON.stringify(await r.json()), '{"error":"not_found"}');
  const g = await fetch(base + '/api/leads');
  assert.ok([404, 405].includes(g.status));
  const put = await fetch(base + '/', { method: 'DELETE' });
  assert.equal(put.status, 405);
});

test('no stack traces or file paths in error responses', async () => {
  const r = await post('/api/checkout', '{"items": [');
  const text = await r.text();
  assert.equal(/\.mjs|node_modules|at \w+/.test(text), false);
});
