#!/usr/bin/env node
// Revolut SANDBOX check. Creates one sandbox order (no money moves) and reads it back.
// Refuses to run unless REVOLUT_ENV is sandbox (the default). Needs REVOLUT_SANDBOX_API_KEY in the environment.
// Usage: REVOLUT_SANDBOX_API_KEY=... node scripts/revolut-test.mjs check
import { randomBytes } from 'node:crypto';
import { createRevolutOrder, getRevolutOrder } from '../server/revolut.mjs';

const [cmd] = process.argv.slice(2);
const env = process.env.REVOLUT_ENV || 'sandbox';
const key = process.env.REVOLUT_SANDBOX_API_KEY || '';
if (env !== 'sandbox') { console.error('REFUSED: this script works only with the sandbox environment.'); process.exit(2); }
if (cmd !== 'check') { console.error('Usage: revolut-test.mjs check'); process.exit(1); }
if (!key) { console.error('REVOLUT_SANDBOX_API_KEY is not set.'); process.exit(1); }
const reference = `sandbox-${randomBytes(6).toString('hex')}`;
try {
  const o = await createRevolutOrder({ env: 'sandbox', apiKey: key, amountCents: 990, currency: 'EUR', description: 'Sandbox check', reference, email: 'sandbox-check@example.com', redirectUrl: 'https://example.com/return' });
  const back = await getRevolutOrder({ env: 'sandbox', apiKey: key, id: o.id });
  if (back.merchant_order_data?.reference !== reference || Number(back.amount) !== 990) { console.error('FAIL: the order read back does not match what was created'); process.exit(1); }
  console.log(`OK: sandbox order ${o.id} created (state ${o.state}), amount 9.90 EUR, reference matches.`);
  console.log(`Open ${o.checkoutUrl} and pay with a sandbox test card to test the full flow. No real money moves in sandbox.`);
} catch (e) {
  console.error(`FAIL: ${e.code || e.message}`); process.exit(1);
}
