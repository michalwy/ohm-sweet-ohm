# Running and deploying

Keep the project runnable locally and deployable to cloud infrastructure. Docker Compose is for local
use and development, never the only deployment path. `docs/development/local-setup.md` has the
commands; this file has the rules.

## Local

- `docker compose up` is the user's normal local-use stack: it runs the built app with `next start`
  against the persistent development database, without creating a seeded development user. This is
  how the user exercises changes (see `collaboration.md` § *No browser verification*).
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` is containerized development
  with hot reload.

## Self-hosted deployment (ADR 0022)

- CI pushes a multi-arch image to `ghcr.io/michalwy/ohm-sweet-ohm` **only for
  release tags (`v*`)**: `build-image` builds `linux/amd64` on `ubuntu-latest` and `linux/arm64` on
  `ubuntu-24.04-arm`, natively — **no QEMU** (the owner, 2026-11-24, #259) — each pushed by digest
  only, and `publish-image` (`Publish container image`) merges the two digests into one tagged
  manifest list and checks it lists both architectures. It runs on the tag's push, or on the release
  workflow's dispatch with `publish_image` — never on every `main` commit. A release is cut by dispatching
  `.github/workflows/release.yml`; see `release-versioning.md`.
- **Every pull request and every push to `main`** also builds the image, `linux/amd64` only and not
  pushed (`Container image build check`, #317), so a broken Dockerfile fails CI before it reaches a
  release. It is not a required check ([`branch-protection.md`](branch-protection.md)).
- `docker-compose.prod.yml` runs that prebuilt image against an operator-provided external database,
  with all configuration in a git-ignored `.env` (template `.env.prod.example`).
- `scripts/install.sh` is the curl-able installer: interactive whiptail dialogs when available, with a
  pure-bash arrow-key fallback so it needs no extra dependencies.
- Deployment management commands run as bare `docker compose ...` from the install directory, reading
  the file list from the `COMPOSE_FILE` key in `.env`.
- HTTPS is the operator's own reverse proxy in front of `OSO_HTTP_PORT` (Caddy recommended), with
  `BETTER_AUTH_URL` set to the public HTTPS URL; the operator guide's *HTTPS with a Reverse Proxy*
  section has the setup. The stack ships no proxy service or overlay (#143). Restricting the port
  to loopback is `OSO_HTTP_PORT=127.0.0.1:3000` — the compose port mapping takes a host IP — so
  keep that mapping's `${OSO_HTTP_PORT}:3000` shape, and keep the installer from validating the
  value as a bare number.
- There is no automatic updater: deployments track the image's `latest` tag and the operator updates
  with `docker compose pull && docker compose up -d --remove-orphans`. Watchtower and the
  `autoupdate` profile were removed (the owner, 2026-11-23, #250); a leftover
  `COMPOSE_PROFILES=autoupdate` in an old `.env` starts nothing, and the installer clears it.

## The owner's instance on the Pi (ADR 0028)

- **A release deploys it**: `release.yml` dispatches `.github/workflows/deploy.yml`, which runs
  `scripts/deploy.sh` on a self-hosted runner on the Pi. The runbook (the owner's steps) is
  `docs/deployment/pi-deploy.md`. No thread can reach the Pi or start a deploy.
- The deploy moves **`app` and `worker` to the same digest**, decides health by `app`'s health check,
  then checks that `worker` is running without restarts, and **rolls both back together**. Change
  the services, their commands or the health check → update `scripts/deploy.sh`, the runbook and
  ADR 0028 too.
- The configuration stays in the installation's `.env`; the deploy writes only `OSO_IMAGE_TAG`
  (`X.Y.Z@sha256:…`) and, when GitHub has them, the feedback notification's `FEEDBACK_NOTIFY_URL`
  (variable) and `FEEDBACK_NOTIFY_TOKEN` (secret) — the owner's decision in #326; a change to either
  recreates the containers even when the version is already running — keeps the compose project name and refuses when it would differ, and refuses
  while an old install still has Watchtower on (the profile in `.env`, or its leftover container).
- **`deploy.yml` is the only workflow allowed onto a self-hosted runner.** The repository is public:
  `scripts/check-self-hosted-runners.mjs` (in `Unit tests`) fails any other workflow whose `runs-on`
  is not a GitHub-hosted label, `tests/unit/deploy-workflow.test.ts` pins Deploy's triggers, and the
  runner's job-started hook (`scripts/runner-job-started-hook.sh`) refuses every other job on the Pi.
  A change to any of these, or to the deploy or release workflows, crosses the deploy / CI-trigger
  guardrail in `merge-checklist.md`.
- The deploy's log is public: it prints no `.env`, database address, Pi path or application log.
- The optional overlay `docker-compose.network.yml` (appended to `COMPOSE_FILE`, network named by
  `OSO_DB_NETWORK`) attaches the app and worker to a pre-existing external Docker network for a
  port-less database.
- The release version is baked into the image through the `OSO_VERSION` build argument and shown in
  the workspace sidebar through `getAppVersion()` in `src/lib/version.ts`.

**Keep these in sync** when changing runtime environment variables, the worker command,
migrations-on-start behavior, or the Dockerfile `runner` target: the prod compose file, the env
template, the installer, ADR 0022, `scripts/deploy.sh` and its runbook, and this file.
