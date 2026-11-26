// The server setup script writes a correct, private .env and never prints secrets. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'deploy/setup-server.sh');
const SECRETS = ['smtp-secret-key-1', 'backup passphrase long 2026', 'admin password 2026!'];

test('the setup script is valid bash', () => {
  execFileSync('bash', ['-n', SCRIPT]);
});

test('the setup script contains no personal email address and no secret literal', () => {
  const body = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(body, /globalainanutrition@/);
  for (const s of SECRETS) assert.ok(!body.includes(s));
});

test('answers produce a private .env with a verifiable admin hash and no test-only settings', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-test-'));
  try {
    const envFile = join(dir, '.env');
    const answers = [
      'api.example.test',                 // 1 domain
      'https://site.example.test',        // 2 Tilda origin
      'owner@example.test',               // 3 owner mail
      '',                                 // 4 SMTP host -> default
      '',                                 // 5 SMTP port -> default
      'smtp-login-example',               // 6 SMTP login
      'smtp-secret-key-1',                // 7 SMTP key (hidden)
      'orders@example.test',              // 8 MAIL_FROM
      '',                                 // 9 REVOLUT_ENV -> sandbox
      '',                                 // 10 Revolut API key -> skipped
      'backup passphrase long 2026',      // 11 backup passphrase
      'backup passphrase long 2026',      // 11 repeat
      '',                                 // 12 S3 -> skipped
      '',                                 // 13 ping URL -> skipped
      'admin password 2026!',             // 14 admin password
      'admin password 2026!',             // 14 repeat
      '',                                 // 15 success URL -> default
      '',                                 // 16 cancel URL -> default
    ].join('\n') + '\n';
    const r = spawnSync('bash', [SCRIPT], {
      input: answers,
      env: { ...process.env, AINA_SETUP_TEST: '1', AINA_ROOT: dir, AINA_ENV_FILE: envFile, AINA_ADMIN_MODULE: join(ROOT, 'server/admin.mjs') },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    for (const s of SECRETS) assert.ok(!r.stdout.includes(s) && !r.stderr.includes(s), 'a secret was printed');

    assert.equal(statSync(envFile).mode & 0o777, 0o600, '.env must be readable by the owner only');
    const env = Object.fromEntries(readFileSync(envFile, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }));
    assert.match(env.IP_SALT, /^[0-9a-f]{64}$/);
    assert.equal(env.PAYMENTS_ENABLED, 'false', 'payments stay off until the owner decides');
    assert.equal(env.REVOLUT_ENV, 'sandbox');
    assert.equal(env.SITE_URL, 'https://api.example.test');
    assert.equal(env.ALLOWED_ORIGINS, 'https://site.example.test');
    assert.equal(env.CHECKOUT_SUCCESS_URL, 'https://site.example.test/{locale}/merci/');
    assert.equal(env.CHECKOUT_CANCEL_URL, 'https://site.example.test/{locale}/shop/');
    assert.equal(env.SMTP_HOST, 'smtp-relay.brevo.com');
    assert.equal(env.OWNER_CHANNEL, 'smtp');
    assert.equal(env.CLIENT_CHANNEL, 'smtp');
    assert.ok(!('REGISTRATION_FILE' in env), 'REGISTRATION_FILE is a test-only setting and must not be in the server .env');
    assert.ok(!('LIVE_PAYMENTS_APPROVED' in env) || env.LIVE_PAYMENTS_APPROVED === '');

    // The stored hash must be a real scrypt hash of the password that was typed.
    const admin = await import(pathToFileURL(join(ROOT, 'server/admin.mjs')).href);
    assert.match(env.ADMIN_PASSWORD_HASH, /^scrypt:/);
    assert.equal(await admin.verifyPassword('admin password 2026!', env.ADMIN_PASSWORD_HASH), true);
    assert.equal(await admin.verifyPassword('wrong', env.ADMIN_PASSWORD_HASH), false);

    // Docker Compose would read '$' as a variable: no dollar signs in any value.
    for (const [k, v] of Object.entries(env)) assert.ok(!v.includes('$'), `${k} must not contain $`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a passphrase that does not match its repeat is refused, and nothing is written', () => {
  const dir = mkdtempSync(join(tmpdir(), 'setup-test-'));
  try {
    const envFile = join(dir, '.env');
    const answers = ['api.example.test', 'https://site.example.test', 'owner@example.test', '', '', 'login', 'smtp-secret-key-1', 'orders@example.test', '', '',
      'backup passphrase long 2026', 'different passphrase 2026', '', '', 'admin password 2026!', 'admin password 2026!', '', ''];
    const r = spawnSync('bash', [SCRIPT], {
      input: answers.join('\n') + '\n',
      env: { ...process.env, AINA_SETUP_TEST: '1', AINA_ROOT: dir, AINA_ENV_FILE: envFile, AINA_ADMIN_MODULE: join(ROOT, 'server/admin.mjs') },
      encoding: 'utf8',
    });
    // The script re-asks; with the input exhausted it stops cleanly without writing a file.
    assert.notEqual(r.status, 0);
    assert.throws(() => statSync(envFile));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
