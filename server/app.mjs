// HTTP application: API routes and static serving of dist/ (for development and single-server deployment).
// Built on node:http only. Every route returns JSON for API errors and never leaks internal details.

import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, normalize, extname, resolve, sep, basename } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { validateLead, validateCheckout, priceOrder, ValidationError } from './validate.mjs';
import { verifyStripeSignature, createCheckoutSession, fetchStripeFee } from './stripe.mjs';
import { fileSkus } from '../src/config/catalog.mjs';
import { enqueue } from './outbox.mjs';
import { nowIso } from './db.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

// ---------- small helpers ----------
export class RateLimiter {
  constructor(limits) { this.limits = limits; this.hits = new Map(); }
  allow(key, route) {
    const { max, windowMs } = this.limits[route];
    const now = Date.now();
    const k = `${route}:${key}`;
    const arr = (this.hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { this.hits.set(k, arr); return false; }
    arr.push(now);
    this.hits.set(k, arr);
    if (this.hits.size > 50000) this.hits.clear(); // hard cap against memory growth
    return true;
  }
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Security-Policy': CSP,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : headers['Content-Type'] || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) { const e = new Error('too_large'); e.status = 413; throw e; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limit = 16 * 1024) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.startsWith('application/json')) { const e = new Error('bad_content_type'); e.status = 415; throw e; }
  const raw = await readBody(req, limit);
  try { return JSON.parse(raw.toString('utf8')); } catch { const e = new Error('bad_json'); e.status = 400; throw e; }
}

function clientIp(req, trustProxy) {
  if (trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

// ---------- CORS (only for explicitly allowed origins, e.g. the Tilda site) ----------
function corsHeaders(req, allowedOrigins) {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

// ---------- application factory ----------
export function createApp({ config, db, transports, fetchImpl = fetch, now = () => new Date() }) {
  const limiter = new RateLimiter({
    leads: { max: 10, windowMs: 10 * 60 * 1000 },
    checkout: { max: 20, windowMs: 10 * 60 * 1000 },
    download: { max: 60, windowMs: 10 * 60 * 1000 },
  });
  const ipHash = (req) => sha256(`${config.ipSalt}|${clientIp(req, config.trustProxy)}`).slice(0, 32);
  const siteUrl = config.siteUrl.replace(/\/$/, '');
  const distDir = resolve(config.distDir);
  const products = config.catalog;
  const blocked = new Set(config.blockedCountries);

  // ----- POST /api/leads -----
  async function leads(req, res) {
    if (!limiter.allow(ipHash(req), 'leads')) return send(res, 429, { error: 'rate_limited' });
    const body = await readJson(req);
    const lead = validateLead(body);
    if (body.website) return send(res, 201, { ok: true }); // honeypot: pretend success, store nothing
    const id = randomBytes(12).toString('hex');
    const t = now().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO leads (id, created_at, locale, name, email, phone, topic, message, consent_at, ip_hash, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`)
        .run(id, t, lead.locale, lead.name, lead.email, lead.phone || null, lead.topic, lead.message || null, t, ipHash(req));
      enqueue(db, {
        kind: 'lead_owner', recipient: config.ownerEmail,
        subject: `Новая заявка: ${lead.topic}`,
        body: `Имя: ${lead.name}\nEmail: ${lead.email}\nТелефон: ${lead.phone || '—'}\nТема: ${lead.topic}\nЯзык: ${lead.locale}\n\nСообщение:\n${lead.message || '—'}\n\nID: ${id}`,
        relatedId: id,
      });
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    // The client gets the success response only now: the lead is stored and the owner notification is queued.
    return send(res, 201, { ok: true, id });
  }

  // ----- POST /api/checkout -----
  async function checkout(req, res) {
    if (!config.paymentsEnabled || !config.stripeSecretKey) return send(res, 503, { error: 'payments_disabled' });
    if (!limiter.allow(ipHash(req), 'checkout')) return send(res, 429, { error: 'rate_limited' });
    const body = await readJson(req);
    const input = validateCheckout(body);
    const priced = priceOrder(input.items, input.currency, config.catalog, config.enabledCurrencies);
    if (priced.error) return send(res, 409, { error: priced.error, sku: priced.sku });

    const id = randomBytes(12).toString('hex');
    const t = now().toISOString();
    const itemsJson = JSON.stringify(priced.lines.map((l) => ({ sku: l.sku, unitCents: l.unitCents, files: l.files })));
    db.prepare(`INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider,
                 terms_accepted_at, digital_waiver_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'stripe', ?, ?)`)
      .run(id, t, t, input.locale, input.email, itemsJson, priced.amountCents, priced.currency, t, t);
    try {
      const session = await createCheckoutSession({
        secretKey: config.stripeSecretKey, fetchImpl, order: { id, email: input.email }, lines: priced.lines,
        locale: input.locale, idempotencyKey: `order-${id}`,
        // Return pages: the Tilda site in production ({locale} is replaced), the static site by default.
        successUrl: (config.checkoutSuccessUrl || `${siteUrl}/{locale}/checkout/success/`).replace('{locale}', input.locale),
        cancelUrl: (config.checkoutCancelUrl || `${siteUrl}/{locale}/checkout/cancel/`).replace('{locale}', input.locale),
      });
      db.prepare('UPDATE orders SET provider_session_id = ?, updated_at = ? WHERE id = ?').run(session.id, nowIso(), id);
      return send(res, 200, { url: session.url, orderId: id });
    } catch (e) {
      db.prepare("UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ?").run(nowIso(), id);
      return send(res, 502, { error: 'payment_provider_error' });
    }
  }

  // ----- POST /api/webhooks/stripe -----
  async function stripeWebhook(req, res) {
    const raw = (await readBody(req, 64 * 1024)).toString('utf8');
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'], config.stripeWebhookSecret)) {
      return send(res, 400, { error: 'bad_signature' });
    }
    const event = JSON.parse(raw);
    if (db.prepare('SELECT 1 FROM processed_events WHERE event_id = ?').get(event.id)) {
      return send(res, 200, { duplicate: true });
    }
    let feeLookup = null;
    db.exec('BEGIN IMMEDIATE');
    try {
      const obj = event.data?.object || {};
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        feeLookup = settleOrder(obj);
      } else if (event.type === 'checkout.session.expired') {
        db.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE provider_session_id = ? AND status = 'pending_payment'").run(nowIso(), obj.id);
      } else if (event.type === 'checkout.session.async_payment_failed') {
        db.prepare("UPDATE orders SET status = 'failed', updated_at = ? WHERE provider_session_id = ? AND status = 'pending_payment'").run(nowIso(), obj.id);
      } else if (event.type === 'charge.refunded') {
        recordRefund(obj);
      }
      db.prepare('INSERT INTO processed_events (event_id, type, received_at) VALUES (?, ?, ?)').run(event.id, event.type, nowIso());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e; // 500 makes Stripe retry the event later
    }
    // Fee lookup happens after the commit: a slow or failing provider call never blocks delivery.
    if (feeLookup) {
      const fee = await fetchStripeFee({ secretKey: config.stripeSecretKey, fetchImpl, paymentIntentId: feeLookup });
      if (fee) {
        db.prepare('UPDATE payments SET fee_cents = ?, net_cents = ?, fee_currency = ? WHERE provider_payment_id = ?')
          .run(fee.feeCents, fee.netCents, fee.currency, feeLookup);
      }
    }
    return send(res, 200, { received: true });
  }

  // Refunds are made in the Stripe Dashboard; Stripe then sends charge.refunded (amount_refunded is cumulative).
  function recordRefund(charge) {
    const pi = charge.payment_intent;
    const payment = pi && db.prepare('SELECT * FROM payments WHERE provider_payment_id = ?').get(pi);
    if (!payment) return;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id);
    const already = db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM refunds WHERE order_id = ?').get(order.id).s;
    const delta = Number(charge.amount_refunded || 0) - already;
    if (delta <= 0) return;
    const latest = charge.refunds?.data?.[0]?.id;
    db.prepare('INSERT INTO refunds (order_id, provider, provider_refund_id, amount_cents, currency, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(order.id, 'stripe', latest || `${charge.id}:${charge.amount_refunded}`, delta, order.currency, charge.refunds?.data?.[0]?.reason || null, nowIso());
    const full = already + delta >= order.amount_cents;
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(full ? 'refunded' : 'partially_refunded', nowIso(), order.id);
    // A fully refunded order loses access to its files.
    if (full) db.prepare('UPDATE downloads SET revoked = 1 WHERE order_id = ?').run(order.id);
    enqueue(db, { kind: 'order_owner', recipient: config.ownerEmail, subject: full ? 'Возврат: полный' : 'Возврат: частичный', body: `Заказ ${order.id}: возвращено ${((already + delta) / 100).toFixed(2)} ${order.currency} из ${(order.amount_cents / 100).toFixed(2)}.${full ? ' Доступ к файлам отозван.' : ''}`, relatedId: order.id });
  }

  function settleOrder(session) {
    if (session.payment_status !== 'paid') return null; // asynchronous method: wait for async_payment_succeeded
    const orderId = session.metadata?.order_id || session.client_reference_id;
    const order = orderId && db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order || order.status !== 'pending_payment') return null; // idempotent: settle each order once
    // The amount paid must match the server-side price. Otherwise nothing is delivered.
    if (session.amount_total !== order.amount_cents || String(session.currency).toUpperCase() !== order.currency) {
      db.prepare("UPDATE orders SET status = 'review_amount', updated_at = ? WHERE id = ?").run(nowIso(), order.id);
      enqueue(db, { kind: 'order_owner', recipient: config.ownerEmail, subject: 'Заказ требует проверки (сумма)', body: `Заказ ${order.id}: сумма оплаты не совпала с каталогом. Файлы не выданы.`, relatedId: order.id });
      return;
    }
    const country = session.customer_details?.address?.country || null;
    const t = nowIso();
    if (country && blocked.has(country)) {
      // Sanctions control: the country is known only after payment. The order is held for manual review and refund.
      db.prepare("UPDATE orders SET status = 'review_sanctions', customer_country = ?, updated_at = ? WHERE id = ?").run(country, t, order.id);
      enqueue(db, { kind: 'order_owner', recipient: config.ownerEmail, subject: 'Заказ на проверке (санкции)', body: `Заказ ${order.id}: страна клиента ${country} в списке ограничений. Файлы не выданы. Решение и возврат — вручную, после консультации с юристом.`, relatedId: order.id });
      return;
    }
    db.prepare("UPDATE orders SET status = 'paid', paid_at = ?, updated_at = ?, customer_country = ?, provider_session_id = COALESCE(provider_session_id, ?) WHERE id = ?")
      .run(t, t, country, session.id, order.id);
    const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : `cs:${session.id}`;
    db.prepare(`INSERT OR IGNORE INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, status, created_at)
                VALUES (?, 'stripe', ?, ?, ?, 'succeeded', ?)`).run(order.id, paymentId, order.amount_cents, order.currency, t);
    const items = JSON.parse(order.items_json);
    const links = [];
    const expires = new Date(Date.now() + config.downloadValidityDays * 86400000).toISOString();
    // One personal token per PDF file (a bundle delivers three files).
    const files = [...new Set(items.flatMap((it) => it.files || [it.sku]))];
    for (const fileSku of files) {
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO downloads (token_hash, order_id, sku, created_at, expires_at, max_downloads) VALUES (?, ?, ?, ?, ?, ?)')
        .run(sha256(token), order.id, fileSku, t, expires, config.downloadMaxCount);
      const p = products.find((x) => x.sku === fileSku);
      const title = p ? (p.i18n[order.locale]?.title || p.i18n.en.title) : fileSku;
      links.push(`${title}: ${siteUrl}/api/download/${token}`);
    }
    enqueue(db, {
      kind: 'order_delivery', recipient: order.email, subject: 'AINA Évidence: your files',
      body: `Payment confirmed. Your personal download links (valid ${config.downloadValidityDays} days, up to ${config.downloadMaxCount} downloads each):\n\n${links.join('\n')}\n\nKeep this email private.`,
      relatedId: order.id,
    });
    enqueue(db, { kind: 'order_owner', recipient: config.ownerEmail, subject: 'Новый оплаченный заказ', body: `Заказ ${order.id}\nСумма: ${(order.amount_cents / 100).toFixed(2)} ${order.currency}\nПозиции: ${items.map((i) => i.sku).join(', ')}`, relatedId: order.id });
    return paymentId.startsWith('pi_') ? paymentId : null;
  }

  // ----- GET /api/download/:token -----
  async function download(req, res, token) {
    if (!limiter.allow(ipHash(req), 'download')) return send(res, 429, { error: 'rate_limited' });
    const notFound = () => send(res, 404, { error: 'not_found' });
    if (!TOKEN_RE.test(token)) return notFound();
    const row = db.prepare(`
      SELECT d.*, o.status AS order_status FROM downloads d JOIN orders o ON o.id = d.order_id WHERE d.token_hash = ?
    `).get(sha256(token));
    if (!row || row.revoked || row.order_status !== 'paid' || new Date(row.expires_at) < now()) return notFound();
    if (row.download_count >= row.max_downloads) return notFound();
    // Atomic increment: concurrent requests cannot exceed the limit.
    const upd = db.prepare('UPDATE downloads SET download_count = download_count + 1 WHERE token_hash = ? AND download_count < max_downloads AND revoked = 0').run(row.token_hash);
    if (upd.changes !== 1) return notFound();
    const known = config.fileSkus.includes(row.sku);
    const file = known && join(resolve(config.privateDir), `${basename(row.sku)}.pdf`);
    if (!file || !file.startsWith(resolve(config.privateDir) + sep) || !existsSync(file)) {
      db.prepare('UPDATE downloads SET download_count = download_count - 1 WHERE token_hash = ?').run(row.token_hash);
      return send(res, 503, { error: 'file_unavailable' });
    }
    const size = statSync(file).size;
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Length': size,
      'Content-Disposition': `attachment; filename="${row.sku}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    await pipeline(createReadStream(file), res);
  }

  // ----- static files from dist/ -----
  function staticFile(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const target = normalize(join(distDir, rel));
    if (!target.startsWith(distDir + sep) && target !== distDir) return send(res, 400, { error: 'bad_path' });
    let file = target;
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (existsSync(join(file, 'index.html'))) file = join(file, 'index.html');
      else {
        const nf = join(distDir, '404.html');
        if (existsSync(nf)) { res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': MIME['.html'], 'Content-Security-Policy': CSP }); return createReadStream(nf).pipe(res); }
        return send(res, 404, { error: 'not_found' });
      }
    }
    const type = MIME[extname(file)] || 'application/octet-stream';
    const cache = file.includes(`${sep}static${sep}`) ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Content-Security-Policy': CSP, 'Cache-Control': cache, 'Content-Length': statSync(file).size });
    return createReadStream(file).pipe(res);
  }

  // ----- GET /api/catalog: prices the shop block may show (server is the source of truth) -----
  function publicCatalog() {
    return {
      payments: config.paymentsEnabled && !!config.stripeSecretKey,
      currencies: config.enabledCurrencies,
      products: products.filter((p) => p.published && p.contentConfirmed && p.priceConfirmed).map((p) => ({
        sku: p.sku, prices: p.prices, files: p.files.length,
        title: Object.fromEntries(Object.entries(p.i18n).map(([l, t]) => [l, t.title])),
      })),
    };
  }

  // ----- router -----
  return async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://local');
      const p = url.pathname;
      const m = req.method;
      const cors = p.startsWith('/api/') && !p.startsWith('/api/webhooks/') && !p.startsWith('/api/download/') ? corsHeaders(req, config.allowedOrigins || []) : {};
      for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
      if (m === 'OPTIONS' && p.startsWith('/api/')) {
        if (!cors['Access-Control-Allow-Origin']) return send(res, 403, { error: 'origin_not_allowed' });
        res.writeHead(204); return res.end();
      }
      if (p === '/api/health' && m === 'GET') return send(res, 200, { ok: true, payments: config.paymentsEnabled && !!config.stripeSecretKey, currencies: config.enabledCurrencies });
      if (p === '/api/catalog' && m === 'GET') return send(res, 200, publicCatalog(), { 'Cache-Control': 'public, max-age=300' });
      if (p === '/api/leads' && m === 'POST') return await leads(req, res);
      if (p === '/api/checkout' && m === 'POST') return await checkout(req, res);
      if (p === '/api/webhooks/stripe' && m === 'POST') return await stripeWebhook(req, res);
      const dl = p.match(/^\/api\/download\/([^/]+)$/);
      if (dl && m === 'GET') return await download(req, res, dl[1]);
      if (p.startsWith('/api/')) return send(res, 404, { error: 'not_found' });
      if (m !== 'GET' && m !== 'HEAD') return send(res, 405, { error: 'method_not_allowed' });
      return staticFile(req, res, p);
    } catch (e) {
      if (e instanceof ValidationError) return send(res, 422, { error: 'validation', field: e.field, message: e.message });
      if (e.status) return send(res, e.status, { error: e.message });
      console.error('request_failed', e.code || e.name); // no request data in logs (personal data)
      if (!res.headersSent) return send(res, 500, { error: 'internal' });
    }
  };
}
