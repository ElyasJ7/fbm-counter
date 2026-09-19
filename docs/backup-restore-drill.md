# Backup restore drill checklist

**Rule:** Never restore over the active development or production database.

## Placeholders (fill for your org)

| Item | Value |
|------|-------|
| Backup frequency | e.g. daily 02:00 |
| Retention | e.g. 30 daily + 12 monthly |
| RPO | e.g. 24h |
| RTO | e.g. 4h |
| Responsible operator | name / role |

## Drill steps

1. Create dump: `./scripts/backup-postgres.sh` (or provider snapshot).
2. Restore into isolated DB: `./scripts/restore-postgres-drill.sh ./backups/<file>.dump`
3. Verify `\dt` and row counts for users, projects, invoices, payments, documents.
4. Spot-check FK integrity (sample invoice → project/customer; payment → invoice).
5. If using local uploads: restore uploads tarball to a temp dir and confirm `storageKey` files exist.
6. If using S3: validate object listing for a sample of `documents.storageKey` values (read-only).
7. Record date, operator, dump filename, and pass/fail in the ops log.

## Pass criteria

- Restore completes without fatal errors
- Core tables present
- Counts match source within expected delta (or explained)
- No production URL/credentials used for the drill target
