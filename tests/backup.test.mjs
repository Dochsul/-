// Backup, encryption, restore, retention, off-site storage and a full disaster-recovery drill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';

// Async spawn: the fake S3 server lives in this process, so the event loop must stay free (spawnSync would deadlock).
const run = (args, env) => new Promise((resolve) => {
  const c = spawn(process.execPath, args, { env }); let out = '', err = '';
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (err += d));
  c.on('close', (status) => resolve({ status, stdout: out, stderr: err }));
});
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../server/db.mjs';
import { createApp } from '../server/app.mjs';
import { createTransports } from '../server/outbox.mjs';
import { loadConfig } from '../server/config.mjs';
import { createBackup, restoreBackup, encrypt, decrypt, verifyDatabase, pruneBackups, backupName } from '../server/backup.mjs';
import { s3Client, signV4 } from '../server/s3.mjs';

const PASS = 'correct horse battery staple 2026';
const tmp = () => mkdtempSync(join(tmpdir(), 'aina-bkt-'));
const sha = (s) => createHash('sha256').update(s).digest('hex');

function seed(db) {
  const t = new Date().toISOString();
  db.prepare("INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, terms_accepted_at, digital_waiver_at) VALUES ('o1', ?, ?, 'fr', 'b@example.com', ?, 1990, 'EUR', 'paid', 'stripe', ?, ?)").run(t, t, JSON.stringify([{ sku: 'g1', files: ['g1'] }]), t, t);
  db.prepare("INSERT INTO payments (order_id, provider, provider_payment_id, amount_cents, currency, fee_cents, status, created_at) VALUES ('o1', 'stripe', 'pi_1', 1990, 'EUR', 55, 'succeeded', ?)").run(t);
  db.prepare("INSERT INTO leads (id, created_at, locale, name, email, topic, consent_at) VALUES ('l1', ?, 'ru', 'Анна', 'a@example.com', 'general', ?)").run(t, t);
}

test('encryption round-trip; wrong passphrase, tampering and non-backup files are rejected', () => {
  const blob = encrypt(Buffer.from('secret data'), PASS);
  assert.equal(decrypt(blob, PASS).toString(), 'secret data');
  assert.equal(blob.includes(Buffer.from('secret data')), false, 'plaintext must not appear in the file');
  assert.throws(() => decrypt(blob, PASS + 'x'), /wrong_passphrase_or_corrupted_backup/);
  const tampered = Buffer.from(blob); tampered[tampered.length - 5] ^= 0xff;
  assert.throws(() => decrypt(tampered, PASS), /wrong_passphrase_or_corrupted_backup/);
  assert.throws(() => decrypt(Buffer.from('hello world, definitely not a backup file at all'), PASS), /not_a_backup_file/);
  assert.throws(() => encrypt(Buffer.from('x'), 'short'), /at least 20 characters/);
  assert.notDeepEqual(encrypt(Buffer.from('same'), PASS), encrypt(Buffer.from('same'), PASS), 'fresh salt and iv every time');
});

test('backup of a live database is consistent and verified; restore reproduces every row', async () => {
  const dir = tmp(); const file = join(dir, 'app.db');
  const db = openDb(file); seed(db);
  const { blob, counts } = await createBackup(db, PASS);
  assert.deepEqual({ o: counts.orders, p: counts.payments, l: counts.leads }, { o: 1, p: 1, l: 1 });
  db.prepare("INSERT INTO leads (id, created_at, locale, name, email, topic, consent_at) VALUES ('l2', 'x', 'en', 'Later', 'l@example.com', 'general', 'x')").run(); // written after the snapshot
  db.close();
  const target = join(dir, 'restored.db');
  const r = restoreBackup(blob, PASS, target);
  assert.equal(r.previous, null);
  const re = new DatabaseSync(target);
  assert.equal(re.prepare('SELECT COUNT(*) n FROM leads').get().n, 1, 'restore equals the snapshot, not later writes');
  assert.equal(re.prepare("SELECT fee_cents FROM payments WHERE order_id = 'o1'").get().fee_cents, 55);
  re.close(); rmSync(dir, { recursive: true, force: true });
});

