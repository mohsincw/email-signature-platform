# Migrating to a new Vercel + Supabase setup

Runbook for moving the email-signature-platform deployment from one
Vercel/Supabase pair to another — e.g. lifting it out of a colleague's
marketplace-integration setup and into your own standalone accounts.

**Approximate downtime: ~15 seconds** (only the droplet restart step).
**Approximate total time: 30 minutes.**

## Overview

The platform has four moving parts:

1. **Admin Web** on Vercel — Next.js app, stateless
2. **Supabase Postgres** — senders, settings, admin users, mail events
3. **Supabase Storage** — logo + badge image files
4. **Mail processor** on a DigitalOcean droplet — reads `DATABASE_URL`
   from `.env` and relays mail

All app state is in #2 and #3. #1 is stateless (just redeploy), #4 is
stateless (just update its `.env`).

## Pre-flight

You need:

- [ ] A Supabase account (free tier is enough)
- [ ] A Vercel account (free tier is enough)
- [ ] The **current** `DATABASE_URL` (pooled or direct, either works)
- [ ] Access to the droplet via SSH
- [ ] `postgresql-client` installed locally (`brew install postgresql` /
  `sudo apt install postgresql-client`) — or you can run the migration
  script from the droplet which already has psql installed
- [ ] A 1-hour block where a ~15-second mail processor restart is OK

You do **not** need:
- Your colleague's Vercel/Supabase credentials — you only need the
  env vars they already shared with you.

## Step 1 — Create the new Supabase project

1. https://supabase.com/dashboard → your organisation → **New project**
2. Region: match the old one. If the old `DATABASE_URL` host is
   `aws-1-us-east-1.pooler.supabase.com`, pick **US East (Northern
   Virginia)**. Droplet latency stays unchanged.
3. Set a strong DB password and save it somewhere.
4. Wait ~2 minutes for provisioning.
5. From **Project Settings → Database**, grab two connection strings:
   - **Transaction pooler** (port 6543) — this goes into
     `DATABASE_URL` in the Vercel project and the droplet `.env`
   - **Direct connection** (port 5432) — this goes into `DIRECT_URL`
     in the Vercel project (used by Prisma migrations)

## Step 2 — Create the new Vercel project

1. https://vercel.com → Add New → **Project** → import
   `mohsincw/email-signature-platform`
2. Framework preset auto-detects **Next.js** — keep defaults. The
   `vercel.json` at the repo root handles the monorepo build.
3. **Before clicking Deploy**, expand **Environment Variables**.

### Which env vars matter

The old Vercel project probably has 20+ env vars because the Vercel
Supabase marketplace integration auto-injected a pile of aliases
(`POSTGRES_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_JWT_SECRET`,
etc.). **Our app only reads 9 of them.** Ignore the rest.

