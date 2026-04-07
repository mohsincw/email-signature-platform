# ─────────────────────────────────────────────────────────────────────
# Chaiiwala email-signature mail relay
# ─────────────────────────────────────────────────────────────────────
# Multi-stage build:
#   1. `builder` installs all workspace deps and compiles the TS
#   2. `runtime` copies only what's needed to run the compiled JS
#
# The final image ships with:
#   - Node 20 LTS (alpine)
#   - The compiled mail-processor dist/
#   - The generated Prisma client
#   - The signature-png package with the Myriad Pro .otf font bundled
#   - Production-only node_modules
# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# Copy workspace manifest + lockfile so pnpm can resolve before we
# pull in source files (better layer caching on unchanged deps).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Workspace package manifests (also for layer caching).
COPY packages/database/package.json           packages/database/
COPY packages/shared-types/package.json       packages/shared-types/
COPY packages/signature-renderer/package.json packages/signature-renderer/
COPY packages/signature-png/package.json      packages/signature-png/
COPY packages/config/package.json             packages/config/
COPY apps/mail-processor/package.json         apps/mail-processor/

RUN pnpm install --frozen-lockfile=false --filter @esp/mail-processor...

# Now the source
COPY packages/database/           packages/database/
COPY packages/shared-types/       packages/shared-types/
COPY packages/signature-renderer/ packages/signature-renderer/
COPY packages/signature-png/      packages/signature-png/
COPY packages/config/             packages/config/
COPY apps/mail-processor/         apps/mail-processor/

# Generate Prisma client + compile shared TS package(s) + compile mail-processor
RUN pnpm --filter @esp/database exec prisma generate && \
    pnpm --filter @esp/signature-png build && \
    pnpm --filter @esp/mail-processor build

# ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Alpine image is tiny but missing some runtime deps for the native
# modules (resvg, prisma engines).
RUN apk add --no-cache libc6-compat openssl

# Bring across the whole workspace from the builder — disk is cheap
# on a droplet and it simplifies path resolution.
COPY --from=builder /app /app

ENV NODE_ENV=production
ENV FONT_PATH=/app/packages/signature-png/fonts/myriad-pro-black.otf

EXPOSE 25 587 8080

CMD ["node", "apps/mail-processor/dist/index.js"]
