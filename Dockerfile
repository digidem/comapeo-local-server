# syntax=docker/dockerfile:1

# --------------------------------------------------------------------------- #
# Stage 1: build
# Installs all dependencies (including native modules) and compiles TypeScript.
# Primary target: linux/arm64. linux/amd64 supported for local development.
# --------------------------------------------------------------------------- #
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Install build tools needed for native addons (better-sqlite3, sodium-native).
RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 \
	make \
	g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --------------------------------------------------------------------------- #
# Stage 2: runtime
# Lean image with only production dependencies.
# --------------------------------------------------------------------------- #
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 \
	make \
	g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV COMAPEO_DATA_DIR=/data

VOLUME ["/data"]

# Health check: the daemon sets a ready flag on stdout after startup.
# Detailed healthcheck is implemented in Batch 5.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
	CMD node -e "process.exit(0)"

CMD ["node", "dist/daemon/index.js"]
