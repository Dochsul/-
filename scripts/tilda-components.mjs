#!/usr/bin/env node
// Generates Tilda T123 (HTML block) components from the catalog and brand tokens.
// Output: tilda/components/*.html (+ preview.html for local testing; NOT for Tilda).
// Constraints honoured: every selector is scoped under a .ae-* root; no global resets; script wrapped in an IIFE that
// works only inside its own root; several instances per page are safe; no external libraries; all dynamic text is set
// with textContent; no secret is embedded (only the public API base URL, set per block in data-api).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from '../src/config/catalog.mjs';
import { business } from '../src/config/business.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tilda', 'components');

// Brand tokens + base styles, scoped to .ae (approved palette; contrast-checked, see docs/BRAND.md).
export const BASE_CSS = `
.ae{--ae-ivory:#FFF4E9;--ae-powder:#F3D6CF;--ae-lavender:#E4D3E4;--ae-gold:#B4883E;--ae-gold-light:#C9A35E;--ae-burgundy:#74283F;--ae-emerald:#174532;--ae-ink:#2E2427;--ae-ink-soft:#5C4A4E;--ae-line:#E9CFC7;--ae-danger:#A3261C;
  font-family:'Montserrat',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.65;color:var(--ae-ink);box-sizing:border-box;text-align:left}
.ae *,.ae *::before,.ae *::after{box-sizing:border-box}
.ae .ae-wrap{max-width:1160px;margin:0 auto;padding:0 20px}
.ae .ae-h{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;color:var(--ae-burgundy);line-height:1.2;margin:0 0 .5em}
.ae p{margin:0 0 .8em}
.ae a{color:var(--ae-emerald);text-underline-offset:3px}
.ae :focus-visible{outline:2px solid var(--ae-emerald);outline-offset:3px}
.ae .ae-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:12px 24px;border-radius:999px;border:1px solid transparent;font:500 15px/1.2 'Montserrat',system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;text-decoration:none;transition:background-color .3s ease,color .3s ease,transform .3s ease}
.ae .ae-btn--primary{background:linear-gradient(180deg,var(--ae-gold-light),var(--ae-gold));border-color:var(--ae-gold);color:var(--ae-ink)}
.ae .ae-btn--primary:hover{background:var(--ae-gold-light);transform:translateY(-1px)}
.ae .ae-btn--ghost{background:transparent;border-color:var(--ae-emerald);color:var(--ae-ink)}
.ae .ae-btn--ghost:hover{background:var(--ae-emerald);color:var(--ae-ivory)}
.ae .ae-btn[disabled]{opacity:.55;cursor:not-allowed;transform:none}
.ae .ae-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.ae *{transition-duration:.01ms!important}.ae .ae-btn--primary:hover{transform:none}}
`.trim();

