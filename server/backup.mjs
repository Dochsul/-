// Encrypted, verified database backups and restore. No dependencies.
// Format (.enc): "AEB1" | salt(16) | iv(12) | gcm-tag(16) | ciphertext;  ciphertext = AES-256-GCM(gzip(sqlite snapshot)).
// The key comes from a passphrase via scrypt. The authentication tag detects any tampering or a wrong passphrase.
// A snapshot is taken with SQLite's online backup API (consistent even while the server is writing) and verified
// with PRAGMA integrity_check BEFORE it is encrypted, so a corrupt backup is never produced silently.

import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, copyFileSync, renameSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';

const MAGIC = Buffer.from('AEB1');
export const REQUIRED_TABLES = ['orders', 'payments', 'refunds', 'downloads', 'leads', 'outbox', 'processed_events'];
const key = (pass, salt) => scryptSync(pass, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });

export function assertPassphrase(p) {
  if (typeof p !== 'string' || p.length < 20) throw new Error('BACKUP_PASSPHRASE must be at least 20 characters');
}

export function encrypt(plain, passphrase) {
  assertPassphrase(passphrase);
  const salt = randomBytes(16), iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(passphrase, salt), iv);
  const body = Buffer.concat([c.update(gzipSync(plain)), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}

export function decrypt(blob, passphrase) {
  assertPassphrase(passphrase);
  if (blob.length < 4 + 16 + 12 + 16 + 1 || !blob.subarray(0, 4).equals(MAGIC)) throw new Error('not_a_backup_file');
  const salt = blob.subarray(4, 20), iv = blob.subarray(20, 32), tag = blob.subarray(32, 48), body = blob.subarray(48);
  const d = createDecipheriv('aes-256-gcm', key(passphrase, salt), iv);
  d.setAuthTag(tag);
  try { return gunzipSync(Buffer.concat([d.update(body), d.final()])); }
  catch { throw new Error('wrong_passphrase_or_corrupted_backup'); }
}

// Opens a database file read-only-ish and checks structure and integrity. Returns row counts for the log.
export function verifyDatabase(file) {
  const db = new DatabaseSync(file);
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]);
    if (integrity.length !== 1 || integrity[0] !== 'ok') throw new Error(`integrity_check_failed: ${integrity.join(';').slice(0, 120)}`);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
    if (missing.length) throw new Error(`missing_tables: ${missing.join(',')}`);
    const counts = Object.fromEntries(REQUIRED_TABLES.map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));
    return { counts };
  } finally { db.close(); }
}

const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
export const backupName = (d = new Date()) => `aina-${stamp(d)}.db.gz.enc`;
const parseStamp = (name) => { const m = name.match(/^aina-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.db\.gz\.enc$/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null; };

// Takes a snapshot of an OPEN database, verifies it and returns the encrypted bytes.
export async function createBackup(db, passphrase) {
  assertPassphrase(passphrase);
  const tmp = mkdtempSync(join(tmpdir(), 'aina-bk-'));
  const snap = join(tmp, 'snapshot.db');
  try {
    await sqliteBackup(db, snap);
    const { counts } = verifyDatabase(snap);
    return { blob: encrypt(readFileSync(snap), passphrase), counts };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// Decrypts, verifies and installs a backup at `target`. Never overwrites silently:
// an existing database is first kept as <target>.pre-restore-<time>, and only with force=true.
export function restoreBackup(blob, passphrase, target, { force = false, now = new Date() } = {}) {
  const plain = decrypt(blob, passphrase);
  const tmp = mkdtempSync(join(tmpdir(), 'aina-rs-'));
  try {
    const staged = join(tmp, 'restored.db');
    writeFileSync(staged, plain);
    const { counts } = verifyDatabase(staged); // refuse to install anything that is not a healthy database
    mkdirSync(dirname(target), { recursive: true });
    let previous = null;
    if (existsSync(target)) {
      if (!force) throw new Error('target_exists: pass force to replace it (the old file is kept)');
      previous = `${target}.pre-restore-${stamp(now)}`;
      copyFileSync(target, previous);
    }
    for (const ext of ['-wal', '-shm']) rmSync(target + ext, { force: true }); // stale journal files must not be replayed onto the restored file
    const next = `${target}.restoring`;
    copyFileSync(staged, next);
    renameSync(next, target);
    return { counts, previous };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

// Local retention: keep the newest `keepDaily` backups and the newest backup of each of the last `keepWeekly` ISO weeks.
export function pruneBackups(dir, { keepDaily = 14, keepWeekly = 8 } = {}) {
  if (!existsSync(dir)) return { kept: [], removed: [] };
  const files = readdirSync(dir).map((f) => ({ f, d: parseStamp(f) })).filter((x) => x.d).sort((a, b) => b.d - a.d);
  const keep = new Set(files.slice(0, keepDaily).map((x) => x.f));
  const weekOf = (d) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); return `${t.getUTCFullYear()}-${Math.ceil((((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)}`; };
  const seen = new Set();
  for (const x of files) { const w = weekOf(x.d); if (!seen.has(w) && seen.size < keepWeekly) { seen.add(w); keep.add(x.f); } }
  const removed = files.filter((x) => !keep.has(x.f)).map((x) => x.f);
  for (const f of removed) rmSync(join(dir, f), { force: true });
  return { kept: files.filter((x) => keep.has(x.f)).map((x) => x.f), removed };
}

export const latestLocal = (dir) => {
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((n) => parseStamp(n)).sort().at(-1);
  return f ? join(dir, f) : null;
};
export { basename, statSync };
