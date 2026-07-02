FROM node:24.18.0-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
# pnpm-workspace.yaml carries onlyBuiltDependencies/allowBuilds; without it pnpm 11
# aborts install with ERR_PNPM_IGNORED_BUILDS for prisma/esbuild/sharp/etc.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install

FROM base AS dev
WORKDIR /workspace

FROM deps AS build
COPY . .
RUN BETTER_AUTH_URL=http://localhost:3000 \
  BETTER_AUTH_SECRET=ohm-sweet-ohm-local-build-auth-secret \
  pnpm prisma:generate \
  && BETTER_AUTH_URL=http://localhost:3000 \
  BETTER_AUTH_SECRET=ohm-sweet-ohm-local-build-auth-secret \
  pnpm build

FROM base AS runner
ENV NODE_ENV=production
# node_modules is baked into this image; do not let pnpm's verify-deps-before-run
# check auto-run `pnpm install` when starting scripts (pnpm start / migrate). That
# install would otherwise fail with ERR_PNPM_IGNORED_BUILDS, since the build-scripts
# allowlist lives in pnpm-workspace.yaml. Disable the check and ship the workspace
# file as a safety net.
ENV npm_config_verify_deps_before_run=false
# Release version, injected by CI from the git tag; shown in the app UI.
ARG OSO_VERSION=dev
ENV OSO_VERSION=$OSO_VERSION
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
# The worker runs via tsx with scripts/tsconfig.json, which extends the root
# tsconfig.json, so the root config must be present at runtime too.
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
CMD ["pnpm", "start"]