const SHOP_I18N = {
  ru: {
    title: 'Гайды для родителей', add: 'В корзину', inCart: 'В корзине', remove: 'Убрать', cart: 'Корзина', empty: 'Корзина пуста.',
    total: 'Итого', email: 'Email для получения файлов', terms: 'Я принимаю условия продажи и политику возврата', digital: 'Я прошу немедленно предоставить цифровой продукт и понимаю, что после получения доступа право на отказ от покупки не применяется',
    rules: 'Правила', submit: 'Перейти к оплате', payNote: 'Оплата проходит на защищённой странице Revolut. Ссылки на файлы приходят на email только после подтверждения оплаты.', country: 'Страна плательщика (для оплаты)', countryPick: 'Выберите страну',
    soon: 'Скоро', priceTbc: 'Цена уточняется', paymentsOff: 'Оплата пока не подключена. Магазин откроется после запуска платежей.',
    apiDown: 'Магазин временно недоступен. Попробуйте позже или напишите нам.', bundleSwap: 'Комплект уже включает этот гайд: выбран только комплект.',
    rubNote: 'Оплата в рублях пока недоступна, заказ оплачивается в евро.', redirecting: 'Переход к оплате…',
    errors: { product_unavailable: 'Этот товар сейчас недоступен.', currency_not_enabled: 'Эта валюта пока недоступна для оплаты.', bundle_overlap: 'Комплект уже включает выбранный гайд.', payments_disabled: 'Оплата пока не подключена.', validation: 'Проверьте email и отметьте оба согласия.', rate_limited: 'Слишком много попыток. Подождите несколько минут.', generic: 'Не удалось начать оплату. Попробуйте ещё раз.' },
  },
  fr: {
    title: 'Guides pour parents', add: 'Ajouter au panier', inCart: 'Dans le panier', remove: 'Retirer', cart: 'Panier', empty: 'Votre panier est vide.',
    total: 'Total', email: 'E-mail pour recevoir les fichiers', terms: 'J’accepte les conditions générales de vente et la politique de remboursement', digital: 'Je demande la fourniture immédiate du contenu numérique et je reconnais perdre mon droit de rétractation une fois le contenu fourni',
    rules: 'Conditions', submit: 'Passer au paiement', payNote: 'Le paiement a lieu sur une page sécurisée Revolut. Les liens vers les fichiers sont envoyés par e-mail uniquement après confirmation du paiement.', country: 'Pays de facturation', countryPick: 'Choisissez un pays',
    soon: 'Bientôt disponible', priceTbc: 'Prix à confirmer', paymentsOff: 'Le paiement n’est pas encore activé. La boutique ouvrira au lancement des paiements.',
    apiDown: 'La boutique est temporairement indisponible. Réessayez plus tard ou écrivez-nous.', bundleSwap: 'Le pack contient déjà ce guide : seul le pack est conservé.',
    rubNote: '', redirecting: 'Redirection vers le paiement…',
    errors: { product_unavailable: 'Ce produit n’est pas disponible pour le moment.', currency_not_enabled: 'Cette devise n’est pas encore disponible.', bundle_overlap: 'Le pack contient déjà le guide sélectionné.', payments_disabled: 'Le paiement n’est pas encore activé.', validation: 'Vérifiez l’e-mail et cochez les deux cases.', rate_limited: 'Trop de tentatives. Patientez quelques minutes.', generic: 'Le paiement n’a pas pu être lancé. Réessayez.' },
  },
  en: {
    title: 'Parent guides', add: 'Add to basket', inCart: 'In basket', remove: 'Remove', cart: 'Basket', empty: 'Your basket is empty.',
    total: 'Total', email: 'Email to receive the files', terms: 'I accept the terms of sale and the refund policy', digital: 'I request immediate supply of the digital content and acknowledge that I lose my right of withdrawal once it is supplied',
    rules: 'Terms', submit: 'Continue to payment', payNote: 'Payment takes place on a secure Revolut page. File links are emailed only after the payment is confirmed.', country: 'Billing country', countryPick: 'Choose a country',
    soon: 'Coming soon', priceTbc: 'Price to be confirmed', paymentsOff: 'Payments are not switched on yet. The shop opens when payments launch.',
    apiDown: 'The shop is temporarily unavailable. Please try later or write to us.', bundleSwap: 'The bundle already includes this guide: only the bundle is kept.',
    rubNote: '', redirecting: 'Redirecting to payment…',
    errors: { product_unavailable: 'This product is not available right now.', currency_not_enabled: 'This currency is not available yet.', bundle_overlap: 'The bundle already includes the selected guide.', payments_disabled: 'Payments are not switched on yet.', validation: 'Check the email and tick both boxes.', rate_limited: 'Too many attempts. Please wait a few minutes.', generic: 'Payment could not be started. Please try again.' },
  },
};

// Static catalog snapshot embedded in the block (titles, summaries, approved prices). Live availability and the
// prices actually charged always come from the API (/api/catalog, /api/checkout).
const CATALOG = products.map((p) => ({
  sku: p.sku, files: p.files, prices: p.priceConfirmed ? p.prices : null,
  title: Object.fromEntries(Object.entries(p.i18n).map(([l, t]) => [l, t.title])),
  summary: Object.fromEntries(Object.entries(p.i18n).map(([l, t]) => [l, t.summary])),
}));

