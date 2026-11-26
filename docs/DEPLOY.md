# Развёртывание API (пошагово)

Статус: **не выполнено**. Нужны ваши решения и расходы (`docs/HOSTING.md`). Всё ниже подготовлено и проверено по частям. Проверено: тесты кода, парсер Docker Compose, синтаксис скриптов. **Не проверено запуском:** сборка Docker-образа и работа Caddy на реальном сервере (в среде разработки нет демона Docker).

## Что понадобится

1. Сервер с Ubuntu 24.04 в ЕС и публичным IP (VPS).
2. Домен или поддомен для API, например `api.ваш-домен` (DNS-запись A на IP сервера).
3. Репозиторий `Dochsul/-` (если он приватный, понадобится deploy key на сервере).
4. Для писем: SMTP-доступ (ваша почта или бесплатный SMTP-сервис). Адрес отправителя должен быть разрешён сервису, домен подтверждён (SPF/DKIM).
5. Для копий: бакет S3-совместимого хранилища и ключ, ограниченный этим бакетом.

## Шаги

### 1. Первичная настройка сервера
При создании VPS вставьте `deploy/cloud-init.yaml` в поле «cloud-init / user data», **заменив строку `ssh-ed25519 REPLACE_WITH_YOUR_PUBLIC_KEY`** вашим публичным ключом. Файл не содержит секретов. Он ставит Docker, включает файервол (только 22, 80, 443), fail2ban, автоматические обновления безопасности и запрещает вход по паролю.

### 2. Код на сервере
```bash
ssh deploy@<IP>
git clone https://github.com/Dochsul/-.git /opt/aina    # приватный репозиторий: сначала deploy key
cd /opt/aina && git checkout claude/code-setup-plugin-c368la
```

### 3. Файлы гайдов
Скопируйте оригинальные PDF **с вашего компьютера** (не из Tilda и не из чата):
```bash
scp cow-milk-protein-allergy-guide.pdf complementary-feeding-guide.pdf child-sleep-guide-0-18.pdf deploy@<IP>:/opt/aina/private/products/
ssh deploy@<IP> 'cd /opt/aina && node scripts/verify-files.mjs'   # проверяет наличие, формат PDF и SHA-256
```
Имена файлов именно такие. Сверьте SHA-256 с оригиналами.

### 4. Настройки
```bash
cp .env.example .env && chmod 600 .env && nano .env
```
Заполните `.env` (описание каждой переменной — в самом файле). На этом этапе оставьте `PAYMENTS_ENABLED=false`. **Секреты вносятся только в этот файл на сервере.** Не отправляйте их в чат, не вносите в GitHub и Tilda.

Сгенерируйте случайные значения: `openssl rand -hex 32` для `IP_SALT`; пароль копий не короче 20 символов (`openssl rand -base64 24`) и **сохраните его отдельно в менеджере паролей**.

### 5. Запуск
```bash
deploy/deploy.sh claude/code-setup-plugin-c368la
```
Скрипт проверяет конфигурацию защитой запуска, собирает образ, стартует контейнеры и ждёт, пока API станет здоровым. Если не станет, **откатывается на прежнюю версию**. Затем:
```bash
curl https://api.<домен>/api/health        # {"ok":true,...}
```

### 6. Проверка снаружи
```bash
node scripts/stripe-test.mjs endpoint https://api.<домен>   # неподписанное событие должно получить 400
```

### 7. Связка с Tilda
В блоке магазина в Tilda впишите `data-api="https://api.<домен>"` (`TILDA_HANDOFF.md`, раздел 5). В `.env` на сервере: `ALLOWED_ORIGINS`, `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`.

### 8. Тестовая оплата и запуск платежей
По `docs/STRIPE_TEST.md`. Боевой режим включается только с вашим разрешением: `PAYMENTS_ENABLED=true`, боевой ключ **и** `LIVE_PAYMENTS_APPROVED=owner-approved`. Без последнего сервер с боевым ключом не запустится.

## Автоматическая выкладка из GitHub (по желанию)
Рабочий процесс `.github/workflows/deploy.yml` запускается **только вручную** и только после того, как вы сами:
1. создадите в репозитории окружение `production` с обязательным подтверждением (Settings → Environments);
2. добавите секреты `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`;
3. поставите переменную репозитория `DEPLOY_ENABLED=true`.

Пока этого нет, процесс ничего не делает. Секреты приложения (Stripe, SMTP, пароль копий) в GitHub не хранятся.

## Обновление и откат
```bash
ssh deploy@<IP> 'cd /opt/aina && deploy/deploy.sh <ветка-или-тег>'
```
Откат вручную: `deploy/deploy.sh <предыдущий-коммит>`.

## Что смотреть
```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs --tail=100 api
```
В логах нет тел запросов и персональных данных (только тип ошибки).
