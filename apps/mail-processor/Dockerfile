FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/signature-renderer/package.json packages/signature-renderer/
COPY packages/config/package.json packages/config/
COPY apps/mail-processor/package.json apps/mail-processor/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/mail-processor/ apps/mail-processor/
COPY tsconfig.base.json ./

RUN pnpm --filter @esp/mail-processor build

EXPOSE 2525
CMD ["node", "apps/mail-processor/dist/index.js"]
