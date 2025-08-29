# Multi-stage build for WebSocket service
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (if using Prisma)
RUN npx prisma generate || true

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 websocket

# Copy built application
COPY --from=builder --chown=websocket:nodejs /app/dist ./dist
COPY --from=builder --chown=websocket:nodejs /app/package.json ./package.json

# Copy production dependencies
COPY --from=deps --chown=websocket:nodejs /app/node_modules ./node_modules

# Copy Prisma schema and generated client (if using Prisma)
COPY --from=builder --chown=websocket:nodejs /app/prisma ./prisma
COPY --from=builder --chown=websocket:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Set environment variables
ENV NODE_ENV=production
ENV WS_HOST=0.0.0.0
ENV WS_PORT=3003

# Switch to non-root user
USER websocket

# Expose WebSocket port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "dist/server.js"]