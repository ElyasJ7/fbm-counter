# Bring up local staging stack: env → build → migrate → admin → health.
# Requires Docker Desktop running.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/staging-up.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$EnvFile = Join-Path $Root 'deploy\staging.env'
$Example = Join-Path $Root 'deploy\staging.env.example'

if (-not (Test-Path $EnvFile)) {
  if (-not (Test-Path $Example)) { throw "Missing $Example" }
  Copy-Item $Example $EnvFile
  $dbPw = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  $jwt = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  (Get-Content $EnvFile -Raw) `
    -replace 'replace-with-strong-db-password', $dbPw `
    -replace 'replace-with-random-secret-at-least-32-chars-long', $jwt `
    | Set-Content -NoNewline $EnvFile
  Write-Host "Created deploy/staging.env with generated secrets."
}

# Load KEY=VALUE into process + compose
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $i = $line.IndexOf('=')
  if ($i -lt 1) { return }
  $key = $line.Substring(0, $i).Trim()
  $val = $line.Substring($i + 1).Trim()
  Set-Item -Path "Env:$key" -Value $val
}

$dbPassword = $env:STAGING_DB_PASSWORD
if (-not $dbPassword) { throw 'STAGING_DB_PASSWORD missing in deploy/staging.env' }

Write-Host "Building and starting staging stack..."
docker compose -f docker-compose.staging.yml --env-file deploy/staging.env up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

Write-Host "Waiting for Postgres..."
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  docker exec fbm-staging-postgres pg_isready -U fbm -d fbm_counter_staging | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'Staging Postgres not ready' }

$migrateUrl = "postgresql://fbm:$dbPassword@127.0.0.1:5433/fbm_counter_staging?schema=public"
Write-Host "Applying migrations..."
$env:DATABASE_URL = $migrateUrl
pnpm --filter @fbm/api exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'migrate deploy failed' }

Write-Host "Ensuring staging admin..."
node --import tsx scripts/create-staging-admin.mjs
if ($LASTEXITCODE -ne 0) { throw 'create-staging-admin failed' }

Write-Host "Waiting for API health..."
$apiOk = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3002/api/health/ready' -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $apiOk = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $apiOk) { throw 'API /health/ready failed' }

Write-Host ""
Write-Host "Staging is up:"
Write-Host "  Web:  http://127.0.0.1:8081"
Write-Host "  API:  http://127.0.0.1:3002/api"
Write-Host "  DB:   localhost:5433 / fbm_counter_staging"
Write-Host "Smoke: `$env:API_BASE='http://127.0.0.1:3002/api'; node scripts/golive-smoke.mjs"
Write-Host "Note: Secure cookies need HTTPS for browser login; use API smoke on local HTTP."
