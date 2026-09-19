# Release checklist — FBM Counter

Mark each gate **Yes** / **No**. Do not ship with any **No** on Critical gates unless a written exception is approved.

## Critical gates

| Gate | Yes/No |
|------|--------|
| CI green on release commit (quality + docker jobs) | |
| All Prisma migrations applied on target DB | |
| Production/staging env validation passes at API boot | |
| Backup completed immediately before deploy | |
| Restore drill passed on isolated DB within last 90 days | |
| `ALLOW_SEED` not enabled on production | |
| No demo/default passwords on admin accounts | |
| HTTPS enabled end-to-end | |
| Document storage private (not public bucket) | |
| Zero unresolved Critical findings | |
| Zero unresolved High findings **or** written accepted mitigations | |
| `/api/health/ready` OK after deploy | |
| H3 authorization regression smoke passed (PM denied unassigned project + document) | |
| Finance regression scenario passed (cash / AR / costs / profit) | |

## High gates

| Gate | Yes/No |
|------|--------|
| Cookie SameSite Lax/Strict; SameSite=None still blocked | |
| Rate limits active on login | |
| Structured logging without secrets | |
| Admin-only metrics endpoint | |
| Overdue + blob GC jobs observed once in logs | |
| Docker images non-root | |

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Ops / hosting | | |
| Business owner | | |
