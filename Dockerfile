# syntax=docker/dockerfile:1
# SwiftTrack Logistics Platform - Production Multi-Stage Containerfile

# ==============================================================================
# Stage 1: Build Frontend SPA
# ==============================================================================
FROM node:22-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Application Runtime
# ==============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    DEMO_MODE=false

# Install curl for container health check
RUN apk add --no-cache curl

# Copy backend dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server application and database migrations
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY data/ ./data/

# Copy compiled frontend assets from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Security: Run as unprivileged node user
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Container liveness / readiness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "server/server.js"]
