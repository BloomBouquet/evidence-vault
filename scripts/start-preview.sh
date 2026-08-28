#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/evidence-vault"
ENV_FILE="$APP_DIR/.env.production"
PORT="${PORT:-3011}"

test -f "$ENV_FILE" || { echo "preview environment missing" >&2; exit 1; }

set -a
. "$ENV_FILE"
set +a

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SESSION_SECRET:?SESSION_SECRET is required}"
: "${APP_BASE_URL:?APP_BASE_URL is required}"
: "${BOUQUET_BASE_URL:?BOUQUET_BASE_URL is required}"
: "${BOUQUET_CLIENT_ID:?BOUQUET_CLIENT_ID is required}"
: "${BOUQUET_REDIRECT_URI:?BOUQUET_REDIRECT_URI is required}"

[ "${NODE_ENV:-production}" = "production" ] || { echo "NODE_ENV must be production" >&2; exit 1; }
[ "$PORT" = "3011" ] || { echo "preview port must be 3011" >&2; exit 1; }
[ "$APP_BASE_URL" = "https://evidence-vault.https.gsmsv.site" ] || { echo "APP_BASE_URL does not match preview contract" >&2; exit 1; }
[ "$BOUQUET_BASE_URL" = "https://playground.https.gsmsv.site" ] || { echo "BOUQUET_BASE_URL does not match preview contract" >&2; exit 1; }
[ "$BOUQUET_REDIRECT_URI" = "https://evidence-vault.https.gsmsv.site/auth/bouquet/callback" ] || { echo "BOUQUET_REDIRECT_URI does not match preview contract" >&2; exit 1; }
[ "${#SESSION_SECRET}" -ge 32 ] || { echo "SESSION_SECRET is too short" >&2; exit 1; }

cd "$APP_DIR"
exec pnpm start --hostname 127.0.0.1 --port "$PORT"
