// SMTP client and email delivery tests against a real (fake) SMTP server on loopback.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sendSmtp, buildMessage, dotStuff, encodeHeader, checkAddress, SmtpError } from '../server/smtp.mjs';
import { deliveryEmail } from '../server/emails.mjs';
import { openDb } from '../server/db.mjs';
import { createTransports, processOutbox, enqueue } from '../server/outbox.mjs';

// A small SMTP server: records what it receives. Options simulate failures.
function fakeServer({ secureContext = null, requireAuth = null, rejectRcpt = false, dropAfterData = false, offerStartTls = false } = {}) {
  const received = [];
  const handler = (sock) => {
    let state = 'cmd', buf = '', data = '', mail = { from: null, to: [], auth: null };
    const w = (l) => sock.write(l + '\r\n');
    w('220 fake.test ESMTP');
    sock.setEncoding('utf8');
    sock.on('error', () => {});
    sock.on('data', (d) => {
      buf += d;
      for (;;) {
        if (state === 'data') {
          const end = buf.indexOf('\r\n.\r\n');
          if (end === -1) return;
          data = buf.slice(0, end); buf = buf.slice(end + 5);
          if (dropAfterData) return sock.destroy();
          received.push({ ...mail, data: data.replace(/^\.\./gm, '.') });
          w('250 2.0.0 queued'); state = 'cmd'; continue;
        }
        const i = buf.indexOf('\r\n'); if (i === -1) return;
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        const [cmd] = line.split(' ');
        if (state === 'auth-user') { mail.auth = { user: Buffer.from(line, 'base64').toString() }; state = 'auth-pass'; w('334 UGFzc3dvcmQ6'); continue; }
        if (state === 'auth-pass') { const p = Buffer.from(line, 'base64').toString(); state = 'cmd'; if (p === requireAuth.pass) w('235 ok'); else w('535 bad credentials'); continue; }
        if (cmd === 'EHLO') { sock.write(`250-fake.test\r\n${offerStartTls && !sock.encrypted ? '250-STARTTLS\r\n' : ''}250-SIZE 10485760\r\n${requireAuth ? '250-AUTH PLAIN LOGIN\r\n' : ''}250 8BITMIME\r\n`); }
        else if (cmd === 'AUTH') {
          const [, mech, cred] = line.split(' ');
          if (mech === 'PLAIN') { const [, u, p] = Buffer.from(cred, 'base64').toString().split('\0'); if (u === requireAuth.user && p === requireAuth.pass) { mail.auth = { user: u }; w('235 ok'); } else w('535 bad credentials'); }
          else { state = 'auth-user'; w('334 VXNlcm5hbWU6'); }
        }
        else if (cmd === 'MAIL') { if (requireAuth && !mail.auth) w('530 auth required'); else { mail.from = line.match(/<(.*)>/)[1]; w('250 ok'); } }
        else if (cmd === 'RCPT') { if (rejectRcpt) w('550 no such user'); else { mail.to.push(line.match(/<(.*)>/)[1]); w('250 ok'); } }
        else if (cmd === 'DATA') { state = 'data'; w('354 go'); }
        else if (cmd === 'QUIT') { w('221 bye'); sock.end(); }
        else w('502 not implemented');
      }
    });
  };
  const server = secureContext ? tls.createServer({ ...secureContext }, handler) : net.createServer(handler);
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port, received })));
}

const decodeBody = (raw) => Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
const header = (raw, name) => raw.split('\r\n\r\n')[0].match(new RegExp(`^${name}: (.*(?:\\r\\n .*)*)`, 'mi'))?.[1];
const base = { from: { name: 'AINA Évidence', address: 'orders@aina.test' }, to: 'buyer@example.com', subject: 'Test', text: 'Hello' };

