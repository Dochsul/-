// Stripe integration without the SDK (official REST API + documented webhook signature scheme).
// Only used when PAYMENTS_ENABLED=true and STRIPE_SECRET_KEY is set. Nothing here runs in the default configuration.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_TOLERANCE_SECONDS = 300;

// Stripe-Signature: t=1700000000,v1=<hex>[,v1=<hex>...]   signed payload: `${t}.${rawBody}`
export function verifyStripeSignature(rawBody, header, secret, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!header || !secret) return false;
  const parts = String(header).split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v).filter(Boolean);
  if (!t || sigs.length === 0) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest();
  return sigs.some((hex) => {
    if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
    const given = Buffer.from(hex, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const STRIPE_LOCALE = { ru: 'ru', fr: 'fr', en: 'en' };

// Creates a Stripe Checkout Session. `fetchImpl` is injectable for tests.
export async function createCheckoutSession({ secretKey, fetchImpl = fetch, order, lines, locale, successUrl, cancelUrl, idempotencyKey }) {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('client_reference_id', order.id);
  form.set('customer_email', order.email);
  form.set('locale', STRIPE_LOCALE[locale] || 'en');
  form.set('success_url', successUrl);
  form.set('cancel_url', cancelUrl);
  form.set('billing_address_collection', 'required');
  form.set('metadata[order_id]', order.id);
  lines.forEach((l, i) => {
    form.set(`line_items[${i}][quantity]`, String(l.qty));
    form.set(`line_items[${i}][price_data][currency]`, l.currency.toLowerCase());
    form.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitCents));
    form.set(`line_items[${i}][price_data][product_data][name]`, l.titles[locale]?.title || l.sku);
    form.set(`line_items[${i}][price_data][product_data][metadata][sku]`, l.sku);
  });
  const res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url || !body.id) {
    const err = new Error(`stripe_error_${res.status}`);
    err.code = 'stripe_error';
    throw err;
  }
  return { id: body.id, url: body.url };
}

// Reads the provider fee for a payment (Stripe balance transaction). Best effort: returns null on any failure,
// and the ledger keeps fee_cents = NULL so the gap is visible in the accounting export.
export async function fetchStripeFee({ secretKey, fetchImpl = fetch, paymentIntentId }) {
  if (!secretKey || !paymentIntentId || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return null;
  try {
    const url = `https://api.stripe.com/v1/payment_intents/${paymentIntentId}?expand[]=latest_charge.balance_transaction`;
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${secretKey}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const pi = await res.json();
    const bt = pi?.latest_charge?.balance_transaction;
    if (!bt || typeof bt.fee !== 'number' || typeof bt.net !== 'number') return null;
    // Stripe reports fee/net in the balance (settlement) currency, which can differ from the order currency.
    return { feeCents: bt.fee, netCents: bt.net, currency: String(bt.currency || '').toUpperCase() };
  } catch {
    return null;
  }
}
