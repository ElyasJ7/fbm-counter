# Google Cloud free-tier deployment — FBM Counter

Use this when **Oracle Always Free** has no capacity. Same app stack as Oracle:

GitHub → GHCR → Docker Compose → Caddy → HTTPS

Full compose/scripts: see `docs/oracle-cloud-deployment.md` and `deploy/*`.

---

## Honest limits (read first)

Google Cloud **Always Free** includes one **`e2-micro`** VM (in eligible regions).

| Resource | Typical free `e2-micro` |
|----------|-------------------------|
| vCPU | Shared / burstable |
| RAM | **~1 GB** |
| Disk | 30 GB standard persistent disk (free allowance) |
| Egress | Limited free egress per month |

FBM runs **Postgres + API + web + Caddy**. On 1 GB RAM this is **tight**:

- Expect slower first boots and occasional OOM if you skip swap
- Fine for **personal / pilot / demo**, not heavy multi-user production
- Prefer a small paid VPS later if it feels unstable

You **must** add a **swap file** (steps below).

---

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create / select a project
3. Enable billing (required for Compute even when you stay in free tier — watch quotas)
4. Enable **Compute Engine API**

---

## 2. Create the free `e2-micro` VM

1. **Compute Engine → VM instances → Create instance**
2. Settings:

| Field | Value |
|-------|--------|
| Name | `fbm` |
| Region | Free-tier eligible (often `us-west1`, `us-central1`, or `us-east1` — check current GCP free-tier docs) |
| Zone | any in that region |
| Machine type | **`e2-micro`** |
| Boot disk | **Ubuntu 22.04 LTS** or **24.04 LTS**, **30 GB** Balanced / Standard PD |
| Firewall | Allow **HTTP** and **HTTPS** (check both boxes) |

3. Under **Networking**, note the **External IP** (or reserve a static IP later)
4. **SSH keys**: add your public key (or use browser SSH once, then add a key)

Create the instance.

---

## 3. Firewall (VPC)

Default “Allow HTTP/HTTPS” usually opens 80/443. Confirm:

**VPC network → Firewall** allows:

| Port | Target |
|------|--------|
| 22 | Your IP preferred |
| 80 | `0.0.0.0/0` |
| 443 | `0.0.0.0/0` |

Do **not** open 5432 / 3001 / 8080.

---

## 4. DNS

```
fbm.example.com   A   →   <VM external IP>
```

Wait for DNS before expecting a Let’s Encrypt certificate.

---

## 5. SSH and base packages

```bash
ssh YOUR_USER@VM_EXTERNAL_IP

sudo apt update
sudo apt install -y ca-certificates curl git ufw
```

### Critical: add swap (1 GB VM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### Docker

```bash
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
# log out and back in
```

### Firewall (host)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 6. Install FBM under `/opt/fbm`

```bash
sudo mkdir -p /opt/fbm/{data/postgres,uploads,backups,caddy/data,caddy/config,repo}
sudo chown -R "$USER:$USER" /opt/fbm
cd /opt/fbm

git clone https://github.com/ElyasJ7/fbm-counter.git repo
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

```bash
nano .env
```

Set at least:

```env
FBM_DOMAIN=fbm.example.com
CORS_ORIGIN=https://fbm.example.com
POSTGRES_PASSWORD=<strong-password>
JWT_ACCESS_SECRET=<random-32+-chars>
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
TRUST_PROXY=true
ALLOW_SEED=false
FX_PROVIDER=exchangerate-api
FX_API_KEY=<your-key>
FBM_API_IMAGE=ghcr.io/elyasj7/fbm-api:latest
FBM_WEB_IMAGE=ghcr.io/elyasj7/fbm-web:latest
```

Owner name in GHCR must be **lowercase**. Prefer a specific SHA tag from GitHub Actions **Release images** when available.

---

## 7. Login to GHCR and deploy

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

cd /opt/fbm
./deploy.sh
```

First admin:

```bash
ADMIN_EMAIL='you@company.example' ./create-admin.sh
```

Verify:

```bash
curl -fsS https://fbm.example.com/api/health
curl -fsS https://fbm.example.com/api/health/ready
```

Browser: open `https://fbm.example.com` and log in.

---

## 8. Memory tips for e2-micro

If containers die or the VM freezes:

```bash
docker stats
free -h
sudo dmesg | grep -i 'out of memory'
```

Mitigations:

1. Confirm **2G swap** is on  
2. Deploy **one** stack only (don’t also run staging on the same micro)  
3. After pull, prune: `docker image prune -af`  
4. Limit Postgres a bit in `.env` / compose later if needed  
5. If still unstable → move to a small paid VPS (Hetzner ~€4–5)

---

## 9. Backups

```bash
crontab -e
# Daily 02:15 UTC
15 2 * * * /opt/fbm/backup-daily.sh >> /opt/fbm/backups/backup.log 2>&1
```

Copy dumps off the VM periodically (Drive / another machine). Same-disk backup is not disaster recovery.

---

## 10. Auto-deploy from GitHub (optional)

Same secrets as Oracle guide:

| Secret | Purpose |
|--------|---------|
| `DEPLOY_HOST` | VM external IP or hostname |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | private key |
| `GHCR_TOKEN` | PAT with `read:packages` |
| `GHCR_USERNAME` | GitHub username |

See `docs/oracle-cloud-deployment.md` §7.

---

## 11. Troubleshooting

| Problem | What to try |
|---------|-------------|
| Can’t create e2-micro | Wrong region; try another free-tier region |
| OOM / containers restart | Add/check swap; prune images; reduce load |
| TLS fails | DNS A record, ports 80/443 open in GCP + UFW |
| GHCR pull denied | `docker login`; package visibility; PAT scope |
| Very slow | Normal on shared micro — consider paid VPS |

---

## Checklist

- [ ] GCP project + Compute API  
- [ ] `e2-micro` Ubuntu + HTTP/HTTPS firewall  
- [ ] DNS A record  
- [ ] 2G swap  
- [ ] Docker installed  
- [ ] `/opt/fbm/.env` filled (no secrets in Git)  
- [ ] GHCR login + `./deploy.sh`  
- [ ] Admin created  
- [ ] HTTPS login works  
- [ ] Daily backup cron  

When this works, you have a free public HTTPS pilot. For real company traffic, plan a small paid upgrade.
