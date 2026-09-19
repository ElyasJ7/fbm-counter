# Restore a PostgreSQL dump into an ISOLATED target database (never production by default).
# Usage: .\scripts\restore-postgres-drill.ps1 -DumpFile .\backups\fbm_counter-YYYYMMDD.dump
param(
  [Parameter(Mandatory = $true)][string]$DumpFile,
  [string]$Container = "fbm-postgres",
  [string]$DbUser = "fbm",
  [string]$RestoreDb = "fbm_counter_restore"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $DumpFile)) {
  throw "Dump file not found: $DumpFile"
}

Write-Host "Restore drill → database '$RestoreDb' on container '$Container'"
Write-Host "Source dump: $DumpFile"
Write-Host "This does NOT touch the primary 'fbm_counter' database."

docker exec -t $Container psql -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$RestoreDb' AND pid <> pg_backend_pid();" 2>$null
docker exec -t $Container psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $RestoreDb;"
docker exec -t $Container psql -U $DbUser -d postgres -c "CREATE DATABASE $RestoreDb OWNER $DbUser;"

docker cp $DumpFile "${Container}:/tmp/fbm_restore.dump"
docker exec -t $Container pg_restore -U $DbUser -d $RestoreDb --clean --if-exists /tmp/fbm_restore.dump
docker exec -t $Container rm -f /tmp/fbm_restore.dump

Write-Host "--- Verification ---"
docker exec -t $Container psql -U $DbUser -d $RestoreDb -c "\dt"
docker exec -t $Container psql -U $DbUser -d $RestoreDb -c "SELECT 'users' AS entity, COUNT(*) FROM users UNION ALL SELECT 'projects', COUNT(*) FROM projects UNION ALL SELECT 'invoices', COUNT(*) FROM invoices UNION ALL SELECT 'payments', COUNT(*) FROM payments UNION ALL SELECT 'documents', COUNT(*) FROM documents;"

Write-Host "OK: restore drill completed against $RestoreDb"
