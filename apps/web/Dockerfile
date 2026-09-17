# Web production build served by nginx (non-root)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/financial-core/package.json packages/financial-core/
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter @fbm/shared build \
 && pnpm --filter @fbm/financial-core build \
 && pnpm --filter @fbm/web build

FROM nginx:1.27-alpine AS runner
# Run nginx as existing non-root nginx user
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
