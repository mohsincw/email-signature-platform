FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/database/package.json packages/database/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/signature-renderer/package.json packages/signature-renderer/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./

RUN pnpm --filter @esp/database generate
RUN pnpm --filter @esp/api build

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
