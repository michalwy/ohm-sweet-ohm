---
title: Deploying OSO on Your Own Server
---

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
5. Pull the image and start the app and background worker.

When it finishes, open the app at the URL you configured and create your account on the
sign-up screen.

All configuration lives in the `.env` file in the install directory. You never edit the
compose file. To change a setting later, edit `.env` and run the update command below.

## Who Can Create an Account

New-account registration is **closed by default**. On a new instance with no accounts, the sign-up
screen lets you create the first account; once any account exists, sign-up is refused (the sign-up
screen says so, the sign-in screen no longer offers it, and the sign-up API refuses too).

To let anyone who can reach the instance create an account, add `OSO_AUTH_ALLOW_SIGN_UP=1` to `.env`
and apply it as described below. This value is only the default: the instance administrator (the
first account) can open or close registration at runtime in the
[instance administration](admin.md) panel, and that setting then wins until it is changed again.

An instance that already has accounts and is updated to this version starts with registration closed.
Existing accounts, sessions and API tokens keep working.

## Everyday Management

Run these from the install directory. They read the compose file list from `.env`
(the `COMPOSE_FILE` key), so no `-f` flags are needed:

```bash
# View logs
docker compose logs -f

# Apply configuration changes / pull the latest image
docker compose pull && docker compose up -d --remove-orphans

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

Because migrations run on start, an update applies any new database changes on its own. To
hear about new releases, watch the repository's releases on GitHub (*Watch → Custom →
Releases*).

**There are no automatic updates.** Earlier installs could switch on a
[Watchtower](https://containrrr.dev/watchtower/) container that pulled new images on its own.
Watchtower is no longer maintained, so it was removed. If your `.env` still says
`COMPOSE_PROFILES=autoupdate`, the stack keeps starting normally — the setting no longer
starts anything, and you can clear it. The first `docker compose up -d --remove-orphans` (or a
re-run of the installer, which also clears the setting) removes the old Watchtower container;
without `--remove-orphans`, Compose only warns that it found it.

## Rolling Back

Pin a specific image instead of `latest` by setting `OSO_IMAGE_TAG` in `.env` to a specific
build — either a version tag (e.g. `1.4.0`) or a commit tag (e.g. `sha-a1b2c3d`) — then run
`up -d`. The pin holds until you change it.

## HTTPS with a Reverse Proxy

The app itself serves plain HTTP on `OSO_HTTP_PORT`. To reach it over HTTPS on your own
domain, put a **reverse proxy** in front of it: the proxy holds the TLS certificate, answers
on ports 80 and 443, and forwards each request to the app's port. OSO ships no proxy of its
own — you install and run the one you prefer, and the OSO stack stays as it is.

### What OSO needs from you

1. **`BETTER_AUTH_URL` is the public HTTPS URL**, exactly as people type it in the browser,
   with no trailing slash — for example `BETTER_AUTH_URL="https://oso.example.com"`.
   Sign-in checks that each request comes from this address, and when the URL starts with
   `https://` the session cookies are marked secure, so the browser only sends them over
   HTTPS.
2. **The proxy forwards to the app's host port** — `http://127.0.0.1:3000` with the default
   `OSO_HTTP_PORT` — and passes the original `Host` header through. Caddy, Traefik, and the
   nginx example below all do this.
3. **Everyone uses the HTTPS address.** Once `BETTER_AUTH_URL` is `https://…`, signing in
   through the old `http://your-server:3000` address no longer works. That is expected: use
   the proxy's address, also on your home network.

