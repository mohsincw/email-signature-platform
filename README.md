# Email Signature Platform

Self-hosted email signature management for a Microsoft 365 tenant.
Operationally equivalent to CodeTwo Email Signatures 365's cloud mode:
outbound mail from the tenant is redirected through an SMTP relay
that injects a pixel-perfect PNG signature (rendered server-side with
Satori + resvg), then the message is sent back to Exchange Online for
delivery — internally *and* externally — with no per-user Outlook
setup, no Outlook add-ins, and no client installs.

Built for `chaiiwala.co.uk` and currently running against that tenant,
but the moving parts are tenant-agnostic — see
[Using as a module in another project](#using-as-a-module-in-another-project)
below.

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  admin-web              │  HTTPS │  Supabase                │
│  Next.js 15 + API       │◄──────►│  Postgres + Storage      │
│  (deployed to Vercel)   │        │                          │
└─────────────────────────┘        └──────────┬───────────────┘
           ▲                                  │
           │ read/write                       │ reads
           │ sender records                   │ sender records
           │                                  ▼
           │                        ┌──────────────────────────┐
           │                        │  mail-processor          │
           │                        │  Node SMTP relay         │
           │                        │  (DigitalOcean droplet)  │
           │                        └──────────┬───────────────┘
           │                                   │ SMTP STARTTLS
           │                                   ▼
           │                        ┌──────────────────────────┐
           └────────────────────────┤  Exchange Online         │
                                    │  (transport rule +       │
                                    │   inbound/outbound       │
                                    │   connectors)            │
                                    └──────────────────────────┘
```

| Component | Path | Role |
|---|---|---|
| Admin Web | `apps/admin-web` | Next.js 15 app — login, CRUD for senders, global settings, live preview. Deploys to Vercel. |
| Mail Processor | `apps/mail-processor` | Node SMTP server on port 25 — receives mail redirected from Exchange, rebuilds it with a CID-embedded PNG signature, relays it back to Exchange. Runs on any VPS with Docker. |
| `packages/signature-png` | `packages/signature-png` | Shared PNG rendering — Satori + resvg + Myriad Pro fonts. Used by both the admin-web live preview and the mail-processor inject path. |
| `packages/signature-renderer` | `packages/signature-renderer` | HTML / plain-text signature generation used by the admin-web copy-HTML feature and Outlook deploy code path. |
| `packages/database` | `packages/database` | Prisma schema + client. Shared by both apps. |
| `packages/shared-types` | `packages/shared-types` | TypeScript DTOs and constants shared across apps. |
| `packages/config` | `packages/config` | Thin wrapper for env-var reads with `required()` / `optional()` helpers. |

## Prerequisites

- Node.js 20+
- pnpm 9+
- A Microsoft 365 tenant you're Global Admin / Exchange Admin on
- A Postgres database (Supabase or any managed PG)
- A VPS with Docker that can bind port 25 (any cloud works —
  DigitalOcean, Hetzner, Linode, AWS Lightsail)
- A DNS A record for the mail relay (e.g.
  `mail-relay.yourdomain.tld`) pointing at the VPS

## Local development

```bash
pnpm install

cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/mail-processor/.env.example apps/mail-processor/.env
# fill in DATABASE_URL and related settings

pnpm db:generate
pnpm db:migrate
pnpm db:seed          # creates the initial admin user

pnpm dev:admin        # Next.js on :3000
pnpm dev:mail         # Mail processor on :2525 locally (25 in prod)
```

## Deployment

### Admin Web → Vercel

1. Import the repo as a Next.js project. `vercel.json` at the repo
   root handles the monorepo build: `prisma generate` →
   `@esp/signature-png build` → `next build` for `apps/admin-web`.
2. Set environment variables from `apps/admin-web/.env.example` in
   the Vercel project settings. Only `DATABASE_URL`, `DIRECT_URL`,
   `JWT_SECRET` and the seed admin vars are strictly required.
3. Run `pnpm db:seed` once against `DIRECT_URL` to create the
   first admin login.
4. Point a custom domain at the Vercel project.

### Mail Processor → VPS with Docker

This is documented in detail in the mail-processor README because it
has to stay next to the code, the Dockerfile and the connector PS
commands:

**→ [`apps/mail-processor/README.md`](apps/mail-processor/README.md)**

Short version: SSH into the VPS, clone the repo, `cp .env.example .env`,
fill in `DATABASE_URL`, `docker compose up -d --build`, then set up
the Exchange Online connectors + transport rule from the same README.

### Microsoft 365 routing

All Exchange Online configuration (inbound connector, outbound
connector, transport rule, TNEF, SPF) lives in:

**→ [`docs/m365-routing.md`](docs/m365-routing.md)**

which itself points into the mail-processor README for the
step-by-step commands.

## Database schema

- **Sender** — email, name, title, phone(s), `enabled` flag, optional
  `imageKey` for a per-sender override image. Lowercase-normalised on
  write.
- **GlobalSettings** — singleton row holding address lines, website,
  logo URL, badge URL and the italic disclaimer text.
- **AdminUser** — bcrypt login for the admin UI.
- **DeploymentLog** — historical log of per-sender Outlook deploys
  (the Outlook deploy code path exists but the UI button has been
  removed; server-side relay replaces it operationally).

## Key operational design choices

- **Server-side only.** There is no Outlook add-in, no per-user
  signature deployment, no client configuration. Every outbound
  message the tenant sends is routed through the droplet via an
  Exchange transport rule and the signature is injected centrally.
- **PNG, not HTML.** The signature is rendered as a 314×154 PNG
  embedded as a `cid:` MIME part. This is how CodeTwo does it too —
  it's pixel-perfect across every email client (including Outlook
  mobile, Apple Mail, Gmail web, Gmail app) and sidesteps the
  long-standing Outlook HTML rendering bugs around inline images,
  tables and fonts.
- **Loop prevention is belt-and-braces.** The Exchange transport rule
  has an exception on a custom `X-ESP-Processed: v1` header, AND the
  mail-processor stamps that header at the raw-buffer level in
  `apps/mail-processor/src/relay.ts` on *every* relay — including
  pass-throughs for senders that aren't in the DB. This stops
  Exchange from redirecting the same message back to the droplet
  indefinitely.
- **Disabled / unknown senders still deliver.** If a sender isn't in
  the DB or is marked disabled, the droplet rebuilds the MIME with
  no signature changes and relays it normally. Nothing is ever
  dropped because of a DB miss.
- **The PNG cache clears on container restart.** In-memory LRU keyed
  on the exact input hash. Rebuilding the Docker image (via
  `docker compose up -d --build`) is enough to force fresh renders
  after a typography change.

## Using as a module in another project

The two apps and five packages in this repo are all independent
workspaces under a pnpm workspace at the root. To embed the whole
thing in a larger monorepo:

1. Add the repo as a `git subtree` or `git submodule` under your
   project (`subtree` is friendlier for day-to-day editing).
2. Extend your project's pnpm workspace definition so its
   `pnpm-workspace.yaml` includes the paths under the embedded
   directory, e.g.:
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
     - 'vendor/email-signature-platform/apps/*'
     - 'vendor/email-signature-platform/packages/*'
   ```
3. The workspace package names are `@esp/*` — make sure no other
   packages in the outer monorepo use that scope.
4. `apps/admin-web` is a Next.js 15 app; if your outer project is
   also Next.js you probably want to run it as a separate Vercel
   project rather than trying to merge app routers.
5. `apps/mail-processor` is a plain Node service with its own
   `Dockerfile` and `docker-compose.yml`. It has no shared runtime
   with the admin-web so it can be deployed completely independently.
6. Both apps read `DATABASE_URL` for the same Postgres database.
   Point them at the same Supabase / RDS / Neon instance and they'll
   share sender state.

No code assumes a specific tenant domain — the sender domain,
smart host, and hostnames are all configurable via env vars on the
mail-processor (`SMART_HOST_HOST`, `HOSTNAME`) and via the admin
UI's Global Settings page on the admin-web side (address, website,
logo, badge, disclaimer).

## Environment variables

See the `.env.example` file next to each app:

- `apps/admin-web/.env.example` — database, JWT secret, seed admin
- `apps/mail-processor/.env.example` — database, smart host, hostname,
  TLS cert paths

## Troubleshooting

For mail-flow issues (connector errors, `5.7.64 TenantAttribution`,
`winmail.dat` attachments, disabled-sender delivery, loop detection),
see the Troubleshooting section at the bottom of
[`apps/mail-processor/README.md`](apps/mail-processor/README.md).
