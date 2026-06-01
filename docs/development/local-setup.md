# Local Setup

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer
- Docker and Docker Compose

If pnpm is not available yet, enable it through Corepack:

```bash
corepack enable
```

## Environment

The repository includes a default `.env` file for local use.

If you need custom values, copy from `.env.example` and adjust:

```bash
cp .env.example .env
```

## Local-use Docker Compose

Start the local-use app and database:

```bash
docker compose up
```

The app container uses the `runner` Docker image target, applies committed database migrations, and starts the built Next.js app with `next start`.
Database credentials come from `.env` if provided, otherwise compose defaults are used.

The app should be available at `http://localhost:3000`.
Create your own account on the sign-up screen, then sign in.

## Docker Compose Development

Start the development app and database with hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The development override mounts the repository into the app container, installs dependencies in a named volume, generates the Prisma client, applies committed database migrations, seeds the local owner account, and starts the Next.js development server with webpack.
Use webpack mode for containerized development because the default Turbopack dev server can hang while compiling inside the bind-mounted container workspace.

## Native Development

Install dependencies:

```bash
corepack enable
pnpm install
```

Start only the database:

```bash
docker compose up db
```

Apply migrations and generate the Prisma client:

```bash
pnpm prisma:migrate
pnpm prisma:generate
pnpm db:seed:dev
```

Start the app:

```bash
pnpm dev
```
