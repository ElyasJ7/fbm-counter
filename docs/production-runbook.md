# Production runbook — FBM Counter

## Supported topology

```
Browser (HTTPS)
  → Reverse proxy (Nginx / Traefik / Cloudflare)
    → Web (static nginx container, port 8080)
    → API (NestJS container, port 3001)
      → PostgreSQL
      → Local volume or S3/MinIO for documents
```

Requirements:

- TLS at the proxy
- `TRUST_PROXY=true` on API (Express trust proxy hop = 1 — do not use unrestricted `true` for all hops)
- `CORS_ORIGIN` = exact web origin(s)
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax|Strict`

## Deploy

See **`docs/oracle-cloud-deployment.md`** for Oracle Cloud Free + GHCR + Caddy.

1. Take a Postgres backup (`scripts/backup-postgres.sh` or provider snapshot).
2. Build images (CI publishes multi-arch to GHCR) **or** locally:
   - `docker build -f apps/api/Dockerfile -t fbm-api:<tag> .`
   - `docker build -f apps/web/Dockerfile -t fbm-web:<tag> --build-arg VITE_API_URL=/api .`
3. Set production env on the server (`deploy/production.env.example` → `/opt/fbm/.env`).
4. Run `./deploy.sh` on the VM (pull → backup → `prisma migrate deploy` → up → health).
5. Verify:
   - `GET /api/health` → ok
   - `GET /api/health/ready` → database up
   - Login as admin (HTTPS + Secure cookies)
   - Create/read one project invoice smoke

## Rollback

1. **App:** redeploy previous image tags for API and web.
2. **Migrations:** prefer forward-fix. If a migration must be reverted, restore DB from pre-deploy backup into a clone first and validate — do not guess reverse SQL on live data.
3. **Data:** restore only from verified backup with an approved downtime window.

## Incident basics

| Symptom | First checks |
|---------|----------------|
| API down | Container health, logs, `/api/health`, DB connectivity |
| DB unavailable | Postgres status, connection limits, disk |
| Storage unavailable | `/api/health/ready` storage field; S3 creds; volume mount |
| Scheduler silent | API logs for overdue/GC; advisory lock contention; single-replica vs multi |
| Auth failures | Cookie Secure/SameSite vs HTTPS; CORS; JWT secret rotation mismatch |
| 429 storms | Throttle limits; client IP via `TRUST_PROXY` |

## Backup

- Create: `scripts/backup-postgres.sh` + uploads/S3 sync (see `docs/ops-backups.md`)
- Verify: restore drill into `fbm_counter_restore` (`scripts/restore-postgres-drill.sh`)
- Retention / RPO / RTO: fill in ops-backups table for your company

## Logs

- API emits JSON request logs with `requestId` (also returned as `x-request-id`)
- Correlate user reports by `requestId` + timestamp
- Never paste passwords, cookies, or Authorization headers into tickets

## Scheduler

| Job | Schedule | Lock |
|-----|----------|------|
| Overdue invoices | Daily 06:00 | `pg_try_advisory_lock(872314059)` |
| Document blob GC | Daily 03:00 | `pg_try_advisory_lock(872314060)` |

Safe under multiple API replicas: non-lock holders skip.
