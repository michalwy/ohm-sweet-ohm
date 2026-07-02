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

Run these from the install directory:

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Apply configuration changes / pull the latest image
docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d

# Stop everything
docker compose -f docker-compose.prod.yml down
```

Re-running the installer is safe: it never overwrites an existing `.env`; it only refreshes
the compose file and restarts the stack.

## Updates

By default the deployment tracks the rolling `latest` image. You update on your own schedule
with the `pull && up -d` command above.

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
