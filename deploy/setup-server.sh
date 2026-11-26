#!/usr/bin/env bash
# One-time interactive setup of the production server, run ON the server as the deploy user:
#   cd /opt/aina && bash deploy/setup-server.sh
# It asks only for things that cannot be generated (domain, mail, keys, passwords), then:
#   1) writes .env with chmod 600 (secrets are typed hidden and never printed),
#   2) generates the IP salt and the admin password hash (the password goes in on stdin only),
#   3) checks the configuration with the production guard (scripts/check-env.mjs),
#   4) deploys with deploy/deploy.sh (which rolls back if the API is not healthy),
#   5) checks https://<API_DOMAIN>/api/health.
# Safe to re-run: the old .env is kept as .env.bak with chmod 600.
set -euo pipefail

REPO_URL="${AINA_REPO_URL:-https://github.com/Dochsul/-.git}"
BRANCH="${AINA_BRANCH:-claude/code-setup-plugin-c368la}"
ROOT="${AINA_ROOT:-/opt/aina}"
ENV_OUT="${AINA_ENV_FILE:-$ROOT/.env}"
# AINA_SETUP_TEST=1 runs the questions and the .env writing locally (no git, docker or network). Used by tests.
TEST_MODE="${AINA_SETUP_TEST:-0}"
ADMIN_MODULE="${AINA_ADMIN_MODULE:-/app/server/admin.mjs}"

say() { printf '%s\n' "$*" >&2; }
die() { say "ОШИБКА: $*"; exit 1; }

# ask VAR "вопрос" [значение по умолчанию] [required]
ask() {
  local __v
  printf '%s' "$2" >&2
  if [ -n "${3:-}" ]; then printf ' [%s]' "$3" >&2; fi
  printf ': ' >&2
  IFS= read -r __v || die "ввод прерван"
  if [ -z "$__v" ]; then __v="${3:-}"; fi
  if [ -z "$__v" ] && [ "${4:-}" = required ]; then say "Нужно значение."; ask "$1" "$2" "${3:-}" "${4:-}"; return; fi
  printf -v "$1" '%s' "$__v"
}

# ask_secret VAR "вопрос" минимальная_длина required|optional [проверка_regex]
ask_secret() {
  local __v __min="${3:-0}"
  printf '%s (ввод скрыт): ' "$2" >&2
  IFS= read -rs __v || die "ввод прерван"; printf '\n' >&2
  if [ -z "$__v" ]; then
    if [ "${4:-}" = required ]; then say "Нужно значение."; ask_secret "$1" "$2" "$3" "$4" "${5:-}"; return; fi
    printf -v "$1" '%s' ""; return
  fi
  if [ "${#__v}" -lt "$__min" ]; then say "Слишком короткое значение (нужно не меньше $__min символов)."; ask_secret "$1" "$2" "$3" "$4" "${5:-}"; return; fi
  if [ -n "${5:-}" ] && ! [[ "$__v" =~ ${5} ]]; then say "Неверный формат. Проверьте значение в панели сервиса."; ask_secret "$1" "$2" "$3" "$4" "${5:-}"; return; fi
  printf -v "$1" '%s' "$__v"
}

# ask_secret_twice VAR "вопрос" минимальная_длина: спрашивает дважды и сверяет
ask_secret_twice() {
  local __a __b
  ask_secret __a "$2" "$3" required
  printf '%s (повторите): ' "$2" >&2
  IFS= read -rs __b || die "ввод прерван"; printf '\n' >&2
  if [ "$__a" != "$__b" ]; then say "Значения не совпадают. Повторите."; ask_secret_twice "$1" "$2" "$3"; return; fi
  printf -v "$1" '%s' "$__a"
}

say "== Настройка сервера AINA Évidence =="
say "Ответьте на вопросы. Секреты вводятся скрыто и не показываются на экране."
say ""

if [ "$TEST_MODE" != 1 ]; then
  command -v docker >/dev/null 2>&1 || die "Docker не найден: сначала дождитесь окончания cloud-init (cloud-init status --wait)"
  docker compose version >/dev/null 2>&1 || die "Docker Compose не найден"
fi

