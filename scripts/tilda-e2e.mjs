#!/usr/bin/env node
// End-to-end test of the Tilda shop integration in a real browser (Playwright + Chromium).
// Two origins like production: a "Tilda" page origin serving the generated T123 block, and the API origin.
// Stripe is a STUB (no network, no real payment): this verifies our code path, not Stripe itself.
// Usage: npm run e2e:tilda   (needs Playwright; CHROMIUM_PATH optional)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { createTransports } from '../server/outbox.mjs';
import { products, fileSkus } from '../src/config/catalog.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEBHOOK = 'whsec_e2e_only';
const results = [];
const ok = (cond, msg) => { results.push([!!cond, msg]); console.log(`${cond ? '  ok ' : ' FAIL'}  ${msg}`); };

const dir = mkdtempSync(join(tmpdir(), 'aina-e2e-'));
mkdirSync(join(dir, 'private'), { recursive: true });
mkdirSync(join(dir, 'dist'), { recursive: true });
const PDF = Buffer.from('%PDF-1.4 e2e\n%%EOF');
for (const f of fileSkus()) writeFileSync(join(dir, 'private', `${f}.pdf`), PDF);

// Catalog as it will be once the owner publishes: real products and approved prices; only the bundle has a price.
const catalog = products.map((p) => ({ ...p, published: true, contentConfirmed: true }));
let stripeForms = [];
const fakeFetch = async (url, init) => {
  if (String(url).startsWith('https://api.stripe.com/v1/checkout/sessions')) {
    stripeForms.push(new URLSearchParams(init.body));
    const id = `cs_e2e_${stripeForms.length}`;
    return new Response(JSON.stringify({ id, url: `https://checkout.stripe.test/c/${id}` }), { status: 200 });
  }
  if (String(url).startsWith('https://api.stripe.com/v1/payment_intents/')) {
    return new Response(JSON.stringify({ latest_charge: { balance_transaction: { fee: 55, net: 1935, currency: 'eur' } } }), { status: 200 });
  }
  throw new Error('unexpected fetch');
};

function listen(handler) {
  return new Promise((r) => { const s = createServer(handler); s.listen(0, '127.0.0.1', () => r(s)); });
}

async function startApi({ paymentsEnabled, pageOrigin }) {
  const db = openDb(':memory:');
  const config = {
    siteUrl: 'https://api.test', ipSalt: 'e2e', ownerEmail: 'owner@test', ownerChannel: 'file', clientChannel: 'file', trustProxy: false,
    paymentsEnabled, stripeSecretKey: 'sk_test_e2e_stub', stripeWebhookSecret: WEBHOOK, privateDir: join(dir, 'private'), distDir: join(dir, 'dist'),
    dataDir: dir, catalog, fileSkus: fileSkus(), enabledCurrencies: ['EUR'], allowedOrigins: [pageOrigin], blockedCountries: ['RU', 'BY'],
    downloadValidityDays: 7, downloadMaxCount: 5, checkoutSuccessUrl: `${pageOrigin}/{locale}/merci`, checkoutCancelUrl: `${pageOrigin}/{locale}/panier`, telegram: {},
  };
  const app = createApp({ config, db, transports: createTransports({ dataDir: dir, telegram: {} }), fetchImpl: fakeFetch });
  const server = await listen(app);
  return { server, db, base: `http://127.0.0.1:${server.address().port}` };
}

function pageHtml(blocks) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tilda stand-in</title>
<style>body{margin:0;font-family:Arial,sans-serif} .t-rec{padding:0}</style></head><body>${blocks.map((b) => `<div class="t-rec">${b}</div>`).join('')}</body></html>`;
}

const sign = (body) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac('sha256', WEBHOOK).update(`${t}.${body}`).digest('hex')}`; };

