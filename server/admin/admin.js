// Admin panel logic. No inline handlers or inline styles (CSP). All data is written with textContent.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MONEY_LABELS = { payments: 'Оплачено', refunds: 'Возвраты', fees: 'Комиссии (сверено)', net: 'Чистыми (без нерасчитанных комиссий)', feesToReconcile: 'Комиссий ждут сверки' };
  var STATUS = { paid: 'оплачен', pending_payment: 'ждёт оплаты', settling: 'обрабатывается', expired: 'отменён', failed: 'не прошёл', refunded: 'возврат', partially_refunded: 'частичный возврат', review_sanctions: 'проверка', review_amount: 'проверка суммы', review_reference: 'проверка номера' };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function money(cents, cur) {
    if (cents === null || cents === undefined) return '—';
    return (cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (cur || '');
  }
  function date(iso) {
    return iso ? new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '';
  }
  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(path, init).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('login'); }
      return r;
    });
  }
  function showLogin() {
    $('app').classList.add('hidden');
    $('logout').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('password').value = '';
    $('password').focus();
  }
  function showApp() {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('logout').classList.remove('hidden');
  }
  function selectTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    ['summary', 'orders', 'leads', 'ledger'].forEach(function (t) { $('tab-' + t).classList.toggle('hidden', t !== name); });
    if (name === 'orders') loadOrders();
    if (name === 'leads') loadLeads();
    if (name === 'summary') loadSummary();
  }

  function loadSummary() {
    return api('/api/admin/summary').then(function (r) { return r.json(); }).then(function (s) {
      var cards = $('cards'); cards.textContent = '';
      var paid = (s.orders && s.orders.paid) || 0;
      var toCheck = Object.keys(s.orders || {}).filter(function (k) { return k.indexOf('review') === 0; }).reduce(function (a, k) { return a + s.orders[k]; }, 0);
      var newLeads = (s.leads && s.leads.new) || 0;
      [[paid, 'оплаченных заказов'], [toCheck, 'заказов на проверке'], [newLeads, 'новых заявок'], [s.leadsLast7Days, 'заявок за 7 дней']].forEach(function (x) {
        var c = el('div', 'stat'); c.appendChild(el('div', 'n', x[0])); c.appendChild(el('div', 'l', x[1])); cards.appendChild(c);
      });
      var money = $('money'); money.textContent = '';
      var curs = Object.keys(s.money || {});
      if (!curs.length) money.appendChild(el('p', 'note', 'Оплаченных заказов пока нет.'));
      curs.forEach(function (cur) {
        var m = s.money[cur];
        var box = el('div', 'item');
        box.appendChild(el('strong', null, cur));
        ['payments', 'refunds', 'fees', 'net'].forEach(function (k) {
          var row = el('div', 'money-row'); row.appendChild(el('span', null, MONEY_LABELS[k])); row.appendChild(el('span', null, money(m[k], cur))); box.appendChild(row);
        });
        if (m.feesToReconcile) box.appendChild(el('p', 'note', MONEY_LABELS.feesToReconcile + ': ' + m.feesToReconcile + '. Импортируйте выписку Revolut.'));
        money.appendChild(box);
      });
      $('updated').textContent = 'Обновлено: ' + date(s.generatedAt);
    }).catch(function () {});
  }

  function statusPill(status) {
    var cls = status === 'paid' ? 'pill paid' : (String(status).indexOf('review') === 0 ? 'pill review' : 'pill');
    return el('span', cls, STATUS[status] || status);
  }

  function loadOrders() {
    return api('/api/admin/orders?limit=50').then(function (r) { return r.json(); }).then(function (d) {
      var box = $('orders'); box.textContent = '';
      if (!d.orders.length) box.appendChild(el('p', 'note', 'Заказов пока нет.'));
      d.orders.forEach(function (o) {
        var card = el('div', 'item');
        var row = el('div', 'row'); row.appendChild(el('strong', null, money(o.amount, o.currency))); row.appendChild(statusPill(o.status)); card.appendChild(row);
        card.appendChild(el('div', 'meta', date(o.createdAt) + ' · ' + (o.country || '—') + ' · ' + (o.provider || '—')));
        card.appendChild(el('div', 'meta', o.items.join(' + ')));
        card.appendChild(el('div', 'meta', o.email));
        box.appendChild(card);
      });
    }).catch(function () {});
  }

  function loadLeads() {
    return api('/api/admin/leads?limit=50').then(function (r) { return r.json(); }).then(function (d) {
      var box = $('leads'); box.textContent = '';
      if (!d.leads.length) box.appendChild(el('p', 'note', 'Заявок пока нет.'));
      d.leads.forEach(function (l) {
        var card = el('div', 'item');
        var row = el('div', 'row'); row.appendChild(el('strong', null, l.name)); row.appendChild(el('span', 'pill', l.status)); card.appendChild(row);
        card.appendChild(el('div', 'meta', date(l.createdAt) + ' · ' + l.topic + ' · ' + l.locale));
        card.appendChild(el('div', 'meta', l.email + (l.phone ? ' · ' + l.phone : '')));
        if (l.message) card.appendChild(el('div', 'msg', l.message));
        box.appendChild(card);
      });
    }).catch(function () {});
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('login-error').textContent = '';
    fetch('/api/admin/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('password').value }) })
      .then(function (r) {
        if (r.status === 429) throw new Error('Слишком много попыток. Подождите 15 минут.');
        if (!r.ok) throw new Error('Неверный пароль.');
        $('password').value = '';
        showApp(); selectTab('summary');
      })
      .catch(function (err) { $('login-error').textContent = err.message || 'Не удалось войти.'; });
  });

  $('logout').addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }).finally(showLogin);
  });

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { selectTab(b.getAttribute('data-tab')); });
  });

  $('ledger-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('ledger-error').textContent = '';
    var f = e.target;
    var qs = [];
    if (f.from.value) qs.push('from=' + encodeURIComponent(f.from.value));
    if (f.to.value) qs.push('to=' + encodeURIComponent(f.to.value));
    api('/api/admin/ledger.csv' + (qs.length ? '?' + qs.join('&') : '')).then(function (r) {
      if (!r.ok) throw new Error('Не удалось скачать файл.');
      return r.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'ledger.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function (err) { if (err.message !== 'login') $('ledger-error').textContent = err.message; });
  });

  // Start: if a session exists, go straight to the summary.
  api('/api/admin/summary').then(function (r) {
    if (!r.ok) throw new Error('x');
    return r.json();
  }).then(function () { showApp(); selectTab('summary'); }).catch(showLogin);
})();
