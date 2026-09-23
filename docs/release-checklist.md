# Release checklist — FBM Counter

Mark each gate **Yes** / **No**. Do not ship with any **No** on Critical gates unless a written exception is approved.

**Release candidate SHA (local):** `14de759` (ahead of `origin/main` — not pushed)  
**Local verification date:** 2026-09-23

## Critical gates

| Gate | Yes/No |
|------|--------|
| CI green on release commit (quality + docker jobs) | **No** — commit not pushed; remote CI not run |
| All Prisma migrations applied on target DB | **Yes** (local `fbm_counter`, 12 migrations) |
| Production/staging env validation passes at API boot | **No** — staging/prod not deployed this run |
| Backup completed immediately before deploy | **No** — deploy not started |
| Restore drill passed on isolated DB within last 90 days | **Yes** — prior go-live verification (2026-09-19) |
| `ALLOW_SEED` not enabled on production | **No** — production env not configured this run |
| No demo/default passwords on admin accounts | **No** — production accounts not provisioned |
| HTTPS enabled end-to-end | **No** — local HTTP only |
| Document storage private (not public bucket) | **Yes** (local driver); **No** until S3/prod confirmed |
| Zero unresolved Critical findings | **Yes** (local lint/test/build clean after FX eslint fixes) |
| Zero unresolved High findings **or** written accepted mitigations | **Yes** — prior hardening + accepted local warnings only |
| `/api/health/ready` OK after deploy | **Yes** locally; **No** until real deploy |
| H3 authorization regression smoke passed (PM denied unassigned project + document) | **Yes** (`golive-smoke.mjs` 2026-09-23) |
| Finance regression scenario passed (cash / AR / costs / profit) | **Yes** (unit + smoke finance flow) |

## High gates

| Gate | Yes/No |
|------|--------|
| Cookie SameSite Lax/Strict; SameSite=None still blocked | **Yes** (code + prior verification) |
| Rate limits active on login | **Yes** (code + prior verification) |
| Structured logging without secrets | **Yes** (prior verification) |
| Admin-only metrics endpoint | **Yes** (smoke 2026-09-23) |
| Overdue + blob GC jobs observed once in logs | **No** — not re-confirmed this run |
| Docker images non-root | **Yes** (prior go-live image work); rebuild on new SHA |

## Local engineering gates (this punch list)

| Gate | Result |
|------|--------|
| Multi-currency + converter committed | Yes (`13bc768` + follow-ups) |
| `pnpm lint` | Pass (warnings only) |
| `pnpm test` | Pass (financial-core 55, shared 9, API 88, web build suite) |
| `pnpm --filter @fbm/api build` | Pass |
| `pnpm --filter @fbm/web build` | Pass |
| `node scripts/golive-smoke.mjs` | Pass 42/42 |

## Remaining before production go-live

1. Push release commits and confirm GitHub Actions green  
2. Deploy staging with production-like env (`docs/staging-readiness.md`)  
3. Decide FX: live provider (`FX_PROVIDER` + `FX_API_KEY`) or manual rates only  
4. Create real admin users (no seed passwords); `ALLOW_SEED=false`  
5. HTTPS + private document storage on target host  
6. Pre-deploy backup + `/api/health/ready` on staging/prod  
7. Engineering / Ops / Business sign-off below  

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Ops / hosting | | |
| Business owner | | |