const SHOP_CSS = `
.ae-shop{background:var(--ae-ivory);padding:56px 0}
.ae-shop .ae-shop__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;margin:0 0 40px;padding:0;list-style:none}
.ae-shop .ae-card{display:flex;flex-direction:column;background:#fff;border:1px solid var(--ae-line);border-radius:16px;padding:24px 22px;box-shadow:0 10px 30px -18px rgba(116,40,63,.35)}
.ae-shop .ae-card--bundle{border-color:var(--ae-gold);background:linear-gradient(160deg,#fff 0%,var(--ae-ivory) 60%,var(--ae-powder) 100%)}
.ae-shop .ae-card__tag{align-self:flex-start;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ae-burgundy);background:var(--ae-lavender);border-radius:999px;padding:4px 10px;margin-bottom:12px}
.ae-shop .ae-card__title{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;color:var(--ae-burgundy);line-height:1.2;margin:0 0 10px}
.ae-shop .ae-card__text{font-size:14px;color:var(--ae-ink-soft);margin:0 0 16px}
.ae-shop .ae-card__price{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600;color:var(--ae-ink);margin:auto 0 14px}
.ae-shop .ae-card__price--tbc{font-family:'Montserrat',system-ui,sans-serif;font-size:15px;font-weight:500;color:var(--ae-ink-soft)}
.ae-shop .ae-shop__title{font-size:40px;margin-bottom:18px}
.ae-shop .ae-card__price small{display:block;font-family:'Montserrat',system-ui,sans-serif;font-size:13px;font-weight:400;color:var(--ae-ink-soft)}
.ae-shop .ae-panel{background:#fff;border:1px solid var(--ae-line);border-radius:16px;padding:28px;max-width:760px}
.ae-shop .ae-panel__title{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:var(--ae-burgundy);margin:0 0 12px}
.ae-shop .ae-lines{list-style:none;margin:0 0 12px;padding:0}
.ae-shop .ae-lines li{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--ae-line)}
.ae-shop .ae-lines button{background:none;border:0;color:var(--ae-emerald);text-decoration:underline;cursor:pointer;font:inherit;padding:4px}
.ae-shop .ae-total{text-align:right;font-weight:600;margin:0 0 20px}
.ae-shop .ae-field{display:grid;gap:6px;margin:0 0 14px}
.ae-shop .ae-field label{font-weight:500;font-size:14px}
.ae-shop .ae-field input[type=email]{width:100%;min-height:44px;font:400 16px 'Montserrat',system-ui,sans-serif;color:var(--ae-ink);background:var(--ae-ivory);border:1px solid #CDB3AA;border-radius:10px;padding:10px 14px}
.ae-shop .ae-check{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;font-size:14px;line-height:1.5}
.ae-shop .ae-check input{width:18px;height:18px;margin-top:2px;flex-shrink:0;accent-color:var(--ae-emerald)}
.ae-shop .ae-note{font-size:13px;color:var(--ae-ink-soft);margin:8px 0 16px}
.ae-shop .ae-status{min-height:1.4em;margin:12px 0 0;font-size:14px}
.ae-shop .ae-status--error{color:var(--ae-danger)}
.ae-shop .ae-banner{background:var(--ae-lavender);border-left:3px solid var(--ae-burgundy);border-radius:10px;padding:14px 18px;margin:0 0 24px;font-size:14px}
@media (max-width:1199px){.ae-shop .ae-shop__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:639px){.ae-shop{padding:40px 0}.ae-shop .ae-shop__title{font-size:30px}.ae-shop .ae-shop__grid{grid-template-columns:1fr}.ae-shop .ae-panel{padding:20px}.ae-shop .ae-btn{width:100%}}
`.trim();

