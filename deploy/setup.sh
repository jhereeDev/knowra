#!/usr/bin/env bash
# Knowra VPS one-time bootstrap. Run this once on a fresh Ubuntu 22.04/24.04
# server as a user with sudo. After it finishes, edit /opt/knowra/.env with
# your secrets, then run `deploy.sh` to build + start the app.
#
#   curl -fsSL https://raw.githubusercontent.com/<your-org>/knowra/main/deploy/setup.sh | bash
# or after cloning manually:
#   sudo bash /opt/knowra/deploy/setup.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/<your-org>/knowra.git}"
DEPLOY_USER="${DEPLOY_USER:-knowra}"
APP_DIR="/opt/knowra"
LOG_DIR="/var/log/knowra"
PNPM_VERSION="10.11.0"
NODE_MAJOR="20"

if [[ $EUID -ne 0 ]]; then
	echo "Re-running with sudo…"
	exec sudo -E bash "$0" "$@"
fi

echo "==> Updating apt index"
apt-get update -y

echo "==> Installing base packages (git, curl, build deps, Caddy prereqs)"
apt-get install -y --no-install-recommends \
	git curl ca-certificates gnupg \
	build-essential \
	debian-keyring debian-archive-keyring apt-transport-https

echo "==> Installing Node.js ${NODE_MAJOR}.x via NodeSource"
if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
	curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
	apt-get install -y nodejs
fi
node -v

echo "==> Enabling corepack + activating pnpm ${PNPM_VERSION}"
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
pnpm -v

echo "==> Installing Caddy (auto-TLS reverse proxy)"
if ! command -v caddy >/dev/null; then
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		| tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
	apt-get update -y
	apt-get install -y caddy
fi
caddy version

echo "==> Creating deploy user + directories"
id -u "${DEPLOY_USER}" >/dev/null 2>&1 || useradd -m -s /bin/bash "${DEPLOY_USER}"
mkdir -p "${APP_DIR}" "${LOG_DIR}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}" "${LOG_DIR}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
	echo "==> Cloning repo to ${APP_DIR}"
	sudo -u "${DEPLOY_USER}" git clone "${REPO_URL}" "${APP_DIR}"
else
	echo "==> ${APP_DIR} already a git checkout — skipping clone"
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
	echo "==> Seeding ${APP_DIR}/.env from template"
	cp "${APP_DIR}/deploy/env.example" "${APP_DIR}/.env"
	chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/.env"
	chmod 600 "${APP_DIR}/.env"
fi

echo "==> Installing Caddyfile"
cp "${APP_DIR}/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Installing systemd unit"
cp "${APP_DIR}/deploy/knowra-web.service" /etc/systemd/system/knowra-web.service
systemctl daemon-reload

# Allow the deploy user to restart the service without a password —
# `deploy.sh` runs as the knowra user and needs this for a hands-off deploy.
SUDOERS_FILE="/etc/sudoers.d/knowra-web-deploy"
cat > "${SUDOERS_FILE}" <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/systemctl restart knowra-web, /bin/systemctl status knowra-web
EOF
chmod 0440 "${SUDOERS_FILE}"

cat <<EOM

✓ Bootstrap complete.

Next steps:
  1. Edit /opt/knowra/.env (DATABASE_URL, ANTHROPIC_API_KEY, CF_IMAGES_*, …)
       sudo -u ${DEPLOY_USER} nano ${APP_DIR}/.env

  2. Build + start the app for the first time:
       sudo -u ${DEPLOY_USER} bash ${APP_DIR}/deploy/deploy.sh
       sudo systemctl enable --now knowra-web

  3. Point DNS:
       knowra.space    A     <this VPS IP>
       www.knowra.space A     <this VPS IP>

  4. Verify (after DNS propagates, ~5 min):
       curl https://knowra.space/api/health
       → should return {"ok":true,"service":"knowra-web",...}

Logs:
  journalctl -u knowra-web -f
  sudo tail -f /var/log/caddy/knowra-access.log

EOM
