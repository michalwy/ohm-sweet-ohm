#!/usr/bin/env bash
#
# Deploy one OhmSweetOhm release to an existing installation (#249, ADR 0028).
#
#   OSO_DIR=/path/to/installation scripts/deploy.sh --version 0.14.0 [--allow-downgrade]
#
# Run by `.github/workflows/deploy.yml` on the owner's Raspberry Pi, through a self-hosted runner,
# when a release is cut (or by hand, from the Actions tab, for a redeploy or a rollback). The runbook
# is `docs/deployment/pi-deploy.md`; the reasoning is ADR 0028. Ported from Stamporama's deploy
# (michalwy/stamporama#2689 at b918320), with OhmSweetOhm's two services.
#
# **Two services, one image.** `app` runs the migrations at start and has the health check; `worker`
# (the workspace-deletion worker) has none. Both run `ghcr.io/michalwy/ohm-sweet-ohm:${OSO_IMAGE_TAG}`,
# so one `docker compose up -d` moves both to the same digest. Health is decided by `app`; `worker`
# must then be running, without restarts. A rollback moves **both** back, together, to the image
# `app` ran before.
#
# The steps:
#
#   1. pull the release image **by digest**: the tag is resolved once, and from then on only the
#      digest is used, so what is deployed is exactly what was resolved;
#   2. the **no-downgrade guard**: when the running version is newer, skip and succeed — unless
#      `--allow-downgrade` (the workflow passes it for a manual run, which is how a rollback is made);
#   3. a **pre-deploy `pg_dump`** of the external database into the backup directory, keeping the
#      newest OSO_BACKUP_KEEP dumps;
#   4. `docker compose up -d` in the installation directory, with its own `.env` and so its own
#      compose project name — migrations run at `app` start, as they always have;
#   5. wait for `app`'s health check and check that `worker` is running, and **on failure roll both
#      back to the previous image**. Migrations are not rolled back; the dump from step 3 is how the
#      database goes back.
#
# **The installation is the configuration.** `.env` is read, never rebuilt. The script writes
# `OSO_IMAGE_TAG`, after a deploy came up healthy, so a later hand-run `docker compose up -d` starts
# the same image instead of whatever `latest` is by then; and the feedback notification's two
# settings, `FEEDBACK_NOTIFY_URL` and `FEEDBACK_NOTIFY_TOKEN`, when the workflow passes them (from
# GitHub, #326 — the owner's decision recorded there), so they live in GitHub rather than by hand on
# the Pi. A setting the workflow passes empty leaves `.env` as it is.
#
# **The output is public.** This repository is public, and so are its Actions logs. Nothing here
# prints `.env`, the database address, a path on the Pi or the application's own logs; a failure
# says where on the Pi to look instead.
#
# Exit status: 0 deployed, already running, or skipped as a downgrade; 1 the release failed and the
# previous image is running again; 2 anything else — including a failed rollback, which leaves the
# instance down and needs the owner.
#
# Settings (environment):
#   OSO_DIR               the installation directory (required): .env and the compose files
#   OSO_IMAGE             image repository             (default ghcr.io/michalwy/ohm-sweet-ohm)
#   OSO_BACKUP_DIR        where dumps go               (default $OSO_DIR/backups)
#   OSO_BACKUP_KEEP       dumps kept                   (default 14)
#   OSO_PG_CLIENT_IMAGE   image providing pg_dump      (default postgres:18-alpine; its major must
#                         be at least the server's)
#   OSO_HEALTH_TIMEOUT    seconds to wait for healthy  (default 600)
#   OSO_HEALTH_POLL       seconds between checks       (default 5)
#   OSO_WORKER_SETTLE     seconds worker must stay up after app is healthy (default 10)
#   FEEDBACK_NOTIFY_URL   written into .env when set   (the routine's fire URL, #326)
#   FEEDBACK_NOTIFY_TOKEN written into .env when set   (its token; never printed)

set -euo pipefail
umask 077

IMAGE="${OSO_IMAGE:-ghcr.io/michalwy/ohm-sweet-ohm}"
BACKUP_KEEP="${OSO_BACKUP_KEEP:-14}"
PG_CLIENT_IMAGE="${OSO_PG_CLIENT_IMAGE:-postgres:18-alpine}"
HEALTH_TIMEOUT="${OSO_HEALTH_TIMEOUT:-600}"
HEALTH_POLL="${OSO_HEALTH_POLL:-5}"
WORKER_SETTLE="${OSO_WORKER_SETTLE:-10}"

