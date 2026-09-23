# Oracle Cloud Free deployment — FBM Counter

Production-oriented deploy for an Always Free (or paid) Oracle Cloud VM using
GitHub → GHCR → Docker Compose → Caddy (HTTPS).

**Do not** store secrets in Git. Runtime secrets live only on the VM in `/opt/fbm/.env`.

Related files:

| Path | Purpose |
|------|---------|
| `deploy/production.compose.yml` | postgres + api + web + caddy |
| `deploy/Caddyfile` | same-origin HTTPS (`/api` → API, else → web) |
| `deploy/production.env.example` | env template |
| `deploy/deploy.sh` | pull → backup → migrate → up → health |
| `deploy/backup-daily.sh` | Postgres + uploads backup |
| `deploy/create-admin.sh` | first admin (no demo seed) |
| `.github/workflows/ci.yml` | quality + docker build check |
| `.github/workflows/release.yml` | multi-arch GHCR publish + optional SSH deploy |

---

## Architecture

```
Browser (HTTPS)
  → Caddy :443 (Let's Encrypt)
       ├─ /api*  → fbm-api:3001
       └─ /*     → fbm-web:8080 (nginx SPA)
            → PostgreSQL (internal Docker network only)
            → /opt/fbm/uploads (local documents)
```

Public URL shape (preferred):

- App: `https://fbm.example.com`
- API: `https://fbm.example.com/api`
- Web build uses `VITE_API_URL=/api` (same-origin cookies)

---

## 1. Create Oracle Cloud VM

1. Oracle Cloud Console → **Compute → Instances → Create**.
2. Prefer **VM.Standard.A1.Flex** (Ampere **ARM64**) Always Free shape if capacity allows.
   - Fallback: `VM.Standard.E2.1.Micro` (x86) if ARM capacity is unavailable.
3. Image: **Canonical Ubuntu 22.04** or **24.04** (minimal).
4. Networking: assign a **public IPv4**.
5. SSH: upload your **public** key; disable password auth later.
6. VCN Security List / NSG ingress:

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP /32 (preferred) | SSH |
| 80 | 0.0.0.0/0 | HTTP (ACME + redirect) |
| 443 | 0.0.0.0/0 | HTTPS |

**Do not** open 5432, 3001, or 8080 publicly.

---

## 2. DNS

Create an **A** record:

```
fbm.example.com  →  <VM public IP>
```

Wait for propagation before expecting Caddy certificates.

---

## 3. VM bootstrap (Ubuntu)

SSH as `ubuntu` (or your user):

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw

# Docker Engine + Compose plugin (official)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker "$USER"
# re-login for docker group

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

Optional SSH hardening: keys only, `PasswordAuthentication no`, `PermitRootLogin no`.

---

## 4. Directory layout

```bash
sudo mkdir -p /opt/fbm/{data/postgres,uploads,backups,caddy/data,caddy/config,repo}
sudo chown -R "$USER:$USER" /opt/fbm
cd /opt/fbm

git clone https://github.com/<owner>/fbm-counter.git repo
cp repo/deploy/production.compose.yml ./production.compose.yml
cp repo/deploy/Caddyfile ./Caddyfile
cp repo/deploy/deploy.sh ./deploy.sh
cp repo/deploy/backup-daily.sh ./backup-daily.sh
cp repo/deploy/create-admin.sh ./create-admin.sh
cp repo/deploy/create-admin.cjs ./create-admin.cjs
cp repo/deploy/production.env.example ./.env
chmod +x deploy.sh backup-daily.sh create-admin.sh
```

Edit `.env`:

- `FBM_DOMAIN=fbm.example.com`
- `CORS_ORIGIN=https://fbm.example.com`
- Strong `POSTGRES_PASSWORD` and `JWT_ACCESS_SECRET` (≥32 chars, not `change-me`)
- `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=true`
- `ALLOW_SEED=false`
- `FBM_API_IMAGE` / `FBM_WEB_IMAGE` (set after first GHCR publish)
- `FX_PROVIDER=none` or configure a live provider + `FX_API_KEY`

Company defaults (AFN / Asia/Kabul) are applied **only** when creating first company settings via `create-admin.sh`. Existing settings are never overwritten.

---

## 5. GHCR login on the VM

Create a GitHub PAT (classic) with `read:packages` (and `write:packages` only if needed elsewhere), or use a fine-grained token that can read packages.

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Images:

```
ghcr.io/<owner-lowercase>/fbm-api:<sha12>
ghcr.io/<owner-lowercase>/fbm-web:<sha12>
```

Also tagged `:latest` on main releases.

**ARM note:** Release workflow builds `linux/amd64` and `linux/arm64` via Buildx — Ampere VMs pull arm64 automatically.

---

## 6. First deploy

```bash
cd /opt/fbm
# Set image tags in .env to a published SHA, then:
./deploy.sh
```

