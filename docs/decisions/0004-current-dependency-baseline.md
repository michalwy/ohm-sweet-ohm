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
- TypeScript 6, until `typescript-eslint` and Next.js can load TypeScript 7 (see below).

Use Prisma's `prisma-client` generator with an explicit output under `src/generated/prisma`, and import Prisma Client from that generated module.

ESLint 10 (the owner, 2026-11-24, #266), although `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import` (pulled in by `eslint-config-next`) do not yet declare ESLint 10 in their peer ranges. The one incompatibility found — `eslint-plugin-react`'s `version: "detect"` calls `context.getFilename()`, which ESLint 10 removed — is avoided by setting `settings.react.version` from the installed `react` package in `eslint.config.mjs`. The resolved rule set is the same as under ESLint 9. Once `eslint-plugin-react` supports ESLint 10, that setting can go.

TypeScript 7.0 stays out for now (#266, 2026-11-24): its package ships the native compiler with no JavaScript compiler API, so `@typescript-eslint/typescript-estree` (peer range `<6.1.0`; TypeScript 7 support only from 7.1 through `@typescript/native`) crashes `pnpm lint`, and `next build` reports TypeScript as not installed. `tsc --noEmit` itself passes on 7.0. Upgrade once both `typescript-eslint` and Next.js support it.

## Consequences

- `pnpm typecheck` regenerates the Prisma client and runs `next typegen` before TypeScript checking.
- Prisma datasource URLs are configured in `prisma.config.ts`, not `prisma/schema.prisma`.
- PostgreSQL access goes through `@prisma/adapter-pg`.
- Generated Prisma client files under `src/generated/prisma` are ignored and should be regenerated locally.
- Future dependency upgrades should run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e`.
