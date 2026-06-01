# OhmSweetOhm

OhmSweetOhm, or OSO, is a web application for managing a home electronics workshop. It is intended to start small and grow into a larger product over time.

The application language is English by default, with the project structured so additional languages can be added later.

## Start Here (Non-Technical User)

If you want to use OSO (not develop it), start with the user documentation:

- **[OSO User Guide](docs/user-guide.md)** <- first stop for everyday usage

The user guide includes a simple local run section for regular users and a walkthrough of current app features.

## Project Status

This repository contains a working OSO application slice with authentication, workspace routing, workspace-scoped access control, parts, manufacturer organizations, part categories, attributes, units, storage locations, stock movements, and supplier integration settings (DigiKey and TME).

Purchase-order workflows, pricing policy, lifecycle states, import pipelines, and BOM/project behavior are still intentionally undefined until product decisions are made.

## Tech Direction

- Web app: Next.js App Router with TypeScript
- Styling: Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma
- Local stack: Docker Compose
- Package manager: pnpm

These choices are documented in [docs/decisions/0001-initial-stack.md](docs/decisions/0001-initial-stack.md).

## Local Development

Install dependencies:

```bash
corepack enable
pnpm install
```

Start the local-use application and database:

```bash
docker compose up
```

This runs the built Next.js app with `next start` and applies committed migrations.
The repository already includes a default local `.env`, so no extra configuration is required for first run.

Then open `http://localhost:3000`, create your own account on sign-up, and sign in.

Start the development app with hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Run the app without Docker:

```bash
pnpm dev
```

The default app URL is:

```text
http://localhost:3000
```

## Repository Guide

- [AGENTS.md](AGENTS.md): instructions for future coding agents
- [docs/user-guide.md](docs/user-guide.md): end-user guide for current functionality
- [docs/product/brief.md](docs/product/brief.md): product direction and open questions
- [docs/architecture/overview.md](docs/architecture/overview.md): architecture skeleton
- [docs/development/local-setup.md](docs/development/local-setup.md): local setup notes
- [docs/decisions](docs/decisions): architecture decision records
