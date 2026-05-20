# OhmSweetOhm

OhmSweetOhm, or OSO, is a web application for managing a home electronics workshop. It is intended to start small and grow into a larger product over time.

The application language is English by default, with the project structured so additional languages can be added later.

## Project Status

This repository currently contains only the application skeleton. Domain features, data models, workflows, and UI screens will be designed in later iterations.

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

This runs the built Next.js app with `next start`, applies committed migrations, and seeds the local owner account.

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
- [docs/product/brief.md](docs/product/brief.md): product direction and open questions
- [docs/architecture/overview.md](docs/architecture/overview.md): architecture skeleton
- [docs/development/local-setup.md](docs/development/local-setup.md): local setup notes
- [docs/decisions](docs/decisions): architecture decision records
