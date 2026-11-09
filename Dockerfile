# syntax=docker/dockerfile:1

# ---- web build (runs natively on the build machine, same output for every platform)
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY . .
RUN npm run build

# ---- production dependencies (native modules for the target platform)
FROM node:22-bookworm-slim AS deps
# Build tools are only used if a native module has no prebuilt binary for this platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runtime
FROM node:22-bookworm-slim
LABEL org.opencontainers.image.title="Folio" \
      org.opencontainers.image.description="Self-hosted client galleries for photographers"

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    PHOTOS_DIR=/photos \
    DATA_DIR=/data \
    CACHE_DIR=/cache \
    MIGRATIONS_DIR=/app/drizzle \
    PUID=1000 \
    PGID=1000

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json server.js ./
COPY drizzle ./drizzle
COPY docker/entrypoint.sh /usr/local/bin/folio-entrypoint

RUN mkdir -p /photos /data /cache

VOLUME ["/photos", "/data", "/cache"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["folio-entrypoint"]
CMD ["node", "server.js"]