// Client script. Plain ES5-compatible JS for broad browser support; no template literals.
const SHOP_JS = `
(function () {
  'use strict';
  var I18N = __I18N__;
  var CATALOG = __CATALOG__;
  var CART_KEY = 'ae-shop-cart-v1';
  function init(root) {
    if (root.getAttribute('data-ae-ready')) return;
    root.setAttribute('data-ae-ready', '1');
    var lang = I18N[root.getAttribute('data-lang')] ? root.getAttribute('data-lang') : 'en';
    var t = I18N[lang];
    var api = (root.getAttribute('data-api') || '').replace(/\\/$/, '');
    var grid = root.querySelector('[data-ae-grid]');
    var panel = root.querySelector('[data-ae-panel]');
    var lines = root.querySelector('[data-ae-lines]');
    var totalEl = root.querySelector('[data-ae-total]');
    var emptyEl = root.querySelector('[data-ae-empty]');
    var form = root.querySelector('[data-ae-form]');
    var status = root.querySelector('[data-ae-status]');
    var banner = root.querySelector('[data-ae-banner]');
    var live = { products: {}, payments: false, currencies: [] };
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function fmt(cents, cur) {
      var tag = { ru: 'ru-RU', fr: 'fr-FR', en: 'en-GB' }[lang];
      var whole = cur === 'RUB' && cents % 100 === 0;
      try { return new Intl.NumberFormat(tag, { style: 'currency', currency: cur, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100); }
      catch (e) { return (cents / 100).toFixed(2) + ' ' + cur; }
    }
    function readCart() { try { var v = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(v) ? v.filter(function (s) { return typeof s === 'string'; }) : []; } catch (e) { return []; } }
    function writeCart(v) { try { localStorage.setItem(CART_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked: cart lives only on this page */ } memCart = v; }
    var memCart = readCart();
    function cart() { return memCart; }
    function byId(sku) { for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].sku === sku) return CATALOG[i]; return null; }
    function sellable(sku) { return live.payments && !!live.products[sku]; }
    function setStatus(msg, isError) { status.textContent = msg || ''; status.className = 'ae-status' + (isError ? ' ae-status--error' : ''); }

    function add(sku) {
      var p = byId(sku); var c = cart().slice(); var note = '';
      if (c.indexOf(sku) !== -1) return;
      // Bundle rules: never sell the same PDF twice in one order.
      if (p.files.length > 1) {
        var kept = c.filter(function (s) { var q = byId(s); return !q || !q.files.some(function (f) { return p.files.indexOf(f) !== -1; }); });
        if (kept.length !== c.length) note = t.bundleSwap;
        c = kept;
      } else {
        for (var i = 0; i < c.length; i++) { var b = byId(c[i]); if (b && b.files.length > 1 && b.files.indexOf(sku) !== -1) { setStatus(t.bundleSwap, false); return; } }
      }
      c.push(sku); writeCart(c); render(); setStatus(note, false);
    }
    function removeSku(sku) { writeCart(cart().filter(function (s) { return s !== sku; })); render(); }

    function renderGrid() {
      grid.textContent = '';
      CATALOG.forEach(function (p) {
        var li = el('li', 'ae-card' + (p.files.length > 1 ? ' ae-card--bundle' : ''));
        if (p.files.length > 1) li.appendChild(el('span', 'ae-card__tag', p.files.length + ' PDF'));
        li.appendChild(el('h3', 'ae-card__title', p.title[lang]));
        li.appendChild(el('p', 'ae-card__text', p.summary[lang]));
        var priceBox = el('p', 'ae-card__price');
        var lp = live.products[p.sku];
        var prices = lp ? lp.prices : p.prices;
        if (prices && prices.EUR != null) {
          priceBox.appendChild(document.createTextNode(fmt(prices.EUR, 'EUR')));
          if (lang === 'ru' && prices.RUB != null) priceBox.appendChild(el('small', null, fmt(prices.RUB, 'RUB')));
        } else { priceBox.textContent = t.priceTbc; priceBox.className += ' ae-card__price--tbc'; }
        li.appendChild(priceBox);
        var btn = el('button', 'ae-btn ae-btn--primary', sellable(p.sku) ? (cart().indexOf(p.sku) !== -1 ? t.inCart : t.add) : t.soon);
        btn.type = 'button';
        btn.disabled = !sellable(p.sku) || cart().indexOf(p.sku) !== -1;
        btn.addEventListener('click', function () { add(p.sku); });
        li.appendChild(btn);
        grid.appendChild(li);
      });
    }
    function renderCart() {
      var items = cart().filter(function (s) { return sellable(s); });
      lines.textContent = '';
      var total = 0;
      items.forEach(function (sku) {
        var p = byId(sku); var price = live.products[sku].prices.EUR; total += price;
        var li = el('li');
        li.appendChild(el('span', null, p.title[lang] + ' — ' + fmt(price, 'EUR')));
        var rm = el('button', null, t.remove); rm.type = 'button';
        rm.setAttribute('aria-label', t.remove + ': ' + p.title[lang]);
        rm.addEventListener('click', function () { removeSku(sku); });
        li.appendChild(rm); lines.appendChild(li);
      });
      emptyEl.hidden = items.length > 0;
      form.hidden = items.length === 0;
      totalEl.textContent = items.length ? (t.total + ': ' + fmt(total, 'EUR')) : '';
      panel.hidden = !live.payments;
    }
    function render() { renderGrid(); renderCart(); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); setStatus(t.errors.validation, true); return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; setStatus(t.redirecting, false);
      var body = { locale: lang, currency: 'EUR', email: form.elements.email.value, country: form.elements.country.value, acceptTerms: form.elements.terms.checked, acceptDigital: form.elements.digital.checked,
        items: cart().filter(sellable).map(function (s) { return { sku: s }; }) };
      fetch(api + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.url && /^https:\\/\\//.test(res.j.url)) { window.location.assign(res.j.url); return; }
          setStatus(t.errors[res.j.error] || t.errors.generic, true); btn.disabled = false;
        })
        .catch(function () { setStatus(t.errors.generic, true); btn.disabled = false; });
    });

    render();
    if (!api) { banner.textContent = t.paymentsOff; banner.hidden = false; return; }
    fetch(api + '/api/catalog', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        live.payments = !!data.payments; live.currencies = data.currencies || [];
        (data.products || []).forEach(function (p) { if (byId(p.sku)) live.products[p.sku] = p; });
        writeCart(cart().filter(function (s) { return !!live.products[s]; }));
        if (!live.payments) { banner.textContent = t.paymentsOff; banner.hidden = false; }
        else if (lang === 'ru' && t.rubNote && live.currencies.indexOf('RUB') === -1) { banner.textContent = t.rubNote; banner.hidden = false; }
        render();
      })
      .catch(function () { banner.textContent = t.apiDown; banner.hidden = false; render(); });
  }
  function boot() { var roots = document.querySelectorAll('[data-ae-shop]'); for (var i = 0; i < roots.length; i++) init(roots[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
`.trim();

