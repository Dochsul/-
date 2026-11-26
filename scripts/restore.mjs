#!/usr/bin/env node
// Restores the database from an encrypted backup (local file, "latest" local, or "s3-latest").
// STOP the server before restoring. Usage:
//   node scripts/restore.mjs <file.enc>            restore into DB_FILE (refuses if it exists)
//   node scripts/restore.mjs latest [--force]      newest local backup in BACKUP_DIR
//   node scripts/restore.mjs s3-latest [--force]   newest backup in the off-site bucket
//   node scripts/restore.mjs <file|latest> --verify-only   decrypt and verify, install nothing
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { restoreBackup, decrypt, verifyDatabase, latestLocal } from '../server/backup.mjs';
import { s3Client } from '../server/s3.mjs';

const args = process.argv.slice(2);
const what = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
const verifyOnly = args.includes('--verify-only');
const dbFile = process.env.DB_FILE || 'data/app.db';
const dir = process.env.BACKUP_DIR || 'data/backups';
if (!what) { console.error('Usage: node scripts/restore.mjs <file.enc | latest | s3-latest> [--force] [--verify-only]'); process.exit(1); }
try {
  let blob; let source;
  if (what === 's3-latest') {
    const s3 = s3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, bucket: process.env.S3_BUCKET, accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY });
    const keys = (await s3.list(process.env.S3_PREFIX || 'backups/')).filter((k) => /aina-\d{8}T\d{6}Z\.db\.gz\.enc$/.test(k));
    if (!keys.length) throw new Error('no backups found in the bucket');
    source = keys.at(-1); blob = await s3.get(source);
  } else {
    source = what === 'latest' ? latestLocal(dir) : what;
    if (!source) throw new Error(`no backups in ${dir}`);
    blob = readFileSync(source);
  }
  if (verifyOnly) {
    const tmp = mkdtempSync(join(tmpdir(), 'aina-vo-'));
    try { writeFileSync(join(tmp, 'v.db'), decrypt(blob, process.env.BACKUP_PASSPHRASE)); console.log(`verified ${source}: ${JSON.stringify(verifyDatabase(join(tmp, 'v.db')).counts)}`); }
    finally { rmSync(tmp, { recursive: true, force: true }); }
  } else {
    const r = restoreBackup(blob, process.env.BACKUP_PASSPHRASE, dbFile, { force });
    console.log(`restored ${source} -> ${dbFile}; rows: ${JSON.stringify(r.counts)}${r.previous ? `; previous database kept as ${r.previous}` : ''}`);
  }
} catch (e) { console.error(`RESTORE FAILED: ${e.message}`); process.exit(1); }
