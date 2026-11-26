// Static site build: node src/build.mjs            (development: placeholders allowed)
//                   node src/build.mjs --prod      (publication gate: refuses to build until everything is confirmed)
// Output: dist/. No dependencies.

import { mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { business } from './config/business.mjs';
import { products } from './config/catalog.mjs';
import { ROUTES, LEGAL_IDS, LOCALES, DEFAULT_LOCALE, esc, origin, absUrl, localePath, layout, renderPage, productPageBody, isSellable } from './render.mjs';
import contentRu from './content/ru.mjs';
import contentFr from './content/fr.mjs';
import contentEn from './content/en.mjs';
import legalRu from './legal/ru.mjs';
import legalFr from './legal/fr.mjs';
import legalEn from './legal/en.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = join(root, 'dist');
const PROD = process.argv.includes('--prod');

const CONTENT = { ru: contentRu, fr: contentFr, en: contentEn };
const LEGAL = { ru: legalRu, fr: legalFr, en: legalEn };
const TODO = { ru: 'УКАЗАТЬ', fr: 'À COMPLÉTER', en: 'TO COMPLETE' };

// ---------- Gate: what must be known before publication ----------
const gateIssues = [];
const missing = new Set();

function lookup(path, locale) {
  const map = {
    'contact.email': business.contactEmail,
    'contact.phone': business.contactPhone,
    'owner.displayName': business.owner.displayName,
    'owner.qualification': business.owner.qualification[locale],
    'business.paymentMethods': business.paymentMethods,
    'business.paymentProviderEntity': business.paymentProviderEntity,
  };
  if (path in map) return map[path];
  const [group, key] = path.split('.');
  const src = { legal: business.legal, policy: business.policy, download: business.download }[group];
  return src ? src[key] : undefined;
}

// Replace {{path|label}} tokens. Returns HTML-safe string.
export function resolveTokens(text, locale) {
  const parts = String(text).split(/(\{\{[^}]+\}\})/);
  return parts.map((part) => {
    const m = part.match(/^\{\{([^|}]+)\|?([^}]*)\}\}$/);
    if (!m) return esc(part);
    const [, path, label] = m;
    const value = lookup(path.trim(), locale);
    if (value === null || value === undefined || value === '') {
      missing.add(path.trim());
      return `<mark class="todo">[${TODO[locale]}: ${esc(label || path)}]</mark>`;
    }
    return esc(value);
  }).join('');
}

// Required fields for production (anything null blocks publication)
const REQUIRED = [
  ['siteUrl', business.siteUrl],
  ['legal.legalName', business.legal.legalName],
  ['legal.legalForm', business.legal.legalForm],
  ['legal.siren', business.legal.siren],
  ['legal.address', business.legal.address],
  ['legal.publicationDirector', business.legal.publicationDirector],
  ['legal.hostProvider', business.legal.hostProvider],
  ['legal.mediator', business.legal.mediator],
  ['policy.retentionMonths', business.policy.retentionMonths],
  ['policy.refundWindowHours', business.policy.refundWindowHours],
  ['policy.refundDays', business.policy.refundDays],
  ['policy.governingLaw', business.policy.governingLaw],
  ['policy.courtLocation', business.policy.courtLocation],
  ['policy.transfers', business.policy.transfers],
  ['policy.lateCancellation', business.policy.lateCancellation],
  ['business.paymentMethods', business.paymentMethods],
  ['business.paymentProviderEntity', business.paymentProviderEntity],
];
for (const [name, value] of REQUIRED) {
  if (value === null || value === undefined || value === '') gateIssues.push(`не заполнено: ${name}`);
}
if (!business.pricesConfirmed) gateIssues.push('цены консультаций не подтверждены (business.pricesConfirmed)');
if (!business.legalReviewed) gateIssues.push('юридические документы не проверены юристом (business.legalReviewed)');
for (const p of products) {
  if (p.published && !isSellable(p)) gateIssues.push(`товар ${p.sku} опубликован без подтверждённой цены или содержания`);
}

// ---------- Layout helpers ----------
function parityCheck() {
  const shape = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => {
    const key = prefix + k;
    return v && typeof v === 'object' && !Array.isArray(v) ? shape(v, key + '.') : [key];
  });
  const base = shape(CONTENT.ru).sort();
  for (const l of ['fr', 'en']) {
    const other = shape(CONTENT[l]).sort();
    const a = new Set(base), b = new Set(other);
    const onlyRu = base.filter((k) => !b.has(k)), onlyL = other.filter((k) => !a.has(k));
    if (onlyRu.length || onlyL.length) throw new Error(`Content keys differ for ${l}: ${[...onlyRu, ...onlyL].join(', ')}`);
  }
}

function legalBody(locale, id) {
  const doc = LEGAL[locale][id.replace('legal', '').replace(/^./, (c) => c.toLowerCase()).replace('terms', 'terms')];
  return doc;
}

