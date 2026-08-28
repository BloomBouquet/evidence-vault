#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/evidence-vault"
ENV_FILE="$APP_DIR/.env.production"
PROCESS_NAME="evidence-vault-preview"
PREVIEW_PORT="3011"
HEALTH_URL="http://127.0.0.1:3011/api/health"

fail() {
  echo "preview deploy failed: $1" >&2
  exit 1
}

require_preview_env() {
  test -f "$ENV_FILE" || fail "preview environment missing"

  ENV_MODE="$(stat -c '%a' "$ENV_FILE")"
  [ "$ENV_MODE" = "600" ] || fail "preview environment permissions must be 600"

  set -a
  . "$ENV_FILE"
  set +a

  : "${DATABASE_URL:?DATABASE_URL is required}"
  : "${SESSION_SECRET:?SESSION_SECRET is required}"
  : "${APP_BASE_URL:?APP_BASE_URL is required}"
  : "${BOUQUET_BASE_URL:?BOUQUET_BASE_URL is required}"
  : "${BOUQUET_CLIENT_ID:?BOUQUET_CLIENT_ID is required}"
  : "${BOUQUET_REDIRECT_URI:?BOUQUET_REDIRECT_URI is required}"

  [ "${NODE_ENV:-production}" = "production" ] || fail "NODE_ENV must be production"
  [ "${PORT:-3011}" = "$PREVIEW_PORT" ] || fail "preview port must be 3011"
  [ "$APP_BASE_URL" = "https://evidence-vault.https.gsmsv.site" ] || fail "APP_BASE_URL does not match preview contract"
  [ "$BOUQUET_BASE_URL" = "https://playground.https.gsmsv.site" ] || fail "BOUQUET_BASE_URL does not match preview contract"
  [ "$BOUQUET_REDIRECT_URI" = "https://evidence-vault.https.gsmsv.site/auth/bouquet/callback" ] || fail "BOUQUET_REDIRECT_URI does not match preview contract"
  [ "${#SESSION_SECRET}" -ge 32 ] || fail "SESSION_SECRET is too short"
}

verify_port_owner() {
  local listener_line listener_pid pm2_pid
  listener_line="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:3011$/ { print; exit }')"
  [ -n "$listener_line" ] || return 0

  listener_pid="$(printf '%s\n' "$listener_line" | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p')"
  pm2_pid="$(pm2 pid "$PROCESS_NAME" 2>/dev/null | awk 'NF && $1 != 0 { print $1; exit }')"

  [ -n "$listener_pid" ] || fail "port 3011 is occupied but listener ownership cannot be verified"
  [ -n "$pm2_pid" ] || fail "port 3011 is occupied by a non-preview process"
  [ "$listener_pid" = "$pm2_pid" ] || fail "port 3011 is occupied by a non-preview process"
}

activate_pnpm() {
  export PATH="$HOME/.local/node_modules/.bin:$PATH"
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@10.33.0 --activate >/dev/null 2>&1 || true
  if ! command -v pnpm >/dev/null 2>&1; then
    npm install --prefix "$HOME/.local" pnpm@10.33.0 >/dev/null 2>&1 || fail "pnpm 10.33.0 setup failed"
  fi
}

start_or_restart_preview() {
  if [ "$(pm2 pid "$PROCESS_NAME" 2>/dev/null | awk 'NF && $1 != 0 { print $1; exit }')" ]; then
    pm2 restart "$PROCESS_NAME" --update-env >/dev/null || return 1
  else
    pm2 start scripts/start-preview.sh --name "$PROCESS_NAME" --interpreter bash --update-env >/dev/null || return 1
  fi
}

wait_for_health() {
  local attempt body
  for attempt in $(seq 1 30); do
    if body="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null)"; then
      if printf '%s' "$body" | grep -q '"ok":true' && printf '%s' "$body" | grep -q '"service":"evidence-vault"'; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

restore_previous_code() {
  echo "restoring previous application SHA without reversing database migrations" >&2
  git reset --hard "$PREVIOUS_SHA" >/dev/null || return 1
  activate_pnpm
  pnpm install --frozen-lockfile >/dev/null 2>&1 || return 1
  pnpm build >/dev/null 2>&1 || return 1
  start_or_restart_preview || return 1
  wait_for_health || return 1
}

[ "$#" -eq 1 ] || fail "usage: deploy-preview.sh <verified-develop-sha>"
VERIFIED_SHA="$1"
[[ "$VERIFIED_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "verified SHA must be 40 hexadecimal characters"

cd "$APP_DIR"
require_preview_env
verify_port_owner

PREVIOUS_SHA="$(git rev-parse HEAD)"

git fetch origin develop >/dev/null 2>&1 || fail "git fetch origin develop failed"
git cat-file -e "${VERIFIED_SHA}^{commit}" 2>/dev/null || fail "verified SHA does not exist"
git merge-base --is-ancestor "$VERIFIED_SHA" origin/develop || fail "verified SHA is not contained in origin/develop"

git reset --hard "$VERIFIED_SHA" >/dev/null || fail "git reset to verified SHA failed"
activate_pnpm

if ! pnpm install --frozen-lockfile; then
  git reset --hard "$PREVIOUS_SHA" >/dev/null 2>&1 || true
  fail "dependency install failed"
fi

if ! pnpm db:migrate; then
  git reset --hard "$PREVIOUS_SHA" >/dev/null 2>&1 || true
  fail "database migration failed; no down migration was attempted"
fi

if ! pnpm build; then
  git reset --hard "$PREVIOUS_SHA" >/dev/null 2>&1 || true
  fail "production build failed; database migration was left forward-only"
fi

if ! start_or_restart_preview; then
  restore_previous_code || true
  fail "preview process restart failed"
fi

if ! wait_for_health; then
  restore_previous_code || true
  fail "preview health check failed"
fi

pm2 save >/dev/null || fail "pm2 save failed"
echo "Evidence Vault preview deploy OK sha=$VERIFIED_SHA"
