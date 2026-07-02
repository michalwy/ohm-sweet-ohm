#!/usr/bin/env bash
#
# OhmSweetOhm self-hosting installer.
#
# Downloads the production Docker Compose stack, interviews you for the required
# configuration, writes a local .env, and starts the app against your external
# PostgreSQL database.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/michalwy/ohm-sweet-ohm/main/scripts/install.sh | bash
#
# Re-running is safe: an existing .env is never overwritten; only the compose
# file is refreshed so you can pick up deployment changes.

set -euo pipefail

REPO="michalwy/ohm-sweet-ohm"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_EXAMPLE=".env.prod.example"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mxx \033[0m %s\n' "$*" >&2; }

die() {
  err "$*"
  exit 1
}

# Prompt helpers. Read from /dev/tty so they work when the script is piped into
# bash via `curl | bash` (stdin is the script body, not the terminal).
prompt() {
  # prompt <variable_name> <question> [default]
  local __var="$1" __question="$2" __default="${3:-}" __reply
  if [ -n "$__default" ]; then
    printf '%s [%s]: ' "$__question" "$__default" >/dev/tty
  else
    printf '%s: ' "$__question" >/dev/tty
  fi
  IFS= read -r __reply </dev/tty || __reply=""
  if [ -z "$__reply" ]; then
    __reply="$__default"
  fi
  printf -v "$__var" '%s' "$__reply"
}

confirm() {
  # confirm <question> — returns 0 for yes, 1 for no (default no)
  local __reply
  printf '%s [y/N]: ' "$1" >/dev/tty
  IFS= read -r __reply </dev/tty || __reply=""
  case "$__reply" in
  [yY] | [yY][eE][sS]) return 0 ;;
  *) return 1 ;;
  esac
}

# Escape a value for safe use as a double-quoted shell/.env value.
env_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

# Set KEY="value" in the .env file, replacing any existing line for KEY.
set_env() {
  local key="$1" value="$2" escaped
  escaped="$(env_escape "$value")"
  if grep -qE "^${key}=" .env; then
    # Use a temp file to stay portable across GNU/BSD sed.
    grep -vE "^${key}=" .env >.env.tmp
    printf '%s="%s"\n' "$key" "$escaped" >>.env.tmp
    mv .env.tmp .env
  else
    printf '%s="%s"\n' "$key" "$escaped" >>.env
  fi
}

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48
  else
    head -c 48 /dev/urandom | base64 | tr -d '\n'
  fi
}

download() {
  # download <url> <dest>
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  else
    die "Neither curl nor wget is available to download files."
  fi
}

# Resolve the Docker Compose v2 command (plugin form only).
compose() {
  docker compose "$@"
}

main() {
  info "OhmSweetOhm self-hosting installer"

  # --- Preflight -----------------------------------------------------------
  command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/engine/install/"
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose v2 is not available. Install the Compose plugin: https://docs.docker.com/compose/install/"
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Cannot talk to the Docker daemon. Is it running, and do you have permission?"
  fi

  # --- Install directory ---------------------------------------------------
  local target_dir
  prompt target_dir "Install directory" "./ohm-sweet-ohm"
  mkdir -p "$target_dir"
  cd "$target_dir"
  info "Using $(pwd)"

  # --- Fetch deployment files ---------------------------------------------
  info "Downloading ${COMPOSE_FILE}"
  download "${RAW_BASE}/${COMPOSE_FILE}" "${COMPOSE_FILE}"

  if [ -f .env ]; then
    info "Existing .env found — keeping it, not overwriting."
    info "Refreshing ${COMPOSE_FILE} only. Edit .env by hand if you need to change settings."
    info "Pulling latest images..."
    compose -f "${COMPOSE_FILE}" pull
    info "Starting stack..."
    compose -f "${COMPOSE_FILE}" up -d
    print_summary
    return 0
  fi

  info "Downloading ${ENV_EXAMPLE}"
  download "${RAW_BASE}/${ENV_EXAMPLE}" "${ENV_EXAMPLE}"
  cp "${ENV_EXAMPLE}" .env

  # --- Interview -----------------------------------------------------------
  info "Let's configure your deployment. Press Enter to accept a default."

  local database_url auth_url http_port secret_choice secret interval
  echo >/dev/tty
  echo "Your PostgreSQL database must already exist and be reachable from Docker." >/dev/tty
  echo "If Postgres runs on this host outside Docker, use host.docker.internal as the host." >/dev/tty
  prompt database_url "External DATABASE_URL" ""
  [ -n "$database_url" ] || die "DATABASE_URL is required."
  set_env DATABASE_URL "$database_url"

  prompt auth_url "Public app URL (BETTER_AUTH_URL)" "http://localhost:3000"
  set_env BETTER_AUTH_URL "$auth_url"

  prompt http_port "Host port to expose the app on" "3000"
  set_env OSO_HTTP_PORT "$http_port"

  if confirm "Auto-generate a BETTER_AUTH_SECRET for you?"; then
    secret="$(gen_secret)"
    info "Generated a new auth secret."
  else
    prompt secret "BETTER_AUTH_SECRET (>=32 random chars)" ""
    [ ${#secret} -ge 32 ] || die "BETTER_AUTH_SECRET must be at least 32 characters."
  fi
  set_env BETTER_AUTH_SECRET "$secret"

  if confirm "Enable automatic updates (Watchtower)?"; then
    set_env COMPOSE_PROFILES "autoupdate"
    prompt interval "Update check interval in seconds" "3600"
    set_env OSO_UPDATE_INTERVAL "$interval"
    info "Auto-update enabled."
  else
    set_env COMPOSE_PROFILES ""
    info "Auto-update disabled. Update manually with: docker compose -f ${COMPOSE_FILE} pull && docker compose -f ${COMPOSE_FILE} up -d"
  fi

  # --- Launch --------------------------------------------------------------
  info "Pulling images..."
  compose -f "${COMPOSE_FILE}" pull
  info "Starting stack..."
  compose -f "${COMPOSE_FILE}" up -d

  print_summary
}

print_summary() {
  local url port
  # Read back what we ended up with for a friendly summary.
  port="$(grep -E '^OSO_HTTP_PORT=' .env | head -n1 | cut -d= -f2- | tr -d '"' || true)"
  url="$(grep -E '^BETTER_AUTH_URL=' .env | head -n1 | cut -d= -f2- | tr -d '"' || true)"
  echo >/dev/tty
  info "OhmSweetOhm is starting."
  echo "  Directory:   $(pwd)" >/dev/tty
  echo "  Config:      $(pwd)/.env" >/dev/tty
  [ -n "$url" ] && echo "  App URL:     ${url}" >/dev/tty
  [ -n "$port" ] && echo "  Local port:  ${port}" >/dev/tty
  echo >/dev/tty
  echo "Useful commands (run from $(pwd)):" >/dev/tty
  echo "  View logs:   docker compose -f ${COMPOSE_FILE} logs -f" >/dev/tty
  echo "  Update:      docker compose -f ${COMPOSE_FILE} pull && docker compose -f ${COMPOSE_FILE} up -d" >/dev/tty
  echo "  Stop:        docker compose -f ${COMPOSE_FILE} down" >/dev/tty
}

main "$@"
