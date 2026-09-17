# FBM Counter

Finance & Building Management web application for construction companies (Germany-first).

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **API:** NestJS, TypeScript, Prisma, PostgreSQL
- **Auth:** HTTP-only cookies, JWT access + rotating refresh tokens, Argon2, RBAC
- **Documents:** Local disk or S3-compatible object storage (MinIO / AWS S3)

## Quick start

```bash
# 1) Install
pnpm install

# 2) Start database
docker compose up -d

# 3) Build shared packages
pnpm build:packages

# 4) Generate client, migrate, seed
pnpm db:generate
pnpm --filter @fbm/api exec prisma migrate deploy
pnpm db:seed

# 5) Run apps (separate terminals)
pnpm dev:api
pnpm dev:web
```

- Web: http://localhost:5173
- API health: http://localhost:3001/api/health

### Demo users (local seed)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@musterbau.example | Admin123! |
| MANAGEMENT | management@musterbau.example | Manager123! |
| ACCOUNTING | accounting@musterbau.example | Accounting123! |
| PROJECT_MANAGER | pm@musterbau.example | Project123! |
| VIEWER | viewer@musterbau.example | Viewer123! |

## Tests & quality

```bash
pnpm test
pnpm --filter @fbm/api test:e2e
```

Manual responsive / a11y smoke: [`docs/quality-checklist.md`](docs/quality-checklist.md)

CI runs on push/PR via `.github/workflows/ci.yml`.

## Deploy notes

1. Copy `.env.example` → `apps/api/.env` (and set `VITE_API_URL` for the web build).
2. Use strong unique `JWT_*_SECRET` values (≥32 chars). Prefer `NODE_ENV=production` (cookies become Secure automatically unless `COOKIE_SECURE=false`).
3. Set `CORS_ORIGIN` to the public web origin (comma-separated if needed) and `TRUST_PROXY=true` behind nginx/load balancers.
4. Run Postgres, then `prisma migrate deploy` and optionally `db:seed` (never seed production with demo passwords).
5. **Docker images:**
   - API: `docker build -f apps/api/Dockerfile -t fbm-api .`
   - Web: `docker build -f apps/web/Dockerfile -t fbm-web --build-arg VITE_API_URL=https://api.example.com/api .`
6. Or build locally: `pnpm build` → serve `apps/web/dist`; run `node apps/api/dist/main.js`.
7. Documents: `STORAGE_DRIVER=local` with a persistent volume, **or** S3/MinIO (below).
8. Health check: `GET /api/health`.
9. Backups: see [`docs/ops-backups.md`](docs/ops-backups.md) (Postgres + object storage, restore drill).
10. Seeding: development only by default. Production requires `ALLOW_SEED=true` and will **not** overwrite existing user password hashes.

### Object storage (S3 / MinIO)

```bash
# Local MinIO (optional) — bound to localhost only
docker compose --profile storage up -d
# Create bucket "fbm-documents" in the MinIO console at http://127.0.0.1:9001
```

**Do not** use default MinIO credentials on any host reachable from the internet.

```env
STORAGE_DRIVER=s3
S3_BUCKET=fbm-documents
S3_REGION=eu-central-1
S3_PREFIX=documents
S3_ENDPOINT=http://127.0.0.1:9000
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

On AWS S3, omit `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` and use IAM or access keys.

## Phase status

**Phases 1–8 + follow-ups — complete** (foundation through settings, finances, users, project tabs)

**Notifications / search / PDF / storage — complete** (product polish previously labeled phases 9–12 in README)

**Administration (users, RBAC, notifications, audit, settings) — complete**

- Global audit log at `/audit` (`GET /api/audit`, detail + filters; `audit:read`)
- Project-scoped Aktivität tab remains available

**Phase 9 (Quality) — complete**

- Tests: RBAC guard, invoice party rules, MIME sniff, storage, shared permissions, financial-core, CI
- Security: upload size/MIME hardening, refresh throttle, prod cookie Secure default, trust proxy, MinIO localhost bind
- Performance: lighter invoice list queries, composite DB indexes
- Accessibility: skip link, Escape on panels, contrast tweak, labeled icon controls
- Responsive: mobile search + logout in drawer; checklist in `docs/quality-checklist.md`
- Production: Dockerfiles, GitHub Actions CI, expanded `.env.example` / deploy notes
