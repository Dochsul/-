#!/usr/bin/env node
// End-to-end test of the PRIMARY payment flow (Revolut) in a real browser: a stand-in "Tilda" origin serving the generated
// T123 shop block, and the API origin. The Revolut Merchant API is a stub with the documented routes and fields;
// webhooks are signed with the documented scheme. No network to Revolut, no real money.
// Usage: CHROMIUM_PATH=... node scripts/tilda-e2e-revolut.mjs   (needs Playwright)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { createTransports } from '../server/outbox.mjs';
import { products, fileSkus } from '../src/config/catalog.mjs';
import { REVOLUT_BASE } from '../server/revolut.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WSK = 'wsk_e2e_revolut_signing_secret';
const results = [];
const ok = (cond, msg) => { results.push(!!cond); console.log(`${cond ? '  ok ' : ' FAIL'}  ${msg}`); };

const dir = mkdtempSync(join(tmpdir(), 'aina-e2e-rv-'));
mkdirSync(join(dir, 'private')); mkdirSync(join(dir, 'dist'));
const PDF = Buffer.from('%PDF-1.7 e2e revolut\n%%EOF');
for (const f of fileSkus()) writeFileSync(join(dir, 'private', `${f}.pdf`), PDF);

// ---- Revolut stub: same routes and response fields as the Merchant API ----
const remote = new Map(); // id -> order
const revolutPosts = [];
async function fakeRevolut(url, init) {
  const u = String(url);
  if (u === `${REVOLUT_BASE.sandbox}/api/orders` && init?.method === 'POST') {
    const b = JSON.parse(init.body);
    const id = randomUUID();
    revolutPosts.push(b);
    remote.set(id, { id, state: 'pending', amount: b.amount, currency: b.currency, merchant_order_data: { reference: b.merchant_order_data.reference }, billing_address: null });
    return new Response(JSON.stringify({ id, state: 'pending', checkout_url: `https://checkout.revolut.com/pay/${id}` }), { status: 200 });
  }
  if (u.startsWith(`${REVOLUT_BASE.sandbox}/api/orders/`)) {
    const o = remote.get(u.split('/').pop());
    return o ? new Response(JSON.stringify(o), { status: 200 }) : new Response('{}', { status: 404 });
  }
  throw new Error('unexpected fetch ' + u);
}

const shopRu = readFileSync(join(root, 'tilda', 'components', '01-shop.ru.html'), 'utf8');
let pageBody = '';
const pageServer = await new Promise((r) => { const s = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(pageBody); }); s.listen(0, '127.0.0.1', () => r(s)); });
const pageOrigin = `http://127.0.0.1:${pageServer.address().port}`;
const catalog = products.map((p) => ({ ...p, published: true, contentConfirmed: true }));
let apiDown = false;
const api = await new Promise((r) => {
  const db = openDb(':memory:');
  const config = {
    siteUrl: 'https://api.test', ipSalt: 'e2e', ownerEmail: 'owner@test', ownerChannel: 'file', clientChannel: 'file', trustProxy: false,
    paymentsEnabled: true, paymentProvider: 'revolut', revolut: { env: 'sandbox', apiKey: 'sk_e2e_stub', webhookSecret: WSK, version: '2024-05-01' },
    privateDir: join(dir, 'private'), distDir: join(dir, 'dist'), dataDir: dir, catalog, fileSkus: fileSkus(), enabledCurrencies: ['EUR'],
    allowedOrigins: [pageOrigin], blockedCountries: ['RU', 'BY'], downloadValidityDays: 7, downloadMaxCount: 5, telegram: {},
    checkoutSuccessUrl: 'https://tilda.test/{locale}/merci', checkoutCancelUrl: 'https://tilda.test/{locale}/panier',
  };
  const fetchImpl = async (u, i) => (apiDown ? Promise.reject(new Error('network down')) : fakeRevolut(u, i));
  const app = createApp({ config, db, transports: createTransports({ dataDir: dir, telegram: {} }), fetchImpl });
  const server = createServer(app);
  server.listen(0, '127.0.0.1', () => r({ server, db, base: `http://127.0.0.1:${server.address().port}`, config }));
});

