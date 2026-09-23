# Staging readiness checklist

Use this before promoting a build from local/CI to a shared staging environment.

## Local staging (this repo)

Quick start on the developer machine (Docker Desktop):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/staging-up.ps1
```

- Web: http://127.0.0.1:8081  
- API: http://127.0.0.1:3002/api  
- DB: localhost:5433 / `fbm_counter_staging`  
- Secrets: `deploy/staging.env` (gitignored; generated from `deploy/staging.env.example`)  
- Admin: created by `scripts/create-staging-admin.mjs` (password printed once)  
- Note: `COOKIE_SECURE=true` means browser session cookies need HTTPS; API login still works for smoke tests.

For a public VPS/cloud staging host, continue with the checklist below (HTTPS required).

## Environment

- [ ] `NODE_ENV=production` (or dedicated staging profile with production-like security)
- [ ] `DATABASE_URL` points to **staging** Postgres only
- [ ] Strong unique `JWT_ACCESS_SECRET` (≥32 chars, not `change-me`)
- [ ] `CORS_ORIGIN` = staging web origin (HTTPS)
- [ ] `COOKIE_SECURE=true` (or omit; auto-true when `NODE_ENV=production`)
- [ ] `COOKIE_SAME_SITE=lax` or `strict` (`none` blocked until CSRF tokens)
- [ ] `TRUST_PROXY=true` behind reverse proxy (trust hop count = 1)
- [ ] `STORAGE_DRIVER=local` with persistent volume **or** S3 with non-default credentials
- [ ] `ALLOW_SEED` unset or `false` (never seed staging with demo passwords after go-live data exists)
- [ ] Web build `VITE_API_URL` points at staging API

## Database

- [ ] `prisma migrate deploy` on empty or existing staging DB succeeds
- [ ] No `prisma migrate reset` in shared environments
- [ ] Admin user created securely (not demo seed passwords)

## Storage

- [ ] Upload directory writable by API user (local) **or** S3 bucket private
- [ ] `/api/health/ready` reports storage OK

## Backup / restore

- [ ] Nightly Postgres backup configured (see `docs/ops-backups.md`)
- [ ] Restore drill executed against **isolated** DB (`scripts/restore-postgres-drill.sh`)
- [ ] Object storage / uploads included in backup plan
- [ ] RPO / RTO placeholders filled for the company

## Security smoke

- [ ] HTTPS terminated at proxy
- [ ] Login rate limit effective
- [ ] VIEWER cannot mutate
- [ ] PROJECT_MANAGER cannot open unassigned project (H3)
- [ ] Document download denied for unassigned project (H3)
- [ ] Admin metrics `/api/health/metrics` requires ADMIN

## Functional smoke

- [ ] Login / logout / refresh
- [ ] Dashboard loads for ADMIN and for assigned PM
- [ ] Create invoice → partial payment → paid
- [ ] Report CSV export authorized
- [ ] Document upload + download

## Observability

- [ ] Structured request logs include `requestId`
- [ ] Overdue job and document GC run once (check logs)
- [ ] Failure alerts destination agreed (email/Slack/pager — operator-defined)

## Rollback

- [ ] Previous container image tag retained
- [ ] DB backup taken immediately before deploy
- [ ] Rollback steps in `docs/production-runbook.md` reviewed