VERSION=""
ALLOW_DOWNGRADE=false

info() { printf '==> %s\n' "$*"; }
warn() { printf '::warning::%s\n' "$*"; }
notice() { printf '::notice::%s\n' "$*"; }
die() {
  printf '::error::%s\n' "$*"
  summary "**Failed:** $*"
  exit 2
}

summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '%s\n\n' "$*" >>"$GITHUB_STEP_SUMMARY"
  fi
}

usage() {
  echo "Usage: OSO_DIR=<installation> $0 --version X.Y.Z [--allow-downgrade]" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
  --version)
    [ $# -ge 2 ] || usage
    VERSION="$2"
    shift 2
    ;;
  --allow-downgrade)
    ALLOW_DOWNGRADE=true
    shift
    ;;
  *) usage ;;
  esac
done

VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Version '$VERSION' is not X.Y.Z."
[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] || die "OSO_BACKUP_KEEP must be a positive number."
[[ "$WORKER_SETTLE" =~ ^[0-9]+$ ]] || die "OSO_WORKER_SETTLE must be a number of seconds."
[ -n "${OSO_DIR:-}" ] || die "OSO_DIR is not set - it names the installation directory (see docs/deployment/pi-deploy.md)."
[ -d "$OSO_DIR" ] || die "OSO_DIR does not exist on this machine."
cd "$OSO_DIR"
[ -f .env ] || die "The installation directory has no .env - is OSO_DIR the directory scripts/install.sh set up?"
BACKUP_DIR="${OSO_BACKUP_DIR:-$PWD/backups}"

# --- .env, read the way scripts/install.sh writes it --------------------------------------------

get_env() {
  { grep -E "^$1=" .env || true; } | tail -n1 | cut -d= -f2- |
    sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" -e 's/\$\$/$/g'
}

# Replace (or add) OSO_IMAGE_TAG in .env **in place**, so the file keeps its owner and mode.
write_tag() {
  local tmp
  tmp="$(mktemp)"
  { grep -vE '^OSO_IMAGE_TAG=' .env || true; } >"$tmp"
  printf 'OSO_IMAGE_TAG="%s"\n' "$1" >>"$tmp"
  cat "$tmp" >.env
  rm -f "$tmp"
}

# --- Settings the workflow carries into .env (#326) ---------------------------------------------

# Escaped for a double-quoted value in a Compose .env, as scripts/install.sh writes it: backslash
# and double quote for the parser, `$` -> `$$` so Compose does not interpolate inside it.
env_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\$/$$/g'
}

# Writes KEY from this script's environment into .env **in place**, when it is set and differs.
# Nothing here prints a value: the token is a secret and the log is public.
SETTINGS_CHANGED=false
sync_setting() { # <KEY>
  local key="$1" value line tmp
  value="${!key:-}"
  [ -n "$value" ] || return 0
  [[ "$value" != *$'\n'* ]] || die "$key from the workflow contains a line break - it was not written."
  line="${key}=\"$(env_escape "$value")\""
  [ "$({ grep -E "^${key}=" .env || true; } | tail -n1)" != "$line" ] || return 0
  tmp="$(mktemp)"
  { grep -vE "^${key}=" .env || true; } >"$tmp"
  printf '%s\n' "$line" >>"$tmp"
  cat "$tmp" >.env
  rm -f "$tmp"
  SETTINGS_CHANGED=true
  info "Wrote ${key} into .env."
}

sync_setting FEEDBACK_NOTIFY_URL
sync_setting FEEDBACK_NOTIFY_TOKEN
unset FEEDBACK_NOTIFY_URL FEEDBACK_NOTIFY_TOKEN

COMPOSE_FILES="$(get_env COMPOSE_FILE)"
[ -n "$COMPOSE_FILES" ] || COMPOSE_FILES="docker-compose.prod.yml"

# The file list comes from .env, as for the bare `docker compose ...` the installer documents.
compose() {
  COMPOSE_FILE="$COMPOSE_FILES" docker compose "$@"
}

# --- Small docker helpers -----------------------------------------------------------------------

