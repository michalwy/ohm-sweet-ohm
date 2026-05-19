# Architecture Overview

## Current State

This repository contains a minimal Next.js skeleton with TypeScript, Tailwind CSS, Prisma, and PostgreSQL configuration.

## Intended Shape

- `src/app`: Next.js App Router entry points and route-level UI.
- `src/lib`: shared application utilities.
- `src/server`: server-side application and domain code as it emerges.
- `prisma`: database schema and migrations.
- `docs`: product, architecture, development, and decision records.

## Boundaries To Preserve

- UI components should not accumulate domain rules.
- Database schema should follow explicit product decisions.
- User-facing strings should remain easy to localize.
- Local development and cloud deployment should both remain viable.

