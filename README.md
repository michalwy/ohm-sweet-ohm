# OhmSweetOhm

OhmSweetOhm (OSO) is a self-hosted web app for managing a home electronics workshop — parts, inventory, builds, and purchasing in one place.

## Start Here (Non-Technical User)

If you want to use OSO (not develop it), start with the user documentation:

- **[OSO User Guide](docs/user-guide/index.md)** — first stop for everyday usage

The user guide includes a simple local run section and a walkthrough of all current features.

## What OSO Can Do

- **Parts catalogue** — track electronic parts by manufacturer and catalog number, with custom categories, attributes, and units
- **Inventory** — manage stock across named storage locations; record receipts, issues, transfers, and adjustments
- **Designs & BOMs** — create designs with revision history; each revision carries a bill of materials that resolves against live inventory
- **Builds** — run a design revision for a target quantity; allocate parts, reserve stock on start, consume per assembled unit, and automatically receive the output part on completion; plan against incoming (on-order or in-production) stock when on-hand stock is short
- **Purchasing** — collect parts to buy on shopping lists, convert them to formal per-supplier purchase orders, and receive deliveries to update inventory automatically
- **Supplier integrations** — look up parts and pricing directly from DigiKey and TME when adding items to a purchase order
- **Workspaces** — all data is workspace-scoped; create multiple isolated workshop contexts under one account

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
