// Static and behavioural checks of the deployment package (no Docker daemon is needed or used).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { openDb } from '../server/db.mjs';

const read = (f) => readFileSync(f, 'utf8');
const run = (file, args, env) => new Promise((resolve) => {
  const c = spawn(process.execPath, [file, ...args], { env: { PATH: process.env.PATH, ...env } }); let out = '', err = '';
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (err += d)); c.on('close', (status) => resolve({ status, stdout: out, stderr: err }));
});

test('Dockerfile: non-root user, health check, no secrets or state copied into the image', () => {
  const d = read('deploy/Dockerfile');
  assert.match(d, /^USER node$/m);
  assert.match(d, /HEALTHCHECK/);
  assert.match(d, /NODE_ENV=production/);
  assert.equal(/COPY[^\n]*(\.env|private|data|dist)\b/.test(d.replace(/COPY scripts[^\n]*/g, '').replace(/chown[^\n]*data/g, '')), false);
  assert.equal(/COPY \. /.test(d), false, 'never copy the whole repository');
});

test('.dockerignore keeps secrets, data and PDFs out of the build context', () => {
  const ig = read('.dockerignore').split('\n');
  for (const x of ['.env', 'data', 'private', '.git', 'exports']) assert.ok(ig.includes(x), x);
});

