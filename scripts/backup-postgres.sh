#!/usr/bin/env bash
# Create a PostgreSQL logical backup into ./backups (custom format).
# Usage: ./scripts/backup-postgres.sh [container_name] [db_user] [db_name]
set -euo pipefail

CONTAINER="${1:-fbm-postgres}"
DB_USER="${2:-fbm}"
DB_NAME="${3:-fbm_counter}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/fbm_counter-${STAMP}.dump"

echo "Backing up ${DB_NAME} from ${CONTAINER} → ${FILE}"
docker exec -t "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "/tmp/fbm_counter.dump"
docker cp "${CONTAINER}:/tmp/fbm_counter.dump" "$FILE"
docker exec -t "$CONTAINER" rm -f /tmp/fbm_counter.dump
echo "OK: $FILE"
ls -lh "$FILE"