image_env() { # <image> <name> -> value of an ENV baked into the image, or nothing
  docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2>/dev/null |
    sed -n "s/^$2=//p" | head -n1
}

image_digest() { # <image> -> sha256:... the image is known by in $IMAGE, or nothing
  docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$1" 2>/dev/null |
    sed -n "s|^${IMAGE}@||p" | head -n1
}

is_semver() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

version_gt() { # a > b
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

service_container() { compose ps -a -q "$1" 2>/dev/null | head -n1; }

container_image() { docker inspect --format '{{.Image}}' "$1" 2>/dev/null || true; }

container_running() { [ "$(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null || echo false)" = "true" ]; }

# --- Preflight ----------------------------------------------------------------------------------

docker info >/dev/null 2>&1 || die "Cannot talk to the Docker daemon - is the runner's user in the docker group?"
for f in ${COMPOSE_FILES//:/ }; do
  [ -f "$f" ] || die "Compose file $f (from COMPOSE_FILE in .env) is missing from the installation."
done

case ",$(get_env COMPOSE_PROFILES)," in
*,autoupdate,*)
  die "Watchtower is still switched on (COMPOSE_PROFILES=autoupdate in .env). Two updaters would fight over the containers - turn it off first (docs/deployment/pi-deploy.md, 'Turn Watchtower off')."
  ;;
esac

# The compose project name decides which containers compose manages. It comes from the installation
# directory (or COMPOSE_PROJECT_NAME), and a deploy under any other name would start a second app
# and a second worker beside the running ones, against the same database. So it is checked against
# the running containers' own label.
PROJECT="$(compose config 2>/dev/null | sed -n 's/^name: *//p' | head -n1)"
[ -n "$PROJECT" ] || die "docker compose could not read the installation's compose files."

# The profile switched off is not enough: the installation's Watchtower container, left running,
# still updates app and worker.
if [ -n "$(docker ps -q --filter "label=com.docker.compose.project=${PROJECT}" --filter label=com.docker.compose.service=watchtower)" ]; then
  die "The installation's Watchtower container is still running. Remove it first (docs/deployment/pi-deploy.md, 'Turn Watchtower off')."
fi

# A container of this installation is found by the directory compose ran in, not by project name,
# so a different name is caught rather than mistaken for "nothing running yet".
for svc in app worker; do
  for cid in $(docker ps -a -q --filter "label=com.docker.compose.service=${svc}"); do
    dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$cid")"
    [ "$dir" = "$PWD" ] || [ "$dir" = "$(pwd -P)" ] || continue
    running_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$cid")"
    [ "$running_project" = "$PROJECT" ] ||
      die "Compose project mismatch: the installation's ${svc} runs as project '$running_project', this deploy would use '$PROJECT'. That would start a second app and worker beside the running ones - nothing was changed. Is COMPOSE_PROJECT_NAME set in the runner's environment?"
  done
done

PREV_CONTAINER="$(service_container app)"
PREV_WORKER="$(service_container worker)"
PREV_IMAGE_ID=""
PREV_VERSION=""
PREV_RUNNING=false
PREV_HEALTH=""
if [ -n "$PREV_CONTAINER" ]; then
  PREV_IMAGE_ID="$(container_image "$PREV_CONTAINER")"
  PREV_VERSION="$(image_env "$PREV_IMAGE_ID" OSO_VERSION)"
  container_running "$PREV_CONTAINER" && PREV_RUNNING=true
  PREV_HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$PREV_CONTAINER")"
else
  warn "No app container exists in compose project '$PROJECT'. This deploy has nothing to roll back to."
fi
PREV_WORKER_IMAGE_ID=""
PREV_WORKER_RUNNING=false
if [ -n "$PREV_WORKER" ]; then
  PREV_WORKER_IMAGE_ID="$(container_image "$PREV_WORKER")"
  container_running "$PREV_WORKER" && PREV_WORKER_RUNNING=true
fi
if [ -n "$PREV_IMAGE_ID" ] && [ -n "$PREV_WORKER_IMAGE_ID" ] && [ "$PREV_IMAGE_ID" != "$PREV_WORKER_IMAGE_ID" ]; then
  warn "app and worker run different images. A rollback would put both on app's image."
fi

# --- 1. Pull the release image by digest --------------------------------------------------------

info "Resolving ${IMAGE}:${VERSION}"
docker pull -q "${IMAGE}:${VERSION}" >/dev/null || die "Could not pull ${IMAGE}:${VERSION}. Has the release's CI run published the image?"
DIGEST="$(image_digest "${IMAGE}:${VERSION}")"
[ -n "$DIGEST" ] || die "${IMAGE}:${VERSION} has no registry digest."
info "Pulling ${IMAGE}@${DIGEST}"
docker pull -q "${IMAGE}@${DIGEST}" >/dev/null || die "Could not pull ${IMAGE}@${DIGEST}."
NEW_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${IMAGE}@${DIGEST}")"
NEW_VERSION="$(image_env "$NEW_IMAGE_ID" OSO_VERSION)"
[ "$NEW_VERSION" = "$VERSION" ] ||
  die "${IMAGE}@${DIGEST} says it is version '${NEW_VERSION}', not ${VERSION}. Nothing was changed."
# Compose's image is `${IMAGE}:${OSO_IMAGE_TAG}`; a tag followed by a digest pins the digest, and the
# tag part keeps `docker ps` readable.
NEW_REF="${VERSION}@${DIGEST}"

# --- 2. No-downgrade guard ----------------------------------------------------------------------

# A settings change in .env reaches the containers only when they are recreated, so it is not
# "already running" then: the deploy goes on, and compose recreates both on the same image.
if ! $SETTINGS_CHANGED && [ -n "$PREV_IMAGE_ID" ] && [ "$PREV_IMAGE_ID" = "$NEW_IMAGE_ID" ] && $PREV_RUNNING &&
  { [ -z "$PREV_HEALTH" ] || [ "$PREV_HEALTH" = "healthy" ]; } &&
  [ "$PREV_WORKER_IMAGE_ID" = "$NEW_IMAGE_ID" ] && $PREV_WORKER_RUNNING; then
  # Pin it in .env all the same, so the installation that Watchtower left on `latest` says what it runs.
  [ "$(get_env OSO_IMAGE_TAG)" = "$NEW_REF" ] || write_tag "$NEW_REF"
  notice "${VERSION} (${DIGEST}) is already running - app healthy, worker running - nothing to do."
  summary "**Already running:** ${VERSION} \`${DIGEST}\` - app and worker were left alone; .env's OSO_IMAGE_TAG names it."
  exit 0
fi

if is_semver "$PREV_VERSION" && version_gt "$PREV_VERSION" "$VERSION"; then
  if ! $ALLOW_DOWNGRADE; then
    notice "Skipped: ${PREV_VERSION} is running, which is newer than ${VERSION}. A manual run (workflow_dispatch) is how a rollback is made."
    summary "**Skipped:** ${PREV_VERSION} is running, newer than ${VERSION}. Nothing was changed."
    exit 0
  fi
  info "Rolling back by hand: ${PREV_VERSION} -> ${VERSION}"
elif [ -n "$PREV_CONTAINER" ] && ! is_semver "$PREV_VERSION"; then
  warn "The running image reports version '${PREV_VERSION:-none}', which is not a release - the no-downgrade guard cannot judge it and lets the deploy through."
fi

# --- 3. Pre-deploy pg_dump ----------------------------------------------------------------------

# The database is the operator's, outside compose, reached through DATABASE_URL — from inside the
# app's network. So the client runs **in the app container's network namespace** when it is up,
# which reaches exactly what the app reaches; otherwise on the shared database network when the
# network overlay is in COMPOSE_FILE, else on the host's.
pg_network() {
  if [ -n "$PREV_CONTAINER" ] && $PREV_RUNNING; then
    echo "container:${PREV_CONTAINER}"
  elif [[ ":${COMPOSE_FILES}:" == *":docker-compose.network.yml:"* ]]; then
    local net
    net="$(get_env OSO_DB_NETWORK)"
    echo "${net:-oso}"
  else
    echo "host"
  fi
}

# Prisma's connection string carries parameters libpq refuses ("invalid URI query parameter");
# they say nothing about where the database is, so they are dropped for pg_dump.
libpq_url() {
  local url="$1" base query out="" pair
  base="${url%%\?*}"
  [ "$base" = "$url" ] && {
    echo "$url"
    return
  }
  query="${url#*\?}"
  local IFS='&'
  for pair in $query; do
    case "${pair%%=*}" in
    schema | connection_limit | pool_timeout | pgbouncer | statement_cache_size | socket_timeout | sslaccept | sslidentity) ;;
    *) out="${out:+$out&}$pair" ;;
    esac
  done
  echo "${base}${out:+?$out}"
}

