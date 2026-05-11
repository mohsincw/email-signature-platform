#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# disable-relay-rule.sh
#
# Disables the Exchange Online transport rule that routes outbound
# mail through this droplet. Used by the auto-disable trigger when
# the SMTP probe detects sustained failure, OR runnable manually by
# an operator.
#
# Once disabled, mail bypasses the droplet entirely and Exchange
# delivers direct (no signature, but mail flows). Re-enable with
# enable-relay-rule.sh after the underlying issue is fixed.
#
# State file at /var/lib/mail-monitor/auto-disabled records when an
# auto-disable happened; the probe checks this to avoid repeated
# disable attempts on subsequent failures, and the enable script
# clears it.
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

ENV_FILE="${ENV_FILE:-/root/email-signature-platform/apps/mail-processor/.env}"
STATE_DIR="${STATE_DIR:-/var/lib/mail-monitor}"
LOG="${MONITOR_LOG:-/var/log/mail-monitor.log}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

mkdir -p "$STATE_DIR"

log() {
  echo "$(date -Is) [disable-rule] $1" >> "$LOG"
  echo "$1"
}

if ! command -v pwsh > /dev/null 2>&1; then
  log "ERROR: pwsh not installed (apt install -y powershell)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log "Calling Exchange to disable rule: ${EXCHANGE_RULE_NAME:-Chaiiwala Signature Relay}"

if pwsh -NoProfile -File "$SCRIPT_DIR/exchange-rule-control.ps1" -Action Disable >> "$LOG" 2>&1; then
  date -Is > "$STATE_DIR/auto-disabled"
  log "OK: rule disabled. Re-enable with enable-relay-rule.sh after fixing the underlying issue."

  # Push a /fail ping with a descriptive body so the Healthchecks
  # alert email tells the operator exactly what happened and how to
  # recover.
  if [ -n "${HEARTBEAT_URL:-}" ]; then
    body="Mail relay transport rule auto-disabled at $(date -Is) after sustained probe failure. Mail is now flowing direct (no signatures) until you re-enable. To re-enable after fixing the issue: ssh root@$(hostname) && /root/email-signature-platform/apps/mail-processor/scripts/enable-relay-rule.sh"
    curl -sf -m 10 --data-raw "$body" "${HEARTBEAT_URL}/fail" > /dev/null \
      && log "Notification ping sent to Healthchecks /fail" \
      || log "WARN: notification ping to Healthchecks failed"
  fi
  exit 0
else
  log "ERROR: pwsh disable command failed (see lines above for detail)"
  exit 1
fi
