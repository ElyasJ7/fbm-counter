# Web production build served by nginx
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
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