DATABASE_URL_VALUE="$(get_env DATABASE_URL)"
[ -n "$DATABASE_URL_VALUE" ] || die "DATABASE_URL is not set in .env."
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_NAME="oso-${STAMP}-before-${VERSION}.dump"
DUMP="${BACKUP_DIR}/${DUMP_NAME}"
DUMP_LOG="${BACKUP_DIR}/last-dump-error.log"

info "Dumping the database before the deploy (${PG_CLIENT_IMAGE})"
docker pull -q "$PG_CLIENT_IMAGE" >/dev/null || die "Could not pull ${PG_CLIENT_IMAGE} for pg_dump."
# The URL travels in the environment rather than on a command line, where `ps` would show it, and
# pg_dump's own messages go to a file on the Pi: they name the database host and user.
if ! PGURL="$(libpq_url "$DATABASE_URL_VALUE")" docker run --rm -e PGURL --network "$(pg_network)" \
  "$PG_CLIENT_IMAGE" sh -c 'exec pg_dump --format=custom --no-owner --dbname="$PGURL"' \
  >"${DUMP}.partial" 2>"$DUMP_LOG"; then
  rm -f "${DUMP}.partial"
  die "pg_dump failed, so nothing was deployed. Its message is in the backup directory on the Pi, in last-dump-error.log."
