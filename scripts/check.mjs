#!/usr/bin/env node
// Static checks on the BUILT site (dist/) and on source secrets. No dependencies.
// Usage: npm run build && npm run check   (exit code 1 on any failure)
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const failures = [];
const fail = (m) => failures.push(m);

if (!existsSync(dist)) { console.error('dist/ is missing: run npm run build first'); process.exit(1); }

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));

// 1. Internal links and assets resolve to files in dist/
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const rel = file.slice(dist.length);
  for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
    const target = join(dist, m[1].endsWith('/') ? m[1] + 'index.html' : m[1]);
    if (!existsSync(target)) fail(`${rel}: broken internal link ${m[1]}`);
  }
  // 2. In-page anchors resolve to an id on the same page
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/\shref="#([^"]+)"/g)) {
    if (!ids.has(m[1])) fail(`${rel}: anchor #${m[1]} has no target`);
  }
  // 3. Every page has a self-referencing canonical and reciprocal hreflang
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
  const alts = [...html.matchAll(/hreflang="([a-z-]+)" href="([^"]+)"/g)].map((m) => m[2]);
  if (canon && !alts.includes(canon[1])) fail(`${rel}: canonical URL is not among its hreflang alternates`);
}

// 4. Sitemap: valid XML and no fragment URLs
const sitemap = join(dist, 'sitemap.xml');
try {
  execFileSync('python3', ['-c', 'import sys,xml.dom.minidom as m; m.parse(sys.argv[1])', sitemap], { stdio: 'pipe' });
} catch { fail('sitemap.xml is not well-formed XML'); }
const sm = readFileSync(sitemap, 'utf8');
if (sm.includes('#')) fail('sitemap.xml contains fragment URLs');

// 5. robots.txt points to the sitemap
if (!/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(readFileSync(join(dist, 'robots.txt'), 'utf8'))) fail('robots.txt has no sitemap line');

// 6. No credentials committed in source (scan tracked source, not node_modules or data)
const secret = /((sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|api[_-]?key\s*[:=]\s*['"][^'"]{12,}['"])/i;
const scanDirs = ['src', 'server', 'site', 'scripts', 'tests', 'docs', '.github'];
const skipSuffix = /\.(woff2|png|jpg|webp)$/;
for (const d of scanDirs.map((x) => join(root, x)).filter(existsSync)) {
  for (const f of walk(d)) {
    if (skipSuffix.test(f) || f.endsWith('.test.mjs')) continue;
    if (secret.test(readFileSync(f, 'utf8'))) fail(`possible credential in ${f.slice(root.length + 1)}`);
  }
}
// .env must never be tracked
try {
  const tracked = execFileSync('git', ['ls-files', '.env', 'data', 'private', 'dist'], { cwd: root, encoding: 'utf8' }).trim();
  if (tracked) fail(`must not be tracked by git: ${tracked}`);
} catch { /* not a git checkout: skip */ }

console.log(`Checked ${htmlFiles.length} HTML pages in dist/ and source files.`);
if (failures.length) {
  for (const f of failures.slice(0, 50)) console.log('FAIL: ' + f);
  console.log(`${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('All static checks passed.');
