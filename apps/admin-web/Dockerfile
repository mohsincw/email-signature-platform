FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/admin-web/package.json apps/admin-web/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/admin-web/ apps/admin-web/
COPY tsconfig.base.json ./

RUN pnpm --filter @esp/admin-web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@esp/admin-web", "start"]
