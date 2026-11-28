# Развёртывание на Oracle Cloud Always Free (ARM) — бюджет 0 €

Статус: конфигурация подготовлена, **не развёрнута**. Ничего не куплено и не запущено. Развёртывание — только после вашего решения.

## 1. Что проверено и что нет

| Пункт | Статус |
|---|---|
| Dockerfile и образы (`node:22-slim`, `caddy:2`) — многоархитектурные образы, включая `linux/arm64` | Официальные образы публикуют arm64. **Здесь не проверено:** Docker-демона в этой среде нет. Проверить на сервере: `docker buildx imagetools inspect node:22-slim` и `caddy:2` |
| Приложение не содержит x86-бинарников и npm-зависимостей | Проверено чтением: `package.json` без зависимостей, в `deploy/` нет жёстких путей к архитектуре, cloud-init ставит Docker по `dpkg --print-architecture` |
| Лимиты Oracle Always Free (Ampere A1, блочное хранилище) | **Не подтверждено.** `docs.oracle.com` недоступен из этой среды. По сторонним источникам лимит A1 могли снизить до 2 OCPU / 12 ГБ. Проверить на странице Oracle «Always Free Resources» до регистрации |
| Потребности приложения | Node API (~100 МБ) + Caddy + контейнер копий. Лимит в `docker-compose.yml`: API 512 МБ, копии 256 МБ. Достаточно 1 OCPU и 2–4 ГБ, так что урезанный A1 подходит |

## 2. Схема

```
Интернет → Oracle VCN (порты 22, 80, 443) → VM Ubuntu 24.04 aarch64
  ├─ caddy:2        HTTPS (Let's Encrypt), security headers, лимит тела 100 КБ
  ├─ api (Node 22)  /api/*, SQLite в томе aina_data (WAL), PDF только для чтения
  └─ backup         раз в сутки: зашифрованная копия SQLite → локально и в Backblaze B2
```

Tilda отдаёт публичный сайт. Сервер обслуживает только `/api`.

## 3. Постоянное хранение SQLite

- База: `DB_FILE=/app/data/app.db` в именованном томе `aina_data` (`deploy/docker-compose.yml`). Том живёт на загрузочном диске VM и переживает пересоздание контейнеров.
- `docker compose down` тома не удаляет. **Не выполнять** `docker compose down -v` и `docker volume rm aina_data`: это удаляет базу.
- PDF-гайды (`private/products`) монтируются только для чтения.
- Важно: том не реплицируется. Защита от потери диска — только копии (раздел 5).

## 4. HTTPS

- Caddy получает сертификат Let's Encrypt для `API_DOMAIN`. Нужен домен, указывающий на публичный IP VM (A-запись).
- **Решение владельца:** домен покупать нельзя по условиям бюджета. Варианты с 0 €: бесплатный поддомен динамического DNS (например, DuckDNS) или работа без HTTPS на самом API (не рекомендуется, так как ссылки на PDF и форма передают персональные данные). Выбор за вами.
- Сайт на Tilda уже имеет HTTPS от Tilda. API-домен нужен только для вызовов из Tilda и для webhook Revolut.

## 5. Резервные копии и восстановление

- `backup` запускает `scripts/backup.mjs` раз в сутки: копия SQLite шифруется `BACKUP_PASSPHRASE` (не короче 20 символов) и хранится в `BACKUP_DIR=/app/data/backups` и в `S3_*` (Backblaze B2 через S3-совместимый API, `server/s3.mjs`).
- Бесплатный тариф B2 — 10 ГБ хранения (подтверждено списком free-for-dev). Ограничение 1 ГБ в день на загрузку **не подтверждено**; проверить на странице тарифов B2.
- Восстановление:
  - проверка без записи: `node scripts/restore.mjs latest --verify-only`
  - восстановление последней копии: `node scripts/restore.mjs s3-latest --force` (сначала остановить API: `docker compose stop api`)
- Пароль `BACKUP_PASSPHRASE` хранить отдельно (менеджер паролей владельца). Без него копия не восстанавливается.
- Раз в месяц: restore в тестовый каталог и проверка `verify-only`. Это ручная процедура владельца.

## 6. Ключи и секреты

- Секреты только в `/opt/aina/.env` с правами 600. `deploy/setup-server.sh` спрашивает их скрыто и не печатает.
- В git, в Tilda, в чате и в Drive секреты не хранятся. Тест `tests/registration.test.mjs` и `scripts/check.mjs` проверяют часть этого.
- Список переменных (значения — только в `.env` на сервере):

| Группа | Переменные |
|---|---|
| Сайт и API | `SITE_URL`, `API_DOMAIN`, `ALLOWED_ORIGINS`, `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`, `TRUST_PROXY`, `IP_SALT` |
| Администратор | `ADMIN_PASSWORD_HASH` (формат scrypt с двоеточиями, см. `admin:password`) |
| Платежи | `PAYMENT_PROVIDER` (`revolut`), `PAYMENTS_ENABLED`, `REVOLUT_ENV` (`sandbox`), `REVOLUT_API_KEY`, `REVOLUT_WEBHOOK_SECRET`, `ENABLED_CURRENCIES=EUR`, `LIVE_PAYMENTS_APPROVED` (не задавать до решения владельца) |
| Почта (Brevo) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO`, `OWNER_EMAIL` |
| Копии | `BACKUP_PASSPHRASE`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PREFIX` |

- Brevo Free: 300 писем в день (подтверждено справкой Brevo). SMTP-адрес и порт брать из панели Brevo, в документе не фиксируются.
- Revolut Sandbox: ключ создаётся в тестовом кабинете Revolut владельцем. Ключ в чат не передавать. Для `REVOLUT_ENV=sandbox` боевое подтверждение не нужно.

## 7. Файрвол — важная ловушка Oracle

На образах Oracle Ubuntu есть свой iptables, который блокирует всё, кроме 22. Порты 80 и 443 нужно открыть **и** в правилах VCN (Security List / NSG), **и** в `ufw` или iptables. `deploy/cloud-init.yaml` открывает их в `ufw`; правило VCN нужно добавить вручную в консоли Oracle.

## 8. Порядок запуска (после решения владельца)

1. Создать аккаунт Oracle Cloud Free Tier (владелец; нужна карта для проверки личности, списаний не будет при соблюдении лимитов Always Free — проверить условия на сайте Oracle).
2. Создать VM Ampere A1 (Ubuntu 24.04, aarch64), открыть 22/80/443 в VCN, вставить свой публичный SSH-ключ в `cloud-init.yaml`.
3. На сервере: `cd /opt/aina && bash deploy/setup-server.sh`. Скрипт спрашивает домен, Brevo, B2, пароль админа и т. д.
4. Проверить `https://<API_DOMAIN>/api/health`.
5. Запустить тестовый заказ в Revolut Sandbox (`node scripts/revolut-test.mjs check`) с тестовым ключом.

Без шага 4 и 5 считать развёртывание непроверенным.

## 9. Что не сделано и почему

- ARM-сборка образа не выполнена: нет Docker-демона в этой среде.
- Лимиты Oracle не подтверждены: нет доступа к docs.oracle.com.
- Домен и DNS: требуют решения владельца (бюджет 0 €).
- Аккаунты Oracle, Brevo, Backblaze, Revolut Sandbox: создаёт владелец.
