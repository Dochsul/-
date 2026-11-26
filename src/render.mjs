// HTML rendering for the static site. Pure functions: content in, HTML string out.
// No inline scripts or styles (CSP: script-src 'self', style-src 'self').

import { business } from './config/business.mjs';
import { services } from './config/services.mjs';
import { products } from './config/catalog.mjs';

export const LOCALES = ['ru', 'fr', 'en'];
export const DEFAULT_LOCALE = 'en'; // x-default

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Route table: id is the key in content.pages; path is relative to /<locale>/
export const ROUTES = [
  { id: 'home', path: '' },
  { id: 'about', path: 'about/' },
  { id: 'consultations', path: 'consultations/', draft: true },
  { id: 'childNutrition', path: 'child-nutrition/', draft: true },
  { id: 'adultNutrition', path: 'adult-nutrition/', draft: true },
  { id: 'menus', path: 'menus/', draft: true },
  { id: 'support', path: 'support/', draft: true },
  { id: 'shop', path: 'shop/' },
  { id: 'guides', path: 'guides/' },
  { id: 'reviews', path: 'reviews/' },
  { id: 'community', path: 'community/' },
  { id: 'blog', path: 'blog/' },
  { id: 'faq', path: 'faq/' },
  { id: 'contact', path: 'contact/' },
  { id: 'cart', path: 'cart/', noindex: true },
  { id: 'checkoutSuccess', path: 'checkout/success/', noindex: true },
  { id: 'checkoutCancel', path: 'checkout/cancel/', noindex: true },
  { id: 'legalMentions', path: 'legal/mentions/' },
  { id: 'legalPrivacy', path: 'legal/privacy/' },
  { id: 'legalTerms', path: 'legal/terms-of-sale/' },
  { id: 'legalRefunds', path: 'legal/refunds/' },
  { id: 'legalDigital', path: 'legal/digital-products/' },
  { id: 'legalCookies', path: 'legal/cookies/' },
];

// Draft routes: built for preview but not published (noindex, out of sitemap and navigation).
// Owner's instruction: consultations, menus and support stay drafts until the legal right to provide them in France is confirmed.
export const DRAFT_IDS = ROUTES.filter((r) => r.draft).map((r) => r.id);

export const LEGAL_IDS = ['legalMentions', 'legalPrivacy', 'legalTerms', 'legalRefunds', 'legalDigital', 'legalCookies'];

// Canonical site origin. In development a clearly non-production placeholder is used.
export function origin() {
  return (business.siteUrl || process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
}

export const localePath = (locale, path = '') => `/${locale}/${path}`;
export const absUrl = (locale, path = '') => origin() + localePath(locale, path);

export function price(cents, currency, locale) {
  if (cents == null) return null;
  const tag = { ru: 'ru-RU', fr: 'fr-FR', en: 'en-GB' }[locale];
  // Whole-rouble prices are shown without kopecks (2 000 ₽); euros always keep cents (19,90 €).
  const whole = currency === 'RUB' && cents % 100 === 0;
  return new Intl.NumberFormat(tag, { style: 'currency', currency, ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}) }).format(cents / 100);
}

// A product can be bought only when it is published, its content and price are confirmed, and it has an EUR price.
export const isSellable = (p) => !!(p.published && p.contentConfirmed && p.priceConfirmed && p.prices?.EUR != null);

// Confirmed prices: EUR everywhere; the Russian version also shows the approved RUB price.
export function productPriceText(p, locale, c) {
  if (!p.priceConfirmed || p.prices?.EUR == null) return c.ui.priceToConfirm;
  const eur = price(p.prices.EUR, 'EUR', locale);
  return locale === 'ru' && p.prices.RUB != null ? `${eur} · ${price(p.prices.RUB, 'RUB', locale)}` : eur;
}

// ---------- Layout pieces ----------

