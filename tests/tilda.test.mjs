// Tilda handoff package: page texts, SEO and T123 components.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportAll, PAGES } from '../scripts/tilda-export.mjs';
import { buildComponents } from '../scripts/tilda-components.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = join(root, 'tilda', 'pages');
const compDir = join(root, 'tilda', 'components');
let comps;

before(() => { exportAll(); comps = buildComponents(); });

test('19 pages, each with Russian, French and English sections', () => {
  const files = readdirSync(pagesDir).filter((f) => f.endsWith('.md'));
  assert.equal(files.length, 19);
  assert.equal(PAGES.length, 19);
  for (const f of files) {
    const md = readFileSync(join(pagesDir, f), 'utf8');
    for (const l of ['(ru)', '(fr)', '(en)']) assert.ok(md.includes(l), `${f} ${l}`);
    assert.equal(/undefined|\[object Object\]|NaN/.test(md), false, `${f} has broken output`);
  }
});

test('page statuses: services are drafts, legal pages are legal drafts with highlighted placeholders', () => {
  for (const n of ['03', '04', '05', '06', '07']) {
    const f = readdirSync(pagesDir).find((x) => x.startsWith(n));
    assert.match(readFileSync(join(pagesDir, f), 'utf8'), /ЧЕРНОВИК: не публиковать/);
  }
  for (const n of ['15', '16', '17', '18', '19']) {
    const f = readdirSync(pagesDir).find((x) => x.startsWith(n));
    const md = readFileSync(join(pagesDir, f), 'utf8');
    assert.match(md, /ЮРИДИЧЕСКИЙ ЧЕРНОВИК/);
  }
  assert.match(readFileSync(join(pagesDir, '15-legal-mentions.md'), 'utf8'), /\*\*\[À COMPLÉTER: SIREN\]\*\*/);
  assert.match(readFileSync(join(pagesDir, '16-legal-privacy.md'), 'utf8'), /### Cookies/);
});

test('service prices are not copied from this package (the approved price list in Tilda prevails)', () => {
  const md = readFileSync(join(pagesDir, '03-consultations.md'), 'utf8');
  assert.match(md, /цены НЕ переносить/);
  assert.equal(/\b15\s?€|80\s?€/.test(md), false);
});

test('shop page lists the bundle with the approved prices', () => {
  const md = readFileSync(join(pagesDir, '08-shop.md'), 'utf8');
  assert.match(md, /Комплект из трёх гайдов/);
  assert.match(md, /19,90\s€\s·\s2\s000\s₽/);
  assert.match(md, /9,90\s€\s·\s1\s000\s₽/);
  assert.match(md, /7,90\s€\s·\s800\s₽/);
});

test('SEO: 57 rows, title ≤ 65, description 50–160, drafts are noindex', () => {
  const rows = readFileSync(join(root, 'tilda', 'seo.csv'), 'utf8').trim().split('\r\n');
  assert.equal(rows.length, 58);
  const parse = (line) => { const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out; };
  for (const r of rows.slice(1).map(parse)) {
    const [, page, lang, , status, , tlen, , dlen, robots] = r;
    assert.ok(Number(tlen) <= 65, `${page}/${lang} title ${tlen}`);
    assert.ok(Number(dlen) >= 50 && Number(dlen) <= 160, `${page}/${lang} description ${dlen}`);
    assert.equal(robots, status === 'publish' ? 'index, follow' : 'noindex, nofollow');
  }
});

test('components: 15 files (5 blocks × 3 languages)', () => {
  assert.equal(comps.length, 15);
});

test('components: every CSS selector is scoped under .ae (safe inside Tilda)', () => {
  for (const f of comps) {
    const html = readFileSync(join(compDir, f), 'utf8');
    for (const css of html.match(/<style>([\s\S]*?)<\/style>/g)) {
      const body = css.replace(/<\/?style>/g, '').replace(/@media[^{]+\{/g, '').replace(/\}\s*\}/g, '}');
      const selectors = [...body.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim()).filter(Boolean);
      for (const sel of selectors) for (const part of sel.split(',')) assert.match(part.trim(), /^\.ae[\s.:-]|^\.ae$/, `${f}: unscoped selector "${part.trim()}"`);
    }
  }
});

test('components: no secrets, no innerHTML/eval, API base empty by default', () => {
  for (const f of comps) {
    const html = readFileSync(join(compDir, f), 'utf8');
    assert.equal(/(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/.test(html), false, f);
    assert.equal(/innerHTML|eval\(|new Function/.test(html), false, f);
    const apis = [...html.matchAll(/data-api="([^"]*)"/g)].map((m) => m[1]);
    for (const a of apis) assert.equal(a, '', `${f}: data-api must be empty in the package`);
  }
});

test('components: the shop embeds the approved prices of all four products; only https redirects are followed', () => {
  const html = readFileSync(join(compDir, '01-shop.ru.html'), 'utf8');
  assert.match(html, /\/\^https:\\\/\\\/\/\.test\(res\.j\.url\)/);
  const expected = { 'parent-guides-bundle': '"EUR":1990,"RUB":200000', 'cow-milk-protein-allergy-guide': '"EUR":990,"RUB":100000',
    'child-sleep-guide-0-18': '"EUR":990,"RUB":100000', 'complementary-feeding-guide': '"EUR":790,"RUB":80000' };
  for (const [sku, prices] of Object.entries(expected)) assert.ok(html.includes(`"prices":{${prices}}`) && html.includes(`"sku":"${sku}"`), `${sku} prices`);
});

test('components: legal consent checkboxes are required in the checkout form', () => {
  for (const l of ['ru', 'fr', 'en']) {
    const html = readFileSync(join(compDir, `01-shop.${l}.html`), 'utf8');
    assert.match(html, /name="terms" type="checkbox" required/);
    assert.match(html, /name="digital" type="checkbox" required/);
    assert.match(html, new RegExp(`/${l}/legal/terms-of-sale/`));
  }
});
