# =============================================================================
# DocBase — Multi-stage Dockerfile
# Stage 1: builder — install deps & build
# Stage 2: runner — minimal runtime
# =============================================================================

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy dependency files first for better caching
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
ENV NODE_ENV=production
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S docbase -u 1001

# Copy built artifacts
COPY --from=builder --chown=docbase:nodejs /app/build ./build
COPY --from=builder --chown=docbase:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=docbase:nodejs /app/package.json ./package.json
COPY --from=builder --chown=docbase:nodejs /app/db ./db

# Install wget for healthcheck
RUN apk add --no-cache wget

USER docbase

EXPOSE 3000

# Run migrations then start app
CMD ["sh", "-c", "node -e \"require('drizzle-orm/postgres-js/migrator').default(require('postgres')('${DATABASE_URL}'), { migrationsFolder: './db/migrations' }).then(() => console.log('migrated')).catch(e => { console.error(e); process.exit(1); })\" && node .output/server/index.mjs"]