function header(c, locale, route) {
  const u = c.ui;
  const navLinks = c.nav.filter((n) => n.primary && !DRAFT_IDS.includes(n.id)).map((n) => {
    const href = localePath(locale, n.path);
    const current = n.id === route.id ? ' aria-current="page"' : '';
    return `<a href="${href}"${current}>${esc(n.label)}</a>`;
  }).join('');
  const langs = LOCALES.map((l) => {
    const current = l === locale ? ' aria-current="true"' : '';
    return `<a href="${localePath(l, route.path)}" lang="${l}" hreflang="${l}"${current}>${l.toUpperCase()}</a>`;
  }).join('');
  return `
<a class="skip-link" href="#main">${esc(u.skip)}</a>
<header class="site-header" id="top">
  <div class="container header-inner">
    <a class="brand" href="${localePath(locale)}" aria-label="${esc(business.brand)}">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="34" height="34"><circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M24 12c-5 6-5 18 0 24 5-6 5-18 0-24z" fill="currentColor"/></svg>
      </span>
      <span class="brand-text">AINA <em>Évidence</em></span>
    </a>
    <button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="site-nav">
      <span class="sr-only">${esc(u.menu)}</span><span aria-hidden="true" class="bars"></span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="${esc(u.menu)}">
      ${navLinks}
      <div class="lang-switch" role="group" aria-label="${esc(u.language)}">${langs}</div>
    </nav>
    <a class="cart-link" href="${localePath(locale, 'cart/')}" aria-label="${esc(u.cart)}">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 8H7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="19.5" r="1.3" fill="currentColor"/><circle cx="17" cy="19.5" r="1.3" fill="currentColor"/></svg>
      <span class="cart-count" data-cart-count hidden>0</span>
    </a>
  </div>
</header>`;
}

function footer(c, locale) {
  const f = c.footer;
  const L = business.legal;
  const legal = [
    ['legalMentions', c.legalLinks.mentions], ['legalPrivacy', c.legalLinks.privacy], ['legalTerms', c.legalLinks.terms],
    ['legalRefunds', c.legalLinks.refunds], ['legalDigital', c.legalLinks.digital], ['legalCookies', c.legalLinks.cookies],
  ].map(([id, label]) => `<a href="${localePath(locale, ROUTES.find((r) => r.id === id).path)}">${esc(label)}</a>`).join('');
  return `
<footer class="site-footer">
  <div class="container">
    <p class="disclaimer">${esc(f.disclaimer)}</p>
    <div class="footer-grid">
      <div>
        <p class="footer-brand">${esc(business.brand)}</p>
        <p>${esc(business.owner.qualification[locale])}</p>
        <p>${esc(f.remote)}</p>
      </div>
      <div>
        <p class="footer-h">${esc(f.contacts)}</p>
        <p><a href="mailto:${esc(business.contactEmail)}">${esc(business.contactEmail)}</a></p>
        <p><a href="${business.messenger.whatsapp}" rel="noopener noreferrer" target="_blank">WhatsApp</a> · <a href="${business.messenger.telegram}" rel="noopener noreferrer" target="_blank">Telegram</a></p>
      </div>
      <div>
        <p class="footer-h">${esc(f.legal)}</p>
        <nav class="footer-legal" aria-label="${esc(f.legal)}">${legal}</nav>
      </div>
    </div>
    <nav class="footer-sections" aria-label="${esc(c.ui.menu)}">${c.nav.filter((n) => !DRAFT_IDS.includes(n.id)).map((n) => `<a href="${localePath(locale, n.path)}">${esc(n.label)}</a>`).join('')}</nav>
    <p class="copyright">&copy; ${new Date().getFullYear()} ${esc(business.brand)}. ${esc(f.rights)}</p>
  </div>
</footer>`;
}

// ---------- Sections ----------


