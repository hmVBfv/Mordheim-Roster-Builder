# syntax=docker/dockerfile:1
#
# The Mordheim Campaign server: Node 24 LTS, the server bundle, the app's
# campaign build. Built by CI for linux/arm64 (the Pi) and linux/amd64 (the
# desktop in an emergency, docs/operations.md) and pushed to
#   ghcr.io/hmvbfv/mordheim-roster:<sha>
# Everything that runs a command runs on the build machine's own platform;
# the image for the target platform only copies files. That works because
# nothing is compiled: better-sqlite3 ships a prebuilt binary per platform,
# and the one for the target is picked below.
#
#   docker build --build-arg ROSTER_VERSION=$(git rev-parse HEAD) -t roster .
#   docker build --target drill-broken -t roster:drill-broken .   (rollback drill)

ARG NODE_IMAGE=node:24-trixie

# 1. JavaScript: the app's campaign build and the server bundle
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /src
COPY .npmrc package.json package-lock.json tsconfig.base.json ./
COPY core/package.json core/
COPY app/package.json app/
COPY server/package.json server/
RUN npm ci --no-audit --no-fund
COPY data data
COPY core core
COPY app app
COPY server server
ARG ROSTER_VERSION=dev
RUN APP_VERSION=${ROSTER_VERSION} npm run build:campaign -w app \
 && npm run build -w server

# 2. The server's packages, without development ones; only the target's binary
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY .npmrc package.json package-lock.json ./
COPY core/package.json core/
COPY app/package.json app/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server --no-audit --no-fund
ARG TARGETARCH
RUN set -eu; \
    case "${TARGETARCH}" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) echo "unsupported ${TARGETARCH}" >&2; exit 1 ;; esac; \
    cd node_modules/better-sqlite3; \
    test -f "prebuilds/linux-${arch}.node"; \
    find prebuilds -type f ! -name "linux-${arch}.node" -delete; \
    rm -rf deps src binding.gyp; \
    cd /app; rm -rf node_modules/@types node_modules/@mordheim

# 3. What runs on the Pi
FROM ${NODE_IMAGE}-slim AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/data \
    UPLOAD_DIR=/uploads \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY server/package.json server/
COPY server/migrations server/migrations
COPY --from=build /src/server/dist server/dist
COPY --from=build /src/app/dist/campaign app/dist/campaign
COPY --chmod=755 ops/image/roster-cli /usr/local/bin/roster-cli
ARG ROSTER_VERSION=dev
ENV ROSTER_VERSION=${ROSTER_VERSION}
LABEL org.opencontainers.image.source="https://github.com/hmVBfv/Mordheim-Roster-Builder" \
      org.opencontainers.image.description="Mordheim Campaign server" \
      org.opencontainers.image.revision="${ROSTER_VERSION}"
# the official image's user "node" is 1000:1000, like robin on the Pi
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "server/dist/healthcheck.js"]
CMD ["node", "server/dist/server.js"]

# For the rollback drill (docs/operations.md, Stufe 3): the same image, but it
# exits at once. roster-deploy must notice and go back.
FROM runtime AS drill-broken
CMD ["node", "-e", "console.error('deliberately broken image for the rollback drill'); process.exit(1)"]

# The default target
FROM runtime
