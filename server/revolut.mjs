// Revolut Merchant API client and webhook verification. No dependencies.
// Sources: developer.revolut.com Merchant API (orders, webhooks, signature verification guide).
// Field names not confirmed against a live sandbox response are marked UNVERIFIED in docs/REVOLUT.md.
// Everything here is injectable (fetchImpl, now) so it is tested without network access.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const REVOLUT_BASE = {
  sandbox: 'https://sandbox-merchant.revolut.com',
  production: 'https://merchant.revolut.com',
};
export const DEFAULT_API_VERSION = '2024-05-01';
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000; // our replay policy (not a Revolut requirement)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RevolutError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

function base(env) {
  if (!REVOLUT_BASE[env]) throw new RevolutError('unknown_revolut_env', 'config');
  return REVOLUT_BASE[env];
}

async function call({ env, apiKey, version, fetchImpl, method, path, body }) {
  if (!apiKey) throw new RevolutError('revolut_not_configured', 'config');
  const res = await fetchImpl(`${base(env)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Revolut-Api-Version': version || DEFAULT_API_VERSION,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new RevolutError(`revolut_http_${res.status}`, `revolut_${res.status}`);
  return json;
}

// Creates an order for an exact amount in minor units. The returned checkout_url is the hosted payment page.
export async function createRevolutOrder({ env, apiKey, version, fetchImpl = fetch, amountCents, currency, description, reference, email, redirectUrl }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new RevolutError('invalid_amount', 'invalid_amount');
  if (!/^[A-Z]{3}$/.test(currency)) throw new RevolutError('invalid_currency', 'invalid_currency');
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(reference)) throw new RevolutError('invalid_reference', 'invalid_reference');
  if (!/^https:\/\//.test(redirectUrl)) throw new RevolutError('redirect_must_be_https', 'config');
  const json = await call({
    env, apiKey, version, fetchImpl, method: 'POST', path: '/api/orders',
    body: {
      amount: amountCents,
      currency,
      description: String(description).slice(0, 200),
      merchant_order_data: { reference },   // our order id: the link between Revolut and our database
      customer: { email },
      redirect_url: redirectUrl,
    },
  });
  if (!UUID.test(json.id || '')) throw new RevolutError('revolut_bad_order_response', 'revolut_response');
  if (!/^https:\/\//.test(json.checkout_url || '')) throw new RevolutError('revolut_bad_checkout_url', 'revolut_response');
  return { id: json.id, checkoutUrl: json.checkout_url, state: json.state };
}

// Authoritative order state. We never trust the webhook body for money: we read the order back from Revolut.
export async function getRevolutOrder({ env, apiKey, version, fetchImpl = fetch, id }) {
  if (!UUID.test(id || '')) throw new RevolutError('invalid_order_id', 'invalid_order_id');
  return call({ env, apiKey, version, fetchImpl, method: 'GET', path: `/api/orders/${id}` });
}

// Signature check (Revolut guide): HMAC-SHA256 hex of "v1.<timestamp>.<raw body>" with the webhook signing secret (wsk_…).
// Header Revolut-Signature: "v1=<hex>" (several comma-separated values are possible during secret rotation).
export function verifyRevolutSignature(rawBody, timestampHeader, signatureHeader, secret, { now = Date.now(), toleranceMs = WEBHOOK_TOLERANCE_MS } = {}) {
  if (!secret || !signatureHeader || !timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > toleranceMs) return false;
  const expected = createHmac('sha256', secret).update(`v1.${timestampHeader}.${rawBody}`, 'utf8').digest();
  const candidates = [...String(signatureHeader).matchAll(/v1=([0-9a-f]{64})/gi)].map((m) => Buffer.from(m[1], 'hex'));
  return candidates.some((c) => c.length === expected.length && timingSafeEqual(c, expected));
}

// Parses the event envelope. Only the order id is taken from it; everything else is read back via the API.
export function parseRevolutEvent(rawBody) {
  let ev;
  try { ev = JSON.parse(rawBody); } catch { throw new RevolutError('bad_event_json', 'bad_event'); }
  const type = String(ev.event || '');
  const orderId = String(ev.order_id || ev.data?.id || ev.data?.order_id || '');
  return { type, orderId: UUID.test(orderId) ? orderId : null };
}

// Compares the authoritative Revolut order with our order. Returns { ok:true } or { ok:false, reason }.
export function checkRevolutOrder(remote, ours) {
  if (remote.state !== 'completed') return { ok: false, reason: 'not_completed' };
  if (remote.merchant_order_data?.reference !== ours.id) return { ok: false, reason: 'reference_mismatch' };
  if (Number(remote.amount) !== ours.amount_cents) return { ok: false, reason: 'amount_mismatch' };
  if (String(remote.currency || '').toUpperCase() !== ours.currency) return { ok: false, reason: 'currency_mismatch' };
  return { ok: true };
}

// Country as reported by Revolut for the payer (field name unverified: billing_address or customer.country).
export function revolutCountry(remote) {
  const c = remote.billing_address?.country || remote.customer?.country || null;
  return typeof c === 'string' && /^[A-Z]{2}$/.test(c) ? c : null;
}