function renderSection(s, ctx) {
  const { c, locale } = ctx;
  const h = (text, level = 2) => (text ? `<h${level}>${esc(text)}</h${level}>` : '');
  switch (s.type) {
    case 'hero':
      return `<section class="hero reveal">
  <div class="container hero-inner">
    ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
    <h1>${esc(s.h1)}</h1>
    ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}
    ${s.actions?.length ? `<div class="actions">${s.actions.map((a) => `<a class="btn ${a.primary ? 'btn-primary' : 'btn-ghost'}" href="${localePath(locale, a.href)}">${esc(a.label)}</a>`).join('')}</div>` : ''}
  </div>
</section>`;
    case 'text':
      return `<section class="block reveal">${h(s.h)}${(s.paras || []).map((p) => `<p>${esc(p)}</p>`).join('')}</section>`;
    case 'list':
      return `<section class="block reveal">${h(s.h)}<ul class="checklist">${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
    case 'cards':
    case 'steps':
      return `<section class="block reveal">${h(s.h)}<div class="cards ${s.type === 'steps' ? 'steps' : ''}">${s.items.map((i, n) => `<article class="card">${s.type === 'steps' ? `<span class="step-n">${String(n + 1).padStart(2, '0')}</span>` : ''}<h3>${esc(i.t)}</h3><p>${esc(i.p)}</p></article>`).join('')}</div></section>`;
    case 'cta':
      return `<section class="cta-band reveal"><div class="container"><h2>${esc(s.h)}</h2>${s.p ? `<p>${esc(s.p)}</p>` : ''}<a class="btn btn-primary" href="${localePath(locale, s.href)}">${esc(s.label)}</a></div></section>`;
    case 'communityLinks': {
      // Free groups. A group link missing in business.mjs shows the pending note instead of a broken button.
      const cards = s.items.map((it) => {
        const href = it.platform === 'whatsapp' ? business.community?.whatsappGroup : business.community?.telegramGroup;
        const action = href
          ? `<a class="btn btn-primary" href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(it.button)}</a>`
          : `<p class="note">${esc(s.pendingWhatsapp)}</p>`;
        return `<article class="card community-card">
  <h3>${esc(it.h)}</h3>
  <ul class="community-list">${it.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  ${action}
</article>`;
      }).join('');
      return `<section class="block reveal"><div class="cards community-cards">${cards}</div></section>`;
    }
    case 'notice':
      return `<section class="block reveal"><div class="notice" role="note">${(Array.isArray(s.p) ? s.p : [s.p]).map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>`;
    case 'empty':
      return `<section class="block reveal"><div class="empty">${h(s.h, 2)}<p>${esc(s.p)}</p>${s.cta ? `<a class="btn btn-ghost" href="${localePath(locale, s.cta.href)}">${esc(s.cta.label)}</a>` : ''}</div></section>`;
    case 'services': {
      const items = services.filter((x) => x.group === s.group);
      const cards = items.map((svc) => {
        const t = c.services[svc.id];
        // RUB for Russian, EUR for French and English. EUR is null until the owner approves a European tariff.
        const amount = locale === 'ru' ? svc.rub : svc.eur;
        const currency = locale === 'ru' ? 'RUB' : 'EUR';
        const priceLabel = business.pricesConfirmed && amount != null
          ? price(amount * 100, currency, locale)
          : c.ui.priceToConfirm;
        return `<article class="card service">
  <h3>${esc(t.t)}</h3>
  <p class="price">${esc(priceLabel)}</p>
  <p>${esc(t.p)}</p>
  <a class="btn btn-ghost" href="${localePath(locale, 'contact/')}?topic=${svc.topic}">${esc(c.ui.bookLabel)}</a>
</article>`;
      }).join('');
      return `<section class="block reveal">${h(s.h)}<div class="cards">${cards}</div></section>`;
    }
    case 'lead':
      return renderLead(s, ctx);
    case 'faq':
      return `<section class="block reveal">${h(s.h)}<div class="faq">${s.items.map((i) => `<details><summary>${esc(i.q)}</summary><p>${esc(i.a)}</p></details>`).join('')}</div></section>`;
    case 'products':
      return renderProductGrid(ctx, s);
    case 'cart':
      return renderCart(ctx);
    case 'checkoutResult': {
      const k = s.kind === 'success' ? 'success' : 'cancel';
      return `<section class="block reveal checkout-result" data-result="${k}" data-paid-title="${esc(c.ui.paidTitle)}" data-paid-text="${esc(c.ui.paidText)}" data-pending-text="${esc(c.ui.pendingText)}" data-unpaid-title="${esc(c.ui.unpaidTitle)}" data-unpaid-text="${esc(c.ui.unpaidText)}" data-review-title="${esc(c.ui.reviewTitle)}" data-review-text="${esc(c.ui.reviewText)}"><h1>${esc(c.ui[k + 'Title'])}</h1><p data-result-text>${esc(c.ui[k + 'Text'])}</p><a class="btn btn-ghost" href="${localePath(locale, 'shop/')}">${esc(c.ui.backToShop)}</a></section>`;
    }
    default:
      throw new Error(`Unknown section type: ${s.type}`);
  }
}

function renderLead(s, ctx) {
  const { c, locale } = ctx;
  const f = c.forms.lead;
  const topics = c.forms.topics.map(([v, label]) => `<option value="${v}"${v === s.topic ? ' selected' : ''}>${esc(label)}</option>`).join('');
  return `<section class="block reveal" id="contact-form-section">
  ${s.h ? `<h2>${esc(s.h)}</h2>` : ''}
  ${s.p ? `<p>${esc(s.p)}</p>` : ''}
  <form class="form" id="lead-form" novalidate data-kind="lead" data-success="${esc(f.success)}" data-error="${esc(f.error)}" data-fallback="${esc(f.fallback)}">
    <input type="hidden" name="locale" value="${locale}">
    <div class="field"><label for="lead-name">${esc(f.name)} <span class="req" aria-hidden="true">*</span></label>
      <input id="lead-name" name="name" type="text" autocomplete="name" required maxlength="120"></div>
    <div class="field"><label for="lead-email">${esc(f.email)} <span class="req" aria-hidden="true">*</span></label>
      <input id="lead-email" name="email" type="email" autocomplete="email" required maxlength="200"></div>
    <div class="field"><label for="lead-phone">${esc(f.phone)}</label>
      <input id="lead-phone" name="phone" type="tel" autocomplete="tel" maxlength="40"></div>
    <div class="field"><label for="lead-topic">${esc(f.topic)} <span class="req" aria-hidden="true">*</span></label>
      <select id="lead-topic" name="topic" required><option value="">${esc(f.choose)}</option>${topics}</select></div>
    <div class="field"><label for="lead-message">${esc(f.message)}</label>
      <textarea id="lead-message" name="message" rows="4" maxlength="500" aria-describedby="lead-msg-hint"></textarea>
      <p class="hint" id="lead-msg-hint">${esc(f.messageHint)}</p></div>
    <div class="field check"><input id="lead-consent" name="consent" type="checkbox" required>
      <label for="lead-consent">${esc(f.consent)} <span class="req" aria-hidden="true">*</span> <a href="${localePath(locale, ROUTES.find((r) => r.id === 'legalPrivacy').path)}">${esc(c.legalLinks.privacy)}</a></label></div>
    <div class="hp" aria-hidden="true"><label>${esc(f.honeypot)} <input name="website" tabindex="-1" autocomplete="off"></label></div>
    <button class="btn btn-primary" type="submit">${esc(f.submit)}</button>
    <p class="form-status" role="status" aria-live="polite"></p>
  </form>
</section>`;
}

function renderProductGrid(ctx, s) {
  const { c, locale } = ctx;
  const shown = products.filter((p) => p.published);
  const body = shown.length
    ? `<div class="cards products">${shown.map((p) => productCard(p, ctx)).join('')}</div>`
    : `<div class="empty"><p>${esc(c.ui.shopEmpty)}</p></div>`;
  const soon = products.filter((p) => !p.published).map((p) => productCard(p, ctx, true)).join('');
  return `<section class="block reveal">${s.h ? `<h2>${esc(s.h)}</h2>` : ''}${s.p ? `<p>${esc(s.p)}</p>` : ''}${body}
  ${soon ? `<h3 class="sub">${esc(c.ui.comingSoon)}</h3><div class="cards products">${soon}</div>` : ''}</section>`;
}

export function productCard(p, ctx, dimmed = false) {
  const { c, locale } = ctx;
  const t = p.i18n[locale];
  const priceText = productPriceText(p, locale, c);
  const buy = isSellable(p)
    ? `<button class="btn btn-primary" type="button" data-add-sku="${p.sku}">${esc(c.ui.addToCart)}</button>`
    : `<span class="pill">${esc(c.ui.comingSoon)}</span>`;
  return `<article class="card product${dimmed ? ' dimmed' : ''}">
  <h3><a href="${localePath(locale, `shop/${p.sku}/`)}">${esc(t.title)}</a></h3>
  <p>${esc(t.summary)}</p>
  <p class="price">${esc(priceText)}</p>
  <div class="card-actions"><a class="btn btn-ghost" href="${localePath(locale, `shop/${p.sku}/`)}">${esc(c.ui.details)}</a> ${buy}</div>
</article>`;
}

// ---------- Layout ----------

export function layout({ c, locale, route, title, description, body, jsonld = [], ogType = 'website', breadcrumbs = null }) {
  const path = route.path;
  const canonical = absUrl(locale, path);
  const alternates = LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${absUrl(l, path)}">`).join('\n  ');
  const xdef = `<link rel="alternate" hreflang="x-default" href="${absUrl(DEFAULT_LOCALE, path)}">`;
  const robots = route.noindex || route.draft ? 'noindex, nofollow' : 'index, follow';
  const ld = [...jsonld];
  if (breadcrumbs) {
    ld.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: absUrl(locale, b.path) })),
    });
  }
  const ldHtml = ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n  ');
  const bc = breadcrumbs ? `<nav class="breadcrumbs" aria-label="${esc(c.ui.breadcrumbs)}"><ol>${breadcrumbs.map((b, i) => (i === breadcrumbs.length - 1 ? `<li aria-current="page">${esc(b.name)}</li>` : `<li><a href="${localePath(locale, b.path)}">${esc(b.name)}</a></li>`)).join('')}</ol></nav>` : '';
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical}">
  ${alternates}
  ${xdef}
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="${esc(business.brand)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${{ ru: 'ru_RU', fr: 'fr_FR', en: 'en_GB' }[locale]}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
  <link rel="stylesheet" href="/static/fonts/fonts.css">
  <link rel="stylesheet" href="/static/styles.css">
  <meta name="theme-color" content="#FFF4E9">
  ${ldHtml}
