#!/usr/bin/env bash
# Daily backup: Postgres + local uploads. Intended for cron on the VM.
# Install: see docs/oracle-cloud-deployment.md
set -euo pipefail

ROOT="${FBM_ROOT:-/opt/fbm}"
cd "$ROOT"

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source .env
set +a

BACKUP_DIR="${FBM_BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY="$(date -u +%Y%m%d)"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"

CONTAINER="${POSTGRES_CONTAINER:-fbm-postgres}"
DB_USER="${POSTGRES_USER:-fbm}"
DB_NAME="${POSTGRES_DB:-fbm_counter}"

DUMP="$BACKUP_DIR/fbm-${STAMP}.dump"
echo "[$(date -u +%FT%TZ)] backup start → $DUMP"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f /tmp/fbm_backup.dump
docker cp "$CONTAINER:/tmp/fbm_backup.dump" "$DUMP"
docker exec "$CONTAINER" rm -f /tmp/fbm_backup.dump

if [[ -d "$ROOT/uploads" ]]; then
  tar -C "$ROOT" -czf "$BACKUP_DIR/uploads-${STAMP}.tgz" uploads
fi

# Retention: keep last N daily dumps (by mtime)
mapfile -t dumps < <(ls -1t "$BACKUP_DIR"/fbm-*.dump 2>/dev/null || true)
if ((${#dumps[@]} > KEEP_DAILY)); then
  for old in "${dumps[@]:KEEP_DAILY}"; do
    rm -f "$old"
    base="${old%.dump}"
    rm -f "${base/fbm-/uploads-}.tgz" 2>/dev/null || true
  done
fi

# Weekly copy on Sunday UTC
if [[ "$(date -u +%u)" == "7" ]]; then
  cp -f "$DUMP" "$BACKUP_DIR/weekly-fbm-${DAY}.dump" || true
fi

echo "[$(date -u +%FT%TZ)] backup OK ($(du -h "$DUMP" | awk '{print $1}'))"