import { offeredCountries } from '../src/config/countries.mjs';
const countryOptions = (lang) => {
  const dn = new Intl.DisplayNames([lang === 'ru' ? 'ru' : lang === 'fr' ? 'fr' : 'en'], { type: 'region' });
  return offeredCountries.map((c) => `<option value="${c}">${dn.of(c)}</option>`).join('');
};

function shopHtml(lang) {
  const t = SHOP_I18N[lang];
  const legal = (slug) => `/${lang}/legal/${slug}/`;
  return `<!-- AINA Évidence — магазин PDF-гайдов (Tilda T123). Язык: ${lang}.
     Настройка: data-api = адрес API (например https://api.<ваш-домен>), без «/» в конце. Пока API не развёрнут, оставьте пустым:
     блок покажет товары и «Оплата пока не подключена». Ссылки на юридические страницы поправьте под адреса страниц в Tilda.
     Цены и доступность товаров берутся с сервера; цены в блоке — только для отображения. Секретов в блоке нет. -->
<div class="ae ae-shop" data-ae-shop data-lang="${lang}" data-api="">
  <div class="ae-wrap">
    <h2 class="ae-h ae-shop__title">${t.title}</h2>
    <p class="ae-banner" data-ae-banner role="status" hidden></p>
    <ul class="ae-shop__grid" data-ae-grid aria-label="${t.title}"></ul>
    <section class="ae-panel" data-ae-panel aria-labelledby="ae-cart-title-${lang}" hidden>
      <h3 class="ae-panel__title" id="ae-cart-title-${lang}">${t.cart}</h3>
      <p data-ae-empty>${t.empty}</p>
      <ul class="ae-lines" data-ae-lines></ul>
      <p class="ae-total" data-ae-total></p>
      <form data-ae-form novalidate hidden>
        <div class="ae-field"><label for="ae-email-${lang}">${t.email} *</label><input id="ae-email-${lang}" name="email" type="email" autocomplete="email" required maxlength="200"></div>
        <div class="ae-field"><label for="ae-country-${lang}">${t.country} *</label><select id="ae-country-${lang}" name="country" required><option value="">${t.countryPick}</option>${countryOptions(lang)}</select></div>
        <label class="ae-check"><input name="terms" type="checkbox" required><span>${t.terms} (<a href="${legal('terms-of-sale')}" target="_blank" rel="noopener">${t.rules}</a>, <a href="${legal('terms-of-sale')}#refunds" target="_blank" rel="noopener">${{ ru: 'возврат', fr: 'remboursement', en: 'refunds' }[lang]}</a>) *</span></label>
        <label class="ae-check"><input name="digital" type="checkbox" required><span>${t.digital} (<a href="${legal('terms-of-sale')}#digital" target="_blank" rel="noopener">${t.rules}</a>) *</span></label>
        <p class="ae-note">${t.payNote}</p>
        <button class="ae-btn ae-btn--primary" type="submit">${t.submit}</button>
      </form>
      <p class="ae-status" data-ae-status role="status" aria-live="polite"></p>
    </section>
  </div>
</div>
<style>
${BASE_CSS}
${SHOP_CSS}
</style>
<script>
${SHOP_JS.replace('__I18N__', JSON.stringify(SHOP_I18N)).replace('__CATALOG__', JSON.stringify(CATALOG))}
</script>
`;
}

