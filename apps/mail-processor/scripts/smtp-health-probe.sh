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
# ─────────────────────────────────────────────────────────────────────

set -uo pipefail

LOG="/var/log/mail-monitor.log"
ENV_FILE="${ENV_FILE:-/root/email-signature-platform/apps/mail-processor/.env}"

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

log() {
  echo "$(date -Is) $1" >> "$LOG"
}

fail() {
  log "FAIL: $1"
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

# ─── Ping heartbeat ─────────────────────────────────────────────────
if [ -z "$HEARTBEAT_URL" ]; then
  log "OK: probe succeeded but HEARTBEAT_URL not set — no monitor configured"
  exit 0
fi

if curl -sf -m 10 "$HEARTBEAT_URL" > /dev/null; then
  log "OK: probe succeeded, heartbeat sent"
else
  log "WARN: probe succeeded but heartbeat ping to $HEARTBEAT_URL failed"
fi
