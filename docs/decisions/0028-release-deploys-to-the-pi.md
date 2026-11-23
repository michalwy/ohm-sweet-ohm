# ADR 0028 — A Release Deploys to the Pi Through a Self-Hosted Runner

**Status:** Accepted
**Date:** 2026-11-23

Decided by the owner on 2026-11-23 and recorded in #249: port Stamporama's release-to-Pi deploy
(ADR-0083 in `michalwy/stamporama`, its #2689, #2697 and #2704, at commit `b918320`) without
redesigning it; the pull request may add the deploy and release workflows, change CI triggers, add
the self-hosted runner check to CI and use a self-hosted runner on the Pi with a job-started hook
that refuses everything but the deploy. Replaces Watchtower **on the owner's instance only**;
retiring it for other self-hosters is #250.

## Context

The owner's live instance runs `docker-compose.prod.yml` (ADR 0022) on a Raspberry Pi, and until now
Watchtower (the `autoupdate` profile) polled GHCR and restarted `app` and `worker` on any new
`latest`. Watchtower is unmaintained (archived in December 2025); nothing happened before or after
the swap — no backup before the migrations ran, no check that the new containers came up, no way
back but by hand; and nothing recorded what was deployed when.

Since #247 a release *is* a deploy, cut only on the owner's word. The deploy should hang off the
release and be visible in GitHub Actions.

The Pi is on a home network: GitHub cannot reach it, but it can reach GitHub. That is the shape of a
**self-hosted runner** — it polls for jobs, so nothing is exposed — and the owner already runs one on
the Pi for Stamporama. The repository is **public**, which is the danger: a self-hosted runner
executes whatever the job's commit says, on the machine that holds the production `.env` and
reaches the production database.

## Decision

1. **`.github/workflows/deploy.yml` runs on `release: published` and `workflow_dispatch` with a
   version input — and nothing else.** Never `pull_request`, `pull_request_target` or
   `workflow_call`. The job checks `github.repository == 'michalwy/ohm-sweet-ohm'`, runs on
   `[self-hosted, pi, ohm-sweet-ohm]` in the `prod` environment (deployable from `main` and `v*`
   tags only), in a concurrency group that **queues rather than cancels**, with a timeout.
   `tests/unit/deploy-workflow.test.ts` pins every one of these.
2. **Releases are cut by `.github/workflows/release.yml`**, dispatched on `main` by a release thread
   with the version, the checked `main` SHA and the notes: a cloud thread's proxy refuses tag and
   Release writes (measured in Stamporama). It refuses a version not newer than the latest release,
   reads `main`'s run for the commit, creates the tag, **dispatches CI on the tag** with
   `publish_image` and waits for it (deleting the tag when red), publishes the Release and
   **dispatches Deploy on the tag**. The two dispatches are needed because events caused by
   `GITHUB_TOKEN` start no workflow except `workflow_dispatch`; a dispatch of Deploy on a `v*` tag is
   its manual trigger, which the `prod` environment and the hook already accept. Because a manual
   Deploy run passes `--allow-downgrade`, the no-downgrade guard for a release lives in the release
   workflow. `tests/unit/release-workflow.test.ts` pins its trigger, runner and step order.
   Stamporama's step that moves a `latest` git tag is not ported: OSO has no such tag — `latest` is
   the image tag the publish job sets.
3. **No other workflow may reach a self-hosted runner, and CI enforces it.**
   `scripts/check-self-hosted-runners.mjs`, run by `tests/unit/self-hosted-runners.test.ts` inside
   the required `Unit tests` check, fails when another workflow names `self-hosted` **or** has a
   `runs-on` that is not a GitHub-hosted label (`runs-on: [pi]` would reach the Pi without the word).
   It reads lines rather than YAML and **fails closed** on any shape it does not recognise. No new
   required check, so the ruleset is unchanged. Beside it, *Require approval for all external
   contributors* stays on for fork pull requests, and agents never approve a fork's workflow run.
4. **The runner refuses every job but the deploy.** The CI check keeps such a workflow off `main`,
   but a `pull_request` run uses the pull request's own workflow files, so a pull request from a
   branch of this repository — every agent thread's is one — could still get one job onto the Pi.
   So the runner's **job-started hook**, `scripts/runner-job-started-hook.sh`, installed root-owned
   outside the runner's directory and set through `ACTIONS_RUNNER_HOOK_JOB_STARTED`, fails every job
   before its first step unless the repository is `michalwy/ohm-sweet-ohm`, the workflow ref is
   exactly `…/.github/workflows/deploy.yml@refs/tags/v…` or `…@refs/heads/main`, and the event is
   `release` or `workflow_dispatch`. It fails closed on a missing variable.
   `tests/unit/runner-job-started-hook.test.ts` runs it over the accepted and refused cases.
5. **`scripts/deploy.sh` does the deploy, for both services**:
   1. pull the release image **by digest** — the tag is resolved once, and the image's own
      `OSO_VERSION` must match the release;
   2. the **no-downgrade guard** — when the running version is newer, skip and succeed; a manual run
      passes `--allow-downgrade`, which is how a rollback is made;
   3. a **pre-deploy `pg_dump`** of the external database, custom format, into a `0700` backup
      directory on the Pi, keeping the newest 14 by default;
   4. `docker compose up -d`, which moves **`app` and `worker` to the same digest** — migrations still
      run at `app` start;
   5. **health is decided by `app`** (its health check); `worker`, which has none, must then be
      running and must not have restarted after a short settle time. On failure **both roll back
      together** to the image `app` ran before, and the job fails. **Migrations are not rolled
      back**; the dump is how the database goes back, by hand, following the runbook.
6. **The installation is the configuration.** The script works in the existing installation
   directory with its own `.env` and compose file list; it never rebuilds `.env` from GitHub secrets.
   The one key it writes is `OSO_IMAGE_TAG` — `X.Y.Z@sha256:…`, after a deploy came up — so a later
   hand-run `docker compose up -d` starts the same image. The compose file's
   `ghcr.io/michalwy/ohm-sweet-ohm:${OSO_IMAGE_TAG:-latest}` accepts a tag followed by a digest, so
   `docker-compose.prod.yml` did not change.
7. **The compose project name is kept, and checked.** A deploy under another name would start a
   second `app` and `worker` beside the running ones, against the same database. The script finds
   the installation's running containers by the directory compose ran them from and refuses when
   their project differs from the one this deploy would use.
8. **The output is public, so it says little.** The script prints versions, digests and dump file
   names, never `.env`, the database address, paths on the Pi or the application's logs; `pg_dump`'s
   messages go to a file in the backup directory.

The owner's runbook — runner, hook, `prod` environment, fork approval, turning Watchtower off, the
first deploy, rollback and restoring a dump — is
[`docs/deployment/pi-deploy.md`](../deployment/pi-deploy.md).

## Consequences

- A deploy is a run in the Actions tab with a summary: deployed, already running, skipped as a
  downgrade, rolled back, or failed.
- **A rollback is a manual Deploy run with an older version.** It takes a dump first; its database
  still carries the newer release's migrations, and restoring the dump is the other way back.
- **Watchtower must be off on the Pi.** The script refuses while `COMPOSE_PROFILES` contains
  `autoupdate` or the installation's Watchtower container runs.
- **The Pi keeps two images** of this repository, the running one and the one a rollback would use;
  the script removes the others after a successful deploy.
- **Dumps accumulate on the Pi**, 14 by default (`OSO_BACKUP_KEEP`); copying them off the Pi is the
  owner's own backup, not this workflow's.
- **`pg_dump` comes from `postgres:18-alpine`** (`OSO_PG_CLIENT_IMAGE`), whose major must be at least
  the server's, or the deploy fails before anything changed.
- A release cut while the runner is offline waits in the queue (up to 24 hours).
- Other self-hosters are unaffected: they still use `scripts/install.sh`. Watchtower was removed for
  them too in #250; they update by hand.

## Alternatives considered

- **Keep Watchtower, or a maintained fork.** Still polls, still has no backup, health gate or record.
- **SSH from a GitHub-hosted runner into the Pi.** Needs the Pi reachable from the internet and an
  SSH key in GitHub secrets that can do anything on the Pi.
- **Rebuild `.env` from GitHub secrets on every deploy.** Two places to edit the configuration, and
  everything `scripts/install.sh` writes moved into GitHub. The issue keeps it on the Pi.
- **Health-check the worker separately.** It has no health check, and giving it one would change the
  image and the compose file for every self-hoster; "running and not restarting" is what the deploy
  can tell without that.
