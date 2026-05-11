#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# SMTP health probe — runs every 5 minutes via cron on the droplet.
#
# Checks three things in order:
#   1. mail-processor health endpoint responds on :8080
#   2. SMTP listener accepts a TCP connection on :25
#   3. End-to-end relay path to Microsoft works (RCPT TO returns 2xx,
#      i.e. our outbound IP is not on Microsoft's blocklist)
#
# If all three pass, pings the configured heartbeat URL. The external
# uptime monitor (UptimeRobot / Better Stack / etc.) expects a ping
# at least every N minutes; if it stops arriving, it alerts.
#
# This is intentionally a "dead man's switch" — we only ping on
# success, so a script bug or droplet outage also triggers an alert
# (rather than silently failing).
#
# Auto-disable: after AUTO_DISABLE_FAILURE_THRESHOLD consecutive
# failures, calls disable-relay-rule.sh to detach the Exchange
# transport rule so mail flows direct (no signature, but delivered)
# instead of piling up in queues. The rule must be re-enabled
# manually with enable-relay-rule.sh once the underlying issue is
# resolved.
# ─────────────────────────────────────────────────────────────────────

set -uo pipefail

LOG="/var/log/mail-monitor.log"
STATE_DIR="/var/lib/mail-monitor"
ENV_FILE="${ENV_FILE:-/root/email-signature-platform/apps/mail-processor/.env}"

mkdir -p "$STATE_DIR"

# Load env from .env if present (for HEARTBEAT_URL, SMART_HOST_HOST, etc.)
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

HEARTBEAT_URL="${HEARTBEAT_URL:-}"
SMART_HOST_HOST="${SMART_HOST_HOST:-chaiiwala-co-uk.mail.protection.outlook.com}"
SMART_HOST_PORT="${SMART_HOST_PORT:-25}"
PROBE_FROM="${PROBE_FROM:-monitor@chaiiwala.co.uk}"
PROBE_TO="${PROBE_TO:-mohsin@chaiiwala.co.uk}"
HEALTH_PORT="${HEALTH_PORT:-8080}"
AUTO_DISABLE_FAILURE_THRESHOLD="${AUTO_DISABLE_FAILURE_THRESHOLD:-3}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAIL_COUNT_FILE="$STATE_DIR/consecutive_failures"
AUTO_DISABLED_FLAG="$STATE_DIR/auto-disabled"

log() {
  echo "$(date -Is) $1" >> "$LOG"
}

read_fail_count() {
  if [ -f "$FAIL_COUNT_FILE" ]; then
    cat "$FAIL_COUNT_FILE"
  else
    echo 0
  fi
}

# On any FAIL: increment consecutive_failures, maybe trigger auto-disable,
# then exit non-zero (no heartbeat ping → external monitor alerts).
fail() {
  local reason="$1"
  log "FAIL: $reason"

  local count
  count=$(($(read_fail_count) + 1))
  echo "$count" > "$FAIL_COUNT_FILE"
  log "FAIL: consecutive failure count = $count"

  if [ "$count" -ge "$AUTO_DISABLE_FAILURE_THRESHOLD" ] && [ ! -f "$AUTO_DISABLED_FLAG" ]; then
    if [ -x "$SCRIPT_DIR/disable-relay-rule.sh" ]; then
      log "TRIGGER: $count consecutive failures hit threshold ($AUTO_DISABLE_FAILURE_THRESHOLD) — calling disable-relay-rule.sh"
      "$SCRIPT_DIR/disable-relay-rule.sh" >> "$LOG" 2>&1 || log "WARN: disable-relay-rule.sh exited non-zero"
    else
      log "WARN: would auto-disable but disable-relay-rule.sh not found or not executable"
    fi
  elif [ -f "$AUTO_DISABLED_FLAG" ]; then
    log "INFO: rule already auto-disabled (since $(cat "$AUTO_DISABLED_FLAG")) — skipping"
  fi

  exit 1
}

# ─── Check 1: mail-processor health endpoint ────────────────────────
if ! curl -sf -m 5 "http://localhost:${HEALTH_PORT}/health" > /dev/null; then
  fail "health endpoint not responding on localhost:${HEALTH_PORT}"
fi

# ─── Check 2: SMTP listener on port 25 ──────────────────────────────
if ! timeout 5 bash -c "cat < /dev/null > /dev/tcp/localhost/25" 2>/dev/null; then
  fail "port 25 not listening on localhost"
fi

# ─── Check 3: End-to-end deliverability via smart host ──────────────
# swaks --quit-after RCPT stops after RCPT TO so no actual message
# body is sent — we only test whether Microsoft accepts the envelope
# from our outgoing IP.
if ! command -v swaks > /dev/null 2>&1; then
  fail "swaks not installed (run: apt install -y swaks)"
fi

probe_output=$(swaks \
  --quit-after RCPT \
  --to "$PROBE_TO" \
  --from "$PROBE_FROM" \
  --server "${SMART_HOST_HOST}:${SMART_HOST_PORT}" \
  --tls \
  --timeout 20 2>&1 || true)

# Microsoft's IP-ban error has a stable signature
if echo "$probe_output" | grep -qE "5\.7\.606|banned sending IP"; then
  log "$probe_output"
  fail "droplet IP banned by Microsoft (5.7.606)"
fi

# Any other 5xx from the smart host (swaks marks non-success
# responses with `<*` or `<~*` followed by the code).
if echo "$probe_output" | grep -qE "^<[~]?\*+ +5[0-9][0-9]"; then
  log "$probe_output"
  fail "SMTP 5xx response from smart host"
fi

# Connection-level failures
if echo "$probe_output" | grep -qiE "cannot connect|connection refused|connection timed out|no route to host"; then
  log "$probe_output"
  fail "cannot reach smart host"
fi

# Final sanity: ensure we saw a 2xx response to RCPT TO. swaks marks
# success responses with `<- ` (no TLS) or `<~ ` (TLS) — note: no `*`.
if ! echo "$probe_output" | grep -qE "^<[~]? +250"; then
  log "$probe_output"
  fail "no 2xx response from smart host (unexpected probe output)"
fi

# ─── Success: reset failure counter and ping heartbeat ──────────────
# Note: we do NOT auto-re-enable the rule here. If it was disabled
# (manually or by the auto-trigger), the operator must re-enable it
# explicitly via enable-relay-rule.sh. This avoids flapping when the
# underlying issue is intermittent.
prev_count=$(read_fail_count)
if [ "$prev_count" -gt 0 ]; then
  log "OK: probe recovered after $prev_count consecutive failure(s)"
fi
echo 0 > "$FAIL_COUNT_FILE"

if [ -f "$AUTO_DISABLED_FLAG" ]; then
  log "REMINDER: rule is still auto-disabled (since $(cat "$AUTO_DISABLED_FLAG")) — run enable-relay-rule.sh to re-enable"
fi

if [ -z "$HEARTBEAT_URL" ]; then
  log "OK: probe succeeded but HEARTBEAT_URL not set — no monitor configured"
  exit 0
fi

if curl -sf -m 10 "$HEARTBEAT_URL" > /dev/null; then
  log "OK: probe succeeded, heartbeat sent"
else
  log "WARN: probe succeeded but heartbeat ping to $HEARTBEAT_URL failed"
fi
