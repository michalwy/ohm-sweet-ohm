# ADR 0001: Initial Application Stack

## Status

Accepted for initial skeleton.

## Context

OhmSweetOhm starts as a simple web app but is expected to grow into a larger project. It must be easy to run locally while keeping a path open for cloud deployment.

## Decision

Use:

- Next.js App Router with TypeScript for the web application.
- Tailwind CSS for styling.
- PostgreSQL for persistence.
- Prisma for database access and migrations.
- Docker Compose for local development.
- pnpm for package management.

## Rationale

Next.js provides a stable full-stack web foundation without forcing an early split between frontend and backend services. TypeScript helps future agents maintain larger code safely. PostgreSQL and Prisma are mature defaults for structured application data. Docker Compose keeps the complete local stack reproducible.

## Consequences

- The project can begin as one deployable web app and split services later if needed.
- Database schema work should be handled as explicit product design.
- Future agents should document major stack changes in additional ADRs.

