# Windows Prisma generate — DLL lock workaround

On Windows, `prisma generate` can fail with:

`EPERM: operation not permitted, rename ... query_engine-windows.dll.node`

when a running Nest/API process still holds the Prisma engine DLL.

## Reliable local workflow

1. Stop the API watch process (`Ctrl+C` in the terminal running `pnpm --filter @fbm/api start:dev`).
2. Confirm port 3001 is free:
   ```powershell
   Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
     Select-Object OwningProcess, State
   ```
3. If a stale Node process owns the port, stop **that** PID only (do not kill unrelated processes):
   ```powershell
   Stop-Process -Id <OwningProcess> -Force
   ```
4. Run:
   ```powershell
   pnpm db:generate
   ```
5. Restart the API:
   ```powershell
   pnpm --filter @fbm/api start:dev
   ```

Helper script (manual): `scripts/win-prisma-generate.ps1` prints the port owner and runs generate after you confirm the API is stopped.