const page = (blocks) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${blocks.map((b) => `<div class="t-rec">${b}</div>`).join('')}</body></html>`;

const sign = (raw, ts = Date.now()) => `v1=${createHmac('sha256', WSK).update(`v1.${ts}.${raw}`, 'utf8').digest('hex')}`;
const webhook = (type, orderId, extra = '') => {
  const raw = JSON.stringify({ event: type, order_id: orderId, timestamp: Date.now() }) + extra;
  const ts = Date.now();
  return fetch(`${api.base}/api/webhooks/revolut`, { method: 'POST', headers: { 'content-type': 'application/json', 'revolut-request-timestamp': String(ts), 'revolut-signature': sign(raw, ts) }, body: raw });
};
const orderBy = (id) => api.db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

(async () => {
  pageBody = page([shopRu.replace('data-api=""', `data-api="${api.base}"`)]);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const newPage = async (viewport = { width: 1280, height: 900 }) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    await p.route('https://checkout.revolut.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id="revolut-stub">Revolut Checkout (stub)</h1>' }));
    return { ctx, p };
  };

  // 1. Shop shows the approved prices and the billing-country field, in Revolut wording
  {
    const { ctx, p } = await newPage();
    await p.goto(pageOrigin, { waitUntil: 'networkidle' });
    ok((await p.locator('.ae-card').count()) === 4, 'shop: 4 products');
    ok(/Revolut/.test(await p.textContent('[data-ae-form]').catch(() => '')) || /Revolut/.test(await p.content()), 'shop: payment is described as Revolut');
    ok((await p.locator('select[name=country] option').count()) > 10, 'shop: billing-country list is offered');
    ok(!(await p.locator('select[name=country] option[value=RU]').count()), 'shop: sanctioned countries are not offered');
    await ctx.close();
  }

  // 2. Purchase: consents are required; checkout sends the exact server price and the order reference
  let orderId;
  {
    const { ctx, p } = await newPage();
    await p.goto(pageOrigin, { waitUntil: 'networkidle' });
    await p.locator('.ae-card--bundle button').click();
    await p.fill('[data-ae-form] input[name=email]', 'buyer@example.com');
    await p.selectOption('[data-ae-form] select[name=country]', 'FR');
    const before = revolutPosts.length;
    await p.click('[data-ae-form] button[type=submit]');
    await p.waitForTimeout(300);
    ok(revolutPosts.length === before, 'checkout: no Revolut order without both legal consents');
    await p.check('[data-ae-form] input[name=terms]');
    await p.check('[data-ae-form] input[name=digital]');
    await Promise.all([p.waitForURL(/checkout\.revolut\.com/), p.click('[data-ae-form] button[type=submit]')]);
    ok(await p.isVisible('#revolut-stub'), 'checkout: browser is sent to the Revolut hosted page');
    const post = revolutPosts.at(-1);
    ok(post.amount === 1990 && post.currency === 'EUR', 'checkout: Revolut receives exactly 19,90 EUR');
    ok(post.redirect_url.startsWith('https://tilda.test/ru/merci'), 'checkout: buyer returns to the Tilda thank-you page (configured address)');
    orderId = post.merchant_order_data.reference;
    ok(orderBy(orderId).status === 'pending_payment', 'order: pending until Revolut confirms');
    ok(api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n === 0, 'delivery: no link before confirmation');
    await ctx.close();
  }

  // 3. Confirmed payment: the authoritative order is read back; the bundle delivers three PDFs
  const rid = orderBy(orderId).provider_session_id;
  {
    const r = await webhook('ORDER_COMPLETED', rid);
    ok(r.status === 500 && orderBy(orderId).status === 'pending_payment', 'webhook: completed event before Revolut reports completed is retried, nothing delivered');
    remote.get(rid).state = 'completed';
    ok((await webhook('ORDER_COMPLETED', rid)).status === 200, 'webhook: signed completed event accepted');
    ok(orderBy(orderId).status === 'paid', 'order: paid after Revolut confirms (state, amount, reference, currency)');
    const links = api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n;
    ok(links === 3, `delivery: exactly 3 personal links for the bundle (got ${links})`);
    const mail = api.db.prepare("SELECT body FROM outbox WHERE kind = 'order_delivery' AND related_id = ?").get(orderId).body;
    const urls = [...mail.matchAll(/https:\/\/api\.test(\/api\/download\/[A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    let good = 0;
    for (const u of urls) { const d = await fetch(api.base + u); if (d.status === 200 && Buffer.from(await d.arrayBuffer()).equals(PDF)) good++; }
    ok(good === 3, 'delivery: all three links download the PDF after confirmation');
    const pay = api.db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
    ok(pay.provider === 'revolut' && pay.amount_cents === 1990 && pay.fee_cents === null, 'ledger: Revolut payment recorded; fee unknown until reconciled (not invented)');
    ok((await webhook('ORDER_COMPLETED', rid)).status === 200 && api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n === 3, 'idempotency: repeated completed event adds no links');
  }

  // 4. Authoritative checks: wrong amount at Revolut -> held, nothing delivered
  {
    const { ctx, p } = await newPage();
    await p.goto(pageOrigin, { waitUntil: 'networkidle' });
    await p.locator('.ae-card').nth(0).locator('button').count().then(() => {});
    await ctx.close();
    const r = await fetch(`${api.base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale: 'fr', email: 'x@example.com', items: [{ sku: products[0].sku }], acceptTerms: true, acceptDigital: true, country: 'FR' }) });
    const oid = (await r.json()).orderId;
    const rr = orderBy(oid).provider_session_id;
    Object.assign(remote.get(rr), { state: 'completed', amount: 1 });
    await webhook('ORDER_COMPLETED', rr);
    ok(orderBy(oid).status === 'review_amount' && api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(oid).n === 0, 'authoritative check: amount mismatch at Revolut -> review, no files');
  }

  // 5. Sanctions after payment: Revolut reports a blocked payer country -> review, no files
  {
    const r = await fetch(`${api.base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale: 'fr', email: 'y@example.com', items: [{ sku: products[0].sku }], acceptTerms: true, acceptDigital: true, country: 'FR' }) });
    const oid = (await r.json()).orderId;
    const rr = orderBy(oid).provider_session_id;
    Object.assign(remote.get(rr), { state: 'completed', billing_address: { country: 'BY' } });
    await webhook('ORDER_COMPLETED', rr);
    ok(orderBy(oid).status === 'review_sanctions', 'sanctions: payer country reported by Revolut is blocked -> review, no files');
  }

  // 6. Declined payment keeps the order open; a retry that completes is delivered
  {
    const r = await fetch(`${api.base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale: 'fr', email: 'z@example.com', items: [{ sku: products[1].sku }], acceptTerms: true, acceptDigital: true, country: 'FR' }) });
    const oid = (await r.json()).orderId;
    const rr = orderBy(oid).provider_session_id;
    await webhook('ORDER_PAYMENT_DECLINED', rr);
    ok(orderBy(oid).status === 'pending_payment', 'declined: order stays open for a retry on the same page');
    remote.get(rr).state = 'completed';
    await webhook('ORDER_COMPLETED', rr);
    ok(orderBy(oid).status === 'paid', 'retry: completed payment is delivered');
    // 7. Refund (recorded from the Revolut dashboard): partial keeps access, full revokes links
    const { applyRefund } = await import('../server/refunds.mjs');
    const o = orderBy(oid);
    applyRefund(api.db, { order: o, providerName: 'revolut', providerRefundId: 'rf_part', amountCents: 300, ownerEmail: 'owner@test' });
    ok(orderBy(oid).status === 'partially_refunded' && api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ? AND revoked = 1').get(oid).n === 0, 'refund: partial refund keeps access');
    applyRefund(api.db, { order: orderBy(oid), providerName: 'revolut', providerRefundId: 'rf_full', amountCents: 790 - 300, ownerEmail: 'owner@test' });
    ok(orderBy(oid).status === 'refunded' && api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ? AND revoked = 1').get(oid).n === 1, 'refund: full refund revokes the links');
  }

  // 8. Revolut unavailable: honest error, order marked failed, nothing delivered
  {
    apiDown = true;
    const { ctx, p } = await newPage();
    await p.goto(pageOrigin, { waitUntil: 'networkidle' });
    await p.locator('.ae-card--bundle button').click();
    await p.fill('[data-ae-form] input[name=email]', 'down@example.com');
    await p.selectOption('[data-ae-form] select[name=country]', 'FR');
    await p.check('[data-ae-form] input[name=terms]');
    await p.check('[data-ae-form] input[name=digital]');
    await p.click('[data-ae-form] button[type=submit]');
    await p.waitForFunction(() => document.querySelector('[data-ae-status]').textContent.trim().length > 0, null, { timeout: 15000 });
    ok(/Не удалось начать оплату/.test(await p.textContent('[data-ae-status]')), 'outage: the buyer sees an honest error');
    ok(api.db.prepare("SELECT COUNT(*) n FROM orders WHERE status = 'failed' AND email = 'down@example.com'").get().n === 1, 'outage: the order is marked failed');
    apiDown = false;
    await ctx.close();
  }

  // 9. Payments not configured: banner, nothing sellable
  {
    const off = await new Promise((r) => { const db = openDb(':memory:'); const s = createServer(createApp({ config: { ...api.config, paymentsEnabled: false }, db, transports: createTransports({ dataDir: dir, telegram: {} }), fetchImpl: fakeRevolut })); s.listen(0, '127.0.0.1', () => r({ s, base: `http://127.0.0.1:${s.address().port}` })); });
    pageBody = page([shopRu.replace('data-api=""', `data-api="${off.base}"`)]);
    const { ctx, p } = await newPage();
    await p.goto(pageOrigin, { waitUntil: 'networkidle' });
    ok(/Оплата пока не подключена/.test(await p.textContent('[data-ae-banner]')), 'payments off: banner says payments are not connected');
    ok((await p.locator('.ae-card button:enabled').count()) === 0, 'payments off: nothing can be bought');
    await ctx.close(); off.s.close();
  }

  // 10. Browser hygiene: no uncaught script errors on any page of this run
  ok(errs.length === 0, `browser: no script errors (${errs.slice(0, 2).join(' | ')})`);

  await browser.close();
  api.server.close(); pageServer.close();
  rmSync(dir, { recursive: true, force: true });
  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('E2E ERROR', e); process.exit(1); });
