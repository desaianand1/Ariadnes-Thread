ARG PNPM_VERSION=10.28.2

# --- deps stage (all deps including native compilation) ---
FROM node:24-alpine AS deps
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# --- builder stage ---
FROM node:24-alpine AS builder
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV ADAPTER=node
RUN pnpm build

# --- prod-deps stage (prune dev deps, let onlyBuiltDependencies handle native addons) ---
FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# --- runner stage ---
FROM node:24-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S sveltekit && \
    adduser -u 1001 -S sveltekit -G sveltekit && \
    apk add --no-cache curl && \
    mkdir -p /app/data && chown sveltekit:sveltekit /app/data

COPY --from=builder --chown=sveltekit:sveltekit /app/build ./build
COPY --from=builder --chown=sveltekit:sveltekit /app/package.json ./
COPY --from=prod-deps --chown=sveltekit:sveltekit /app/node_modules ./node_modules

USER sveltekit

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV ADAPTER=node

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

LABEL org.opencontainers.image.source="https://github.com/desaianand1/Ariadnes-Thread"
LABEL org.opencontainers.image.description="Ariadne's Thread — Minecraft Mod Compatibility Checker"

CMD ["node", "build"]
