// Owner admin panel (for iPhone and desktop): password login, server-side sessions, read-only views.
// Enabled only when ADMIN_PASSWORD_HASH is set. The password itself is never stored or sent back; create the hash with
// `node scripts/admin-password.mjs` on your own computer and put only the hash into the server's .env.
// Read-only by design: refunds and fee imports stay in the audited scripts (scripts/record-refund.mjs, import-revolut-fees.mjs).

import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ledgerRows, ledgerTotals, toCsv } from './ledger.mjs';

const scrypt = promisify(scryptCb);
const HERE = dirname(fileURLToPath(import.meta.url));
export const ADMIN_HASH_RE = /^scrypt:(\d+):(\d+):(\d+):([A-Za-z0-9+/=]{16,}):([A-Za-z0-9+/=]{32,})$/;
export const SESSION_MS = 8 * 60 * 60 * 1000;   // 8 hours, then log in again
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 5;                             // failed attempts per client per window
const COOKIE = 'aina_admin';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const iso = (ms) => new Date(ms).toISOString();

// ---------- password hashing (scrypt, salted) ----------
export async function hashPassword(password, { N = 16384, r = 8, p = 1 } = {}) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw new Error('password must be 12–200 characters');
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const m = ADMIN_HASH_RE.exec(stored || '');
  if (!m || typeof password !== 'string' || password.length > 200) return false;
  const [, N, r, p, saltB64, keyB64] = m;
  const expected = Buffer.from(keyB64, 'base64');
  const got = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// ---------- sessions (stored hashed; expired rows removed on each check) ----------
export function createSession(db, nowMs) {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)').run(sha256(token), iso(nowMs), iso(nowMs + SESSION_MS));
  return token;
}

export function isValidSession(db, token, nowMs) {
  if (!token || typeof token !== 'string' || token.length > 100) return false;
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(iso(nowMs));
  return Boolean(db.prepare('SELECT 1 AS ok FROM admin_sessions WHERE token_hash = ? AND expires_at >= ?').get(sha256(token), iso(nowMs)));
}

export function revokeSession(db, token) {
  if (typeof token === 'string' && token.length <= 100) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token));
}

export function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// ---------- read-only queries ----------
export function adminSummary(db, nowMs) {
  const count = (sql) => Object.fromEntries(db.prepare(sql).all().map((r) => [r.k, r.n]));
  const totals = ledgerTotals(ledgerRows(db, {}));
  const since7 = iso(nowMs - 7 * 24 * 3600 * 1000);
  return {
    orders: count('SELECT status AS k, COUNT(*) AS n FROM orders GROUP BY status'),
    leads: count('SELECT status AS k, COUNT(*) AS n FROM leads GROUP BY status'),
    leadsLast7Days: db.prepare('SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?').get(since7).n,
    outbox: count('SELECT status AS k, COUNT(*) AS n FROM outbox GROUP BY status'),
    // Amounts per currency, in minor units (cents). Fees not yet imported are counted, not guessed.
    money: Object.fromEntries(Object.entries(totals).map(([cur, t]) => [cur, {
      payments: t.payments, refunds: t.refunds, fees: t.fees, net: t.payments - t.refunds - t.fees, feesToReconcile: t.feesToReconcile,
    }])),
    generatedAt: iso(nowMs),
  };
}

export function adminOrders(db, limit = 50) {
  return db.prepare(`SELECT id, created_at, status, email, locale, customer_country, items_json, amount_cents, currency, provider, paid_at
                     FROM orders ORDER BY created_at DESC LIMIT ?`).all(limit).map((o) => ({
    id: o.id, createdAt: o.created_at, status: o.status, email: o.email, locale: o.locale, country: o.customer_country,
    items: JSON.parse(o.items_json).map((i) => i.sku), amount: o.amount_cents, currency: o.currency,
    provider: o.provider, paidAt: o.paid_at,
  }));
}

