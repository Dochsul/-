#!/usr/bin/env node
// Stripe TEST-MODE integration check. Refuses live keys. Run it where api.stripe.com is reachable.
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-test.mjs check
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-test.mjs session [bundle|<sku>]   creates a TEST Checkout Session, prints its URL
//   node scripts/stripe-test.mjs endpoint https://api.your-domain                       checks that the deployed webhook endpoint rejects unsigned events
// Nothing here moves real money: test keys only, and the script exits before any request if the key is not a test key.
import { products } from '../src/config/catalog.mjs';
import { createCheckoutSession } from '../server/stripe.mjs';

const [cmd, arg] = process.argv.slice(2);
const key = process.env.STRIPE_SECRET_KEY || '';
const needTestKey = () => {
  if (!/^(sk|rk)_test_[A-Za-z0-9]{10,}$/.test(key)) {
    console.error(/_live_/.test(key) ? 'REFUSED: this is a LIVE key. This script works with test keys (sk_test_…) only.' : 'STRIPE_SECRET_KEY must be a test key (sk_test_… or rk_test_…).');
    process.exit(2);
  }
};
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

if (cmd === 'check') {
  needTestKey();
  const r = await fetch('https://api.stripe.com/v1/balance', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) }).catch((e) => fail(`cannot reach Stripe: ${e.cause?.code || e.message}`));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) fail(`Stripe answered ${r.status}: ${j.error?.message || 'error'}`);
  if (j.livemode !== false) fail('the account reports livemode=true: stop and check the key');
  console.log('OK: test-mode credentials are valid (livemode=false).');
} else if (cmd === 'session') {
  needTestKey();
  const p = products.find((x) => x.sku === (arg && arg !== 'bundle' ? arg : 'parent-guides-bundle'));
  if (!p) fail('unknown product');
  const order = { id: `test-${Date.now().toString(36)}`, email: 'test-buyer@example.com' };
  const lines = [{ sku: p.sku, qty: 1, unitCents: p.prices.EUR, currency: 'EUR', titles: p.i18n }];
  const s = await createCheckoutSession({ secretKey: key, order, lines, locale: 'en', successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel', idempotencyKey: `test-${order.id}` }).catch((e) => fail(e.message));
  console.log(`OK: test Checkout Session ${s.id}\nOpen: ${s.url}\nPay with the test card 4242 4242 4242 4242 (any future date, any CVC).`);
  console.log('NOTE: this session has no matching order in your database, so a webhook for it is ignored by the API. Use the real checkout flow for an end-to-end test.');
} else if (cmd === 'endpoint') {
  if (!/^https:\/\//.test(arg || '')) fail('give the https:// address of the API');
  const body = JSON.stringify({ id: 'evt_probe', type: 'checkout.session.completed', data: { object: {} } });
  const r = await fetch(`${arg.replace(/\/$/, '')}/api/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=00' }, body }).catch((e) => fail(`cannot reach the endpoint: ${e.cause?.code || e.message}`));
  if (r.status !== 400) fail(`expected 400 (bad signature) but got ${r.status}: the endpoint does not verify signatures or is misrouted`);
  const h = await fetch(`${arg.replace(/\/$/, '')}/api/health`).then((x) => x.json()).catch(() => ({}));
  console.log(`OK: endpoint rejects an unsigned event (400). Health: ${JSON.stringify(h)}`);
} else {
  console.error('Usage: stripe-test.mjs check | session [bundle|sku] | endpoint https://api.your-domain');
  process.exit(1);
}
