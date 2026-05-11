#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# enable-relay-rule.sh
#
# Re-enables the Exchange Online transport rule that was auto-disabled
# by the SMTP probe (or manually by an operator).
#
# Run this AFTER you've confirmed the underlying issue is fixed
# (probe shows OK, swaks test succeeds, etc.) — otherwise re-enabling
# will just queue more mail behind a still-broken relay.
#
# Clears the /var/lib/mail-monitor/auto-disabled flag so the probe
# can auto-disable again on the next sustained failure.
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
  echo "$(date -Is) [enable-rule] $1" >> "$LOG"
  echo "$1"
}

if ! command -v pwsh > /dev/null 2>&1; then
  log "ERROR: pwsh not installed (apt install -y powershell)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log "Calling Exchange to enable rule: ${EXCHANGE_RULE_NAME:-Chaiiwala Signature Relay}"

if pwsh -NoProfile -File "$SCRIPT_DIR/exchange-rule-control.ps1" -Action Enable >> "$LOG" 2>&1; then
  rm -f "$STATE_DIR/auto-disabled"
  log "OK: rule enabled. Auto-disable trigger re-armed."
  exit 0
else
  log "ERROR: pwsh enable command failed (see lines above for detail)"
  exit 1
fi
