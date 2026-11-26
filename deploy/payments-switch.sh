#!/usr/bin/env bash
# Switches payments on the server, with explicit typed confirmations. Run on the server from /opt/aina:
#   bash deploy/payments-switch.sh status            # shows the switches (no secrets)
#   bash deploy/payments-switch.sh sandbox-on        # Revolut sandbox: test orders, no real money
#   bash deploy/payments-switch.sh off               # all payments off
#   bash deploy/payments-switch.sh production-on     # REAL money: needs two typed confirmations
# Production needs the owner's written decision (docs/DEPLOY_STEPS.md, step 9). The script does not decide for you.
set -euo pipefail

ENV_FILE="${AINA_ENV_FILE:-/opt/aina/.env}"
ROOT="${AINA_ROOT:-/opt/aina}"
TEST_MODE="${AINA_PAYMENTS_TEST:-0}"
DC=(docker compose -f "$ROOT/deploy/docker-compose.yml" --env-file "$ENV_FILE")

say() { printf '%s\n' "$*" >&2; }
die() { say "ОШИБКА: $*"; exit 1; }

[ -f "$ENV_FILE" ] || die "нет файла $ENV_FILE (сначала deploy/setup-server.sh)"

get() { # get KEY -> value (empty if missing)
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  printf '%s' "${line#*=}"
}

set_key() { # set_key KEY VALUE: replaces the line or appends it; keeps everything else
  local key="$1" value="$2" tmp
  umask 077
  tmp="$(mktemp "$ENV_FILE.XXXX")"
  if grep -qE "^$key=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' "$ENV_FILE" > "$tmp"
  else
    cat "$ENV_FILE" > "$tmp"; printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

restart_api() {
  if [ "$TEST_MODE" = 1 ]; then say "(тест: перезапуск пропущен)"; return; fi
  "${DC[@]}" up -d api
  say "API перезапущен с новыми настройками."
}

case "${1:-}" in
  status)
    say "PAYMENTS_ENABLED=$(get PAYMENTS_ENABLED)"
    say "REVOLUT_ENV=$(get REVOLUT_ENV)"
    say "LIVE_PAYMENTS_APPROVED=$(get LIVE_PAYMENTS_APPROVED)"
    say "REVOLUT_API_KEY: $( [ -n "$(get REVOLUT_API_KEY)" ] && echo задан || echo НЕ задан)"
    say "REVOLUT_WEBHOOK_SECRET: $( [ -n "$(get REVOLUT_WEBHOOK_SECRET)" ] && echo задан || echo НЕ задан)"
    ;;
  sandbox-on)
    [ -n "$(get REVOLUT_API_KEY)" ] || die "сначала задайте ключ песочницы (REVOLUT_API_KEY) в .env"
    [ -n "$(get REVOLUT_WEBHOOK_SECRET)" ] || die "сначала задайте секрет webhook (REVOLUT_WEBHOOK_SECRET) в .env"
    set_key REVOLUT_ENV sandbox
    set_key LIVE_PAYMENTS_APPROVED ""
    set_key PAYMENTS_ENABLED true
    say "Песочница включена: тестовые заказы, реальных денег нет."
    restart_api
    ;;
  off)
    set_key PAYMENTS_ENABLED false
    say "Платежи выключены."
    restart_api
    ;;
  production-on)
    [ -n "$(get REVOLUT_API_KEY)" ] || die "нужен боевой ключ Revolut в .env"
    [ -n "$(get REVOLUT_WEBHOOK_SECRET)" ] || die "нужен секрет webhook в .env"
    say "ВНИМАНИЕ: это включает приём РЕАЛЬНЫХ платежей."
    say "Введите фразу 'merchant-approved', если Merchant-аккаунт одобрен Revolut:"
    IFS= read -r a || die "ввод прерван"; [ "$a" = merchant-approved ] || die "фраза не совпала, ничего не изменено"
    say "Введите фразу 'owner-approved', если вы письменно приняли решение о боевом режиме:"
    IFS= read -r b || die "ввод прерван"; [ "$b" = owner-approved ] || die "фраза не совпала, ничего не изменено"
    set_key REVOLUT_ENV production
    set_key LIVE_PAYMENTS_APPROVED owner-approved
    set_key PAYMENTS_ENABLED true
    if [ "$TEST_MODE" != 1 ]; then
      "${DC[@]}" run --rm --no-deps -e NODE_ENV=production api node scripts/check-env.mjs || die "проверка не прошла; верните прежние настройки: bash deploy/payments-switch.sh off"
    fi
    say "Боевой режим включён."
    restart_api
    ;;
  *)
    die "используйте: status | sandbox-on | off | production-on"
    ;;
esac
