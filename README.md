# Email Signature Platform

Internal email signature management platform for Chaiiwala's Microsoft 365 organisation.

## Architecture

| Component | Path | Port | Description |
|-----------|------|------|-------------|
| Admin Web | `apps/admin-web` | 3000 | Next.js admin UI + API routes (auth, senders, settings, Outlook deploy) |
| Mail Processor | `apps/mail-processor` | 2525 | SMTP server that intercepts and signs outbound email (self-hosted, not on Vercel) |

### Shared Packages

- `packages/database` — Prisma schema and database client
- `packages/shared-types` — TypeScript DTOs and constants
- `packages/signature-renderer` — HTML/plain text signature generation
- `packages/config` — Environment variable helpers

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for local Postgres + MinIO)

## Local Setup

### 1. Start infrastructure

```bash
cd infrastructure/docker
docker compose up -d
```

Starts PostgreSQL (5432) and MinIO (9000 / console 9001).

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/mail-processor/.env.example apps/mail-processor/.env
```

For local dev, set `DATABASE_URL` and `DIRECT_URL` to your local Postgres, and point `S3_*` at MinIO.

### 4. Set up database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Run

```bash
pnpm dev
```

Individual apps:

```bash
pnpm dev:admin    # Next.js (UI + API) on :3000
pnpm dev:mail     # Mail processor on :2525
```

## Deployment

The admin UI + API deploy to **Vercel** as a single Next.js project. Database and storage are provided by **Supabase**.

### One-time setup

1. **Supabase** — create a project, copy the pooled `DATABASE_URL` (Transaction pooler, port 6543) and `DIRECT_URL` (Direct connection, port 5432). Create a Storage bucket called `signatures` and enable the S3 connection to get access keys.
2. **Vercel** — import the GitHub repo. Vercel will pick up `vercel.json` which runs `prisma generate`, `prisma migrate deploy`, then `next build`.
3. **Environment variables** — set the vars listed in `apps/admin-web/.env.example` in the Vercel project settings.
4. **First admin user** — run `pnpm db:seed` locally against the Supabase `DIRECT_URL`, or trigger seeding manually. The default admin is read from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
5. **Custom domain** — add `emailsignatures.chaiiwala.co.uk` under Vercel → Settings → Domains.

The mail-processor is **not** deployed to Vercel — it needs a persistent TCP listener. Host it on a VPS when you're ready.

## Database Schema

- **Sender** — email, name, title, phone, enabled flag, optional image key
- **GlobalSettings** — singleton row (address, website, logo URL, badge URL)
- **AdminUser** — bcrypt-hashed login
- **DeploymentLog** — Outlook deployment history per sender

## Microsoft 365 Integration

See [docs/m365-routing.md](docs/m365-routing.md) for instructions on routing M365 outbound mail through the processor.

## TODO

- [ ] Admin authentication (SSO / Azure AD)
- [ ] Microsoft 365 mail flow connector configuration
- [ ] TLS on mail processor SMTP server
- [ ] Monitoring and alerting