const LEAD_I18N = {
  ru: { title: 'Оставить заявку', name: 'Имя', email: 'Email', topic: 'Тема', message: 'Коротко о запросе (необязательно)', hint: 'Не указывайте медицинские анализы и диагнозы.', consent: 'Я согласен(на) на обработку данных для ответа на заявку.', privacy: 'Политика конфиденциальности', submit: 'Отправить', ok: 'Спасибо! Заявка получена. Ответ придёт на ваш email.', err: 'Не удалось отправить заявку. Напишите нам напрямую: ', health: 'Пожалуйста, не указывайте анализы и диагнозы: обсудим их на консультации.', topics: [['general', 'Вопрос'], ['community', 'Сообщество «Мамы и дети»']] },
  fr: { title: 'Envoyer une demande', name: 'Prénom et nom', email: 'E-mail', topic: 'Sujet', message: 'Quelques mots (facultatif)', hint: 'N’indiquez pas d’analyses médicales ni de diagnostics.', consent: 'J’accepte le traitement de mes données pour répondre à ma demande.', privacy: 'Politique de confidentialité', submit: 'Envoyer', ok: 'Merci ! Votre demande est bien reçue. La réponse arrivera par e-mail.', err: 'La demande n’a pas pu être envoyée. Écrivez-nous directement : ', health: 'Merci de ne pas indiquer d’analyses ni de diagnostics.', topics: [['general', 'Question'], ['community', 'Communauté « Mamans et enfants »']] },
  en: { title: 'Send a request', name: 'Name', email: 'Email', topic: 'Topic', message: 'A few words (optional)', hint: 'Please do not include medical test results or diagnoses.', consent: 'I agree to my data being processed to answer my request.', privacy: 'Privacy policy', submit: 'Send', ok: 'Thank you! Your request has been received. The reply will come by email.', err: 'Your request could not be sent. Write to us directly: ', health: 'Please do not include test results or diagnoses.', topics: [['general', 'Question'], ['community', 'Mums & Kids community']] },
};

