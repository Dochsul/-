# Страница «спасибо» в Tilda: проверка статуса заказа

Назначение: после возврата покупателя со страницы оплаты страница сама спрашивает сервер, оплачен ли заказ. Переход на страницу не считается оплатой.

Для каждого языка (`/ru/merci/`, `/fr/merci/`, `/en/merci/`) в Tilda ставится один блок «HTML» (блок T123 «Код»). Перед вставкой замените `API_DOMAIN_HERE` на адрес API (например `https://api.ваш-домен.fr`, он появится после настройки сервера). Тексты по языкам — из `src/content/*.mjs` (ключи `paidTitle`, `paidText`, `pendingText`, `unpaidTitle`, `unpaidText`, `reviewTitle`, `reviewText`); здесь для русского.

Код блока:

```html
<div class="ae" style="max-width:640px;margin:40px auto;padding:0 16px;text-align:center">
  <h1 id="ae-title">Спасибо за заказ</h1>
  <p id="ae-text">Проверяем оплату. Это займёт несколько секунд.</p>
</div>
<script>
(function () {
  var m = /[?&]order=([a-f0-9]{24})(?:&|$)/.exec(location.search);
  if (!m) return;
  var API = 'https://API_DOMAIN_HERE';
  var n = 0;
  function show(title, text) {
    if (title) document.getElementById('ae-title').textContent = title;
    document.getElementById('ae-text').textContent = text;
  }
  function check() {
    n += 1;
    fetch(API + '/api/orders/' + m[1] + '/status', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.status === 'paid') { show('Оплата подтверждена', 'Ссылка для скачивания придёт на ваш email. Если письма нет, проверьте папку «Спам».'); return; }
        if (d && d.status === 'unpaid') { show('Оплата не завершена', 'Заказ не оплачен. Вы можете вернуться в корзину и оформить заказ снова.'); return; }
        if (d && d.status === 'review') { show('Заказ на проверке', 'Мы проверяем заказ и свяжемся с вами по email.'); return; }
        if (n < 40) { setTimeout(check, 3000); return; }
        show(null, 'Банк ещё не подтвердил оплату. Обновите страницу через минуту. Подтверждение придёт на ваш email.');
      })
      .catch(function () {
        if (n < 40) { setTimeout(check, 3000); return; }
        show(null, 'Банк ещё не подтвердил оплату. Обновите страницу через минуту. Подтверждение придёт на ваш email.');
      });
  }
  check();
})();
</script>
```

## Что проверить после вставки

1. Открыть страницу с тестовым номером заказа: статус меняется после подтверждения (в песочнице).
2. Открыть `/ru/merci/` без номера заказа: показывается общий текст, запросов к серверу нет.
3. Адрес сайта Tilda должен быть в `ALLOWED_ORIGINS` на сервере, иначе браузер не получит ответ.

## Что неизвестно

- Политика безопасности (CSP) страниц Tilda не открыта мне; если Tilda блокирует внешний запрос, эта проверка не сработает и нужна доработка. Проверка на реальной странице не выполнена.
