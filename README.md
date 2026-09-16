# FBM Counter

Finance & Building Management web application for construction companies (Germany-first).

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query
- **API:** NestJS, TypeScript, Prisma, PostgreSQL
- **Auth:** HTTP-only cookies, JWT access + rotating refresh tokens, Argon2, RBAC

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

## Phase status

**Phase 1 (foundation) — complete**

**Phase 2 (projects) — complete**

**Phase 3 (finance) — complete**

**Phase 4 (dashboard) — complete**

**Phase 5 (partners) — complete**

Full suppliers (with financial totals) and subcontractors (trades, project assignments).

**Next: Phase 6** — document uploads, storage, permissions.