function leadHtml(lang) {
  const t = LEAD_I18N[lang];
  return `<!-- AINA Évidence — форма заявки на собственный API (Tilda T123), язык: ${lang}. Необязательный компонент:
     вместо него можно использовать нативную форму Tilda (см. TILDA_HANDOFF.md, раздел «Заявки»). data-api — адрес API. -->
<div class="ae ae-lead" data-ae-lead data-lang="${lang}" data-api="">
  <div class="ae-wrap">
    <h2 class="ae-h">${t.title}</h2>
    <form class="ae-lead__form" novalidate>
      <div class="ae-lead__field"><label for="ae-ln-${lang}">${t.name} *</label><input id="ae-ln-${lang}" name="name" required minlength="2" maxlength="120" autocomplete="name"></div>
      <div class="ae-lead__field"><label for="ae-le-${lang}">${t.email} *</label><input id="ae-le-${lang}" name="email" type="email" required maxlength="200" autocomplete="email"></div>
      <div class="ae-lead__field"><label for="ae-lt-${lang}">${t.topic} *</label><select id="ae-lt-${lang}" name="topic" required>${t.topics.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="ae-lead__field"><label for="ae-lm-${lang}">${t.message}</label><textarea id="ae-lm-${lang}" name="message" maxlength="500" rows="4"></textarea><small>${t.hint}</small></div>
      <label class="ae-lead__check"><input name="consent" type="checkbox" required><span>${t.consent} <a href="/${lang}/legal/privacy/" target="_blank" rel="noopener">${t.privacy}</a> *</span></label>
      <div class="ae-lead__hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>
      <button class="ae-btn ae-btn--primary" type="submit">${t.submit}</button>
      <p class="ae-lead__status" role="status" aria-live="polite"></p>
    </form>
  </div>
</div>
<style>
${BASE_CSS}
.ae-lead{background:var(--ae-ivory);padding:48px 0}
.ae-lead .ae-lead__form{max-width:640px;display:grid;gap:14px;background:#fff;border:1px solid var(--ae-line);border-radius:16px;padding:28px}
.ae-lead .ae-lead__field{display:grid;gap:6px}
.ae-lead label{font-weight:500;font-size:14px}
.ae-lead input:not([type=checkbox]),.ae-lead select,.ae-lead textarea{width:100%;min-height:44px;font:400 16px 'Montserrat',system-ui,sans-serif;color:var(--ae-ink);background:var(--ae-ivory);border:1px solid #CDB3AA;border-radius:10px;padding:10px 14px}
.ae-lead small{color:var(--ae-ink-soft);font-size:13px}
.ae-lead .ae-lead__check{display:flex;gap:10px;align-items:flex-start;font-weight:400}
.ae-lead .ae-lead__check input{width:18px;height:18px;margin-top:2px;accent-color:var(--ae-emerald)}
.ae-lead .ae-lead__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.ae-lead .ae-lead__status{min-height:1.4em;margin:0;font-size:14px}
.ae-lead .ae-lead__status--error{color:var(--ae-danger)}
@media (max-width:639px){.ae-lead .ae-lead__form{padding:20px}.ae-lead .ae-btn{width:100%}}
</style>
<script>
(function () {
  'use strict';
  var T = ${JSON.stringify(LEAD_I18N)};
  var CONTACT = ${JSON.stringify(business.contactEmail)};
  function init(root) {
    if (root.getAttribute('data-ae-ready')) return; root.setAttribute('data-ae-ready', '1');
    var t = T[root.getAttribute('data-lang')] || T.en; var lang = T[root.getAttribute('data-lang')] ? root.getAttribute('data-lang') : 'en';
    var api = (root.getAttribute('data-api') || '').replace(/\\/$/, '');
    var form = root.querySelector('form'); var status = root.querySelector('.ae-lead__status');
    function show(msg, err) { status.textContent = msg; status.className = 'ae-lead__status' + (err ? ' ae-lead__status--error' : ''); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.elements.website.value) return;
      var btn = form.querySelector('button'); btn.disabled = true;
      fetch(api + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({
        name: form.elements.name.value, email: form.elements.email.value, topic: form.elements.topic.value,
        message: form.elements.message.value, consent: form.elements.consent.checked, locale: lang }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
        .then(function (res) {
          // Success is shown only after the server confirmed the request is stored (HTTP 201).
          if (res.status === 201) { form.reset(); show(t.ok, false); }
          else if (res.j && res.j.message === 'health_data_not_allowed') show(t.health, true);
          else show(t.err + CONTACT, true);
        })
        .catch(function () { show(t.err + CONTACT, true); })
        .then(function () { btn.disabled = false; });
    });
  }
  function boot() { var r = document.querySelectorAll('[data-ae-lead]'); for (var i = 0; i < r.length; i++) init(r[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
</script>
`;
}

