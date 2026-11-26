#!/usr/bin/env node
// Imports Revolut fees from a statement CSV (see server/fees.mjs for the columns). Dry-run by default.
// Usage: DB_FILE=data/app.db node scripts/import-revolut-fees.mjs statement.csv [--apply]
import { readFileSync, existsSync } from 'node:fs';
import { openDb } from '../server/db.mjs';
import { parseFeeCsv, applyFees, FeeImportError } from '../server/fees.mjs';

const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file || !existsSync(file)) { console.error('Usage: node scripts/import-revolut-fees.mjs <statement.csv> [--apply]'); process.exit(1); }
const dbFile = process.env.DB_FILE || 'data/app.db';
if (!existsSync(dbFile)) { console.error(`Database not found: ${dbFile}`); process.exit(1); }
try {
  const rows = parseFeeCsv(readFileSync(file, 'utf8'));
  const db = openDb(dbFile);
  if (!apply) {
    db.close();
    console.log(`DRY RUN: ${rows.length} row(s) read. Nothing was written. Re-run with --apply to update the ledger.`);
    for (const r of rows) console.log(r.error ? `  line ${r.line}: ${r.error}` : `  ${r.reference}  fee ${(r.feeCents / 100).toFixed(2)} ${r.currency}`);
    process.exit(0);
  }
  const res = applyFees(db, rows);
  db.close();
  console.log(`fees applied: ${res.updated}; skipped: ${res.skipped.length}`);
  for (const s of res.skipped) console.log(`  line ${s.line}: ${s.reason}`);
} catch (e) {
  console.error(e instanceof FeeImportError ? `IMPORT FAILED: ${e.message}` : `IMPORT FAILED: ${e.message}`);
  process.exit(1);
}