ask API_DOMAIN "1. Домен API (например api.ваш-домен.fr, без https://)" "" required
[[ "$API_DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "домен записан неверно: $API_DOMAIN"

ask SITE_ORIGIN "2. Адрес сайта Tilda (с https://, без / в конце)" "" required
[[ "$SITE_ORIGIN" =~ ^https://[^/[:space:]]+$ ]] || die "адрес сайта должен начинаться с https:// и не заканчиваться на /"

ask OWNER_EMAIL "3. Почта владельца для уведомлений о заказах и заявках" "" required

ask SMTP_HOST "4. Сервер SMTP Brevo (сверьте в Brevo: Settings → SMTP & API)" "smtp-relay.brevo.com" required
ask SMTP_PORT "   Порт SMTP" "587" required
ask SMTP_USER "   Логин SMTP из Brevo" "" required
ask_secret SMTP_PASS "   SMTP-ключ из Brevo" 8 required
ask MAIL_FROM "   Адрес отправителя на вашем домене (например orders@ваш-домен.fr)" "" required

ask REVOLUT_ENV "5. Режим Revolut: sandbox (песочница) или production (боевой)" "sandbox" required
if [ "$REVOLUT_ENV" != sandbox ] && [ "$REVOLUT_ENV" != production ]; then die "REVOLUT_ENV: sandbox или production"; fi
if [ "$REVOLUT_ENV" = production ]; then
  say "Боевой режим выбран. Платежи включаются отдельным шагом после вашего письменного решения (docs/DEPLOY_STEPS.md, шаг 9)."
fi
ask_secret REVOLUT_API_KEY "   Ключ Revolut Merchant API (можно пропустить: Enter)" 0 optional
REVOLUT_WEBHOOK_SECRET=""
if [ -n "$REVOLUT_API_KEY" ]; then
  ask_secret REVOLUT_WEBHOOK_SECRET "   Секрет webhook (начинается с wsk_)" 10 required '^wsk_[A-Za-z0-9_-]+$'
fi

ask_secret_twice BACKUP_PASSPHRASE "6. Пароль зашифрованных копий (не короче 20 символов; сохраните в менеджере паролей)" 20
ask S3_ENDPOINT "7. Backblaze B2: адрес S3 (https://s3.<регион>.backblazeb2.com), Enter — пропустить" ""
S3_REGION="" ; S3_BUCKET="" ; S3_ACCESS_KEY_ID="" ; S3_SECRET_ACCESS_KEY=""
if [ -n "$S3_ENDPOINT" ]; then
  if ! [[ "$S3_ENDPOINT" =~ ^https://[^/[:space:]]+$ ]]; then die "адрес S3 должен начинаться с https://"; fi
  ask S3_REGION "   Регион бакета (например eu-central-003)" "" required
  ask S3_BUCKET "   Имя бакета" "" required
  ask S3_ACCESS_KEY_ID "   keyID ключа приложения" "" required
  ask_secret S3_SECRET_ACCESS_KEY "   applicationKey ключа приложения" 10 required
fi
ask BACKUP_PING_URL "8. Адрес пинга healthchecks.io (необязательно, Enter — пропустить)" ""

ask_secret_twice ADMIN_PW "9. Пароль админ-панели (не короче 12 символов)" 12

ask CHECKOUT_SUCCESS_URL "10. Страница после оплаты на сайте (с {locale})" "${SITE_ORIGIN}/{locale}/merci/" required
ask CHECKOUT_CANCEL_URL "11. Страница при отмене оплаты (с {locale})" "${SITE_ORIGIN}/{locale}/shop/" required

IP_SALT="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"

DC=(docker compose -f "$ROOT/deploy/docker-compose.yml")
if [ "$TEST_MODE" != 1 ]; then
  mkdir -p "$ROOT/private/products"
  if [ ! -d "$ROOT/.git" ]; then
    git -C "$ROOT" init -q
    git -C "$ROOT" remote add origin "$REPO_URL"
  fi
  git -C "$ROOT" fetch -q origin "$BRANCH"
  git -C "$ROOT" checkout -q -B "$BRANCH" FETCH_HEAD
fi

write_env() { # write_env HASH
  local tmp
  umask 077
  tmp="$(mktemp "${ENV_OUT}.XXXX")"
  {
    printf '%s\n' "# Создано deploy/setup-server.sh. Секреты не публиковать и не присылать в чат."
    printf 'API_DOMAIN=%s\n' "$API_DOMAIN"
    printf 'SITE_URL=https://%s\n' "$API_DOMAIN"
    printf 'ALLOWED_ORIGINS=%s\n' "$SITE_ORIGIN"
    printf 'CHECKOUT_SUCCESS_URL=%s\n' "$CHECKOUT_SUCCESS_URL"
    printf 'CHECKOUT_CANCEL_URL=%s\n' "$CHECKOUT_CANCEL_URL"
    printf 'IP_SALT=%s\n' "$IP_SALT"
    printf 'OWNER_EMAIL=%s\n' "$OWNER_EMAIL"
    printf 'OWNER_CHANNEL=smtp\nCLIENT_CHANNEL=smtp\n'
    printf 'SMTP_HOST=%s\nSMTP_PORT=%s\nSMTP_SECURE=starttls\n' "$SMTP_HOST" "$SMTP_PORT"
    printf 'SMTP_USER=%s\nSMTP_PASS=%s\n' "$SMTP_USER" "$SMTP_PASS"
    printf 'MAIL_FROM=%s\nMAIL_FROM_NAME=AINA Évidence\nMAIL_REPLY_TO=%s\n' "$MAIL_FROM" "$OWNER_EMAIL"
    printf 'PAYMENT_PROVIDER=revolut\nPAYMENTS_ENABLED=false\nENABLED_CURRENCIES=EUR\n'
    printf 'REVOLUT_ENV=%s\nREVOLUT_API_KEY=%s\nREVOLUT_WEBHOOK_SECRET=%s\n' "$REVOLUT_ENV" "$REVOLUT_API_KEY" "$REVOLUT_WEBHOOK_SECRET"
    printf 'LIVE_PAYMENTS_APPROVED=\n'
    printf 'BACKUP_PASSPHRASE=%s\nBACKUP_PING_URL=%s\n' "$BACKUP_PASSPHRASE" "$BACKUP_PING_URL"
    printf 'S3_ENDPOINT=%s\nS3_REGION=%s\nS3_BUCKET=%s\nS3_ACCESS_KEY_ID=%s\nS3_SECRET_ACCESS_KEY=%s\nS3_PREFIX=backups/\n' "$S3_ENDPOINT" "$S3_REGION" "$S3_BUCKET" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
    printf 'ADMIN_PASSWORD_HASH=%s\n' "$1"
  } > "$tmp"
  if [ -f "$ENV_OUT" ]; then cp "$ENV_OUT" "$ENV_OUT.bak"; chmod 600 "$ENV_OUT.bak"; fi
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_OUT"
}

# The hash is made by the same code the server uses (server/admin.mjs). The password goes in on stdin only.
HASH_JS='let d="";process.stdin.on("data",c=>d+=c).on("end",async()=>{const u=require("url");const m=await import(u.pathToFileURL(process.env.AINA_ADMIN_MODULE).href);process.stdout.write(await m.hashPassword(d.replace(/\r?\n$/,"")));});'

# First write without the hash: docker compose needs the env file to exist before it can build.
write_env ""
if [ "$TEST_MODE" = 1 ]; then
  HASH="$(printf '%s' "$ADMIN_PW" | AINA_ADMIN_MODULE="$ADMIN_MODULE" node -e "$HASH_JS")"
else
  "${DC[@]}" --env-file "$ENV_OUT" build api
  HASH="$(printf '%s' "$ADMIN_PW" | "${DC[@]}" --env-file "$ENV_OUT" run --rm -T --no-deps -e AINA_ADMIN_MODULE=/app/server/admin.mjs --entrypoint node api -e "$HASH_JS")"
fi
if ! [[ "$HASH" =~ ^scrypt:[0-9]+:[0-9]+:[0-9]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$ ]]; then die "не удалось создать хеш пароля админки"; fi
unset ADMIN_PW
write_env "$HASH"
unset HASH BACKUP_PASSPHRASE S3_SECRET_ACCESS_KEY SMTP_PASS REVOLUT_API_KEY REVOLUT_WEBHOOK_SECRET
say "Файл .env записан (права 600): $ENV_OUT"

if [ "$TEST_MODE" = 1 ]; then
  say "Тестовый режим: проверка конфигурации и запуск пропущены."
  exit 0
fi

say "Проверка конфигурации (защита production)..."
if ! "${DC[@]}" --env-file "$ENV_OUT" run --rm --no-deps -e NODE_ENV=production api node scripts/check-env.mjs; then
  die "конфигурация не прошла проверку. Запустите скрипт заново с исправленными ответами (старый .env сохранён как .env.bak)."
fi

say "Запуск (deploy/deploy.sh, с откатом при ошибке)..."
bash "$ROOT/deploy/deploy.sh"

say "Ждём ответа API..."
for _ in $(seq 1 30); do
  if curl -fsS "https://$API_DOMAIN/api/health" >/dev/null 2>&1; then
    say "API отвечает: https://$API_DOMAIN/api/health"
    say "Готово. Дальше: откройте https://$API_DOMAIN/admin на iPhone (docs/DEPLOY_STEPS.md, шаг 8)."
    exit 0
  fi
  sleep 10
done
die "API не ответил за 5 минут. Логи: docker compose -f deploy/docker-compose.yml logs --tail=100 api"