export function adminLeads(db, limit = 50) {
  return db.prepare(`SELECT id, created_at, locale, name, email, phone, topic, message, status FROM leads ORDER BY created_at DESC LIMIT ?`).all(limit)
    .map((l) => ({ id: l.id, createdAt: l.created_at, locale: l.locale, name: l.name, email: l.email, phone: l.phone, topic: l.topic, message: l.message, status: l.status }));
}

// ---------- HTTP routes ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns true when the request was handled. `send` and `readJson` come from the app so headers stay identical.
export function createAdminRoutes({ config, db, send, readJson, now = () => new Date() }) {
  const enabled = Boolean(config.adminPasswordHash);
  const attempts = new Map(); // client key -> timestamps of failed logins
  const secure = config.siteUrl.startsWith('https://');
  const page = (name) => readFileSync(join(HERE, 'admin', name));
  const assets = { '/admin': ['index.html', 'text/html; charset=utf-8'], '/admin/admin.css': ['admin.css', 'text/css; charset=utf-8'], '/admin/admin.js': ['admin.js', 'application/javascript; charset=utf-8'] };
  const PAGE_HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-cache' };

  function requireSession(req, res) {
    if (isValidSession(db, readCookie(req, COOKIE), now().getTime())) return true;
    send(res, 401, { error: 'login_required' });
    return false;
  }

  return async function adminRoute(req, res, p, url) {
    const isPage = p === '/admin' || p.startsWith('/admin/');
    const isApi = p.startsWith('/api/admin/');
    if (!isPage && !isApi) return false;
    if (!enabled) { send(res, 404, { error: 'not_found' }); return true; }

    if (isPage) {
      const asset = assets[p.replace(/\/$/, '') || '/admin'];
      if (!asset || req.method !== 'GET') { send(res, 404, { error: 'not_found' }); return true; }
      send(res, 200, page(asset[0]), { 'Content-Type': asset[1], ...PAGE_HEADERS });
      return true;
    }

    if (p === '/api/admin/login' && req.method === 'POST') {
      const key = `${config.ipSalt}|${clientAddress(req, config.trustProxy)}`;
      const t = now().getTime();
      const recent = (attempts.get(key) || []).filter((x) => t - x < LOGIN_WINDOW_MS);
      attempts.set(key, recent);
      if (recent.length >= LOGIN_MAX) { send(res, 429, { error: 'rate_limited' }); return true; }
      const body = await readJson(req, 1024);
      if (!(await verifyPassword(body.password, config.adminPasswordHash))) {
        recent.push(t); attempts.set(key, recent);
        send(res, 401, { error: 'bad_credentials' });
        return true;
      }
      attempts.delete(key);
      const token = createSession(db, t);
      const cookie = `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
      send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
      return true;
    }

    if (p === '/api/admin/logout' && req.method === 'POST') {
      await readJson(req, 1024);
      revokeSession(db, readCookie(req, COOKIE));
      send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}` });
      return true;
    }

    if (req.method !== 'GET') { send(res, 405, { error: 'method_not_allowed' }); return true; }
    if (!requireSession(req, res)) return true;

    if (p === '/api/admin/summary') { send(res, 200, adminSummary(db, now().getTime())); return true; }
    if (p === '/api/admin/orders') { send(res, 200, { orders: adminOrders(db, clampLimit(url)) }); return true; }
    if (p === '/api/admin/leads') { send(res, 200, { leads: adminLeads(db, clampLimit(url)) }); return true; }
    if (p === '/api/admin/ledger.csv') {
      const from = url.searchParams.get('from') || undefined;
      const to = url.searchParams.get('to') || undefined;
      if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) { send(res, 422, { error: 'bad_date' }); return true; }
      const csv = toCsv(ledgerRows(db, { from, to, withEmail: false })); // buyer emails stay out of the export
      send(res, 200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ledger.csv"' });
      return true;
    }
    send(res, 404, { error: 'not_found' });
    return true;
  };
}

// Behind the reverse proxy every request comes from one address, so the real client comes from X-Forwarded-For (TRUST_PROXY).
function clientAddress(req, trustProxy) {
  if (trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function clampLimit(url) {
  const n = Number(url.searchParams.get('limit'));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 200) : 50;
}
