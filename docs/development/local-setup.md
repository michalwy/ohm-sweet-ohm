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

Start the app:

```bash
pnpm dev
```
