# Running and deploying

Keep the project runnable locally and deployable to cloud infrastructure. Docker Compose is for local
use and development, never the only deployment path. `docs/development/local-setup.md` has the
commands; this file has the rules.

## Local

- `docker compose up` is the user's normal local-use stack: it runs the built app with `next start`
  against the persistent development database, without creating a seeded development user. This is
  how the user exercises changes (see `collaboration.md` §8).
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` is containerized development
  with hot reload.

## Self-hosted deployment (ADR 0022)

- CI's `publish-image` job pushes a multi-arch image to `ghcr.io/michalwy/ohm-sweet-ohm` **only for
  release tags (`v*`)** — never on every `main` commit. A release is cut by pushing a version tag; see
  `release-versioning.md`.
- `docker-compose.prod.yml` runs that prebuilt image against an operator-provided external database,
  with all configuration in a git-ignored `.env` (template `.env.prod.example`).
- `scripts/install.sh` is the curl-able installer: interactive whiptail dialogs when available, with a
  pure-bash arrow-key fallback so it needs no extra dependencies.
- Deployment management commands run as bare `docker compose ...` from the install directory, reading
  the file list from the `COMPOSE_FILE` key in `.env`.
- Optional auto-update uses Watchtower under the `autoupdate` compose profile; deployments track the
  image's `latest` tag.
- The optional overlay `docker-compose.network.yml` (appended to `COMPOSE_FILE`, network named by
  `OSO_DB_NETWORK`) attaches the app and worker to a pre-existing external Docker network for a
  port-less database.
- The release version is baked into the image through the `OSO_VERSION` build argument and shown in
  the workspace sidebar through `getAppVersion()` in `src/lib/version.ts`.

**Keep these in sync** when changing runtime environment variables, the worker command,
migrations-on-start behavior, or the Dockerfile `runner` target: the prod compose file, the env
template, the installer, ADR 0022 and this file.