**Set these 9 on the new Vercel:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | NEW Supabase **pooled** URL (port 6543, includes `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | NEW Supabase **direct** URL (port 5432, no query string) |
| `JWT_SECRET` | Fresh random — `openssl rand -hex 32`. Invalidates existing logins (users re-authenticate once, not a problem). |
| `S3_ENDPOINT` | NEW Supabase → Project Settings → Storage → **S3 Connection** → Endpoint URL |
| `S3_REGION` | Match your Supabase region, e.g. `us-east-1` or `eu-west-2` |
| `S3_BUCKET` | `signatures` (create this bucket via Supabase Storage, make it public) |
| `S3_ACCESS_KEY_ID` | NEW Supabase → Storage → S3 Connection → Generate credentials |
| `S3_SECRET_ACCESS_KEY` | Shown once when generating credentials — save immediately |
| `S3_PUBLIC_URL` | `https://<new-ref>.supabase.co/storage/v1/object/public/signatures` |

**Skip these** (they were Vercel-Supabase integration duplicates,
our app never references them):
- Any `POSTGRES_*` — our app uses `DATABASE_URL` / `DIRECT_URL`
- Any `NEXT_PUBLIC_SUPABASE_*` — we don't use the Supabase JS client
- `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`,
  `SUPABASE_PUBLISHABLE_KEY` — same
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` —
  legacy Outlook deploy code path, no longer called
- `SMTP_*` — mail-processor uses smart host directly
- `SEED_ADMIN_*` — only used if you run `pnpm db:seed`, and we're
  migrating the DB so the admin user already exists

4. Click **Deploy**. Build will succeed but the DB is empty. Next step.

## Step 3 — Migrate the database

From your laptop (or the droplet — it already has `psql`):

```bash
# Clone or pull the repo locally if you haven't already
git clone https://github.com/mohsincw/email-signature-platform.git
cd email-signature-platform
git checkout claude/fix-external-email-delivery-f1Evm  # (or main after merge)

# Run the migration script with both URLs (in single quotes so your
# shell doesn't eat the & characters).
./scripts/migrate-supabase.sh \
  'postgresql://postgres.OLD_REF:OLD_PW@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1' \
  'postgresql://postgres.NEW_REF:NEW_PW@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
```

The script handles the pgbouncer-pooled-vs-direct URL gotcha for you
and prints row counts before and after the dump. Expected output:

```
▶ Checking connectivity to OLD database…
▶ Checking connectivity to NEW database…
▶ Row counts in OLD database:
    senders              <N> rows
    global_settings      1 rows
    admin_users          <N> rows
    mail_events          <N> rows
    deployment_logs      <N> rows
▶ Dumping public schema from OLD database → /tmp/esp-migration-xxxxx.sql
    dump is <X> bytes
▶ Restoring into NEW database (this replaces any existing public schema data)…
▶ Row counts in NEW database after restore:
    senders              <N> rows
    global_settings      1 rows
    admin_users          <N> rows
    mail_events          <N> rows
    deployment_logs      <N> rows
✓ Migration complete.
```

Row counts before and after should match exactly.

Deeper sanity check if you want one:

```bash
psql 'NEW_DIRECT_URL' -f scripts/verify-migration.sql
```

This prints the first 10 senders, the global settings, admin users
and the latest 10 mail events so you can eyeball them.

## Step 4 — Migrate the logo and badge images

Supabase Storage is a separate object store; `pg_dump` doesn't copy
it. Simplest path:

1. Open the NEW Vercel deployment URL (it's in your Vercel project's
   Deployments tab, looks like
   `email-signature-platform-XXXX-YOUR-SCOPE.vercel.app`)
2. Log in with the existing admin credentials
3. Go to **Settings** page → re-upload **Logo** and **Badge**

Takes ~30 seconds.

If you'd rather bulk-copy, use the Supabase CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref OLD_REF
supabase storage download -r signatures ./backup-storage
supabase link --project-ref NEW_REF
# Create "signatures" bucket in the new Supabase dashboard first
supabase storage upload signatures ./backup-storage
```

## Step 5 — Verify the new stack (cold, before switching the droplet)

Still without touching production:

- [ ] Vercel deployment shows green in the Deployments tab
- [ ] Log in at the new `.vercel.app` URL works
- [ ] **People** page lists all senders
- [ ] **Console** page shows historical mail events
- [ ] **Settings** page has correct address / disclaimer / logo / badge

If anything looks off, fix it now — the droplet is still pointing at
the old DB so you can start over if needed.

## Step 6 — Switch the mail processor to the new Supabase

Only step with (brief) downtime. Any email arriving during the ~15s
restart gets queued by Exchange and retried; nothing is lost.

```bash
ssh root@167.172.49.118

cd ~/email-signature-platform/apps/mail-processor
nano .env
# Replace the DATABASE_URL line with the NEW pooled URL
# (keep the ?pgbouncer=true&connection_limit=1 query string)

docker compose restart mail-processor
docker compose logs --tail=20 mail-processor
```

Look for `Smart host is reachable` — that means it connected to the
new DB successfully and is ready to relay.

Send yourself a test email from any configured sender. Watch the
logs for `Signature injected` / `passing through` and verify the
event appears on the Console page of the NEW Vercel deployment.

## Step 7 — Confirm everyone can log in

Because we generated a fresh `JWT_SECRET`, any admin users currently
logged into the old Vercel URL will see their session expire on the
NEW one. That's fine — they just re-login with their existing email +
password.

## Step 8 — Decommission the old stack

Wait 24–48 hours running on the new stack. If nothing's broken:

1. Ask your colleague to go to their Vercel → project → Settings →
   Advanced → **Delete Project**
2. That also tears down the Supabase marketplace integration and
   stops any billing on their account

Done.

## Rollback

If something goes wrong between steps 6 and 8, flip the droplet's
`DATABASE_URL` back to the OLD pooled URL and `docker compose
restart mail-processor`. The old stack is still live until step 8
completes, so you can yo-yo between them as needed.

## Troubleshooting

**`pg_dump: error: aborting because of server version mismatch`** —
your local `pg_dump` is older than Supabase's Postgres. Upgrade
postgresql-client: `brew upgrade postgresql` or use the version on
the droplet (`apt install postgresql-client-16`).

**`ERROR: permission denied for schema public`** during restore —
Supabase restricts the default role. Re-run the script with the
direct (port 5432) URL rather than the pooled one; the script should
do this automatically but double-check with `echo` of the normalised
URL.

**`ON CONFLICT` errors on `_prisma_migrations`** — means Vercel's
post-deploy step already seeded the table. Drop it first:
```bash
psql 'NEW_DIRECT_URL' -c 'drop table if exists _prisma_migrations'
./scripts/migrate-supabase.sh ...
```

**Droplet logs show `connection refused` to Supabase after restart** —
double-check you used the **pooled** URL (port 6543) in the droplet
`.env`, not the direct one. Direct connections from the droplet to
Supabase get rate-limited.