The claude.ai custom connector ([API and MCP](api-and-mcp.md#claudeai-custom-connector)) relies on
the same setting: OSO builds its sign-in addresses for connected apps from `BETTER_AUTH_URL`, and
claude.ai reaches them from the internet — `/api/mcp`, `/.well-known/…`, `/oauth/authorize` and
`/api/oauth/…` must all be forwarded to the app, as a proxy forwarding everything does.

After changing `BETTER_AUTH_URL`, apply it:

```bash
docker compose up -d
```

### Keep the app port off the network (recommended)

By default the app's port is published on every network interface of the server, so the app
can still be reached over plain HTTP, around the proxy. When the proxy runs on the same server
(outside Docker), publish the port on the loopback address only, by setting this in `.env`:

```bash
OSO_HTTP_PORT=127.0.0.1:3000
```

Then run `docker compose up -d`. The proxy still reaches `127.0.0.1:3000`; nothing else can.

### Recommended: Caddy

[Caddy](https://caddyserver.com/) gets and renews a free
[Let's Encrypt](https://letsencrypt.org/) certificate on its own, with no extra setup. It
needs:

- a **domain name** whose DNS record points at your server's public IP address, and
- **ports 80 and 443** reachable from the internet (forwarded from your router to the
  server, for a server at home) — Let's Encrypt connects to them to check that you control
  the domain.

Install Caddy on the server with your system's package manager — on Debian, Ubuntu, and
Raspberry Pi OS follow [Caddy's install guide](https://caddyserver.com/docs/install) — then
replace the contents of `/etc/caddy/Caddyfile` with:

```text
oso.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Use your own domain and, if you changed `OSO_HTTP_PORT`, its port. Reload Caddy:

```bash
sudo systemctl reload caddy
```

Open `https://oso.example.com`. The first request can take a few seconds while the
certificate is issued; `journalctl -u caddy` shows what Caddy is doing if it fails.

**Only on your home network, without a public domain?** Let's Encrypt cannot reach a server
that is not on the internet. Caddy can instead issue a certificate from its own local
authority — write `tls internal` inside the site block — but each browser then warns about
the certificate until you install Caddy's root certificate on that computer
(`caddy trust` explains how).

### Alternatives

Any reverse proxy works as long as it meets the three points under
[What OSO needs from you](#what-oso-needs-from-you).

- **nginx** does not get certificates by itself; pair it with
  [Certbot](https://certbot.eff.org/), which obtains the Let's Encrypt certificate and
  edits the nginx configuration for you. The site block forwards to the app like this:

  ```nginx
  server {
      server_name oso.example.com;

      location / {
          proxy_pass http://127.0.0.1:3000;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # listen 443 ssl; and the certificate lines are added by Certbot.
  }
  ```

- **Traefik**, or a proxy you already run **in a Docker container**: a proxy inside Docker
  cannot reach `127.0.0.1` on the host. Either forward to the host's address (on Linux,
  `host.docker.internal` works when the proxy container is started with
  `--add-host=host.docker.internal:host-gateway`) and leave `OSO_HTTP_PORT` on all
  interfaces, or attach the proxy to the same shared Docker network as OSO (see
  [Connecting to a Database on a Shared Docker Network](#connecting-to-a-database-on-a-shared-docker-network))
  and forward to the app container by its name on port `3000` — `docker compose ps` in the
  install directory shows the name.

### The API and MCP server

The [REST API and MCP server](api-and-mcp.md) are part of the app: `/api/v1` and `/api/mcp` are
paths on the same address, served by the same container. The reverse proxy above already forwards
them, and **nothing extra is published** — no other port, container or proxy rule. Both refuse any
request without a valid personal API token, so a signed-in browser alone cannot call them.

Two things are worth knowing:

- An MCP client on another computer reaches OSO at the same HTTPS address you use in the browser.
  A **claude.ai custom connector** is called from Claude's servers, so it works only if that
  address is reachable from the internet; an instance kept to your home network can still be used
  from Claude Code or Claude Desktop on that network.
- Requests to `/api/mcp` are short, ordinary `POST` requests answered with JSON (no long-lived
  streams), so the proxy needs no special timeout or buffering settings for them.

## Backups

**Database backups** are your responsibility, since you own the database. Back it up with
your usual PostgreSQL tooling.
