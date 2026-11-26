// Tests for the generated site. Run `npm run build` first (done automatically here).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import contentRu from '../src/content/ru.mjs';
import contentFr from '../src/content/fr.mjs';
import contentEn from '../src/content/en.mjs';
import legalRu from '../src/legal/ru.mjs';
import legalFr from '../src/legal/fr.mjs';
import legalEn from '../src/legal/en.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (f.endsWith('.html')) out.push(p);
  }
  return out;
}
const shapeKeys = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? shapeKeys(v, `${pre}${k}.`) : [`${pre}${k}`])).sort();

before(() => {
  execFileSync(process.execPath, [join(root, 'src', 'build.mjs')], { cwd: root, stdio: 'pipe' });
});

test('content: all three languages have the same keys', () => {
  assert.deepEqual(shapeKeys(contentFr), shapeKeys(contentRu));
  assert.deepEqual(shapeKeys(contentEn), shapeKeys(contentRu));
});

test('legal: all three languages have the same document keys and sections', () => {
  for (const doc of Object.keys(legalFr)) {
    assert.ok(legalRu[doc] && legalEn[doc], `missing ${doc}`);
    assert.equal(legalEn[doc].sections.length, legalFr[doc].sections.length, `sections differ in ${doc}`);
  }
});

test('build: 3 languages x all routes plus product pages are generated', () => {
  const pages = walk(dist);
  // 23 routes (incl. legal) + 4 product pages (3 guides + bundle) per language = 27 per language
  assert.equal(pages.length, 3 * 27 + 2, `page count ${pages.length}`); // +404 and chooser
});

