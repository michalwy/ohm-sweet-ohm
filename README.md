# OhmSweetOhm

OhmSweetOhm, or OSO, is a web application for managing a home electronics workshop. It is intended to start small and grow into a larger product over time.

The application language is English by default, with the project structured so additional languages can be added later.

## Start Here (Non-Technical User)

If you want to use OSO (not develop it), start with the user documentation:

- **[OSO User Guide](docs/user-guide/index.md)** <- first stop for everyday usage

The user guide includes a simple local run section for regular users and a walkthrough of current app features.

## Project Status

This repository contains a working OSO application slice with authentication, workspace routing, workspace-scoped access control, parts, manufacturer organizations, part categories, attributes, units, storage locations, stock movements, and supplier integration settings (DigiKey and TME).

For location lifecycle safety, archived locations cannot be used in new stock movements, and locations with non-zero stock cannot be archived until stock is moved or adjusted to zero.

Design revisions carry a bill of materials of attribute-based line-item specs that resolve against live inventory (see ADR 0020). Builds turn a design revision into a production run for a target quantity, advancing through created → allocated → started → in_progress → completed/cancelled with allocated/reserved/available stock tracking and automatic output-part receipt (see ADR 0021). A single BOM line can be split across multiple matching parts, each with its own quantity and source location, and distributed across designators for the assembly list (see ADR 0023). Shortage analysis, import pipelines, and broader project behavior remain intentionally undefined until product decisions are made.

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

## Self-Hosting / Deployment

To run OSO on your own always-on server (for example a Raspberry Pi) using a prebuilt
image and your own PostgreSQL database, run the installer on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/michalwy/ohm-sweet-ohm/main/scripts/install.sh | bash
```

The script downloads `docker-compose.prod.yml`, interviews you for configuration, writes a
local `.env`, and starts the app against your external database. See the
[Deployment guide](docs/user-guide/deployment.md) and
[ADR 0022](docs/decisions/0022-self-hosted-deployment.md) for details.

`docker-compose.yml` is for **local use** (builds the image and runs its own database).
`docker-compose.prod.yml` is for **real servers** (pulls a prebuilt image from GHCR and
uses an external database). Multi-arch images (amd64 + arm64) are published to GHCR by CI
for each tagged release (`v*`); `latest` tracks the newest release.

## Repository Guide

- [AGENTS.md](AGENTS.md): instructions for future coding agents
- [docs/user-guide/](docs/user-guide/index.md): end-user guide for current functionality
- [docs/product/brief.md](docs/product/brief.md): product direction and open questions
- [docs/architecture/overview.md](docs/architecture/overview.md): architecture skeleton
- [docs/development/local-setup.md](docs/development/local-setup.md): local setup notes
- [docs/decisions](docs/decisions): architecture decision records
