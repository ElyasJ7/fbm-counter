# API production image (multi-stage, non-root)
# Uses `pnpm deploy` so workspace packages (@fbm/shared, @fbm/financial-core)
# and production deps resolve correctly. Dist is copied explicitly because it is
# gitignored and would otherwise be omitted from the deploy bundle.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/financial-core/package.json packages/financial-core/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
ENV CI=true
RUN pnpm --filter @fbm/shared build \
 && pnpm --filter @fbm/financial-core build \
 && pnpm --filter @fbm/api exec prisma generate \
 && pnpm --filter @fbm/api build \
 && test -f /app/apps/api/dist/main.js \
 && mkdir -p /tmp/api-artifacts \
 && cp -a /app/apps/api/dist /tmp/api-artifacts/dist \
 && cp -a /app/apps/api/prisma /tmp/api-artifacts/prisma \
 && pnpm --filter @fbm/api deploy --prod --legacy /deploy \
 && rm -rf /deploy/dist /deploy/src /deploy/test \
 && rm -f /deploy/.env /deploy/.env.* /deploy/Dockerfile /deploy/README.md \
 && cp -a /tmp/api-artifacts/dist /deploy/dist \
 && cp -a /tmp/api-artifacts/prisma /deploy/prisma \
 && cd /deploy && /app/node_modules/.bin/prisma generate \
 && test -f /deploy/dist/main.js \
 && test -d /deploy/node_modules/@nestjs/common \
 && test -d /deploy/node_modules/@fbm/shared \
 && test -d /deploy/node_modules/@fbm/financial-core \
 && test -d /deploy/node_modules/.prisma/client

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

RUN addgroup -S fbm && adduser -S -G fbm fbm \
 && mkdir -p /app/uploads \
 && chown -R fbm:fbm /app

COPY --from=build --chown=fbm:fbm /deploy/ ./

USER fbm
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "dist/main.js"]