</head>
<body>
${header(c, locale, route)}
<main id="main" tabindex="-1">
${bc}
${body}
</main>
${footer(c, locale)}
<script src="/static/app.js" defer></script>
</body>
</html>
`;
}

// Page body from a content page definition
export function renderPage(c, locale, route, page) {
  const ctx = { c, locale, route };
  const sections = page.sections.map((s) => renderSection(s, ctx)).join('\n');
  const banner = route.draft ? `<div class="draft-banner" role="note">${esc(c.ui.draftPage)}</div>` : '';
  return banner + sections;
}

function renderCart(ctx) {
  const { c, locale } = ctx;
  const f = c.checkoutForms;
  const disabled = !business.payments.enabled;
  return `<section class="block cart reveal" data-cart-page data-locale="${locale}" data-payments="${disabled ? 'off' : 'on'}" data-remove-label="${esc(c.ui.cartRemove)}" data-load-error="${esc(c.ui.cartLoadError)}">
  <h1>${esc(c.ui.cartTitle)}</h1>
  <p class="cart-empty" data-cart-empty>${esc(c.ui.cartEmpty)}</p>
  <table class="cart-table" data-cart-table hidden>
    <thead><tr><th scope="col">${esc(c.ui.cartTitle)}</th><th scope="col">${esc(c.ui.cartTotal)}</th><th scope="col"><span class="sr-only">${esc(c.ui.cartRemove)}</span></th></tr></thead>
    <tbody data-cart-rows></tbody>
  </table>
  <p class="cart-total" data-cart-total hidden><strong>${esc(c.ui.cartTotal)}:</strong> <span data-cart-sum></span></p>
  <p class="hint">${esc(c.ui.priceNote)}</p>
  <div class="cart-actions"><a class="btn btn-ghost" href="${localePath(locale, 'shop/')}">${esc(c.ui.continueShopping)}</a></div>
  <div data-checkout hidden>
    <h2>${esc(c.ui.checkoutTitle)}</h2>
    ${disabled ? `<div class="notice" role="note"><p>${esc(c.ui.checkoutDisabled)}</p></div>` : ''}
    <form class="form" id="checkout-form" novalidate data-kind="checkout" data-error="${esc(f.error)}">
      <input type="hidden" name="locale" value="${locale}">
      <div class="field"><label for="co-email">${esc(c.ui.checkoutEmail)} <span class="req" aria-hidden="true">*</span></label>
        <input id="co-email" name="email" type="email" autocomplete="email" required maxlength="200"></div>
      <div class="field check"><input id="co-terms" name="acceptTerms" type="checkbox" required><label for="co-terms">${esc(c.ui.checkoutConsentTerms)} <span class="req" aria-hidden="true">*</span></label></div>
      <div class="field check"><input id="co-digital" name="acceptDigital" type="checkbox" required><label for="co-digital">${esc(c.ui.checkoutConsentDigital)} <span class="req" aria-hidden="true">*</span></label></div>
      <p class="hint">${esc(c.ui.checkoutNote)}</p>
      <button class="btn btn-primary" type="submit" ${disabled ? 'disabled' : ''}>${esc(c.ui.checkoutSubmit)}</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>`;
}

export function productPageBody(c, locale, product) {
  const t = product.i18n[locale];
  const ctx = { c, locale };
  const priceText = productPriceText(product, locale, c);
  const buy = isSellable(product)
    ? `<button class="btn btn-primary" type="button" data-add-sku="${product.sku}">${esc(c.ui.addToCart)}</button>`
    : `<span class="pill">${esc(c.ui.productNotPublished)}</span>`;
  const how = c.productPage.how.map((h, i) => `<li><span class="step-n">${i + 1}</span><div><strong>${esc(h.t)}</strong><p>${esc(h.p)}</p></div></li>`).join('');
  return `<section class="product-hero reveal">
  <div class="container product-grid">
    <div>
      <h1>${esc(t.title)}</h1>
      <p class="lead">${esc(t.summary)}</p>
      <p class="price">${esc(priceText)}</p>
      <div class="actions">${buy}</div>
      <p class="hint">${esc(c.ui.shopNote)}</p>
    </div>
    <aside class="product-side" aria-label="${esc(c.productPage.previewTitle)}">
      <h2>${esc(c.productPage.previewTitle)}</h2>
      ${product.preview ? `<p><a href="${esc(product.preview)}">${esc(c.productPage.previewTitle)} (PDF)</a></p>` : `<p class="hint">${esc(c.productPage.previewNone)}</p>`}
    </aside>
  </div>
</section>
<section class="block reveal"><h2>${esc(c.productPage.includesTitle)}</h2><ul class="checklist">${t.topics.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="hint">${esc(c.productPage.contentPending)}</p></section>
<section class="block reveal"><h2>${esc(c.productPage.howTitle)}</h2><ol class="steps-list">${how}</ol></section>
<section class="block reveal"><div class="notice"><p>${esc(c.productPage.notice)}</p></div></section>`;
}

export { renderSection, renderLead };