fi
[ -s "${DUMP}.partial" ] || {
  rm -f "${DUMP}.partial"
  die "pg_dump wrote nothing, so nothing was deployed."
}
mv "${DUMP}.partial" "$DUMP"
rm -f "$DUMP_LOG"
info "Dump written: ${DUMP_NAME} ($(wc -c <"$DUMP" | tr -d ' ') bytes)"

# Retention: the newest BACKUP_KEEP dumps stay. The names sort by time.
# shellcheck disable=SC2012
ls -1 "$BACKUP_DIR" | { grep -E '^oso-[0-9]{8}T[0-9]{6}Z-before-.*\.dump$' || true; } | sort -r |
  awk -v keep="$BACKUP_KEEP" 'NR > keep' | while read -r old; do
  rm -f "${BACKUP_DIR}/${old}"
  info "Removed old dump ${old}"
done

# --- 4. docker compose up -d --------------------------------------------------------------------

wait_healthy() { # <app container> -> 0 when healthy, 1 otherwise
  local cid="$1" waited=0 status health restarts
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    status="$(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || echo missing)"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo missing)"
    restarts="$(docker inspect --format '{{.RestartCount}}' "$cid" 2>/dev/null || echo 0)"
    case "$health" in
    healthy) return 0 ;;
    unhealthy)
      info "app reports unhealthy."
      return 1
      ;;
    none)
      info "app has no health check - cannot tell whether it works."
      return 1
      ;;
    esac
    if [ "$status" = "exited" ] || [ "$status" = "dead" ] || [ "$status" = "missing" ] || [ "$restarts" -gt 0 ]; then
      info "app stopped (status ${status}, restarts ${restarts}) - a failed migration does this."
      return 1
    fi
    sleep "$HEALTH_POLL"
    waited=$((waited + HEALTH_POLL))
  done
  info "app was not healthy after ${HEALTH_TIMEOUT}s."
  return 1
}

# worker has no health check: it must be running and must not have restarted, now and after a
# short settle time — a worker that crashes on start restarts within it (restart: unless-stopped).
worker_ok() { # <worker container> -> 0 when running without restarts, 1 otherwise
  local cid="$1" i
  for i in 0 1; do
    [ "$i" = 1 ] && sleep "$WORKER_SETTLE"
    if ! container_running "$cid" || [ "$(docker inspect --format '{{.RestartCount}}' "$cid" 2>/dev/null || echo 1)" -gt 0 ]; then
      info "worker is not running steadily (status $(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || echo missing), restarts $(docker inspect --format '{{.RestartCount}}' "$cid" 2>/dev/null || echo '?'))."
      return 1
    fi
  done
  return 0
}

