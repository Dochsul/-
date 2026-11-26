#!/usr/bin/env node
// Static checks for the Global Aina Nutrition site. No dependencies.
// Usage: node scripts/check.mjs   (exit code 1 if any check fails)

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);

const htmlFiles = readdirSync(root).filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(join(root, f), 'utf8');

// 1. Every HTML page: basic head requirements and a CSP
for (const file of htmlFiles) {
  const html = read(file);
  if (!/<html[^>]*\slang="[a-z-]+"/i.test(html)) fail(`${file}: <html lang> is missing`);
  if (!/<meta\s+charset="utf-8"/i.test(html)) fail(`${file}: <meta charset> is missing`);
  if (!/<meta\s+name="viewport"/i.test(html)) fail(`${file}: viewport meta is missing`);
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(`${file}: <title> is missing or empty`);
  if (!/http-equiv="Content-Security-Policy"/i.test(html)) fail(`${file}: Content-Security-Policy meta is missing`);
  if (/\bhttp:\/\//i.test(html.replace(/xmlns="[^"]*"/g, ''))) fail(`${file}: insecure http:// URL found (mixed content)`);
  if (/console\.log\(/.test(html)) fail(`${file}: console.log in page script (may leak personal data)`);

  // duplicate ids
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(`${file}: duplicate ids: ${[...new Set(dupes)].join(', ')}`);

  // 2. Local references (href / src) must point to existing files
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(ref) || ref.startsWith('#')) continue;
    const [path] = ref.split('#');
    if (!path) continue;
    const target = join(root, path.split('?')[0]);
    if (!existsSync(target) || !statSync(target).isFile()) {
      fail(`${file}: broken local reference "${ref}"`);
    }
  }

  // 3. In-page anchors must point to an existing id in the same file
  for (const m of html.matchAll(/\shref="#([^"]+)"/g)) {
    if (!ids.includes(m[1])) fail(`${file}: anchor "#${m[1]}" has no matching id`);
  }
}

// 4. Sitemap: well-formed XML, no fragment URLs, every page listed resolves
const sitemapPath = join(root, 'sitemap.xml');
try {
  execFileSync('python3', ['-c', 'import sys,xml.dom.minidom as m; m.parse(sys.argv[1])', sitemapPath], { stdio: 'pipe' });
} catch (e) {
  fail('sitemap.xml is not well-formed XML');
}
const sitemap = readFileSync(sitemapPath, 'utf8');
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  if (m[1].includes('#')) fail(`sitemap.xml: fragment URL is not indexed by search engines: ${m[1]}`);
}

// 5. robots.txt must reference the sitemap
const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
if (!/^Sitemap:\s*https?:\/\/\S+sitemap\.xml/im.test(robots)) fail('robots.txt: Sitemap line is missing');

// 6. Secrets: obvious credentials must never be committed
const secretPattern = /(api[_-]?key|secret|passwd|password|access[_-]?token|bearer)\s*[:=]\s*["'][^"']{12,}["']/i;
const scanTargets = [...htmlFiles, 'robots.txt', 'sitemap.xml', 'README.md', 'QUICKSTART.md'];
for (const f of scanTargets) {
  if (secretPattern.test(read(f))) fail(`${f}: possible secret/credential in file`);
}

// 7. Form: a configured endpoint must be allowed by CSP connect-src
const index = read('index.html');
const endpointMatch = index.match(/const FORM_ENDPOINT = '([^']*)'/);
if (!endpointMatch) fail('index.html: FORM_ENDPOINT constant not found');
else if (endpointMatch[1]) {
  const origin = new URL(endpointMatch[1]).origin;
  if (!/connect-src[^"]*/.test(index) || !index.includes(origin)) {
    fail(`index.html: FORM_ENDPOINT ${origin} must be added to CSP connect-src`);
  }
} else {
  notes.push('Form backend is not configured (FORM_ENDPOINT empty): submissions open a pre-filled email.');
}

// 8. Draft legal pages must stay out of search engines until reviewed
for (const f of ['privacy.html', 'terms.html', 'refund.html']) {
  if (existsSync(join(root, f)) && !/name="robots"\s+content="noindex/i.test(read(f))) {
    notes.push(`${f}: no noindex meta. Fine only after legal review.`);
  }
  if (existsSync(join(root, f)) && sitemap.includes(f)) fail(`sitemap.xml must not list draft page ${f}`);
}

const rel = (p) => relative(root, p) || '.';
console.log(`Checked ${htmlFiles.length} HTML page(s): ${htmlFiles.join(', ')}`);
for (const n of notes) console.log(`NOTE: ${n}`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('All static checks passed.');