test('restore never overwrites silently: it needs force and keeps the previous database', async () => {
  const dir = tmp(); const file = join(dir, 'app.db');
  const db = openDb(file); seed(db);
  const { blob } = await createBackup(db, PASS); db.close();
  assert.throws(() => restoreBackup(blob, PASS, file), /target_exists/);
  const r = restoreBackup(blob, PASS, file, { force: true });
  assert.ok(r.previous && existsSync(r.previous), 'previous database is kept');
  assert.equal(verifyDatabase(file).counts.orders, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('a backup that decrypts but is not a healthy database is refused and installs nothing', () => {
  const dir = tmp(); const target = join(dir, 'app.db');
  assert.throws(() => restoreBackup(encrypt(Buffer.from('not a sqlite file, just text bytes'), PASS), PASS, target));
  assert.equal(existsSync(target), false);
  const empty = join(dir, 'empty.db'); new DatabaseSync(empty).close();
  assert.throws(() => restoreBackup(encrypt(readFileSync(empty), PASS), PASS, target), /missing_tables/);
  assert.equal(existsSync(target), false);
  rmSync(dir, { recursive: true, force: true });
});

test('retention keeps the newest 14 daily backups and one per week for 8 weeks, removes the rest', () => {
  const dir = tmp();
  const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000);
  for (let n = 0; n < 120; n++) writeFileSync(join(dir, backupName(day(n))), 'x');
  const r = pruneBackups(dir);
  const left = readdirSync(dir);
  assert.ok(left.length <= 14 + 8 && left.length >= 14);
  for (let n = 106; n < 120; n++) assert.ok(left.includes(backupName(day(n))), `day ${n} is kept`);
  assert.ok(!left.includes(backupName(day(0))), 'old daily backup is removed');
  assert.equal(r.removed.length + left.length, 120);
  rmSync(dir, { recursive: true, force: true });
});

test('SigV4 signing agrees with the official AWS example', () => {
  const ph = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const r = signV4({ method: 'GET', path: '/test.txt', headers: { host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9', 'x-amz-content-sha256': ph, 'x-amz-date': '20130524T000000Z' }, payloadHash: ph, region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', amzDate: '20130524T000000Z' });
  assert.equal(r.signature, 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
});

// A tiny S3-compatible server that verifies the SigV4 signature of every request with the secret it knows.
function fakeS3({ accessKeyId, secretAccessKey, region }) {
  const store = new Map(); const log = [];
  const server = createServer((req, res) => {
    const chunks = []; req.on('data', (c) => chunks.push(c)).on('end', () => {
      const body = Buffer.concat(chunks); const url = new URL(req.url, 'http://x');
      const auth = req.headers.authorization || '';
      const signedHeaders = auth.match(/SignedHeaders=([^,]+)/)?.[1].split(';') || [];
      const headers = Object.fromEntries(signedHeaders.map((h) => [h, req.headers[h]]));
      const query = Object.fromEntries(url.searchParams.entries());
      const expect = signV4({ method: req.method, path: decodeURIComponent(url.pathname), query, headers, payloadHash: sha(body), region, accessKeyId, secretAccessKey, amzDate: req.headers['x-amz-date'] });
      if (req.headers['x-amz-content-sha256'] !== sha(body) || auth !== expect.authorization) { log.push('DENIED'); res.writeHead(403); return res.end(); }
      const key = decodeURIComponent(url.pathname).split('/').slice(2).join('/');
      if (req.method === 'PUT') { store.set(key, body); log.push(`PUT ${key}`); res.writeHead(200); return res.end(); }
      if (req.method === 'GET' && key) { if (!store.has(key)) { res.writeHead(404); return res.end(); } res.writeHead(200); return res.end(store.get(key)); }
      if (req.method === 'GET') { const p = query.prefix || ''; res.writeHead(200); return res.end(`<ListBucketResult>${[...store.keys()].filter((k) => k.startsWith(p)).map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}</ListBucketResult>`); }
      res.writeHead(405); res.end();
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, store, log, endpoint: `http://127.0.0.1:${server.address().port}` })));
}
const creds = { accessKeyId: 'AKIATESTTESTTEST', secretAccessKey: 'secret/test+KEY', region: 'eu-central-003' };

test('off-site storage: signed upload, list and download work; wrong secret is denied', async () => {
  const s = await fakeS3(creds);
  const c = s3Client({ endpoint: s.endpoint, bucket: 'bk', ...creds });
  await c.put('backups/aina-1.enc', Buffer.from('payload'));
  assert.deepEqual(await c.list('backups/'), ['backups/aina-1.enc']);
  assert.equal((await c.get('backups/aina-1.enc')).toString(), 'payload');
  const bad = s3Client({ endpoint: s.endpoint, bucket: 'bk', ...creds, secretAccessKey: 'wrong' });
  await assert.rejects(bad.put('backups/x', Buffer.from('x')), /s3_put_403/);
  assert.throws(() => s3Client({ endpoint: 'http://remote.example.com', bucket: 'b', ...creds }), /must_be_https/);
  s.server.close();
});

test('DISASTER RECOVERY DRILL: orders exist, the database is lost, the backup is restored from off-site storage, a bought link works again', async () => {
  const dir = tmp(); const priv = join(dir, 'private'); mkdirSync(priv); mkdirSync(join(dir, 'dist'));
  writeFileSync(join(priv, 'g1.pdf'), '%PDF-drill');
  const file = join(dir, 'app.db'); const db = openDb(file);
  const i18n = { ru: { title: 'T', summary: 's', topics: [] }, fr: { title: 'T', summary: 's', topics: [] }, en: { title: 'T', summary: 's', topics: [] } };
  const token = randomBytes(32).toString('base64url');
  const t = new Date().toISOString();
  db.prepare("INSERT INTO orders (id, created_at, updated_at, locale, email, items_json, amount_cents, currency, status, provider, terms_accepted_at, digital_waiver_at) VALUES ('o9', ?, ?, 'en', 'x@example.com', '[]', 990, 'EUR', 'paid', 'stripe', ?, ?)").run(t, t, t, t);
  db.prepare("INSERT INTO downloads (token_hash, order_id, sku, created_at, expires_at, max_downloads) VALUES (?, 'o9', 'g1', ?, ?, 5)").run(sha(token), t, new Date(Date.now() + 86400000).toISOString());
  const s3 = await fakeS3(creds);
  const env = { ...process.env, DB_FILE: file, BACKUP_DIR: join(dir, 'bk'), BACKUP_PASSPHRASE: PASS, S3_ENDPOINT: s3.endpoint, S3_REGION: creds.region, S3_BUCKET: 'bk', S3_ACCESS_KEY_ID: creds.accessKeyId, S3_SECRET_ACCESS_KEY: creds.secretAccessKey };

  const b = await run(['scripts/backup.mjs'], env);
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, /off-site ok and verified/);
  assert.equal(s3.store.size, 1);
  db.close();

  rmSync(file, { force: true }); rmSync(file + '-wal', { force: true }); rmSync(file + '-shm', { force: true }); rmSync(join(dir, 'bk'), { recursive: true, force: true }); // disaster: database and local backups lost
  assert.equal(existsSync(file), false);

  const v = await run(['scripts/restore.mjs', 's3-latest', '--verify-only'], env);
  assert.equal(v.status, 0, v.stderr); assert.match(v.stdout, /verified/);
  const bad = await run(['scripts/restore.mjs', 's3-latest'], { ...env, BACKUP_PASSPHRASE: 'wrong passphrase wrong passphrase' });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /wrong_passphrase_or_corrupted_backup/);
  assert.equal(existsSync(file), false, 'a failed restore installs nothing');
  const r = await run(['scripts/restore.mjs', 's3-latest'], env);
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /restored/);

  const db2 = openDb(file);
  const config = { ...loadConfig({}), siteUrl: 'http://localhost', dataDir: dir, privateDir: priv, distDir: join(dir, 'dist'), catalog: [{ sku: 'g1', prices: { EUR: 990 }, priceConfirmed: true, published: true, contentConfirmed: true, files: ['g1'], i18n }], fileSkus: ['g1'] };
  const server = createServer(createApp({ config, db: db2, transports: createTransports({ dataDir: dir, telegram: {} }) }));
  await new Promise((rr) => server.listen(0, '127.0.0.1', rr));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/download/${token}`);
  assert.equal(res.status, 200, 'the link bought before the disaster works after recovery');
  assert.equal(await res.text(), '%PDF-drill');
  server.close(); db2.close(); s3.server.close(); rmSync(dir, { recursive: true, force: true });
});

test('backup script fails loudly when the passphrase is weak or the database is missing', () => {
  const dir = tmp();
  const weak = spawnSync(process.execPath, ['scripts/backup.mjs'], { env: { ...process.env, DB_FILE: join(dir, 'x.db'), BACKUP_PASSPHRASE: 'short' }, encoding: 'utf8' });
  assert.notEqual(weak.status, 0);
  openDb(join(dir, 'ok.db')).close();
  const w2 = spawnSync(process.execPath, ['scripts/backup.mjs'], { env: { ...process.env, DB_FILE: join(dir, 'ok.db'), BACKUP_DIR: join(dir, 'b'), BACKUP_PASSPHRASE: 'short' }, encoding: 'utf8' });
  assert.notEqual(w2.status, 0);
  assert.match(w2.stderr, /at least 20 characters/);
  rmSync(dir, { recursive: true, force: true });
});
