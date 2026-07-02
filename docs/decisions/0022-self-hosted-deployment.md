# ADR 0022 — Self-Hosted Deployment via Prebuilt Images

**Status:** Accepted
**Date:** 2026-07-02

## Context

Until now OSO only shipped Docker Compose stacks aimed at **local use and development**
(`docker-compose.yml`, `docker-compose.dev.yml`), both of which build the image on the
machine and bundle their own PostgreSQL. AGENTS.md explicitly keeps Docker Compose
"suitable for local use, not the only deployment path" and requires the project stay
"deployable to infrastructure", but no real deployment path existed.

We want a first-class way for an operator to run OSO on a small always-on server — a
Raspberry Pi is the reference target. That target can't reasonably compile a Next.js
build, and a self-hoster typically already runs (or wants to own) their own database.

## Decision

Introduce a **self-hosting deployment path** built from boring, well-supported tooling:

1. **Prebuilt multi-arch images in GHCR, on release only.** CI builds and pushes
   `ghcr.io/michalwy/ohm-sweet-ohm` for `linux/amd64` and `linux/arm64` (buildx + QEMU)
   via a `publish-image` job in `.github/workflows/ci.yml`. The job `needs` the
   static/unit/integration jobs and runs **only for release tags** (`v*`), so a build is
   cut deliberately by pushing a version tag — not on every `main` commit (which would
   waste CI on routine/Renovate commits and churn the auto-update image). Tags:
   `{{version}}` and `{{major}}.{{minor}}` from the git tag, `sha-<short>` for rollback
   traceability, and `latest` pointing at the newest release (`flavor: latest=true`), which
   is what deployments and Watchtower track. The release version is passed into the build as
   the `OSO_VERSION` build arg so the app can display it. The image reuses the existing
   `runner` Dockerfile target — the app and the pg-boss worker share one image, differing
   only by command.

2. **Public image.** The GHCR package is public, so the target server and Watchtower pull
   without credentials. Tradeoff: the container image is world-readable. This is acceptable
   because it contains no secrets (all secrets are injected at runtime via `.env`) and it
   keeps install/auto-update credential-free. Switching to a private package later would
   only require a `docker login` step in the installer and Watchtower.

3. **External database.** The deployment runs no `db` service. The operator supplies a
   reachable PostgreSQL via `DATABASE_URL`. OSO does not manage, migrate the server, or
   back up that database beyond applying its own schema migrations
   (`prisma migrate deploy`, owned by the `app` container at startup, as in the local stack).

4. **Config only via `.env`.** A committed, never-edited `docker-compose.prod.yml` reads
   every tunable and secret from a sibling `.env` (git-ignored). Operators never edit the
   compose file. `.env.prod.example` documents the keys. Management commands run as a bare
   `docker compose ...` from the install directory; the file list comes from the
   `COMPOSE_FILE` key in `.env`, so optional overlays can be toggled without changing any
   command or editing compose.

5. **One-shot installer.** `scripts/install.sh` is curl-able, checks prerequisites,
   downloads the compose file + env template, interviews the operator, generates
   `BETTER_AUTH_SECRET`, writes `.env`, and brings the stack up. It never overwrites an
   existing `.env`, so re-running only refreshes the deployment definition.

6. **Optional auto-update via Watchtower.** A `watchtower` service gated behind the
   `autoupdate` compose profile polls GHCR and restarts the label-enabled app/worker
   containers on new images. Opt-in: the installer sets `COMPOSE_PROFILES=autoupdate`.
   Because the app container runs `prisma migrate deploy` on start, auto-updates apply
   new migrations automatically.

7. **Optional shared-network database.** For operators who do not want to publish a database
   port and instead run PostgreSQL as a container on a dedicated Docker network, an optional
   overlay `docker-compose.network.yml` attaches the app and worker to that pre-existing
   external network (named by `OSO_DB_NETWORK`, default `oso`). It is enabled purely through
   `.env` by appending the overlay to `COMPOSE_FILE`; `DATABASE_URL` then targets the
   PostgreSQL container name on that network. The installer offers this and can create the
   network. This keeps the "never edit compose" invariant while supporting private,
   port-less database connectivity.

## Consequences

- Raspberry Pi and similar low-power hosts run OSO without local builds.
- Releasing is an explicit act (push a `v*` tag); `main` commits no longer produce images.
- The running version is visible in the app UI (workspace sidebar), read at runtime from
  `OSO_VERSION` via `getAppVersion()` in `src/lib/version.ts`; local/non-release runs show
  `dev`.
- CI cost increases modestly: the arm64 leg is QEMU-emulated (mitigated by GHA layer cache).
- The arm64 image depends on Prisma's `linux-arm64` query engine; the base image already
  installs `openssl`. This must be verified on real/emulated arm64 (see the plan's
  verification notes) whenever the base image or Prisma major version changes.
- TLS/reverse proxy and database backups are explicitly the operator's responsibility and
  are out of scope for this ADR (candidate follow-up work).

## References

- Operator guide: `docs/user-guide/deployment.md`
- Files: `.github/workflows/ci.yml` (`publish-image`), `docker-compose.prod.yml`,
  `.env.prod.example`, `scripts/install.sh`
- Initial stack: ADR 0001