const LEGAL_KEY = { legalMentions: 'mentions', legalPrivacy: 'privacy', legalTerms: 'terms', legalRefunds: 'refunds', legalDigital: 'digital', legalCookies: 'cookies' };

function renderLegalBody(locale, routeId) {
  const doc = LEGAL[locale][LEGAL_KEY[routeId]];
  const frDoc = legalFr[LEGAL_KEY[routeId]];
  const notice = doc.notice ? `<div class="notice" role="note"><p>${esc(doc.notice)}</p></div>` : '';
  const draft = `<div class="notice draft" role="note"><p>${esc(TODO_DRAFT[locale])}</p></div>`;
  const sections = doc.sections.map((s) => {
    const paras = (s.paras || []).map((p) => `<p>${resolveTokens(p, locale)}</p>`).join('');
    const items = s.items ? `<ul class="checklist">${s.items.map((i) => `<li>${resolveTokens(i, locale)}</li>`).join('')}</ul>` : '';
    return `<section class="legal-section"><h2>${esc(s.h)}</h2>${paras}${items}</section>`;
  }).join('');
  const frLink = locale !== 'fr' ? `<p class="hint"><a href="${localePath('fr', ROUTES.find((r) => r.id === routeId).path)}">Version française (juridiquement contraignante)</a></p>` : '';
  return `<article class="legal reveal"><h1>${esc(doc.title)}</h1>${draft}${notice}${frLink}${sections}</article>`;
}

const TODO_DRAFT = {
  ru: 'Черновик. Юридические тексты не опубликованы до проверки юристом.',
  fr: 'Brouillon. Ces textes ne seront publiés qu’après relecture par un juriste.',
  en: 'Draft. These texts will not be published before review by a lawyer.',
};

