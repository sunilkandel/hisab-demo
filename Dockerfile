# syntax=docker/dockerfile:1
# Hisab: production image. One container serves the app and the API.
#   docker build -t hisab .
#   docker run -p 3000:3000 -v hisab-data:/app/data hisab
# Then open http://localhost:3000 and sign in with demo / Hisab@2083.

# ---------- 1. build: install everything, typecheck, bundle the frontend ----------
FROM oven/bun:1.4-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---------- 2. runtime: only what the server needs ----------
FROM oven/bun:1.4-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HISAB_DB=/app/data/hisab.db

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && rm -rf /root/.bun/install/cache

COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/domain ./src/domain

# SQLite lives in /app/data. Mount a volume there to keep data across restarts.
RUN mkdir -p /app/data && chown -R bun:bun /app/data
USER bun

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "server/index.ts"]
