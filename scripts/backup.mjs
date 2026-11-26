#!/usr/bin/env node
// Creates an encrypted, verified backup of the database, stores it locally and (if configured) off-site.
// Usage: node scripts/backup.mjs        Env: DB_FILE, BACKUP_DIR (default data/backups), BACKUP_PASSPHRASE (>= 20 chars),
//        optional off-site: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PREFIX (default "backups/")
// Exit code 0 only if the backup was created AND, when off-site is configured, uploaded.
// Dead-man switch: with BACKUP_PING_URL (e.g. a free healthchecks.io check) the script pings the URL after a good backup and
// URL + '/fail' after a failed one. If pings stop arriving, the monitoring service alerts you. No personal data is sent.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../server/db.mjs';
import { createBackup, backupName, pruneBackups } from '../server/backup.mjs';
import { s3Client } from '../server/s3.mjs';

const dbFile = process.env.DB_FILE || 'data/app.db';
const dir = process.env.BACKUP_DIR || 'data/backups';
if (!existsSync(dbFile)) { console.error(`Database not found: ${dbFile}`); process.exit(1); }
const ping = async (suffix = '') => {
  const url = process.env.BACKUP_PING_URL;
  if (!url) return;
  if (!/^https?:\/\//.test(url)) { console.warn('BACKUP_PING_URL ignored: not an http(s) address'); return; }
  try { await fetch(url.replace(/\/$/, '') + suffix, { method: 'POST', body: suffix ? 'backup failed' : 'backup ok', signal: AbortSignal.timeout(10000) }); }
  catch { console.warn('monitoring ping failed (the backup itself is unaffected)'); }
};
const db = openDb(dbFile);
try {
  const { blob, counts } = await createBackup(db, process.env.BACKUP_PASSPHRASE);
  mkdirSync(dir, { recursive: true });
  const name = backupName();
  writeFileSync(join(dir, name), blob, { mode: 0o600 });
  console.log(`backup ok: ${name} (${blob.length} bytes) rows: ${JSON.stringify(counts)}`);
  const offsite = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].every((k) => process.env[k]);
  if (offsite) {
    const s3 = s3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, bucket: process.env.S3_BUCKET, accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY });
    const key = `${process.env.S3_PREFIX || 'backups/'}${name}`;
    await s3.put(key, blob);
    const back = await s3.get(key); // read back: an upload is only counted when the stored bytes match
    if (!back.equals(blob)) throw new Error('offsite_verification_failed');
    console.log(`off-site ok and verified: ${key}`);
  } else {
    console.warn('WARNING: off-site storage is not configured; this backup lives only on this server.');
  }
  const pruned = pruneBackups(dir);
  if (pruned.removed.length) console.log(`pruned ${pruned.removed.length} old local backup(s)`);
  await ping();
} catch (e) {
  console.error(`BACKUP FAILED: ${e.message}`);
  await ping('/fail');
  process.exitCode = 1;
} finally { db.close(); }
process.exit(process.exitCode || 0);
