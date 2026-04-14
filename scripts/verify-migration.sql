-- Post-migration sanity checks. Run against the NEW database once the
-- migrate-supabase.sh script finishes:
--
--   psql "NEW_DIRECT_URL" -f scripts/verify-migration.sql
--
-- All four queries should return non-empty results matching what the
-- old database had.

\echo ''
\echo '── Row counts per table ───────────────────────────────────────'
select 'senders'         as table, count(*) as rows from public.senders
union all
select 'global_settings' as table, count(*) as rows from public.global_settings
union all
select 'admin_users'     as table, count(*) as rows from public.admin_users
union all
select 'mail_events'     as table, count(*) as rows from public.mail_events
union all
select 'deployment_logs' as table, count(*) as rows from public.deployment_logs
order by table;

\echo ''
\echo '── Senders (first 10) ─────────────────────────────────────────'
select email, name, title, enabled
from public.senders
order by name
limit 10;

\echo ''
\echo '── Global settings (should be 1 row) ──────────────────────────'
select
  substring(address_line_1, 1, 40) as address_line_1,
  substring(address_line_2, 1, 40) as address_line_2,
  website,
  length(logo_url) > 0 as has_logo,
  length(badge_url) > 0 as has_badge,
  length(disclaimer) > 0 as has_disclaimer
from public.global_settings;

\echo ''
\echo '── Admin users (password hashes hidden) ───────────────────────'
select email, name, role, created_at::date as created_at
from public.admin_users
order by name;

\echo ''
\echo '── Latest 10 mail events ──────────────────────────────────────'
select
  created_at::timestamp(0) as at,
  status,
  sender_email,
  array_length(recipients, 1) as to_count
from public.mail_events
order by created_at desc
limit 10;
