// The launch guide must name only settings the code really reads. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAUNCH = ['docs/LAUNCH.md'];
// Variables that the owner must put into the server's .env (secrets are entered by the owner only).
const SETTINGS = [
  'PAYMENTS_ENABLED', 'LIVE_PAYMENTS_APPROVED', 'REVOLUT_ENV', 'REVOLUT_API_KEY', 'REVOLUT_WEBHOOK_SECRET',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_FROM_NAME',
  'OWNER_CHANNEL', 'CLIENT_CHANNEL', 'BACKUP_PASSPHRASE', 'BACKUP_PING_URL',
  'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
  'ADMIN_PASSWORD_HASH', 'IP_SALT', 'TRUST_PROXY', 'SITE_URL', 'API_DOMAIN',
];

function sourceText(dirs) {
  let out = '';
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p); }
      else if (/\.(mjs|js|cjs|yml|yaml|sh|Caddyfile)$|Caddyfile$/.test(f)) out += readFileSync(p, 'utf8') + '\n';
    }
  };
  for (const d of dirs) walk(join(ROOT, d));
  return out;
}

test('every setting named in the launch guide is read by the code or the deployment files', () => {
  const doc = LAUNCH.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  const code = sourceText(['server', 'scripts', 'deploy', 'src/config']);
  for (const name of SETTINGS) {
    assert.ok(doc.includes(name), `${name} is described in docs/LAUNCH.md`);
    assert.ok(code.includes(name), `${name} is read somewhere in the code or deploy files`);
  }
});

test('the launch guide never contains a value that looks like a real secret', () => {
  const doc = readFileSync(join(ROOT, 'docs/LAUNCH.md'), 'utf8');
  assert.doesNotMatch(doc, /wsk_[A-Za-z0-9]{10,}/);
  assert.doesNotMatch(doc, /sk_(test|live)_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(doc, /\b940094709\b/, 'the SIREN must not be published in the repository');
});
