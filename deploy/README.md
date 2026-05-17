# Deploy — knowra.space backend

The Next.js app at `apps/web` serves both the marketing site (`/`, `/about`) and the API (`/api/*`) the mobile app talks to. This directory contains the infra to run it on a single Ubuntu VPS behind Caddy.

## Stack

| Piece | What |
|---|---|
| Reverse proxy + TLS | **Caddy** (auto Let's Encrypt) |
| Process manager | **systemd** unit `knowra-web.service` |
| Runtime | **Node 20** + **pnpm 10.11** (installed via NodeSource + corepack) |
| App | `pnpm --filter @knowra/web build && pnpm --filter @knowra/web start` |
| Repo location | `/opt/knowra` (owned by user `knowra`) |
| Env file | `/opt/knowra/.env` (0600, owned by `knowra`) |
| Logs | `/var/log/knowra/web.log` + `journalctl -u knowra-web` |

## Prerequisites

1. **Ubuntu 22.04 or 24.04 VPS** with sudo access. **2 GB RAM minimum** — Next.js build will OOM on 1 GB. If you're on 1 GB, add 2 GB of swap first.
2. **DNS** for `knowra.space` and `www.knowra.space` pointing at the VPS's public IPv4. Wait 5 min for propagation before Caddy fetches certs.
3. **Ports 80 + 443 open** on the VPS firewall (UFW or cloud security group). Caddy needs both for the ACME HTTP-01 / TLS-ALPN challenges.
4. **Git repo URL** accessible from the VPS. If private, set up an SSH deploy key for the `knowra` user.

## One-time setup

On the VPS, as a user with sudo:

```bash
# 1. Pull the setup script (or upload from your laptop, or clone repo first then run from deploy/)
sudo apt-get install -y git
sudo git clone https://github.com/<your-org>/knowra.git /opt/knowra
sudo bash /opt/knowra/deploy/setup.sh
```

`setup.sh` is idempotent — re-running it just refreshes whatever's out of date.

After it finishes, **edit the env file**:

```bash
sudo -u knowra nano /opt/knowra/.env
```

Paste your real `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CF_IMAGES_*` (if using), `WIKIPEDIA_USER_AGENT`. Save.

Then build + start for the first time:

```bash
sudo -u knowra bash /opt/knowra/deploy/deploy.sh
sudo systemctl enable --now knowra-web
```

`deploy.sh` will:
1. `git pull` latest
2. `pnpm install --frozen-lockfile`
3. `pnpm --filter @knowra/web build`
4. Run any pending Drizzle migrations
5. Restart the systemd service

## Verify

```bash
# On the VPS:
curl http://localhost:3000/api/health
# → {"ok":true,"service":"knowra-web","version":"0.0.1","timestamp":"..."}

# From your laptop (once DNS has propagated and Caddy has the cert):
curl https://knowra.space/api/health
```

If the second one fails:
- `dig knowra.space` — does it return your VPS IP?
- `sudo systemctl status caddy` — running?
- `sudo journalctl -u caddy -n 50` — any cert-fetch errors?
- `sudo ufw status` — ports 80 and 443 open?

## Re-deploying (every code change)

```bash
ssh user@vps "sudo -u knowra bash /opt/knowra/deploy/deploy.sh"
```

That's it. ~30 sec on a fast VPS, mostly the Next.js build.

For push-to-deploy on commit to `main`, see the GitHub Actions section below.

## Updating env vars

```bash
sudo -u knowra nano /opt/knowra/.env
sudo systemctl restart knowra-web
```

The systemd service only reads `.env` on start. Restart picks up changes.

## Useful commands

| What | Command |
|---|---|
| Tail app logs | `sudo journalctl -u knowra-web -f` |
| App log file | `sudo tail -f /var/log/knowra/web.log` |
| Caddy access log | `sudo tail -f /var/log/caddy/knowra-access.log` |
| Reload Caddy after Caddyfile change | `sudo systemctl reload caddy` |
| Restart app only | `sudo systemctl restart knowra-web` |
| Stop everything | `sudo systemctl stop knowra-web caddy` |

## Memory / sizing

The Next.js build needs ~1–1.5 GB peak. The runtime Node process sits at ~150–300 MB. For a hobby VPS, **2 GB RAM** is the floor; **4 GB** is comfortable.

The DB (Neon) is hosted, so no DB load on the VPS. Same for Anthropic + Cloudflare Images.

## Future: push-to-deploy via GitHub Actions

When you're ready, add `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}
      - run: |
          ssh -o StrictHostKeyChecking=no \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} \
            "sudo -u knowra bash /opt/knowra/deploy/deploy.sh"
```

Add `VPS_SSH_KEY`, `VPS_USER`, `VPS_HOST` to repo secrets. Done.

## Files in this directory

| File | What |
|---|---|
| `setup.sh` | One-time VPS bootstrap |
| `deploy.sh` | Every-deploy script (pull → build → migrate → restart) |
| `Caddyfile` | Caddy reverse-proxy + TLS config |
| `knowra-web.service` | systemd unit |
| `env.example` | Template for `/opt/knowra/.env` |
| `README.md` | This file |
