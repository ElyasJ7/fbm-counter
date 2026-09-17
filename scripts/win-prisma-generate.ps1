# Stops nothing automatically — inspects port 3001 then runs prisma generate.
$ErrorActionPreference = 'Stop'
Write-Host 'Checking port 3001 owners...'
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess, State |
  Format-Table -AutoSize

Write-Host ''
Write-Host 'If Nest/API is running, stop it first (Ctrl+C), then re-run this script.'
Write-Host 'Press Enter to continue with prisma generate, or Ctrl+C to abort.'
[void][System.Console]::ReadLine()

Set-Location (Split-Path $PSScriptRoot -Parent)
pnpm db:generate
