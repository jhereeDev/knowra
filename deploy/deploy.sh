#!/usr/bin/env bash
# Build + restart the Knowra web app on the VPS. Run as the `knowra` user
# from anywhere on the box:
#
#   sudo -u knowra bash /opt/knowra/deploy/deploy.sh
#
# Or from your laptop, push-to-deploy style:
#   ssh user@vps "sudo -u knowra bash /opt/knowra/deploy/deploy.sh"

set -euo pipefail

APP_DIR="/opt/knowra"
WEB_DIR="${APP_DIR}/apps/web"

cd "${APP_DIR}"

echo "==> Pulling latest from main"
git fetch --quiet origin main
git reset --hard origin/main

echo "==> Installing deps (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Building apps/web"
pnpm --filter @knowra/web build

# `db:generate` is idempotent (no-op if schema matches migrations on disk).
# `db:migrate` applies any pending SQL migration files to the live DB.
# If you only changed app code without touching the schema, both are quick.
echo "==> Applying any pending DB migrations"
pnpm --filter @knowra/db db:migrate || {
	echo "  ! db:migrate failed — likely DATABASE_URL not exported in this shell"
	echo "  ! systemd loads it from /opt/knowra/.env; for manual runs:"
	echo "    set -a && source ${APP_DIR}/.env && set +a && pnpm --filter @knowra/db db:migrate"
}

echo "==> Restarting knowra-web"
sudo /bin/systemctl restart knowra-web
sleep 1
sudo /bin/systemctl status knowra-web --no-pager --lines=5

echo ""
echo "✓ Deployed. Verify:"
echo "   curl -sS https://knowra.space/api/health | head"
