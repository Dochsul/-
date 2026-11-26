# Тестовая интеграция Stripe (пошагово)

Статус: **не выполнена на реальном Stripe**. Из среды разработки Stripe API недоступен (прокси блокирует `api.stripe.com`), у меня нет ваших ключей и аккаунта. Код создания сессии и обработки событий проверен автотестами с заглушкой Stripe, подписи событий — с настоящей схемой подписи Stripe. Реальный прогон нужно сделать вам (или ChatGPT Work по этим шагам) там, где сеть открыта.

Все шаги безопасны: тестовые ключи (`sk_test_…`) не двигают реальные деньги. Скрипты отказываются работать с боевым ключом.

## Что нужно
1. Аккаунт Stripe (регистрация бесплатна, проверка бизнеса понадобится только для боевого режима). **Регистрация требует вашего разрешения.**
2. Развёрнутый API с HTTPS (`docs/DEPLOY.md`) или локальный запуск со Stripe CLI (ниже).
3. Тестовые ключи из Stripe Dashboard в режиме «Test mode». Вносите их **только** в `.env` на сервере, не в чат.

## Шаги
1. В `.env`: `STRIPE_SECRET_KEY=sk_test_…`, `PAYMENTS_ENABLED=true`, `CLIENT_CHANNEL=smtp` (письма с файлами), остальное по `.env.example`. `ENABLED_CURRENCIES=EUR`.
2. Проверьте ключ: `STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-test.mjs check`. Ожидается `OK ... livemode=false`.
3. В Stripe Dashboard (Test mode) → Developers → Webhooks → добавьте endpoint `https://api.<домен>/api/webhooks/stripe` с событиями:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Скопируйте **Signing secret** (`whsec_…`) в `.env` как `STRIPE_WEBHOOK_SECRET`. Перезапустите: `deploy/deploy.sh`.
4. Проверка endpoint: `node scripts/stripe-test.mjs endpoint https://api.<домен>` (неподписанное событие должно получить 400).
5. Положите тестовые PDF в `private/products/` (можно любые маленькие файлы с заголовком `%PDF-`): `node scripts/verify-files.mjs`.
6. **Временно** для теста опубликуйте товар: `published: true`, `contentConfirmed: true` в `src/config/catalog.mjs` (на тестовом окружении).
7. В блоке магазина впишите `data-api`. Купите комплект тестовой картой.

## Тестовые карты Stripe
| Номер | Результат |
|---|---|
| `4242 4242 4242 4242` | Успешный платёж |
| `4000 0000 0000 0002` | Платёж отклонён |
| `4000 0025 0000 3155` | Требуется подтверждение 3-D Secure |

Срок: любая будущая дата, CVC: любые 3 цифры.

## Что должно произойти (чеклист)
| Сценарий | Ожидаемый результат |
|---|---|
| Успешная оплата комплекта 19,90 € | Заказ `paid`; **3 письма-ссылки в одном письме** на языке покупателя; в базе платёж с комиссией; страница «Спасибо» |
| Повторная доставка события (Dashboard → Resend) | Новых ссылок и писем **нет** |
| Отклонённая карта | Заказ остаётся `pending_payment`/`expired`, ссылок нет |
| Возврат в Dashboard | Заказ `refunded` (полный) или `partially_refunded`; при полном возврате ссылки перестают работать; владельцу приходит уведомление |
| 4-я и последующие попытки скачать | После 5 скачиваний или 7 дней ссылка не работает |
| Покупка из страны в списке ограничений | Заказ `review_sanctions`, файлы не выдаются |
| Оплата в рублях | Отказ `currency_not_enabled` |

Проверка записей:
```bash
docker compose -f deploy/docker-compose.yml exec api node -e "
const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/app/data/app.db');
console.log(d.prepare('select id,status,amount_cents,currency,customer_country from orders order by created_at desc limit 5').all());
console.log(d.prepare('select provider_payment_id,amount_cents,fee_cents,net_cents from payments order by id desc limit 5').all());"
```

## Локально со Stripe CLI (без сервера)
```bash
stripe login
stripe listen --forward-to localhost:8080/api/webhooks/stripe   # напечатает whsec_…: внесите в окружение
npm run serve                                                    # с PAYMENTS_ENABLED=true и тестовыми ключами
```

## Переход к боевому режиму
Только после вашего решения и по чеклисту `docs/PAYMENTS.md`, раздел 5: боевой ключ, новый webhook в боевом режиме и `LIVE_PAYMENTS_APPROVED=owner-approved`. Оплата в рублях остаётся выключенной до подтверждения законного рабочего платёжного канала (`RUB_PAYMENTS_APPROVED`).
