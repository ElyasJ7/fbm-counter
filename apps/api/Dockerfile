# API production image (multi-stage, non-root)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
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
 && pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

RUN addgroup -S fbm && adduser -S -G fbm fbm \
 && mkdir -p /app/uploads \
 && chown -R fbm:fbm /app

COPY --from=build --chown=fbm:fbm /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=fbm:fbm /app/node_modules ./node_modules
COPY --from=build --chown=fbm:fbm /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=fbm:fbm /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=fbm:fbm /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=fbm:fbm /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=fbm:fbm /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=fbm:fbm /app/packages/financial-core/package.json ./packages/financial-core/package.json
COPY --from=build --chown=fbm:fbm /app/packages/financial-core/dist ./packages/financial-core/dist

USER fbm
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
