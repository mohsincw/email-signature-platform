# Email Signature Platform

Internal email signature management platform that automatically appends branded signatures to outbound Microsoft 365 email.

## Architecture

| Component | Path | Port | Description |
|-----------|------|------|-------------|
| Admin Web | `apps/admin-web` | 3000 | Next.js admin UI for managing senders and settings |
| API | `apps/api` | 3001 | NestJS REST API |
| Mail Processor | `apps/mail-processor` | 2525 | SMTP server that intercepts and signs outbound email |

### Shared Packages

- `packages/database` — Prisma schema and database client
- `packages/shared-types` — TypeScript DTOs and constants
- `packages/signature-renderer` — HTML/plain text signature generation
- `packages/config` — Environment variable helpers

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Local Setup

### 1. Start infrastructure

```bash
cd infrastructure/docker
docker compose up -d
```

This starts PostgreSQL (port 5432) and MinIO S3-compatible storage (port 9000, console on 9001).

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment

Copy `.env.example` to `.env` in each app:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/mail-processor/.env.example apps/mail-processor/.env
```

### 4. Set up database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Run all apps

```bash
pnpm dev
```

Or individually:

```bash
pnpm dev:api      # API on :3001
pnpm dev:admin    # Admin UI on :3000
pnpm dev:mail     # Mail processor on :2525
```

## Testing

```bash
pnpm test
```

## Microsoft 365 Integration

See [docs/m365-routing.md](docs/m365-routing.md) for instructions on routing M365 outbound mail through the processor.

## Database Schema

- **Sender** — email, name, title, enabled flag, optional image key
- **GlobalSettings** — singleton row with shared signature text (HTML + plain)

## TODO

- [ ] Real S3 presigned upload flow
- [ ] Admin authentication (SSO / Azure AD)
- [ ] Microsoft 365 mail flow connector configuration
- [ ] TLS on mail processor SMTP server
- [ ] Production deployment configuration
- [ ] Monitoring and alerting
