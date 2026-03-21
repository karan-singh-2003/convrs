# ─────────────────────────────────────────────────────────────
# Stage 1 — Builder (prepare pruned workspace)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /repo

# Install turbo globally
RUN npm install -g turbo@^2

# Copy entire monorepo
COPY . .

# Prune monorepo to only analytics-api and its deps
RUN turbo prune --scope=analytics-api --docker


# ─────────────────────────────────────────────────────────────
# Stage 2 — Installer (install deps + build)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS installer

WORKDIR /repo

# Enable pnpm
RUN corepack enable

# Copy pruned workspace
COPY --from=builder /repo/out/json/ .
COPY --from=builder /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY --from=builder /repo/out/full/ .

# Build API
RUN pnpm --filter analytics-api run build


# ─────────────────────────────────────────────────────────────
# Stage 3 — Runtime (production container)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 analytics

WORKDIR /app

# Copy build output
COPY --from=installer /repo/apps/api/dist ./dist
COPY --from=installer /repo/apps/api/package.json ./package.json
COPY --from=installer /repo/apps/api/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

USER analytics

EXPOSE 3000

ENTRYPOINT ["/sbin/tini","--"]

CMD ["node","dist/server.js"]

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1