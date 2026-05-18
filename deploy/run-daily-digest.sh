#!/usr/bin/env bash
# Fire the daily-digest fan-out endpoint. Invoked by
# knowra-digest-cron.service (a systemd oneshot triggered by
# knowra-digest-cron.timer). Lives in /opt/knowra/deploy/ on the VPS and
# is also useful for ad-hoc manual runs:
#
#   sudo systemctl start knowra-digest-cron.service
# or, with the env loaded already:
#   sudo -u knowra bash /opt/knowra/deploy/run-daily-digest.sh
#
# Loads CRON_SECRET + PORT from the systemd EnvironmentFile (or your
# shell, when run by hand). Exits non-zero on HTTP failure so the
# systemd unit logs a clear failure in `journalctl`.

set -euo pipefail

: "${CRON_SECRET:?CRON_SECRET must be set in /opt/knowra/.env}"
: "${PORT:=3033}"

# `curl --fail` flips a non-2xx response into a non-zero exit. -m caps the
# total request at 90s — long enough for a 1000-device fan-out, short
# enough that a hung Anthropic call doesn't pin the systemd unit.
curl \
	--fail \
	--silent \
	--show-error \
	--max-time 90 \
	--header "Authorization: Bearer ${CRON_SECRET}" \
	"http://127.0.0.1:${PORT}/api/cron/daily-digest"

# Newline so consecutive run logs don't get jammed together in the
# journal output.
printf '\n'
