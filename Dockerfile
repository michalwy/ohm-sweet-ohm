FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
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
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
CMD ["pnpm", "start"]
