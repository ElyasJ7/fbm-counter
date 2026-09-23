#!/usr/bin/env bash
# Deploy FBM Counter on the VM (/opt/fbm).
# Usage (from /opt/fbm): ./deploy.sh [image_tag_or_sha]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: missing $ROOT/.env (copy from production.env.example)" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env
set +a

: "${FBM_API_IMAGE:?FBM_API_IMAGE required in .env}"
: "${FBM_WEB_IMAGE:?FBM_WEB_IMAGE required in .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"
: "${FBM_DOMAIN:?FBM_DOMAIN required}"
: "${CORS_ORIGIN:?CORS_ORIGIN required}"
: "${JWT_ACCESS_SECRET:?JWT_ACCESS_SECRET required}"

COMPOSE=(docker compose -f production.compose.yml --env-file .env)
BACKUP_DIR="${FBM_BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR" data/postgres uploads caddy/data caddy/config

TAG_OVERRIDE="${1:-}"
if [[ -n "$TAG_OVERRIDE" ]]; then
  # Allow deploying a specific SHA: ./deploy.sh abc1234
  if [[ "$FBM_API_IMAGE" == *:* ]]; then
    export FBM_API_IMAGE="${FBM_API_IMAGE%:*}:${TAG_OVERRIDE}"
  else
    export FBM_API_IMAGE="${FBM_API_IMAGE}:${TAG_OVERRIDE}"
  fi
  if [[ "$FBM_WEB_IMAGE" == *:* ]]; then
    export FBM_WEB_IMAGE="${FBM_WEB_IMAGE%:*}:${TAG_OVERRIDE}"
  else
    export FBM_WEB_IMAGE="${FBM_WEB_IMAGE}:${TAG_OVERRIDE}"
  fi
  echo "Using images:"
  echo "  API: $FBM_API_IMAGE"
  echo "  WEB: $FBM_WEB_IMAGE"
fi

echo "==> Validating compose"
"${COMPOSE[@]}" config >/dev/null

echo "==> Pulling images"
"${COMPOSE[@]}" pull api web caddy postgres

echo "==> Ensuring postgres is up"
"${COMPOSE[@]}" up -d postgres
echo "==> Waiting for postgres healthy"
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-fbm}" -d "${POSTGRES_DB:-fbm_counter}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/pre-deploy-${STAMP}.dump"
echo "==> Pre-deploy database backup → $DUMP"
if docker exec fbm-postgres pg_dump -U "${POSTGRES_USER:-fbm}" -d "${POSTGRES_DB:-fbm_counter}" -Fc -f "/tmp/pre-deploy.dump" 2>/dev/null; then
  docker cp fbm-postgres:/tmp/pre-deploy.dump "$DUMP"
  docker exec fbm-postgres rm -f /tmp/pre-deploy.dump
  # Uploads snapshot (tar) — documents + DB together
  if [[ -d uploads ]] && [[ -n "$(ls -A uploads 2>/dev/null || true)" ]]; then
    tar -C . -czf "$BACKUP_DIR/pre-deploy-uploads-${STAMP}.tgz" uploads
  fi
  echo "Backup OK"
else
  echo "WARN: pg_dump skipped (empty or first boot)"
fi

echo "==> Prisma migrate deploy"
"${COMPOSE[@]}" run --rm --no-deps \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-fbm}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-fbm_counter}?schema=public" \
  --entrypoint "" \
  api \
  prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "==> Starting / updating stack"
"${COMPOSE[@]}" up -d

echo "==> Waiting for API readiness"
ok=0
for _ in $(seq 1 60); do
  if docker exec fbm-api wget -qO- http://127.0.0.1:3001/api/health/ready 2>/dev/null | grep -q '"status":"ready"'; then
    ok=1
    break
  fi
  sleep 3
done
if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: API /health/ready failed" >&2
  "${COMPOSE[@]}" ps >&2 || true
  docker logs fbm-api --tail 80 >&2 || true
  exit 1
fi

echo "==> Public HTTPS health (via Caddy)"
if command -v curl >/dev/null; then
  curl -fsS "https://${FBM_DOMAIN}/api/health" >/dev/null || {
    echo "WARN: https://${FBM_DOMAIN}/api/health not reachable yet (DNS/TLS may still be provisioning)"
  }
fi

echo "Deploy complete."