test('plain loopback delivery: envelope and decoded body are correct', async () => {
  const s = await fakeServer();
  await sendSmtp({ host: '127.0.0.1', port: s.port, secure: 'none', ...base, subject: 'Ваши гайды: проверка', text: 'Здравствуйте!\nСсылка:\n.dotted line\nEnd' });
  s.server.close();
  const m = s.received[0];
  assert.equal(m.from, 'orders@aina.test');
  assert.deepEqual(m.to, ['buyer@example.com']);
  assert.equal(decodeBody(m.data), 'Здравствуйте!\r\nСсылка:\r\n.dotted line\r\nEnd');
  assert.match(header(m.data, 'Subject'), /^=\?UTF-8\?B\?/);
  assert.equal(Buffer.from(header(m.data, 'Subject').match(/\?B\?([^?]+)\?=/)[1], 'base64').toString('utf8').startsWith('Ваши гайды'), true);
  assert.match(header(m.data, 'Content-Type'), /charset=utf-8/);
  assert.match(header(m.data, 'From'), /<orders@aina\.test>/);
  assert.match(header(m.data, 'Message-ID'), /^<[0-9a-f]{24}@aina\.test>$/);
});

test('credentials are refused over a plain connection', async () => {
  const s = await fakeServer({ requireAuth: { user: 'u', pass: 'p' } });
  await assert.rejects(sendSmtp({ host: '127.0.0.1', port: s.port, secure: 'none', user: 'u', pass: 'p', ...base }), (e) => e.code === 'insecure');
  s.server.close();
});

test('plain SMTP to a non-loopback host is refused before any connection', async () => {
  await assert.rejects(sendSmtp({ host: 'mail.example.com', port: 25, secure: 'none', ...base }), (e) => e.code === 'insecure');
});

test('dot-stuffing and header injection protection', () => {
  assert.equal(dotStuff('a\r\n.b\r\n..c'), 'a\r\n..b\r\n...c\r\n.\r\n');
  assert.throws(() => buildMessage({ ...base, subject: 'x\r\nBcc: evil@example.com' }), (e) => e.code === 'bad_header');
  assert.throws(() => buildMessage({ ...base, to: 'a@example.com\r\nBcc: evil@example.com' }), (e) => e.code === 'bad_header');
  assert.throws(() => checkAddress('not an address'), (e) => e.code === 'bad_address');
  assert.throws(() => checkAddress('a@b'), (e) => e.code === 'bad_address');
  assert.equal(encodeHeader('plain ascii'), 'plain ascii');
  assert.match(encodeHeader('Évidence'), /^=\?UTF-8\?B\?/);
});

test('rejected recipient and dropped connection surface as errors (nothing is claimed as sent)', async () => {
  const a = await fakeServer({ rejectRcpt: true });
  await assert.rejects(sendSmtp({ host: '127.0.0.1', port: a.port, secure: 'none', ...base }), (e) => e.code === 'smtp_550');
  a.server.close();
  const b = await fakeServer({ dropAfterData: true });
  await assert.rejects(sendSmtp({ host: '127.0.0.1', port: b.port, secure: 'none', ...base, timeoutMs: 3000 }), (e) => e instanceof SmtpError);
  b.server.close();
});

// ---- TLS with a throw-away self-signed certificate ----
let certDir, cert, key;
before(() => {
  certDir = mkdtempSync(join(tmpdir(), 'aina-tls-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(certDir, 'k.pem'), '-out', join(certDir, 'c.pem'), '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'pipe' });
  cert = readFileSync(join(certDir, 'c.pem')); key = readFileSync(join(certDir, 'k.pem'));
});
after(() => rmSync(certDir, { recursive: true, force: true }));

test('implicit TLS: certificate is verified (self-signed is rejected by default) and AUTH PLAIN works with a trusted CA', async () => {
  const s = await fakeServer({ secureContext: { cert, key }, requireAuth: { user: 'orders', pass: 's3cret' } });
  await assert.rejects(sendSmtp({ host: '127.0.0.1', port: s.port, secure: 'tls', user: 'orders', pass: 's3cret', ...base, timeoutMs: 4000 }), (e) => e instanceof SmtpError);
  assert.equal(s.received.length, 0, 'nothing is delivered when the certificate is not trusted');
  const r = await sendSmtp({ host: '127.0.0.1', port: s.port, secure: 'tls', user: 'orders', pass: 's3cret', ...base, tlsOptions: { ca: cert, servername: 'localhost' } });
  assert.equal(r.accepted, true);
  assert.equal(s.received[0].auth.user, 'orders');
  s.server.close();
});

