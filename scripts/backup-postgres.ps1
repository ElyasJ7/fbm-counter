# Create a PostgreSQL logical backup into ./backups (custom format).
# Usage: .\scripts\backup-postgres.ps1 [-Container fbm-postgres] [-DbUser fbm] [-DbName fbm_counter]
param(
  [string]$Container = "fbm-postgres",
  [string]$DbUser = "fbm",
  [string]$DbName = "fbm_counter",
  [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $BackupDir "fbm_counter-$stamp.dump"

Write-Host "Backing up $DbName from $Container → $file"
docker exec -t $Container pg_dump -U $DbUser -d $DbName -Fc -f /tmp/fbm_counter.dump
docker cp "${Container}:/tmp/fbm_counter.dump" $file
docker exec -t $Container rm -f /tmp/fbm_counter.dump
Write-Host "OK: $file"
Get-Item $file | Format-List FullName, Length, LastWriteTime
