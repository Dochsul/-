import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const run = (args, key) => spawnSync(process.execPath, ['scripts/stripe-test.mjs', ...args], { encoding: 'utf8', timeout: 20000, env: { PATH: process.env.PATH, ...(key ? { STRIPE_SECRET_KEY: key } : {}) } });

test('the Stripe test script refuses LIVE keys before sending any request', () => {
  for (const cmd of ['check', 'session']) {
    const r = run([cmd], 'sk_live_' + 'a'.repeat(24));
    assert.equal(r.status, 2, cmd);
    assert.match(r.stderr, /REFUSED: this is a LIVE key/);
  }
  assert.equal(run(['check'], 'rk_live_' + 'a'.repeat(24)).status, 2);
});

test('the Stripe test script refuses a missing or malformed key', () => {
  assert.equal(run(['check']).status, 2);
  assert.equal(run(['session'], 'nonsense').status, 2);
});

test('the endpoint check requires an https address and prints usage for unknown commands', () => {
  assert.equal(run(['endpoint', 'http://api.example.com']).status, 1);
  const u = run(['bogus']);
  assert.equal(u.status, 1);
  assert.match(u.stderr, /Usage/);
});
