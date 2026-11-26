#!/usr/bin/env node
// Verifies the PDF files the catalog needs: present, a real PDF, size and SHA-256 (to compare with the originals in the library).
// Usage: node scripts/verify-files.mjs [dir]   (default PRIVATE_DIR or private/products)   Exit 1 if any file is missing or not a PDF.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileSkus } from '../src/config/catalog.mjs';

const dir = process.argv[2] || process.env.PRIVATE_DIR || 'private/products';
let bad = 0;
for (const sku of fileSkus()) {
  const f = join(dir, `${sku}.pdf`);
  if (!existsSync(f)) { console.log(`MISSING  ${sku}.pdf`); bad++; continue; }
  const b = readFileSync(f);
  if (b.subarray(0, 5).toString() !== '%PDF-') { console.log(`NOT A PDF ${sku}.pdf`); bad++; continue; }
  console.log(`ok       ${sku}.pdf  ${statSync(f).size} bytes  sha256 ${createHash('sha256').update(b).digest('hex')}`);
}
console.log(bad ? `\n${bad} problem(s): products stay unpublished until all files are in place.` : '\nAll PDF files are present.');
process.exit(bad ? 1 : 0);
