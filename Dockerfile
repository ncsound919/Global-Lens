# Node 22 LTS — better-sqlite3 v12 ships prebuilt binaries for node-v127
# (including linuxmusl-x64). Node 20 has NO prebuilds, so npm ci on node:20-alpine
# would fall back to node-gyp and fail without build tools. Do not downgrade.
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build application
RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
# --omit=dev is safe: server.mjs only ever imports vite from the dev branch
# (lazy-loaded), so the prod image needs runtime deps only.
RUN npm ci --omit=dev

# Persistent SQLite lives here when a Cloud Run volume is mounted (see deploy.yml).
# Without a mount the DB resets on each deploy — content repopulates via daily
# syncs, but settled donations are lost. Mount a volume for production.
ENV DB_PATH=/data/app.sqlite
VOLUME /data

# Cloud Run injects $PORT (default 8080); fall back to 8080 for plain docker run.
EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

# Start server
CMD ["node", "dist/server.mjs"]