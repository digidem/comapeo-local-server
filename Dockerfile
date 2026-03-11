# syntax=docker/dockerfile:1
#
# CoMapeo Headless – multi-stage Docker image
#
# Primary target: linux/arm64  (Raspberry Pi 4/5 and similar)
# Also supports: linux/amd64  (local development / CI)
#
# Native modules (better-sqlite3, sodium-native) are compiled in the builder
# stage and copied directly to the runtime stage, so no build toolchain is
# needed at runtime.

# --------------------------------------------------------------------------- #
# Stage 1: builder
# Full toolchain: npm ci (compiles native addons), tsc build, prune dev deps.
# --------------------------------------------------------------------------- #
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Build toolchain for native addons (better-sqlite3, sodium-native).
RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 \
	make \
	g++ \
	&& rm -rf /var/lib/apt/lists/*

# Install ALL dependencies (needed to compile native addons and run tsc).
COPY package*.json ./
RUN npm ci

# Compile TypeScript source → dist/.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from node_modules in-place so we can copy a lean set
# of production modules to the runtime stage.
RUN npm prune --omit=dev

# --------------------------------------------------------------------------- #
# Stage 2: runtime
# Minimal image: no build tools, pre-compiled native addons from builder.
# --------------------------------------------------------------------------- #
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Copy pre-built production node_modules (includes compiled native addons).
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled JS output.
COPY --from=builder /app/dist ./dist

# Copy package.json so Node can resolve package metadata.
COPY package.json ./

ENV NODE_ENV=production
ENV COMAPEO_DATA_DIR=/data

# Data volume: CoMapeo state, SQLite databases, root key, readiness marker.
VOLUME ["/data"]

# Health check: passes once the daemon writes /data/.ready after full startup.
# --start-period gives the daemon time to boot before failures are counted.
HEALTHCHECK \
	--interval=10s \
	--timeout=5s \
	--start-period=30s \
	--retries=3 \
	CMD test -f /data/.ready

CMD ["node", "dist/daemon/index.js"]