test('wrong password is reported as an error', async () => {
  const s = await fakeServer({ secureContext: { cert, key }, requireAuth: { user: 'orders', pass: 's3cret' } });
  await assert.rejects(sendSmtp({ host: '127.0.0.1', port: s.port, secure: 'tls', user: 'orders', pass: 'wrong', ...base, tlsOptions: { ca: cert, servername: 'localhost' } }), (e) => e.code === 'smtp_535');
  s.server.close();
});

test('STARTTLS is required when selected: a server that does not offer it is refused (no downgrade)', async () => {
  const s = await fakeServer();
  await assert.rejects(sendSmtp({ host: '127.0.0.1', port: s.port, secure: 'starttls', ...base }), (e) => e.code === 'no_starttls');
  s.server.close();
});

// ---- Delivery email + outbox ----
test('delivery emails are localised and contain personal links, limits and the order number, but no attachment', () => {
  const links = [{ title: 'Guide', url: 'https://api.test/api/download/abc' }];
  for (const [l, word] of [['ru', 'Ваши персональные ссылки'], ['fr', 'Vos liens de téléchargement'], ['en', 'Your personal download links']]) {
    const m = deliveryEmail({ locale: l, links, validityDays: 7, maxDownloads: 5, supportEmail: 'help@aina.test', orderId: 'o123' });
    assert.ok(m.body.includes(word), l);
    assert.ok(m.body.includes('https://api.test/api/download/abc') && m.body.includes('o123') && m.body.includes('help@aina.test'));
    assert.ok(/7/.test(m.body) && /5/.test(m.body));
  }
});

test('outbox over SMTP: sent only when the relay accepts; a refusing relay leaves the message pending with the error', async () => {
  const db = openDb(':memory:');
  const ok = await fakeServer();
  const transports = createTransports({ dataDir: tmpdir(), telegram: {}, smtp: { host: '127.0.0.1', port: ok.port, secure: 'none', fromAddress: 'orders@aina.test', fromName: 'AINA Évidence' } });
  enqueue(db, { kind: 'order_delivery', recipient: 'buyer@example.com', subject: 'Ваши гайды', body: 'Ссылка: https://x', relatedId: 'o1' });
  await processOutbox(db, transports, { ownerChannel: 'file', clientChannel: 'smtp' });
  assert.equal(db.prepare('SELECT status FROM outbox').get().status, 'sent');
  assert.equal(ok.received.length, 1);
  ok.server.close();

  const bad = await fakeServer({ rejectRcpt: true });
  const t2 = createTransports({ dataDir: tmpdir(), telegram: {}, smtp: { host: '127.0.0.1', port: bad.port, secure: 'none', fromAddress: 'orders@aina.test' } });
  enqueue(db, { kind: 'order_delivery', recipient: 'nobody@example.com', subject: 's', body: 'b', relatedId: 'o2' });
  await processOutbox(db, t2, { ownerChannel: 'file', clientChannel: 'smtp' });
  const row = db.prepare("SELECT status, attempts, last_error FROM outbox WHERE related_id = 'o2'").get();
  assert.equal(row.status, 'pending');
  assert.equal(row.attempts, 1);
  assert.match(row.last_error, /smtp_550|unexpected reply 550/);
  bad.server.close();
});

test('SMTP channel without configuration never reports delivery', async () => {
  const db = openDb(':memory:');
  enqueue(db, { kind: 'order_delivery', recipient: 'b@example.com', subject: 's', body: 'b' });
  await processOutbox(db, createTransports({ dataDir: tmpdir(), telegram: {}, smtp: {} }), { ownerChannel: 'file', clientChannel: 'smtp' });
  const row = db.prepare('SELECT status, last_error FROM outbox').get();
  assert.equal(row.status, 'pending');
  assert.equal(row.last_error, 'smtp_not_configured');
});