# Starts app and worker on one image, and prints "<app container> <worker container>" when both
# run that image.
start() { # <OSO_IMAGE_TAG value> <image id>
  local app worker
  OSO_IMAGE_TAG="$1" compose up -d >&2 || return 1
  app="$(service_container app)"
  worker="$(service_container worker)"
  [ -n "$app" ] && [ "$(container_image "$app")" = "$2" ] || {
    info "docker compose did not start app on the expected image."
    return 1
  }
  [ -n "$worker" ] && [ "$(container_image "$worker")" = "$2" ] || {
    info "docker compose did not start worker on the expected image."
    return 1
  }
  echo "$app $worker"
}

came_up() { # "<app> <worker>" -> 0 when app is healthy and worker runs
  local app worker
  read -r app worker <<<"$1"
  [ -n "$app" ] && [ -n "$worker" ] && wait_healthy "$app" && worker_ok "$worker"
}

info "Starting ${VERSION} (compose project ${PROJECT})"
NEW_CONTAINERS="$(start "$NEW_REF" "$NEW_IMAGE_ID")" || NEW_CONTAINERS=""

# --- 5. Health, and the rollback ----------------------------------------------------------------

if [ -n "$NEW_CONTAINERS" ] && came_up "$NEW_CONTAINERS"; then
  write_tag "$NEW_REF"
  # Old images of this repository pile up on a small disk; Watchtower used to clean them. Keep the
  # one running and the one rolled back to, and let docker refuse anything still in use.
  docker image ls --no-trunc --format '{{.ID}}' "$IMAGE" 2>/dev/null | sort -u | while read -r id; do
    [ "$id" = "$NEW_IMAGE_ID" ] || [ "$id" = "$PREV_IMAGE_ID" ] || docker image rm "$id" >/dev/null 2>&1 || true
  done
  notice "Deployed ${VERSION} (${DIGEST}) to app and worker${PREV_VERSION:+, replacing ${PREV_VERSION}}."
  summary "**Deployed:** ${VERSION} \`${DIGEST}\` to app and worker${PREV_VERSION:+ (was ${PREV_VERSION})}. Pre-deploy dump: \`${DUMP_NAME}\`."
  exit 0
fi

printf '::error::%s did not come up (app must be healthy and worker running). Its logs stay on the Pi: docker compose logs app worker (in the installation directory).\n' "$VERSION"

if [ -z "$PREV_IMAGE_ID" ]; then
  die "There is no previous image to roll back to. The instance is down; the dump ${DUMP_NAME} is in the backup directory."
fi

# Roll back by the previous image's own digest where it has one; an image with none (built
# locally) gets a local tag instead, which compose finds without pulling.
PREV_DIGEST="$(image_digest "$PREV_IMAGE_ID")"
PREV_TAG="${PREV_VERSION:-previous}"
[[ "$PREV_TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,100}$ ]] || PREV_TAG="previous"
if [ -n "$PREV_DIGEST" ]; then
  PREV_REF="${PREV_TAG}@${PREV_DIGEST}"
else
  PREV_REF="rollback-${STAMP}"
  docker tag "$PREV_IMAGE_ID" "${IMAGE}:${PREV_REF}"
fi

info "Rolling app and worker back to ${PREV_VERSION:-the previous image} (${PREV_REF})"
ROLLBACK_CONTAINERS="$(start "$PREV_REF" "$PREV_IMAGE_ID")" || ROLLBACK_CONTAINERS=""
if [ -n "$ROLLBACK_CONTAINERS" ] && came_up "$ROLLBACK_CONTAINERS"; then
  write_tag "$PREV_REF"
  printf '::error::%s did not come up; %s is running again on app and worker. Migrations %s applied were NOT rolled back - see docs/deployment/pi-deploy.md, "Restoring a dump". Pre-deploy dump: %s\n' \
    "$VERSION" "${PREV_VERSION:-the previous image}" "$VERSION" "$DUMP_NAME"
  summary "**Rolled back:** ${VERSION} did not come up; ${PREV_VERSION:-the previous image} is running again on app and worker. Migrations were not rolled back. Pre-deploy dump: \`${DUMP_NAME}\`."
  exit 1
fi

die "The rollback to ${PREV_VERSION:-the previous image} did not come up either. The instance needs the owner; the pre-deploy dump is ${DUMP_NAME}."