(async () => {
  const shopRu = readFileSync(join(root, 'tilda', 'components', '01-shop.ru.html'), 'utf8');
  const leadRu = readFileSync(join(root, 'tilda', 'components', '02-lead-form.ru.html'), 'utf8');
  let pageBody = '';
  const pageServer = await listen((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(pageBody); });
  const pageOrigin = `http://127.0.0.1:${pageServer.address().port}`;
  const api = await startApi({ paymentsEnabled: true, pageOrigin });
  const apiOff = await startApi({ paymentsEnabled: false, pageOrigin });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const consoleErrors = [];
  const newPage = async (viewport) => {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    await page.route('https://checkout.stripe.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1 id="stripe-stub">Stripe Checkout (stub)</h1>' }));
    return { ctx, page };
  };

  // 1. Layout at Tilda breakpoints
  pageBody = pageHtml([shopRu.replace('data-api=""', `data-api="${api.base}"`), leadRu.replace('data-api=""', `data-api="${api.base}"`)]);
  for (const width of [320, 375, 768, 1280]) {
    const { ctx, page } = await newPage({ width, height: 900 });
    await page.goto(pageOrigin, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!overflow, `layout: no horizontal overflow at ${width}px`);
    if (width === 375) await page.screenshot({ path: join(dir, 'shop-375.png'), fullPage: true });
    await ctx.close();
  }

  // 2. Catalog and purchase flow (RU page, EUR checkout)
  {
    const { ctx, page } = await newPage({ width: 1280, height: 900 });
    await page.goto(pageOrigin, { waitUntil: 'networkidle' });
    ok((await page.locator('.ae-card').count()) === 4, 'shop: 4 cards (3 guides + bundle)');
    const bundle = page.locator('.ae-card--bundle');
    const bundleText = await bundle.innerText();
    ok(/19,90\s€/.test(bundleText) && /2\s000\s₽/.test(bundleText), 'shop: bundle shows approved prices 19,90 € and 2 000 ₽');
    ok(await bundle.locator('button').isEnabled(), 'shop: bundle can be added (published in this test, priced)');
    const guideBtn = page.locator('.ae-card').first().locator('button');
    ok(await guideBtn.isDisabled(), 'shop: guide without an approved price cannot be bought');
    await bundle.locator('button').click();
    ok(await page.isVisible('[data-ae-form]'), 'cart: checkout form appears after adding the bundle');
    ok(/19,90/.test(await page.textContent('[data-ae-total]')), 'cart: total 19,90 € (EUR)');
    // Consents are mandatory: no request without them
    await page.fill('[data-ae-form] input[name=email]', 'buyer@example.com');
    const before = stripeForms.length;
    await page.click('[data-ae-form] button[type=submit]');
    await page.waitForTimeout(300);
    ok(stripeForms.length === before, 'checkout: no payment session without both legal consents');
    await page.check('[data-ae-form] input[name=terms]');
    await page.check('[data-ae-form] input[name=digital]');
    await Promise.all([page.waitForURL(/checkout\.stripe\.test/), page.click('[data-ae-form] button[type=submit]')]);
    ok(await page.isVisible('#stripe-stub'), 'checkout: browser is sent to the Stripe Checkout page (stub)');
    const form = stripeForms.at(-1);
    ok(form.get('line_items[0][price_data][unit_amount]') === '1990' && form.get('line_items[0][price_data][currency]') === 'eur', 'checkout: Stripe receives the server price 19,90 EUR');
    ok(form.get('success_url') === `${pageOrigin}/ru/merci`, 'checkout: buyer returns to the Tilda thank-you page');
    await ctx.close();
  }

  // 3. Payment confirmation → delivery of three PDFs, no duplicates, refund revokes access
  {
    const order = api.db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 1").get();
    ok(order.status === 'pending_payment' && order.amount_cents === 1990, 'order: stored as pending_payment, 19,90 EUR, before any confirmation');
    ok(api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(order.id).n === 0, 'delivery: no download link exists before payment confirmation');
    const evt = (id, type, obj) => JSON.stringify({ id, type, data: { object: obj } });
    const paid = evt('evt_e2e_paid', 'checkout.session.completed', { id: order.provider_session_id, payment_status: 'paid', amount_total: 1990, currency: 'eur', payment_intent: 'pi_e2e1', metadata: { order_id: order.id }, customer_details: { address: { country: 'FR' } } });
    const r1 = await fetch(`${api.base}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sign(paid) }, body: paid });
    ok(r1.status === 200, 'webhook: signed payment confirmation accepted');
    await fetch(`${api.base}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sign(paid) }, body: paid });
    const tokens = api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(order.id).n;
    ok(tokens === 3, `delivery: exactly 3 personal links for the bundle after a repeated event (got ${tokens})`);
    const mail = api.db.prepare("SELECT body FROM outbox WHERE kind = 'order_delivery' AND related_id = ?").all(order.id);
    ok(mail.length === 1, 'delivery: one delivery email queued, not duplicated');
    const links = [...mail[0].body.matchAll(/https:\/\/api\.test(\/api\/download\/[A-Za-z0-9_-]+)/g)].map((m) => m[1]);
    let okDownloads = 0;
    for (const l of links) { const r = await fetch(api.base + l); if (r.status === 200 && Buffer.from(await r.arrayBuffer()).equals(PDF)) okDownloads++; }
    ok(okDownloads === 3, 'delivery: all 3 links download the PDF after confirmed payment');
    const pay = api.db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);
    ok(pay && pay.fee_cents === 55 && pay.net_cents === 1935, 'ledger: payment with fee 0,55 and net 19,35 recorded');
    const refund = evt('evt_e2e_refund', 'charge.refunded', { id: 'ch_e2e1', payment_intent: 'pi_e2e1', amount_refunded: 1990, refunds: { data: [{ id: 're_e2e1' }] } });
    await fetch(`${api.base}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sign(refund) }, body: refund });
    const after = await fetch(api.base + links[0]);
    ok(after.status === 404, 'refund: full refund revokes the download links');
    const forged = evt('evt_forged', 'checkout.session.completed', { id: 'x', payment_status: 'paid', amount_total: 1990, currency: 'eur', metadata: { order_id: order.id } });
    const rf = await fetch(`${api.base}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=00' }, body: forged });
    ok(rf.status === 400, 'security: forged payment confirmation is rejected');
  }

  // 4. Failed payment: nothing delivered
  {
    const res = await fetch(`${api.base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json', origin: pageOrigin }, body: JSON.stringify({ locale: 'fr', email: 'f@example.com', items: [{ sku: 'parent-guides-bundle' }], acceptTerms: true, acceptDigital: true }) });
    const { orderId } = await res.json();
    const o = api.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const fail = JSON.stringify({ id: 'evt_e2e_fail', type: 'checkout.session.async_payment_failed', data: { object: { id: o.provider_session_id } } });
    await fetch(`${api.base}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sign(fail) }, body: fail });
    const st = api.db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId).status;
    const n = api.db.prepare('SELECT COUNT(*) n FROM downloads WHERE order_id = ?').get(orderId).n;
    ok(st === 'failed' && n === 0, 'failed payment: order marked failed, no links issued');
  }

  // 5. Payments switched off (current real state): shop shows products but sells nothing
  {
    pageBody = pageHtml([shopRu.replace('data-api=""', `data-api="${apiOff.base}"`)]);
    const { ctx, page } = await newPage({ width: 1280, height: 900 });
    await page.goto(pageOrigin, { waitUntil: 'networkidle' });
    ok(/Оплата пока не подключена/.test(await page.textContent('[data-ae-banner]')), 'payments off: banner says payments are not connected');
    ok((await page.locator('.ae-card button:enabled').count()) === 0, 'payments off: no product can be added');
    await ctx.close();
  }

  // 6. API unreachable: honest message, nothing sellable
  {
    pageBody = pageHtml([shopRu.replace('data-api=""', 'data-api="http://127.0.0.1:9"')]);
    const { ctx, page } = await newPage({ width: 1280, height: 900 });
    await page.goto(pageOrigin, { waitUntil: 'networkidle' });
    ok(/временно недоступен/.test(await page.textContent('[data-ae-banner]')), 'API down: banner says the shop is temporarily unavailable');
    ok((await page.locator('.ae-card button:enabled').count()) === 0, 'API down: no product can be added');
    await ctx.close();
  }

  // 7. Lead form component (cross-origin to the API)
  {
    pageBody = pageHtml([leadRu.replace('data-api=""', `data-api="${api.base}"`)]);
    const { ctx, page } = await newPage({ width: 1280, height: 900 });
    await page.goto(pageOrigin, { waitUntil: 'networkidle' });
    await page.fill('[data-ae-lead] input[name=name]', 'Анна');
    await page.fill('[data-ae-lead] input[name=email]', 'anna@example.com');
    await page.fill('[data-ae-lead] textarea', 'Мой диагноз: анемия');
    await page.check('[data-ae-lead] input[name=consent]');
    await page.click('[data-ae-lead] button');
    await page.waitForFunction(() => document.querySelector('.ae-lead__status').textContent.length > 0);
    ok(/не указывайте анализы/.test(await page.textContent('.ae-lead__status')), 'lead: health data is refused with an explanation');
    await page.fill('[data-ae-lead] textarea', 'Вопрос о гайдах');
    await page.click('[data-ae-lead] button');
    await page.waitForFunction(() => /получена/.test(document.querySelector('.ae-lead__status').textContent));
    ok(true, 'lead: success shown only after the API stored the request (201)');
    ok(api.db.prepare("SELECT COUNT(*) n FROM leads WHERE email = 'anna@example.com'").get().n === 1, 'lead: exactly one lead stored');
    await ctx.close();
  }

  const corsNoise = consoleErrors.filter((e) => !/ERR_CONNECTION_REFUSED|Failed to load resource|net::ERR/.test(e));
  ok(corsNoise.length === 0, `browser: no script or CORS errors (${corsNoise.slice(0, 2).join(' | ')})`);

  await browser.close();
  for (const s of [pageServer, api.server, apiOff.server]) s.close();
  rmSync(dir, { recursive: true, force: true });
  const failed = results.filter(([c]) => !c);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('E2E ERROR', e); process.exit(1); });
