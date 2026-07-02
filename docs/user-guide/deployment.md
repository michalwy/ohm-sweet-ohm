# Deploying OSO on Your Own Server

This page is for running OhmSweetOhm (OSO) on an always-on server you control — for
example a Raspberry Pi or a small home/VPS box — as opposed to the
[local-use setup](index.md#run-oso-on-your-computer-local-use) on your own computer.

The deployment runs a **prebuilt image** from GitHub Container Registry with Docker
Compose, and connects to a **PostgreSQL database that you provide and own**.

## What You Need

- A server with **Docker Engine** and the **Docker Compose v2** plugin installed.
- A **PostgreSQL database** that already exists and is reachable from the server. OSO does
  not create, run, or back up this database — that is your responsibility. Postgres 16+ is
  recommended (the project develops against Postgres 18).
- The public URL or address where the app will be reachable.

> OSO applies its own schema migrations automatically on start. You only need to provide an
> empty (or existing OSO) database and a connection string.

## Install

Run the installer on the server and follow the prompts:

```bash
curl -fsSL https://raw.githubusercontent.com/michalwy/ohm-sweet-ohm/main/scripts/install.sh | bash
```

The script will:

1. Check that Docker and Docker Compose are available.
2. Ask for an install directory (default `./ohm-sweet-ohm`).
3. Download `docker-compose.prod.yml` and an environment template.
4. Ask you a few questions and write a local `.env`:
   - **DATABASE_URL** — your external PostgreSQL connection string. If Postgres runs on the
     same host but outside Docker, use `host.docker.internal` as the host name.
   - **Public app URL** (`BETTER_AUTH_URL`).
   - **Host port** to expose (default `3000`).
   - **Auth secret** — it can generate a strong `BETTER_AUTH_SECRET` for you.
   - **Automatic updates** — optional (see below).
5. Pull the image and start the app and background worker.

When it finishes, open the app at the URL you configured and create your account on the
sign-up screen.

All configuration lives in the `.env` file in the install directory. You never edit the
compose file. To change a setting later, edit `.env` and run the update command below.

## Everyday Management

Run these from the install directory. They read the compose file list from `.env`
(the `COMPOSE_FILE` key), so no `-f` flags are needed:

```bash
# View logs
docker compose logs -f

# Apply configuration changes / pull the latest image
docker compose pull && docker compose up -d

# Stop everything
docker compose down
```

Re-running the installer is safe and doubles as a reconfigure step: it re-runs the interview
with your current `.env` values pre-filled as defaults, so you can change individual settings
(or press Enter/OK to keep each one). Only the keys you change are written — any other keys in
`.env` are preserved — and then it refreshes the compose files and restarts the stack.

## Connecting to a Database on a Shared Docker Network

By default the app reaches PostgreSQL over a network address — either a port published on
the host, or `host.docker.internal` for a database running on the host outside Docker.

If you prefer **not to publish any database port** and instead run PostgreSQL as a
container on a dedicated Docker network, the deployment can join that network directly:

1. Create the network and attach your PostgreSQL container to it, for example:

   ```bash
   docker network create oso
   docker network connect oso <your-postgres-container>
   ```

2. When the installer asks *"Is PostgreSQL on a shared Docker network?"*, answer **yes**
   and give the network name (default `oso`). It offers to create the network for you if it
   does not exist yet.
3. Set `DATABASE_URL` to use the PostgreSQL **container name** as the host and its internal
   port, e.g. `postgresql://oso:password@oso-postgres:5432/ohm_sweet_ohm?schema=public`.

Under the hood this enables an optional overlay (`docker-compose.network.yml`) by setting
`COMPOSE_FILE=docker-compose.prod.yml:docker-compose.network.yml` and `OSO_DB_NETWORK` in
`.env`. To toggle it on an existing install, edit those two keys in `.env` and run
`docker compose up -d`. No database port is exposed to the host in this mode.

## Updates

New images are published only when a new **release** is tagged, so `latest` always points at
the newest release (never at an in-progress `main` commit). The deployment tracks `latest`, so
you update on your own schedule with the `pull && up -d` command above.

The running version is shown in the app's left sidebar (e.g. `OSO v1.4.0`), so you can see at a
glance which release is deployed.

**Automatic updates (optional).** If you answered yes to automatic updates, a
[Watchtower](https://containrrr.dev/watchtower/) container runs alongside the app, checks
GitHub for a newer image periodically, and restarts the app and worker when one appears.
Because migrations run on start, updates apply any new database changes automatically. You
can toggle this later by setting `COMPOSE_PROFILES=autoupdate` (on) or empty (off) in `.env`
and re-running `up -d`. Tune the check frequency with `OSO_UPDATE_INTERVAL` (seconds).

## Rolling Back

Pin a specific image instead of `latest` by setting `OSO_IMAGE_TAG` in `.env` to a specific
build — either a version tag (e.g. `1.4.0`) or a commit tag (e.g. `sha-a1b2c3d`) — then run
`up -d`. Disable automatic updates while pinned so Watchtower does not move you off it.

## Backups and HTTPS

- **Database backups** are your responsibility, since you own the database. Back it up with
  your usual PostgreSQL tooling.
- **HTTPS / custom domain**: put a reverse proxy (Caddy, Traefik, or nginx) in front of the
  app and point `BETTER_AUTH_URL` at the public HTTPS URL. Reverse-proxy setup is outside
  the scope of this guide.
