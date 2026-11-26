#!/usr/bin/env bash
# Deploys a git ref on the server and rolls back automatically if the API does not become healthy.
# Usage (on the server, as the deploy user, in /opt/aina):  deploy/deploy.sh [git-ref]   (default: the current branch head)
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${1:-$(git rev-parse --abbrev-ref HEAD)}"
COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file .env)
[ -f .env ] || { echo "ERROR: .env is missing (copy .env.example, fill in, chmod 600)"; exit 1; }
[ "$(stat -c %a .env)" = "600" ] || { echo "ERROR: chmod 600 .env (it holds secrets)"; exit 1; }

PREVIOUS="$(git rev-parse HEAD)"
git fetch --quiet origin
git checkout --quiet "$REF"
git pull --quiet --ff-only origin "$REF" 2>/dev/null || true
NEW="$(git rev-parse HEAD)"
echo "Deploying $NEW (previous $PREVIOUS)"

echo "Checking configuration with the production guard..."
"${COMPOSE[@]}" build --quiet api
if ! "${COMPOSE[@]}" run --rm --no-deps -e NODE_ENV=production api node scripts/check-env.mjs; then
  echo "ERROR: configuration refused. Nothing was changed."; git checkout --quiet "$PREVIOUS"; exit 1
fi

"${COMPOSE[@]}" up -d --build
echo -n "Waiting for the API to become healthy"
for i in $(seq 1 30); do
  STATUS="$(docker inspect --format '{{.State.Health.Status}}' "$("${COMPOSE[@]}" ps -q api)" 2>/dev/null || echo starting)"
  [ "$STATUS" = "healthy" ] && { echo " ok"; "${COMPOSE[@]}" ps; exit 0; }
  echo -n "."; sleep 2
done

echo; echo "ERROR: the API is not healthy. Rolling back to $PREVIOUS"
"${COMPOSE[@]}" logs --tail=40 api || true
git checkout --quiet "$PREVIOUS"
"${COMPOSE[@]}" up -d --build
exit 1
