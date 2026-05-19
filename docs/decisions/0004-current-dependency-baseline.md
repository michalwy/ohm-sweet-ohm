# ADR 0004: Current Dependency Baseline

## Status

Accepted.

## Context

The initial scaffold used older major versions of the core application libraries. This created unnecessary upgrade risk for future work, especially before adding richer UI features.

The project also moved to Prisma 7, which changes datasource configuration and client generation compared with Prisma 5.

## Decision

Keep the active application stack on current major versions:

- Next.js 16 with React 19.
- Prisma 7 with `prisma.config.ts`.
- Tailwind CSS 4 through `@tailwindcss/postcss`.
- Playwright 1.60 for e2e verification.
- TypeScript 6.

Use Prisma's `prisma-client` generator with an explicit output under `src/generated/prisma`, and import Prisma Client from that generated module.

Keep ESLint on the latest supported 9.x release until the Next.js ESLint plugin stack declares compatibility with ESLint 10.

## Consequences

- `pnpm typecheck` runs `next typegen` before TypeScript checking.
- Prisma datasource URLs are configured in `prisma.config.ts`, not `prisma/schema.prisma`.
- PostgreSQL access goes through `@prisma/adapter-pg`.
- Generated Prisma client files under `src/generated/prisma` are part of the application source baseline.
- Future dependency upgrades should run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e`.
