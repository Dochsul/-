// Payment switches on the server need typed confirmations and never weaken the production guard. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'deploy/payments-switch.sh');
const KEY = 'rv-sandbox-key-example-1';
const WSK = 'wsk_example_signing_secret_1';

function setup(extra = '') {
  const dir = mkdtempSync(join(tmpdir(), 'pay-switch-'));
  const file = join(dir, '.env');
  writeFileSync(file, [
    'SITE_URL=https://api.example.test', 'PAYMENTS_ENABLED=false', 'REVOLUT_ENV=sandbox',
    `REVOLUT_API_KEY=${extra.includes('nokey') ? '' : KEY}`, `REVOLUT_WEBHOOK_SECRET=${extra.includes('nowsk') ? '' : WSK}`,
    'LIVE_PAYMENTS_APPROVED=', 'OWNER_EMAIL=', '',
  ].join('\n'));
  return { dir, file };
}

function run(args, file, input = '') {
  return spawnSync('bash', [SCRIPT, ...args], {
    input, encoding: 'utf8', env: { ...process.env, AINA_ENV_FILE: file, AINA_PAYMENTS_TEST: '1' },
  });
}

test('status prints switches without printing key values', () => {
  const { dir, file } = setup();
  try {
    const r = run(['status'], file);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /PAYMENTS_ENABLED=false/);
    assert.match(r.stderr, /REVOLUT_API_KEY: задан/);
    assert.ok(!r.stderr.includes(KEY) && !r.stdout.includes(KEY), 'the key value is never printed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('sandbox-on refuses without keys, and enables sandbox when keys exist', () => {
  const none = setup('nokey');
  try {
    const r = run(['sandbox-on'], none.file);
    assert.notEqual(r.status, 0);
    assert.match(readFileSync(none.file, 'utf8'), /PAYMENTS_ENABLED=false/, 'nothing changed');
  } finally { rmSync(none.dir, { recursive: true, force: true }); }
  const ok = setup();
  try {
    const r = run(['sandbox-on'], ok.file);
    assert.equal(r.status, 0, r.stderr);
    const env = readFileSync(ok.file, 'utf8');
    assert.match(env, /PAYMENTS_ENABLED=true/);
    assert.match(env, /REVOLUT_ENV=sandbox/);
    assert.match(env, new RegExp(`REVOLUT_API_KEY=${KEY}`), 'other settings are kept');
  } finally { rmSync(ok.dir, { recursive: true, force: true }); }
});

test('production-on needs both typed phrases; a wrong or missing phrase changes nothing', () => {
  const { dir, file } = setup();
  try {
    assert.notEqual(run(['production-on'], file, 'merchant-approved\nwrong\n').status, 0);
    assert.notEqual(run(['production-on'], file, 'wrong\n').status, 0);
    const env = readFileSync(file, 'utf8');
    assert.match(env, /REVOLUT_ENV=sandbox/);
    assert.match(env, /PAYMENTS_ENABLED=false/);
    assert.match(env, /LIVE_PAYMENTS_APPROVED=$/m);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('production-on with both phrases sets the production switches; off turns payments back off', () => {
  const { dir, file } = setup();
  try {
    const on = run(['production-on'], file, 'merchant-approved\nowner-approved\n');
    assert.equal(on.status, 0, on.stderr);
    let env = readFileSync(file, 'utf8');
    assert.match(env, /REVOLUT_ENV=production/);
    assert.match(env, /LIVE_PAYMENTS_APPROVED=owner-approved/);
    assert.match(env, /PAYMENTS_ENABLED=true/);
    const off = run(['off'], file);
    assert.equal(off.status, 0, off.stderr);
    env = readFileSync(file, 'utf8');
    assert.match(env, /PAYMENTS_ENABLED=false/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
