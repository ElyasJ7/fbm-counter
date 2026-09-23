#!/usr/bin/env bash
# Bootstrap first production admin (no demo users).
# Usage on VM (/opt/fbm):
#   ADMIN_EMAIL=you@company.example ADMIN_PASSWORD='...' ./create-admin.sh
# If ADMIN_PASSWORD is omitted, a random password is printed once.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "missing .env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env
set +a

EMAIL="${ADMIN_EMAIL:-${STAGING_ADMIN_EMAIL:-}}"
PASSWORD="${ADMIN_PASSWORD:-${STAGING_ADMIN_PASSWORD:-}}"

if [[ -z "$EMAIL" ]]; then
  echo "Set ADMIN_EMAIL in the environment" >&2
  exit 1
fi

docker compose -f production.compose.yml --env-file .env run --rm --no-deps \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-fbm}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-fbm_counter}?schema=public" \
  -e ADMIN_EMAIL="$EMAIL" \
  -e ADMIN_PASSWORD="${PASSWORD:-}" \
  -e STAGING_ADMIN_EMAIL="$EMAIL" \
  -e STAGING_ADMIN_PASSWORD="${PASSWORD:-}" \
  --entrypoint "" \
  api \
  node /app/deploy/create-admin.cjs
