#!/usr/bin/env bash
# Restore a PostgreSQL dump into an ISOLATED target database (never production by default).
# Usage:
#   ./scripts/restore-postgres-drill.sh ./backups/fbm_counter-YYYYMMDD.dump
#
# Creates/uses database fbm_counter_restore on the same Postgres container.
set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "Usage: $0 <path-to.dump>" >&2
  exit 1
fi

CONTAINER="${CONTAINER:-fbm-postgres}"
DB_USER="${DB_USER:-fbm}"
RESTORE_DB="${RESTORE_DB:-fbm_counter_restore}"

echo "Restore drill → database '${RESTORE_DB}' on container '${CONTAINER}'"
echo "Source dump: $DUMP_FILE"
echo "This does NOT touch the primary 'fbm_counter' database."

docker exec -t "$CONTAINER" psql -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${RESTORE_DB}' AND pid <> pg_backend_pid();" \
  || true
docker exec -t "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${RESTORE_DB};"
docker exec -t "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${RESTORE_DB} OWNER ${DB_USER};"

docker cp "$DUMP_FILE" "${CONTAINER}:/tmp/fbm_restore.dump"
docker exec -t "$CONTAINER" pg_restore -U "$DB_USER" -d "$RESTORE_DB" --clean --if-exists /tmp/fbm_restore.dump \
  || echo "pg_restore finished with warnings (often OK for custom-format restores)"
docker exec -t "$CONTAINER" rm -f /tmp/fbm_restore.dump

echo "--- Verification ---"
docker exec -t "$CONTAINER" psql -U "$DB_USER" -d "$RESTORE_DB" -c "\dt"
docker exec -t "$CONTAINER" psql -U "$DB_USER" -d "$RESTORE_DB" -c \
  "SELECT 'users' AS entity, COUNT(*) FROM users
   UNION ALL SELECT 'projects', COUNT(*) FROM projects
   UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
   UNION ALL SELECT 'payments', COUNT(*) FROM payments
   UNION ALL SELECT 'documents', COUNT(*) FROM documents;"

echo "OK: restore drill completed against ${RESTORE_DB}"
echo "Compare counts with primary DB manually if needed."
