#!/usr/bin/env bash
# Build + restart the Knowra web app on the VPS. Run as root:
#
#   sudo bash /opt/knowra/deploy/deploy.sh
#
# Or from your laptop, push-to-deploy style:
#   ssh user@vps "sudo bash /opt/knowra/deploy/deploy.sh"
#
# Script structure: re-execs itself with sudo if not root, then runs all
# git/pnpm/build operations as the `knowra` user (so file ownership stays
# correct) and the systemctl calls as root (no sudoers magic needed).

set -euo pipefail

APP_DIR="/opt/knowra"
ENV_FILE="${APP_DIR}/.env"
DEPLOY_USER="knowra"

# Re-exec with sudo if not root. -E keeps the caller's env in case
# they've already sourced something useful.
if [[ $EUID -ne 0 ]]; then
	exec sudo -E bash "$0" "$@"
fi

cd "${APP_DIR}"

# Self-heal ownership in case anyone touched files as root (manual edits,
# moves, etc.). Cheap operation; only chown's files where it's needed.
if [[ "$(stat -c '%U' "${APP_DIR}")" != "${DEPLOY_USER}" ]]; then
	echo "==> Repairing ownership to ${DEPLOY_USER}"
	chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
fi

echo "==> Pulling latest from main"
sudo -u "${DEPLOY_USER}" git fetch --quiet origin main
sudo -u "${DEPLOY_USER}" git reset --hard origin/main

echo "==> Installing deps (frozen lockfile)"
sudo -u "${DEPLOY_USER}" pnpm install --frozen-lockfile

echo "==> Building apps/web"
sudo -u "${DEPLOY_USER}" pnpm --filter @knowra/web build

# Load /opt/knowra/.env into this shell so db:migrate can see
# DATABASE_URL. The env file is mode 0600 owned by `knowra`; we read it
# as root which can access anything.
if [[ -f "${ENV_FILE}" ]]; then
	set -a
	# shellcheck disable=SC1090
	source "${ENV_FILE}"
	set +a
else
	echo "  ! ${ENV_FILE} not found — migrations will fail without DATABASE_URL"
fi

echo "==> Applying any pending DB migrations"
# Pass DATABASE_URL explicitly to the deploy user's shell (sudo strips
# most env vars by default; -E preserves them but we want to be explicit
# about secrets). If migrations fail, the deploy still completes — the
# app might just be ahead of the schema.
sudo -u "${DEPLOY_USER}" \
	DATABASE_URL="${DATABASE_URL:-}" \
	pnpm --filter @knowra/db db:migrate || {
	echo "  ! db:migrate failed — see output above. Service will still restart."
}

echo "==> Restarting knowra-web"
systemctl restart knowra-web
sleep 1
systemctl status knowra-web --no-pager --lines=5

echo ""
echo "✓ Deployed. Verify:"
echo "   curl -sS http://localhost:${PORT:-3001}/api/health"
echo "   curl -sS https://knowra.space/api/health"
