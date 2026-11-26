// Minimal SMTP client (RFC 5321/5322/2047) on node:net and node:tls. No dependencies.
// Works with any SMTP relay (your mailbox, Brevo, Resend, Mailgun...). Certificates are always verified.
// Credentials are sent only over TLS; plain connections are allowed only to loopback hosts (tests).
//   secure: 'tls'      implicit TLS (usually port 465)
//   secure: 'starttls' upgrade after EHLO (usually port 587), refuses to continue if the server does not offer it
//   secure: 'none'     loopback only

import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';

export class SmtpError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

const ADDR = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const noCrlf = (v, what) => { if (/[\r\n\0]/.test(String(v))) throw new SmtpError(`invalid ${what}`, 'bad_header'); return String(v); };

export function checkAddress(a) {
  noCrlf(a, 'address');
  if (!ADDR.test(a) || a.length > 254) throw new SmtpError('invalid address', 'bad_address');
  return a;
}

// RFC 2047 encoded-word for non-ASCII header text (split to stay under 75 characters per word)
export function encodeHeader(text) {
  noCrlf(text, 'header');
  if (/^[\x20-\x7E]*$/.test(text)) return text;
  const words = [];
  let cur = '';
  for (const ch of text) {
    if (Buffer.byteLength(cur + ch, 'utf8') > 36) { words.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) words.push(cur);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, 'utf8').toString('base64')}?=`).join('\r\n ');
}

const b64lines = (buf) => Buffer.from(buf).toString('base64').replace(/(.{76})/g, '$1\r\n');

export function buildMessage({ from, to, subject, text, replyTo, date = new Date(), messageIdDomain }) {
  const fromAddr = checkAddress(from.address);
  const toAddr = checkAddress(to);
  const display = from.name ? `${encodeHeader(from.name)} <${fromAddr}>` : fromAddr;
  const domain = messageIdDomain || fromAddr.split('@')[1];
  const headers = [
    `From: ${display}`,
    `To: ${toAddr}`,
    ...(replyTo ? [`Reply-To: ${checkAddress(replyTo)}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    'Auto-Submitted: auto-generated',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${b64lines(Buffer.from(String(text).replace(/\r?\n/g, '\r\n'), 'utf8'))}`;
}

// SMTP data: dot-stuffing and the terminating <CRLF>.<CRLF>
export const dotStuff = (msg) => msg.replace(/(^|\r\n)\./g, '$1..') + '\r\n.\r\n';

class Conn {
  constructor(socket, timeoutMs) {
    this.timeoutMs = timeoutMs; this.buf = ''; this.waiters = []; this.error = null; this.closed = false;
    this.attach(socket);
  }
  attach(socket) {
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.setTimeout(this.timeoutMs, () => this.fail(new SmtpError('timeout', 'timeout')));
    socket.on('data', (d) => { this.buf += d; this.pump(); });
    socket.on('error', (e) => this.fail(new SmtpError(e.code || e.message, 'socket')));
    socket.on('close', () => { this.closed = true; this.fail(new SmtpError('connection closed', 'closed')); });
  }
  fail(err) { if (!this.error) this.error = err; this.pump(); }
  // A reply is complete at the first line "NNN text" (a space after the code); "NNN-" continues.
  pump() {
    while (this.waiters.length) {
      const lines = this.buf.split('\r\n');
      const last = lines.findIndex((l) => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
      if (last === -1) break;
      const reply = lines.slice(0, last + 1);
      this.buf = lines.slice(last + 1).join('\r\n');
      this.waiters.shift().resolve({ code: Number(reply[last].slice(0, 3)), lines: reply.map((l) => l.slice(4)) });
    }
    if (this.error) while (this.waiters.length) this.waiters.shift().reject(this.error);
  }
  read() { return new Promise((resolve, reject) => { if (this.error) return reject(this.error); this.waiters.push({ resolve, reject }); this.pump(); }); }
  write(line) { if (this.error) throw this.error; this.socket.write(line); }
  async cmd(line, expect) {
    this.write(line + '\r\n');
    const r = await this.read();
    if (!expect.includes(r.code)) throw new SmtpError(`unexpected reply ${r.code} to ${line.split(' ')[0]}`, `smtp_${r.code}`);
    return r;
  }
}

const isLoopback = (h) => ['localhost', '127.0.0.1', '::1'].includes(h);

export async function sendSmtp({ host, port, secure = 'starttls', user, pass, from, to, subject, text, replyTo, timeoutMs = 15000, tlsOptions = {}, clientName = 'localhost' }) {
  if (!host || !port || !from?.address) throw new SmtpError('smtp_not_configured', 'smtp_not_configured');
  if (secure === 'none' && !isLoopback(host)) throw new SmtpError('plain SMTP is allowed only to loopback hosts', 'insecure');
  const message = buildMessage({ from, to, subject, text, replyTo });
  const base = { host, port: Number(port), servername: net.isIP(host) ? undefined : host, ...tlsOptions };
  const socket = await new Promise((resolve, reject) => {
    const s = secure === 'tls' ? tls.connect({ ...base, rejectUnauthorized: tlsOptions.rejectUnauthorized !== false }) : net.connect({ host, port: Number(port) });
    s.once(secure === 'tls' ? 'secureConnect' : 'connect', () => resolve(s));
    s.once('error', (e) => reject(new SmtpError(e.code || e.message, 'connect')));
    s.setTimeout(timeoutMs, () => { s.destroy(); reject(new SmtpError('connect timeout', 'timeout')); });
  });
  const c = new Conn(socket, timeoutMs);
  try {
    let r = await c.read();
    if (r.code !== 220) throw new SmtpError(`bad greeting ${r.code}`, 'greeting');
    r = await c.cmd(`EHLO ${clientName}`, [250]);
    let caps = r.lines.map((l) => l.toUpperCase());
    if (secure === 'starttls') {
      if (!caps.includes('STARTTLS')) throw new SmtpError('server does not offer STARTTLS', 'no_starttls');
      await c.cmd('STARTTLS', [220]);
      const upgraded = await new Promise((resolve, reject) => {
        const t = tls.connect({ ...base, socket: c.socket, rejectUnauthorized: tlsOptions.rejectUnauthorized !== false });
        t.once('secureConnect', () => resolve(t));
        t.once('error', (e) => reject(new SmtpError(e.code || e.message, 'tls')));
      });
      c.attach(upgraded);
      r = await c.cmd(`EHLO ${clientName}`, [250]);
      caps = r.lines.map((l) => l.toUpperCase());
    }
    if (user) {
      if (secure === 'none') throw new SmtpError('refusing to send credentials without TLS', 'insecure');
      const mechs = (caps.find((l) => l.startsWith('AUTH ')) || '').slice(5).split(' ');
      if (mechs.includes('PLAIN')) {
        await c.cmd(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`, 'utf8').toString('base64')}`, [235]);
      } else if (mechs.includes('LOGIN')) {
        await c.cmd('AUTH LOGIN', [334]);
        await c.cmd(Buffer.from(user, 'utf8').toString('base64'), [334]);
        await c.cmd(Buffer.from(pass, 'utf8').toString('base64'), [235]);
      } else throw new SmtpError('no supported AUTH mechanism', 'no_auth');
    }
    await c.cmd(`MAIL FROM:<${checkAddress(from.address)}>`, [250]);
    await c.cmd(`RCPT TO:<${checkAddress(to)}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    c.write(dotStuff(message));
    r = await c.read();
    if (r.code !== 250) throw new SmtpError(`message rejected ${r.code}`, `smtp_${r.code}`);
    try { c.write('QUIT\r\n'); } catch { /* already finished */ }
    return { accepted: true, response: r.lines[0] };
  } finally {
    c.socket.destroy();
  }
}