const NOTICE = {
  ru: 'Все услуги и материалы носят консультационно-образовательный характер. Медицинская диагностика и лечение не осуществляются. Рекомендации не заменяют консультацию врача.',
  fr: 'Les services et supports ont une vocation de conseil et d’information. Aucun diagnostic ni traitement médical n’est réalisé. Les recommandations ne remplacent pas une consultation médicale.',
  en: 'All services and materials are advisory and educational. No medical diagnosis or treatment is provided. Recommendations do not replace a consultation with a doctor.',
};
const DRAFT = {
  ru: 'Черновик. Этот раздел не опубликован: юридические тексты — до проверки юристом; консультации, меню и сопровождение — до подтверждения права оказывать эти услуги во Франции.',
  fr: 'Brouillon. Cette section n’est pas publiée : textes juridiques avant relecture par un juriste ; consultations, menus et accompagnement avant confirmation du droit d’exercer en France.',
  en: 'Draft. This section is not published: legal texts until reviewed by a lawyer; consultations, menus and support until the right to provide them in France is confirmed.',
};
const THANKS = {
  ru: { h: 'Спасибо за покупку', p: 'Если оплата подтверждена, ссылки на файлы придут на ваш email в течение нескольких минут. Проверьте папку «Спам». Ссылки персональные и ограничены по сроку и числу скачиваний.' },
  fr: { h: 'Merci pour votre achat', p: 'Si le paiement est confirmé, les liens vers les fichiers arrivent par e-mail dans quelques minutes. Vérifiez vos spams. Les liens sont personnels et limités dans le temps et en nombre de téléchargements.' },
  en: { h: 'Thank you for your purchase', p: 'Once the payment is confirmed, the file links arrive by email within a few minutes. Check your spam folder. The links are personal and limited in time and number of downloads.' },
};

function simpleBlock(kind, lang) {
  if (kind === 'notice') return `<!-- AINA Évidence — дисклеймер (T123), язык: ${lang} -->
<div class="ae ae-notice"><div class="ae-wrap"><p class="ae-notice__text" role="note">${NOTICE[lang]}</p></div></div>
<style>
${BASE_CSS}
.ae-notice{padding:24px 0}
.ae-notice .ae-notice__text{max-width:820px;margin:0;background:var(--ae-lavender);border-left:3px solid var(--ae-burgundy);border-radius:10px;padding:16px 20px;font-size:15px}
</style>
`;
  if (kind === 'draft') return `<!-- AINA Évidence — плашка «черновик» (T123), язык: ${lang}. Ставить первым блоком на черновых и юридических страницах. -->
<div class="ae ae-draft" role="note"><div class="ae-wrap">${DRAFT[lang]}</div></div>
<style>
${BASE_CSS}
.ae-draft{background:#FFF4D6;color:#4A3500;border-bottom:1px solid #E0B84D;padding:12px 0;font-size:14px}
</style>
`;
  return `<!-- AINA Évidence — страница «Спасибо» после оплаты (T123), язык: ${lang}. Это страница возврата из Stripe (CHECKOUT_SUCCESS_URL).
     Блок ничего не «подтверждает»: доступ к файлам выдаёт только сервер после подписанного уведомления Stripe. -->
<div class="ae ae-thanks"><div class="ae-wrap"><h1 class="ae-h">${THANKS[lang].h}</h1><p>${THANKS[lang].p}</p></div></div>
<style>
${BASE_CSS}
.ae-thanks{background:var(--ae-ivory);padding:72px 0;text-align:center}
.ae-thanks .ae-wrap{max-width:680px}
.ae-thanks .ae-h{font-size:40px}
@media (max-width:639px){.ae-thanks .ae-h{font-size:30px}}
</style>
<script>
(function () { try { localStorage.removeItem('ae-shop-cart-v1'); } catch (e) { /* storage blocked */ } })();
</script>
`;
}

export function buildComponents() {
  mkdirSync(out, { recursive: true });
  const written = [];
  const w = (name, html) => { writeFileSync(join(out, name), html, 'utf8'); written.push(name); };
  for (const lang of ['ru', 'fr', 'en']) {
    w(`01-shop.${lang}.html`, shopHtml(lang));
    w(`02-lead-form.${lang}.html`, leadHtml(lang));
    w(`03-notice.${lang}.html`, simpleBlock('notice', lang));
    w(`04-draft-banner.${lang}.html`, simpleBlock('draft', lang));
    w(`05-thank-you.${lang}.html`, simpleBlock('thanks', lang));
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = buildComponents();
  console.log(`Generated ${files.length} T123 components → tilda/components/`);
}
