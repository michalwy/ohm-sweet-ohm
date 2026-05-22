# ADR 0003: End-to-End Test Environment

## Status

Accepted.

## Context

OhmSweetOhm needs UI changes to be verified against a real database. Dynamic tables, dialogs, and forms are hard to validate reliably when the application runs without seeded data.

The development database may contain user data and should not be reset by automated tests.

## Decision

Use Playwright for browser end-to-end tests.

Run e2e tests against an isolated PostgreSQL database from `docker-compose.e2e.yml`. The e2e database uses a separate port and temporary storage, and it is reset and seeded before the Playwright suite runs.

## Rationale

Playwright provides reliable browser automation for desktop browser checks. OSO is a desktop-only application, so e2e coverage should not include mobile viewport projects or mobile-specific assertions. A dedicated e2e database lets tests exercise real Prisma queries and mutations without touching local development data.

Resetting and seeding the e2e database before the test suite keeps test runs predictable.

## Consequences

- Use `pnpm test:e2e` before considering interactive UI work complete.
- Keep e2e browser projects desktop-only.
- Keep e2e seed data minimal and focused on user-visible workflows.
- Do not point e2e tests at the normal development database.
- Add new e2e coverage when adding or changing dynamic tables, dialogs, forms, or navigation flows.