`deploy.sh` will:

1. `docker compose config`
2. pull images
3. start postgres
4. pre-deploy DB (+ uploads) backup when DB already has data
5. `prisma migrate deploy` (never `migrate dev`)
6. `compose up -d`
7. wait for `/api/health/ready`

Create admin (once):

```bash
ADMIN_EMAIL='you@company.example' ./create-admin.sh
# password printed once if ADMIN_PASSWORD unset — change after first login
```

Verify:

```bash
curl -fsS https://fbm.example.com/api/health
curl -fsS https://fbm.example.com/api/health/ready
# Browser: login, session persists (Secure cookie over HTTPS)
```

---

## 7. GitHub Actions

### CI (`ci.yml`)

On every push/PR: install, migrate, lint, tests, build, Docker image build (amd64 smoke).

### Release (`release.yml`)

After **CI succeeds** on `main` (workflow_run), or via **workflow_dispatch**:

1. Buildx multi-arch push to GHCR
2. Optional SSH deploy if repository **Environment `production`** secrets are set:

| Secret | Purpose |
|--------|---------|
| `DEPLOY_HOST` | VM public IP or hostname |
| `DEPLOY_USER` | SSH user (e.g. `ubuntu`) |
| `DEPLOY_SSH_KEY` | private key |
| `GHCR_TOKEN` | PAT with `read:packages` for the VM |
| `GHCR_USERNAME` | GitHub username (optional; defaults to actor) |

Runtime DB/JWT/FX secrets stay on the VM — not in Actions.

If `DEPLOY_HOST` is empty, publish still runs; deploy is skipped.

---

## 8. Backups

Install daily cron (as deploy user):

```bash
crontab -e
# Daily 02:15 UTC
15 2 * * * /opt/fbm/backup-daily.sh >> /opt/fbm/backups/backup.log 2>&1
```

Keeps ~7 daily dumps + weekly Sunday copies. Backs up:

- PostgreSQL custom-format dump
- `uploads/` tarball (documents)

**Off-box copies** are strongly recommended for real business data (rsync/scp/Object Storage). Same-VM backups alone are not disaster recovery.

Restore drill: use `scripts/restore-postgres-drill.sh` against an **isolated** DB — never restore over live production for verification. See `docs/ops-backups.md`.

---

## 9. Logging & disk

Compose sets Docker `json-file` rotation (`10m` × 5).

```bash
docker compose -f production.compose.yml --env-file .env logs -f api
df -h
docker system df
du -sh /opt/fbm/{data,uploads,backups,caddy}
```

Host timezone may stay **UTC**. Business timezone `Asia/Kabul` is an application setting (date-only rules unchanged).

---

## 10. FX provider

Reuse existing system (`FX_PROVIDER`, `FX_API_KEY`). Cron refresh every 4h when configured. If provider is `none` or down, cached/manual rates remain; converter shows unavailable when no rate exists — never invents numbers.

---

## 11. Production smoke (after HTTPS)

- Login / logout / session persists
- Dashboard, projects, invoices, payments, expenses, documents, reports
- Currency converter USD↔AFN
- PM denied on unassigned project (H3)
- Optional: run a trimmed smoke against `https://fbm.example.com/api`

Afghanistan connectivity: from a real Afghan network, time login, dashboard, document download, PDF report, converter.

---

## 12. Rollback

Images are immutable by SHA:

```bash
# In /opt/fbm/.env point to previous short SHA, then:
./deploy.sh
```

Do **not** auto-rollback Prisma migrations. Prefer forward fixes; restore DB only from pre-deploy backup with an approved window.

---

## 13. Troubleshooting

| Symptom | Check |
|---------|--------|
| Oracle free capacity unavailable | Retry later / other AD / x86 micro shape |
| TLS failure | DNS A record, ports 80/443 open, `FBM_DOMAIN` exact match |
| Cookie not sticking | Must be HTTPS; `COOKIE_SECURE=true`; same-origin `/api` |
| GHCR pull denied | `docker login ghcr.io`; package visibility; PAT scope |
| exec format error | Wrong arch image — ensure multi-arch release built |
| DB connect fail | compose network; password URL-safe; postgres healthy |
| Disk full | `df -h`, prune images, trim backups |
| FX unavailable | Provider key, outbound HTTPS from VM, Settings → rates |

---

## 14. Manual steps still required (human)

1. Create Oracle account + Always Free VM  
2. Point DNS A record  
3. Fill `/opt/fbm/.env` secrets  
4. Add GitHub Environment `production` secrets for auto-deploy (optional)  
5. Create first admin  
6. Configure company Settings (AFN / Asia/Kabul) if not created by bootstrap  
7. Decide FX provider  
8. Schedule off-server backups  
9. Sign off `docs/release-checklist.md`  

This repository prepares automation and docs; it cannot create your Oracle VM or DNS for you.
