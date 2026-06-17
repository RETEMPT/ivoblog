# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build Next.js (standalone mode, configured in next.config.ts)
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
# Copy static files (uploaded images, music, etc.)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Ensure uploads directory exists and is writable
RUN mkdir -p public/uploads && chown -R nextjs:nodejs public/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
