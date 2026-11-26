// AINA Évidence — client script (progressive enhancement; the site works as static HTML without it).
// No inline handlers, no third-party code. Cart keeps only SKU + quantity; prices come from the server.
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');
  var locale = root.lang || 'en';
  var CART_KEY = 'aina-cart-v1';

  // ---------- helpers ----------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function setStatus(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-error', !ok);
    el.classList.toggle('is-ok', !!ok);
  }
  function readCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      var items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items.filter(function (i) {
        return i && typeof i.sku === 'string' && i.sku.length < 80;
      }) : [];
    } catch (e) { return []; } // storage blocked or corrupt: behave as an empty cart
  }
  function writeCart(items) {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable */ }
    updateBadge();
  }
  function cartCount(items) { return items.length; }
  function updateBadge() {
    var n = cartCount(readCart());
    $$('[data-cart-count]').forEach(function (b) { b.textContent = String(n); b.hidden = n === 0; });
  }
  function fmt(cents, currency) {
    var tag = { ru: 'ru-RU', fr: 'fr-FR', en: 'en-GB' }[locale] || 'en-GB';
    try { return new Intl.NumberFormat(tag, { style: 'currency', currency: currency }).format(cents / 100); }
    catch (e) { return (cents / 100).toFixed(2) + ' ' + currency; }
  }

  // ---------- header & navigation ----------
  var header = $('.site-header');
  var onScroll = function () { if (header) header.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var toggle = $('#menu-toggle');
  var nav = $('#site-nav');
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }
  if (toggle) toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- reveal on scroll ----------
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ---------- cart: add buttons ----------
  var live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);

  $$('[data-add-sku]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sku = btn.getAttribute('data-add-sku');
      var items = readCart();
      var found = items.find(function (i) { return i.sku === sku; });
      // A digital product is bought once: adding it again does nothing.
      if (!found) items.push({ sku: sku, qty: 1 });
      writeCart(items);
      live.textContent = btn.getAttribute('data-added') || 'OK';
      var old = btn.textContent;
      btn.textContent = '✓';
      setTimeout(function () { btn.textContent = old; }, 1200);
    });
  });
  updateBadge();

  // ---------- lead form ----------
  var leadForm = $('#lead-form');
  if (leadForm) {
    var params = new URLSearchParams(window.location.search);
    var topic = params.get('topic');
    var topicSel = $('#lead-topic');
    if (topic && topicSel && $('option[value="' + topic.replace(/"/g, '') + '"]', topicSel)) topicSel.value = topic;

    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('.form-status', leadForm);
      if (!leadForm.checkValidity()) { leadForm.reportValidity(); return; }
      var data = Object.fromEntries(new FormData(leadForm).entries());
      if (data.website) return; // honeypot: silently drop
      var btn = $('button[type="submit"]', leadForm);
      btn.disabled = true;
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: data.name, email: data.email, phone: data.phone || '', topic: data.topic,
          message: data.message || '', consent: data.consent === 'on', locale: data.locale || locale })
      }).then(function (res) {
        if (res.status === 201) {
          // Success is shown only after the server confirmed the lead is stored.
          leadForm.reset();
          setStatus(status, leadForm.getAttribute('data-success'), true);
          return;
        }
        throw new Error('HTTP ' + res.status);
      }).catch(function () {
        setStatus(status, leadForm.getAttribute('data-error'), false);
      }).then(function () { btn.disabled = false; });
    });
  }

  // ---------- cart page ----------
  var cartPage = $('[data-cart-page]');
  if (cartPage) {
    var catalogUrl = '/static/catalog.json';
    var table = $('[data-cart-table]', cartPage);
    var rows = $('[data-cart-rows]', cartPage);
    var empty = $('[data-cart-empty]', cartPage);
    var totalBox = $('[data-cart-total]', cartPage);
    var sumEl = $('[data-cart-sum]', cartPage);
    var checkout = $('[data-checkout]', cartPage);

    fetch(catalogUrl, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cat) {
      var bySku = {};
      cat.products.forEach(function (p) { bySku[p.sku] = p; });

      function render() {
        var items = readCart().filter(function (i) { return bySku[i.sku]; });
        rows.textContent = '';
        if (!items.length) {
          empty.hidden = false; table.hidden = true; totalBox.hidden = true; checkout.hidden = true;
          return;
        }
        empty.hidden = true; table.hidden = false; totalBox.hidden = false; checkout.hidden = false;
        var total = 0;
        items.forEach(function (it) {
          var p = bySku[it.sku];
          var line = p.prices.EUR || 0;
          total += line;
          var tr = document.createElement('tr');
          var td1 = document.createElement('td'); td1.textContent = p.title[locale] || p.title.en;
          var td3 = document.createElement('td'); td3.textContent = fmt(line, 'EUR');
          var td4 = document.createElement('td');
          var rm = document.createElement('button'); rm.type = 'button'; rm.textContent = cartPage.getAttribute('data-remove-label');
          rm.addEventListener('click', function () { writeCart(readCart().filter(function (x) { return x.sku !== it.sku; })); render(); });
          td4.appendChild(rm);
          tr.appendChild(td1); tr.appendChild(td3); tr.appendChild(td4);
          rows.appendChild(tr);
        });
        sumEl.textContent = fmt(total, 'EUR');
      }
      render();
      window.addEventListener('storage', render);

      var form = $('#checkout-form');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var status = $('.form-status', form);
          if (!form.checkValidity()) { form.reportValidity(); return; }
          var btn = $('button[type="submit"]', form);
          btn.disabled = true;
          var fd = Object.fromEntries(new FormData(form).entries());
          fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              locale: cartPage.getAttribute('data-locale') || locale,
              email: fd.email,
              currency: 'EUR',
              items: readCart().map(function (i) { return { sku: i.sku }; }),
              acceptTerms: fd.acceptTerms === 'on',
              acceptDigital: fd.acceptDigital === 'on'
            })
          }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) {
              if (res.ok && body.url) { window.location.href = body.url; return; }
              throw new Error(body.error || ('HTTP ' + res.status));
            });
          }).catch(function () {
            setStatus(status, form.getAttribute('data-error'), false);
            btn.disabled = false;
          });
        });
      }
    }).catch(function () {
      empty.textContent = cartPage.getAttribute('data-load-error') || '';
    });
  }

  // After a successful payment the basket is emptied.
  if (window.location.pathname.indexOf('/checkout/success/') !== -1) {
    try { window.localStorage.removeItem(CART_KEY); } catch (e) { /* ignore */ }
    updateBadge();
  }
  // After returning from the payment page the server decides whether the order is paid. Returning here is not proof.
  var resultBox = document.querySelector('[data-result="success"]');
  var orderMatch = /[?&]order=([a-f0-9]{24})(?:&|$)/.exec(window.location.search);
  if (resultBox && orderMatch) {
    var h1 = resultBox.querySelector('h1');
    var txt = resultBox.querySelector('[data-result-text]');
    var attempts = 0;
    var show = function (title, text) { if (h1 && title) h1.textContent = title; if (txt && text) txt.textContent = text; };
    var check = function () {
      attempts += 1;
      fetch('/api/orders/' + orderMatch[1] + '/status', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.status === 'paid') { show(resultBox.getAttribute('data-paid-title'), resultBox.getAttribute('data-paid-text')); return; }
          if (d && d.status === 'unpaid') { show(resultBox.getAttribute('data-unpaid-title'), resultBox.getAttribute('data-unpaid-text')); return; }
          if (d && d.status === 'review') { show(resultBox.getAttribute('data-review-title'), resultBox.getAttribute('data-review-text')); return; }
          if (attempts < 40) { window.setTimeout(check, 3000); return; }
          show(null, resultBox.getAttribute('data-pending-text'));
        })
        .catch(function () {
          if (attempts < 40) { window.setTimeout(check, 3000); return; }
          show(null, resultBox.getAttribute('data-pending-text'));
        });
    };
    check();
  }
})();
