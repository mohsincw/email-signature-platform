#!/usr/bin/env bash
#
# Migrate the email-signature-platform data from one Supabase project
# to another. Copies senders, global settings, admin users, mail
# events, deployment logs — everything in the public schema.
#
# Usage:
#   ./scripts/migrate-supabase.sh OLD_DATABASE_URL NEW_DATABASE_URL
#
# You can pass either the Supabase "Transaction pooler" URL (port 6543,
# includes ?pgbouncer=true) OR the "Direct connection" URL (port 5432).
# The script auto-normalises whichever you give it into the direct
# connection form, because pg_dump can't use the transaction pooler
# (it relies on session-level operations that pgbouncer in transaction
# mode doesn't support).
#
# Requirements: postgresql-client >= 14 (provides pg_dump and psql).
#   - macOS:   brew install postgresql
#   - Ubuntu:  sudo apt install postgresql-client
#
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 OLD_DATABASE_URL NEW_DATABASE_URL" >&2
  echo "" >&2
  echo "Both URLs can be either the pooled (port 6543) or direct (5432)" >&2
  echo "form — the script handles both. Put them in single-quotes so your" >&2
  echo "shell doesn't interpret the & and ? characters." >&2
  exit 1
fi

OLD_URL_INPUT="$1"
NEW_URL_INPUT="$2"

# ── Normalise URL to direct connection form ────────────────────────
# Supabase pooled URL:  postgres.<ref>:<pw>@...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
# Supabase direct URL:  postgres.<ref>:<pw>@...pooler.supabase.com:5432/postgres
#
# We strip the query string and swap 6543 → 5432. pg_dump/psql need
# session-level control that pgbouncer transaction mode breaks.
normalize_to_direct() {
  local url="$1"
  # Strip everything from the first '?' onwards (query params)
  url="${url%%\?*}"
  # Swap port 6543 → 5432
  url="${url/:6543\//:5432\/}"
  echo "$url"
}

OLD_URL=$(normalize_to_direct "$OLD_URL_INPUT")
NEW_URL=$(normalize_to_direct "$NEW_URL_INPUT")

# ── Pre-flight checks ──────────────────────────────────────────────

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found. Install postgresql-client." >&2
  echo "  macOS:   brew install postgresql" >&2
  echo "  Ubuntu:  sudo apt install postgresql-client" >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found. Install postgresql-client." >&2
  exit 1
fi

echo "▶ Checking connectivity to OLD database…"
if ! psql "$OLD_URL" -c 'select 1' >/dev/null 2>&1; then
  echo "error: can't connect to the OLD database. Check the URL and password." >&2
  exit 1
fi

echo "▶ Checking connectivity to NEW database…"
if ! psql "$NEW_URL" -c 'select 1' >/dev/null 2>&1; then
  echo "error: can't connect to the NEW database. Check the URL and password." >&2
  exit 1
fi

# ── Row counts before ──────────────────────────────────────────────

echo ""
echo "▶ Row counts in OLD database:"
psql "$OLD_URL" -Atc "
  select 'senders', count(*) from public.senders
  union all select 'global_settings', count(*) from public.global_settings
  union all select 'admin_users', count(*) from public.admin_users
  union all select 'mail_events', count(*) from public.mail_events
  union all select 'deployment_logs', count(*) from public.deployment_logs
" 2>/dev/null | awk -F'|' '{ printf "    %-20s %s rows\n", $1, $2 }' || {
  echo "    (couldn't count — will proceed with dump anyway)"
}

# ── Dump ───────────────────────────────────────────────────────────

DUMP_FILE=$(mktemp -t esp-migration-XXXXXX.sql)
trap "rm -f '$DUMP_FILE'" EXIT

echo ""
echo "▶ Dumping public schema from OLD database → $DUMP_FILE"
pg_dump "$OLD_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --no-comments \
  > "$DUMP_FILE"

DUMP_SIZE=$(wc -c < "$DUMP_FILE")
echo "    dump is $DUMP_SIZE bytes"

# ── Restore ────────────────────────────────────────────────────────

echo ""
echo "▶ Restoring into NEW database (this replaces any existing public schema data)…"
psql "$NEW_URL" --single-transaction -v ON_ERROR_STOP=1 -f "$DUMP_FILE"

# ── Row counts after ──────────────────────────────────────────────

echo ""
echo "▶ Row counts in NEW database after restore:"
psql "$NEW_URL" -Atc "
  select 'senders', count(*) from public.senders
  union all select 'global_settings', count(*) from public.global_settings
  union all select 'admin_users', count(*) from public.admin_users
  union all select 'mail_events', count(*) from public.mail_events
  union all select 'deployment_logs', count(*) from public.deployment_logs
" | awk -F'|' '{ printf "    %-20s %s rows\n", $1, $2 }'

echo ""
echo "✓ Migration complete. Compare the row counts above — they should match."
echo "  Dump temp file is auto-deleted on exit."