test('compose: read-only API, dropped capabilities, no-new-privileges, PDFs mounted read-only, secrets only from .env', () => {
  const c = read('deploy/docker-compose.yml');
  assert.match(c, /read_only: true/);
  assert.match(c, /cap_drop: \[ALL\]/);
  assert.match(c, /no-new-privileges:true/);
  assert.match(c, /\/app\/private\/products:ro/);
  assert.match(c, /env_file: \.\.\/\.env/);
  assert.equal(/(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|PASSPHRASE:\s*\S/.test(c), false, 'no secrets in the compose file');
  assert.match(c, /ports: \["80:80", "443:443"\]/);
  assert.equal(/ports:[^\n]*8080/.test(c), false, 'the API port is not published to the internet');
  assert.match(c, /command: \["sh", "-c", "while true; do node scripts\/backup\.mjs/);
});

test('Caddyfile: HTTPS domain from env, request size limit, HSTS, no server banner', () => {
  const c = read('deploy/Caddyfile');
  assert.match(c, /\{\$API_DOMAIN\}/);
  assert.match(c, /max_size 100KB/);
  assert.match(c, /Strict-Transport-Security/);
  assert.match(c, /-Server/);
  assert.match(c, /reverse_proxy api:8080/);
});

test('cloud-init: firewall allows only 22/80/443, key-only SSH, no secrets, placeholder key must be replaced', () => {
  const c = read('deploy/cloud-init.yaml');
  assert.match(c, /ufw allow 22\/tcp/); assert.match(c, /ufw allow 80\/tcp/); assert.match(c, /ufw allow 443\/tcp/);
  assert.match(c, /default deny incoming/);
  assert.match(c, /PasswordAuthentication no/);
  assert.match(c, /PermitRootLogin no/);
  assert.match(c, /REPLACE_WITH_YOUR_PUBLIC_KEY/);
  assert.equal(/(sk|rk)_(live|test)_|whsec_|BEGIN [A-Z ]*PRIVATE KEY/.test(c), false);
});

test('deploy.sh: strict mode, refuses a world-readable .env, validates config before switching, rolls back on failure', () => {
  const s = read('deploy/deploy.sh');
  assert.match(s, /set -euo pipefail/);
  assert.match(s, /stat -c %a \.env.*600/);
  assert.ok(s.indexOf('check-env.mjs') < s.indexOf('up -d --build'), 'configuration is validated before the new version is started');
  assert.match(s, /Rolling back/);
  assert.equal(spawnSync('bash', ['-n', 'deploy/deploy.sh']).status, 0);
  assert.ok(statSync('deploy/deploy.sh').mode & 0o111, 'executable');
});

test('GitHub deploy workflow is manual-only, gated by a variable and an environment, and has no expression injection', () => {
  const y = read('.github/workflows/deploy.yml');
  assert.match(y, /workflow_dispatch:/);
  assert.equal(/^\s*(push|pull_request|schedule):/m.test(y), false, 'must never run automatically');
  assert.match(y, /vars\.DEPLOY_ENABLED == 'true'/);
  assert.match(y, /environment: production/);
  const runs = [...y.matchAll(/run: \|\n((?:          .*\n)+)/g)].map((m) => m[1]);
  assert.ok(runs.length >= 3);
  for (const r of runs) assert.equal(/\$\{\{/.test(r), false, 'values reach shell only via env');
});

test('CI workflow does not deploy', () => {
  const y = read('.github/workflows/ci.yml');
  assert.equal(/ssh |docker push|deploy\.sh/.test(y), false);
});

test('check-env: accepts a complete production environment and refuses unsafe ones', async () => {
  const ok = { NODE_ENV: 'production', SITE_URL: 'https://api.aina.test', IP_SALT: 'y'.repeat(32), TRUST_PROXY: 'true', OWNER_CHANNEL: 'smtp', CLIENT_CHANNEL: 'smtp', SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'orders@aina.test' };
  const good = await run('scripts/check-env.mjs', [], ok);
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /Payments: off/);
  const bad = await run('scripts/check-env.mjs', [], { ...ok, IP_SALT: 'weak', PAYMENTS_ENABLED: 'true' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /IP_SALT/); assert.match(bad.stderr, /STRIPE_SECRET_KEY/);
});

test('verify-files reports missing and non-PDF files and prints checksums for real ones', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aina-vf-'));
  const none = await run('scripts/verify-files.mjs', [dir], {});
  assert.equal(none.status, 1);
  assert.equal((none.stdout.match(/MISSING/g) || []).length, 3);
  writeFileSync(join(dir, 'cow-milk-protein-allergy-guide.pdf'), '%PDF-1.7 ok');
  writeFileSync(join(dir, 'complementary-feeding-guide.pdf'), 'not a pdf');
  const mix = await run('scripts/verify-files.mjs', [dir], {});
  assert.match(mix.stdout, /ok\s+cow-milk-protein-allergy-guide\.pdf.*sha256 [0-9a-f]{64}/);
  assert.match(mix.stdout, /NOT A PDF complementary-feeding-guide\.pdf/);
  for (const f of ['complementary-feeding-guide', 'child-sleep-guide-0-18']) writeFileSync(join(dir, `${f}.pdf`), '%PDF-1.7 ok');
  const all = await run('scripts/verify-files.mjs', [dir], {});
  assert.equal(all.status, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('backup monitoring: a good backup pings the URL, a failed one pings /fail', async () => {
  const hits = [];
  const srv = createServer((req, res) => { hits.push(req.url); res.end('ok'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/check-abc`;
  const dir = mkdtempSync(join(tmpdir(), 'aina-ping-'));
  openDb(join(dir, 'app.db')).close();
  const env = { DB_FILE: join(dir, 'app.db'), BACKUP_DIR: join(dir, 'b'), BACKUP_PASSPHRASE: 'a long enough passphrase 123', BACKUP_PING_URL: url };
  assert.equal((await run('scripts/backup.mjs', [], env)).status, 0);
  assert.deepEqual(hits, ['/check-abc']);
  const failed = await run('scripts/backup.mjs', [], { ...env, BACKUP_PASSPHRASE: 'short' });
  assert.equal(failed.status, 1);
  assert.deepEqual(hits, ['/check-abc', '/check-abc/fail']);
  srv.close(); rmSync(dir, { recursive: true, force: true });
});

test('the API container serves no static site: the public site lives in Tilda', async () => {
  const d = read('deploy/Dockerfile');
  assert.equal(/COPY (site|dist|src\/content)/.test(d), false);
});
