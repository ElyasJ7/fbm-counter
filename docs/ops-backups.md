# Backup & restore — FBM Counter

Operational guide for production data protection. Adjust schedules and RPO/RTO
to your company policy. **Do not** run destructive restores against a live
production database without a verified plan and downtime window.

## Targets (fill in for your deployment)

| Metric | Placeholder | Notes |
|--------|-------------|-------|
| RPO (max data loss) | e.g. 24h / 1h | How often backups run |
| RTO (max downtime) | e.g. 4h | Time to restore + verify |
| Retention | e.g. 30 daily + 12 monthly | Legal/business retention |

## PostgreSQL (application data)

### Local / Docker Compose (dev)

Database service: `postgres` in `docker-compose.yml`  
Volume: `fbm_pg_data`  
Connection: see `DATABASE_URL` in `apps/api/.env` (never commit secrets)

**Logical backup (custom format):**

```bash
# Cross-platform scripts (preferred)
./scripts/backup-postgres.sh
# Windows PowerShell:
#   .\scripts\backup-postgres.ps1

# Or manual:
docker exec -t fbm-postgres pg_dump -U fbm -d fbm_counter -Fc -f /tmp/fbm_counter.dump
docker cp fbm-postgres:/tmp/fbm_counter.dump ./backups/fbm_counter-$(date +%Y%m%d).dump
```

**Plain SQL backup:**

```bash
docker exec -t fbm-postgres pg_dump -U fbm -d fbm_counter > ./backups/fbm_counter-$(date +%Y%m%d).sql
```

**Restore drill (isolated DB — never production):**

```bash
./scripts/restore-postgres-drill.sh ./backups/fbm_counter-YYYYMMDD.dump
# Windows:
#   .\scripts\restore-postgres-drill.ps1 -DumpFile .\backups\fbm_counter-YYYYMMDD.dump
```

See `docs/backup-restore-drill.md` for pass criteria and RPO/RTO placeholders.

**Restore (destructive — empty/replace target DB only):**

```bash
# Example: restore custom-format dump into a STOPPED or empty database
docker exec -i fbm-postgres pg_restore -U fbm -d fbm_counter --clean --if-exists < ./backups/fbm_counter-YYYYMMDD.dump
```

After restore:

```bash
pnpm db:generate
pnpm --filter @fbm/api exec prisma migrate deploy
```

Do **not** run `db:seed` against production unless `ALLOW_SEED=true` is intentional.

### Managed Postgres (production)

Prefer provider automated backups + PITR (e.g. daily snapshots + WAL).

Document for your host:

1. Backup schedule and retention in the provider console
2. How to create a clone/restore into a staging instance
3. Who is on-call for restore

## Object / document storage

### Local disk (`STORAGE_DRIVER=local`)

- Files live under `UPLOAD_DIR` (default `uploads`, relative to API process cwd).
- Include this directory in filesystem or volume backups alongside Postgres.
- Example (compose volume or host path): back up the mounted uploads path nightly.

```bash
# Example host backup of uploads directory
tar -czf ./backups/uploads-$(date +%Y%m%d).tar.gz -C /path/to/UPLOAD_DIR .
```

### S3 / MinIO (`STORAGE_DRIVER=s3`)

- Enable **versioning** and **lifecycle rules** on the bucket when possible.
- Use IAM roles in AWS; never bake access keys into images.
- MinIO in `docker compose --profile storage` is **localhost-bound for dev only** —
  do not expose default credentials to the internet.
- Cross-region / second-bucket replication is recommended for production objects.

Backup approach:

1. Provider native bucket replication, **or**
2. Periodic `aws s3 sync s3://SOURCE s3://BACKUP` / MinIO `mc mirror`

## Retention

- Keep database dumps offline (encrypted at rest) for the retention window.
- Soft-deleted rows (`deletedAt`) remain in Postgres until an explicit purge —
  backups must retain them for audit/recovery.
- Document blobs may remain after soft-delete until a purge job exists; back up
  the full storage tree/bucket, not only “active” keys.

## Backup verification

At least monthly:

1. Restore the latest dump into an isolated staging database
2. Run `prisma migrate deploy` (should be a no-op if dump is current)
3. Start API against staging `DATABASE_URL`
4. Hit `GET /api/health`
5. Spot-check: login (staging admin), open one project, one invoice, one document download
6. Record date, dump name, and who performed the drill

## Restore drill checklist

- [ ] Confirm RPO/RTO targets with stakeholders
- [ ] Identify latest verified backup (DB + storage)
- [ ] Provision isolated restore environment (not production)
- [ ] Restore Postgres dump
- [ ] Restore uploads / S3 objects to match the dump timestamp
- [ ] Apply migrations if needed
- [ ] Verify health + sample business flows
- [ ] Document issues and time-to-ready (actual RTO)
- [ ] Only then plan production cutover if this was a disaster recovery

## Secrets

- Passwords and API keys belong in a secret manager or encrypted env files.
- Backup scripts must read `DATABASE_URL` / S3 credentials from the environment —
  never hard-code them in the repository.