// ---------- Build ----------
function writePage(locale, path, html) {
  const dir = join(dist, locale, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
}

function build() {
  parityCheck();
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, 'site', 'static'), join(dist, 'static'), { recursive: true });
  cpSync(join(root, 'site', 'static', 'favicon.svg'), join(dist, 'favicon.svg'));

  const pages = []; // for sitemap

  for (const locale of LOCALES) {
    const c = CONTENT[locale];
    const route0 = (id) => ROUTES.find((r) => r.id === id);

    for (const route of ROUTES) {
      let body; let title; let description; let jsonld = []; let breadcrumbs = null; let ogType = 'website';
      if (LEGAL_IDS.includes(route.id)) {
        const doc = LEGAL[locale][LEGAL_KEY[route.id]];
        title = `${doc.title} — ${business.brand}`;
        description = doc.description;
        body = renderLegalBody(locale, route.id);
        breadcrumbs = [{ name: c.footer.legal, path: '' }, { name: doc.title, path: route.path }];
      } else {
        const page = c.pages[route.id];
        title = page.title;
        description = page.description;
        body = renderPage(c, locale, route, page);
        if (route.id === 'home') {
          jsonld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: business.brand, url: absUrl(locale), inLanguage: locale });
          jsonld.push({ '@context': 'https://schema.org', '@type': 'Organization', name: business.brand, url: absUrl(locale), email: business.contactEmail, telephone: business.contactPhone, sameAs: [business.messenger.telegram] });
        }
        if (route.id === 'about') {
          jsonld.push({ '@context': 'https://schema.org', '@type': 'Person', name: business.owner.displayName, jobTitle: business.owner.qualification[locale], url: absUrl(locale, 'about/'), worksFor: { '@type': 'Organization', name: business.brand } });
        }
        if (route.id === 'faq') {
          const faq = page.sections.find((s) => s.type === 'faq');
          jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) });
        }
        if (!['home', 'cart', 'checkoutSuccess', 'checkoutCancel'].includes(route.id)) {
          breadcrumbs = [{ name: c.nav.find((n) => n.id === route.id)?.label || title, path: route.path }];
          breadcrumbs = [{ name: 'AINA Évidence', path: '' }, ...breadcrumbs];
        }
      }
      const html = layout({ c, locale, route, title, description, body, jsonld, ogType, breadcrumbs });
      writePage(locale, route.path, html);
      if (!route.noindex && !route.draft) pages.push({ locale, path: route.path });
    }

    // Product detail pages (noindex until published)
    for (const p of products) {
      const t = p.i18n[locale];
      const route = { id: 'product', path: `shop/${p.sku}/`, noindex: !p.published };
      const ldProduct = isSellable(p) ? [{
        '@context': 'https://schema.org', '@type': 'Product', name: t.title, description: t.summary,
        url: absUrl(locale, route.path), offers: { '@type': 'Offer', price: (p.prices.EUR / 100).toFixed(2), priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: absUrl(locale, route.path) },
      }] : [];
      const body = productPageBody(c, locale, p);
      const html = layout({
        c, locale, route, title: `${t.title} — ${business.brand}`, description: t.summary, body, ogType: 'product', jsonld: ldProduct,
        breadcrumbs: [{ name: 'AINA Évidence', path: '' }, { name: c.nav.find((n) => n.id === 'shop').label, path: 'shop/' }, { name: t.title, path: route.path }],
      });
      writePage(locale, route.path, html);
      if (!route.noindex) pages.push({ locale, path: route.path });
    }
  }

  // 404 (English) and language chooser at root
  const notFound = layout({
    c: CONTENT[DEFAULT_LOCALE], locale: DEFAULT_LOCALE, route: { id: 'notFound', path: '', noindex: true },
    title: `${CONTENT[DEFAULT_LOCALE].notFound.title} — ${business.brand}`, description: CONTENT[DEFAULT_LOCALE].notFound.p,
    body: `<section class="block"><h1>${esc(CONTENT[DEFAULT_LOCALE].notFound.title)}</h1><p>${esc(CONTENT[DEFAULT_LOCALE].notFound.p)}</p><a class="btn btn-primary" href="${localePath(DEFAULT_LOCALE)}">${esc(CONTENT[DEFAULT_LOCALE].pages.home.title.split('—')[0].trim())}</a></section>`,
  });
  writeFileSync(join(dist, '404.html'), notFound.replace('<link rel="canonical"', '<meta name="robots" content="noindex"><link rel="canonical"'), 'utf8');

  writeFileSync(join(dist, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; script-src 'none'; object-src 'none'; base-uri 'self'">
<title>${esc(business.brand)}</title><meta name="description" content="Choose your language / Choisissez votre langue / Выберите язык">
<link rel="stylesheet" href="/static/fonts/fonts.css"><link rel="stylesheet" href="/static/styles.css">
${LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${absUrl(l)}">`).join('')}
<link rel="alternate" hreflang="x-default" href="${absUrl(DEFAULT_LOCALE)}">
<link rel="canonical" href="${absUrl(DEFAULT_LOCALE)}"></head>
<body class="chooser"><main class="chooser-main"><p class="brand-chooser">${esc(business.brand)}</p>
<nav aria-label="Language / Langue / Язык"><ul class="chooser-list">
${LOCALES.map((l) => `<li><a href="${localePath(l)}" hreflang="${l}" lang="${l}">${{ ru: 'Русский', fr: 'Français', en: 'English' }[l]}</a></li>`).join('')}
</ul></nav></main></body></html>`, 'utf8');

  // Catalog for the client (published products only, prices as stored)
  const catalog = products.filter(isSellable).map((p) => ({
    sku: p.sku, prices: p.prices,
    title: Object.fromEntries(LOCALES.map((l) => [l, p.i18n[l].title])),
  }));
  writeFileSync(join(dist, 'static', 'catalog.json'), JSON.stringify({ products: catalog, checkoutCurrency: 'EUR' }), 'utf8');

  // Sitemap with hreflang alternates
  const urls = [];
  const bySlug = new Map();
  for (const p of pages) {
    const key = p.path;
    if (!bySlug.has(key)) bySlug.set(key, {});
    bySlug.get(key)[p.locale] = p;
  }
  for (const [path, byLoc] of bySlug) {
    for (const l of Object.keys(byLoc)) {
      const alts = LOCALES.filter((x) => byLoc[x]).map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${absUrl(x, path)}"/>`).join('\n');
      const xdef = byLoc[DEFAULT_LOCALE] ? `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(DEFAULT_LOCALE, path)}"/>` : '';
      urls.push(`  <url>\n    <loc>${absUrl(l, path)}</loc>\n${alts}${xdef}\n  </url>`);
    }
  }
  writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`, 'utf8');
  writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /*/cart/\nDisallow: /*/checkout/\n\nSitemap: ${origin()}/sitemap.xml\n`, 'utf8');

  // Security headers for static hosts that read _headers (Netlify, Cloudflare Pages)
  writeFileSync(join(dist, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: DENY
/static/*
  Cache-Control: public, max-age=31536000, immutable
`, 'utf8');

  return { pages: pages.length };
}

// Run
if (PROD && gateIssues.length) {
  console.error('ПУБЛИКАЦИЯ ЗАБЛОКИРОВАНА. Не заполнено:');
  for (const i of gateIssues) console.error(' - ' + i);
  console.error('Заполните docs/ANKETA.md и src/config/*.mjs, затем повторите.');
  process.exit(2);
}
const result = build();
const leftover = [...missing];
console.log(`Сборка готова: ${result.pages} страниц (${LOCALES.join(', ')}) → dist/`);
if (leftover.length) console.log(`Недостающие данные (подсвечены в документах): ${leftover.join(', ')}`);
if (gateIssues.length) console.log(`Гейт публикации (не блокирует dev-сборку): ${gateIssues.length} открытых пунктов.`);
if (PROD) console.log('Продакшен-сборка: все проверки пройдены.');
