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

Copy the example environment file:

```bash
cp .env.example .env
```

## Docker Compose

Start the local app and database:

```bash
docker compose up
```

The app container installs dependencies, generates the Prisma client, applies committed database migrations, seeds the development user/workspace membership, and starts the Next.js development server.
Docker Compose starts Next.js with webpack for local development because the default Turbopack dev server can hang while compiling inside the bind-mounted container workspace.

The app should be available at `http://localhost:3000`.

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