test('every page: lang, title, description, canonical, and hreflang for all languages and x-default', () => {
  for (const file of walk(dist).filter((f) => !f.endsWith('404.html') && !f.endsWith(join('dist', 'index.html')))) {
    const html = readFileSync(file, 'utf8');
    const rel = file.slice(dist.length);
    assert.match(html, /<html lang="(ru|fr|en)"/, rel);
    assert.match(html, /<title>[^<]+<\/title>/, rel);
    assert.match(html, /<meta name="description" content="[^"]+"/, rel);
    assert.match(html, /<link rel="canonical" href="[^"]+"/, rel);
    for (const l of ['ru', 'fr', 'en', 'x-default']) assert.match(html, new RegExp(`hreflang="${l}"`), `${rel} hreflang ${l}`);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${rel} must have exactly one h1`);
  }
});

test('CSP compatibility: no inline event handlers, no style attributes, no inline scripts except JSON-LD', () => {
  for (const file of walk(dist)) {
    const html = readFileSync(file, 'utf8');
    const rel = file.slice(dist.length);
    assert.equal(/\son[a-z]+="/i.test(html), false, `inline handler in ${rel}`);
    assert.equal(/\sstyle="/i.test(html), false, `style attribute in ${rel}`);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    for (const [, attrs, body] of scripts) {
      if (/type="application\/ld\+json"/.test(attrs)) JSON.parse(body); // must be valid JSON
      else assert.match(attrs, /src="\/static\/app\.js"/, `unexpected inline script in ${rel}`);
    }
  }
});

test('no insecure http:// links in any page', () => {
  for (const file of walk(dist)) {
    // dev builds use an http://localhost origin; production requires SITE_URL (see the publication gate)
    assert.equal(/href="http:\/\/(?!localhost)/.test(readFileSync(file, 'utf8')), false, file);
  }
});

test('noindex on cart, checkout and unpublished product pages', () => {
  const cart = readFileSync(join(dist, 'en', 'cart', 'index.html'), 'utf8');
  assert.match(cart, /name="robots" content="noindex, nofollow"/);
  const sku = readFileSync(join(dist, 'en', 'shop', 'cow-milk-protein-allergy-guide', 'index.html'), 'utf8');
  assert.match(sku, /noindex/);
});

test('sitemap: lists only indexable pages with alternates, no fragments, no cart or checkout', () => {
  const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  assert.equal(xml.includes('#'), false);
  assert.equal(/\/cart\//.test(xml), false);
  assert.equal(/checkout/.test(xml), false);
  assert.equal(/cow-milk-protein-allergy-guide/.test(xml), false, 'unpublished product must not be listed');
  assert.match(xml, /xhtml:link rel="alternate" hreflang="fr"/);
});

test('JSON-LD FAQ and Organization exist where expected', () => {
  const faq = readFileSync(join(dist, 'fr', 'faq', 'index.html'), 'utf8');
  assert.match(faq, /"@type":"FAQPage"/);
  const home = readFileSync(join(dist, 'ru', 'index.html'), 'utf8');
  assert.match(home, /"@type":"Organization"/);
});

test('no product is priced or listed as available while prices are unconfirmed', () => {
  const shop = readFileSync(join(dist, 'ru', 'shop', 'index.html'), 'utf8');
  assert.equal(/data-add-sku=/.test(shop), false);
  assert.match(shop, /Цена уточняется/);
});

test('client catalog contains only published products', () => {
  const cat = JSON.parse(readFileSync(join(dist, 'static', 'catalog.json'), 'utf8'));
  assert.equal(cat.products.length, 0);
});

test('missing legal data is highlighted, not invented', () => {
  const pr = readFileSync(join(dist, 'fr', 'legal', 'mentions', 'index.html'), 'utf8');
  assert.match(pr, /\[À COMPLÉTER: SIREN\]/);
});

test('draft legal pages are marked as drafts', () => {
  const pr = readFileSync(join(dist, 'fr', 'legal', 'privacy', 'index.html'), 'utf8');
  assert.match(pr, /Brouillon/);
});

test('publication gate refuses to build while data is missing', () => {
  const r = spawnSync(process.execPath, [join(root, 'src', 'build.mjs'), '--prod'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ПУБЛИКАЦИЯ ЗАБЛОКИРОВАНА/);
  assert.match(r.stderr, /не заполнено: siteUrl/);
});

test('hosting: _headers and robots are generated', () => {
  assert.match(readFileSync(join(dist, '_headers'), 'utf8'), /Strict-Transport-Security/);
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Sitemap: /);
  assert.equal(existsSync(join(dist, 'static', 'fonts', 'fonts.css')), true);
});

test('draft service pages: noindex, banner, out of sitemap and navigation', () => {
  const drafts = ['consultations', 'child-nutrition', 'adult-nutrition', 'menus', 'support'];
  const xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  const home = readFileSync(join(dist, 'ru', 'index.html'), 'utf8');
  for (const d of drafts) {
    for (const l of ['ru', 'fr', 'en']) {
      const html = readFileSync(join(dist, l, d, 'index.html'), 'utf8');
      assert.match(html, /name="robots" content="noindex, nofollow"/, `${l}/${d}`);
      assert.match(html, /class="draft-banner"/, `${l}/${d}`);
    }
    assert.equal(xml.includes(`/${d}/`), false, `${d} must not be in sitemap`);
    assert.equal(home.includes(`href="/ru/${d}/"`), false, `${d} must not be linked from the home page`);
  }
});

test('bundle: approved prices are shown (EUR everywhere, RUB on the Russian site), not sold while unpublished', () => {
  const ru = readFileSync(join(dist, 'ru', 'shop', 'parent-guides-bundle', 'index.html'), 'utf8');
  assert.match(ru, /19,90\s€/);
  assert.match(ru, /2\s000\s₽/);
  const fr = readFileSync(join(dist, 'fr', 'shop', 'parent-guides-bundle', 'index.html'), 'utf8');
  assert.match(fr, /19,90\s€/);
  assert.equal(/₽/.test(fr), false);
  assert.equal(/data-add-sku=/.test(ru), false, 'unpublished bundle must not have a buy button');
  const guide = readFileSync(join(dist, 'en', 'shop', 'complementary-feeding-guide', 'index.html'), 'utf8');
  assert.match(guide, /Price to be confirmed/);
});
