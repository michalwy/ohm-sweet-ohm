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
# files are refreshed so you can pick up deployment changes.

set -euo pipefail

REPO="michalwy/ohm-sweet-ohm"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
COMPOSE_FILE_NAME="docker-compose.prod.yml"
NETWORK_FILE_NAME="docker-compose.network.yml"
ENV_EXAMPLE=".env.prod.example"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mxx \033[0m %s\n' "$*" >&2; }

die() {
  err "$*"
  exit 1
}

# Always restore the cursor, even if interrupted while a menu is drawn.
restore_cursor() { printf '\033[?25h' >/dev/tty 2>/dev/null || true; }
trap restore_cursor EXIT INT TERM

# --- Interactive prompts -----------------------------------------------------
# All prompts read from /dev/tty so they work under `curl ... | bash`, where the
# script body is on stdin.

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

# Arrow-key single-select menu. Sets the named variable to the selected index.
# Falls back to index 0 when no terminal is available (non-interactive).
#   choose <result_var> <title> <option> [<option> ...]
choose() {
  local __var="$1" __title="$2"
  shift 2
  local __opts=("$@")
  local __count=${#__opts[@]}
  local __sel=0 __key __rest __i __first=1

  if [ ! -e /dev/tty ] || [ ! -t 1 ]; then
    printf -v "$__var" '%s' "0"
    return 0
  fi

  printf '\033[1m%s\033[0m\n' "$__title" >/dev/tty
  printf '\033[2m  (↑/↓ to move, Enter to select)\033[0m\n' >/dev/tty
  printf '\033[?25l' >/dev/tty # hide cursor

  while true; do
    if [ "$__first" -eq 1 ]; then
      __first=0
    else
      printf '\033[%dA' "$__count" >/dev/tty # move up to redraw
    fi
    for __i in "${!__opts[@]}"; do
      if [ "$__i" -eq "$__sel" ]; then
        printf '\033[K\033[1;36m  ❯ %s\033[0m\n' "${__opts[$__i]}" >/dev/tty
      else
        printf '\033[K    \033[2m%s\033[0m\n' "${__opts[$__i]}" >/dev/tty
      fi
    done

    IFS= read -rsn1 __key </dev/tty || __key=""
    case "$__key" in
    $'\x1b') # escape sequence — arrow keys
      IFS= read -rsn2 __rest </dev/tty || __rest=""
      case "$__rest" in
      '[A') __sel=$(((__sel - 1 + __count) % __count)) ;;
      '[B') __sel=$(((__sel + 1) % __count)) ;;
      esac
      ;;
    'k' | 'K') __sel=$(((__sel - 1 + __count) % __count)) ;;
    'j' | 'J') __sel=$(((__sel + 1) % __count)) ;;
    '') break ;; # Enter
    esac
  done

  printf '\033[?25h' >/dev/tty # show cursor
  printf '\033[1;36m  → %s\033[0m\n' "${__opts[$__sel]}" >/dev/tty
  printf -v "$__var" '%s' "$__sel"
}

# Yes/No menu. Returns 0 for Yes, 1 for No. Default (first option) is Yes.
confirm() {
  local __idx
  choose __idx "$1" "Yes" "No"
  [ "$__idx" -eq 0 ]
}

# --- .env helpers ------------------------------------------------------------

# Escape a value for safe use as a double-quoted shell/.env value.
env_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

# Set KEY="value" in the .env file, replacing any existing line for KEY.
set_env() {
  local key="$1" value="$2" escaped
  escaped="$(env_escape "$value")"
  if grep -qE "^${key}=" .env; then
    grep -vE "^${key}=" .env >.env.tmp
    printf '%s="%s"\n' "$key" "$escaped" >>.env.tmp
    mv .env.tmp .env
  else
    printf '%s="%s"\n' "$key" "$escaped" >>.env
  fi
}

# Read a value back from .env (unquoted).
get_env() {
  grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
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

# Run docker compose using the file list from .env's COMPOSE_FILE. Exporting it
# guarantees the right files are used regardless of how compose parses .env.
compose() {
  local files
  files="$(get_env COMPOSE_FILE)"
  [ -n "$files" ] || files="${COMPOSE_FILE_NAME}"
  COMPOSE_FILE="$files" docker compose "$@"
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
  info "Downloading ${COMPOSE_FILE_NAME}"
  download "${RAW_BASE}/${COMPOSE_FILE_NAME}" "${COMPOSE_FILE_NAME}"
  info "Downloading ${NETWORK_FILE_NAME}"
  download "${RAW_BASE}/${NETWORK_FILE_NAME}" "${NETWORK_FILE_NAME}"

  if [ -f .env ]; then
    info "Existing .env found — keeping it, not overwriting."
    info "Refreshing compose files only. Edit .env by hand if you need to change settings."
    grep -qE '^COMPOSE_FILE=' .env || set_env COMPOSE_FILE "${COMPOSE_FILE_NAME}"
    info "Pulling latest images..."
    compose pull
    info "Starting stack..."
    compose up -d
    print_summary
    return 0
  fi

  info "Downloading ${ENV_EXAMPLE}"
  download "${RAW_BASE}/${ENV_EXAMPLE}" "${ENV_EXAMPLE}"
  cp "${ENV_EXAMPLE}" .env

  # --- Interview -----------------------------------------------------------
  info "Let's configure your deployment."
  echo >/dev/tty

  local database_url auth_url http_port secret interval db_mode secret_mode update_mode net_name

  choose db_mode "How does the app reach your PostgreSQL database?" \
    "Published host port (or host.docker.internal)" \
    "Shared Docker network — no exposed DB port"
  echo >/dev/tty

  if [ "$db_mode" -eq 1 ]; then
    prompt net_name "Name of the shared Docker network" "oso"
    set_env OSO_DB_NETWORK "$net_name"
    set_env COMPOSE_FILE "${COMPOSE_FILE_NAME}:${NETWORK_FILE_NAME}"
    info "The app and worker will join the '${net_name}' network."
    echo "In DATABASE_URL, use your PostgreSQL CONTAINER name as the host and its" >/dev/tty
    echo "internal port (usually 5432), e.g. postgresql://user:pass@oso-postgres:5432/db?schema=public" >/dev/tty
    if ! docker network inspect "$net_name" >/dev/null 2>&1; then
      warn "The Docker network '${net_name}' does not exist yet."
      if confirm "Create the '${net_name}' network now?"; then
        docker network create "$net_name" >/dev/null
        info "Created network '${net_name}'. Attach your PostgreSQL container to it: docker network connect ${net_name} <postgres-container>"
      else
        warn "Create it and attach PostgreSQL before starting: docker network create ${net_name}"
      fi
    fi
  else
    set_env COMPOSE_FILE "${COMPOSE_FILE_NAME}"
    echo "If PostgreSQL runs on this host outside Docker, use host.docker.internal as the host." >/dev/tty
  fi
  echo >/dev/tty

  prompt database_url "External DATABASE_URL" ""
  [ -n "$database_url" ] || die "DATABASE_URL is required."
  set_env DATABASE_URL "$database_url"

  prompt auth_url "Public app URL (BETTER_AUTH_URL)" "http://localhost:3000"
  set_env BETTER_AUTH_URL "$auth_url"

  prompt http_port "Host port to expose the app on" "3000"
  set_env OSO_HTTP_PORT "$http_port"
  echo >/dev/tty

  choose secret_mode "Authentication secret (BETTER_AUTH_SECRET)" \
    "Auto-generate a strong secret (recommended)" \
    "Enter my own"
  echo >/dev/tty
  if [ "$secret_mode" -eq 0 ]; then
    secret="$(gen_secret)"
    info "Generated a new auth secret."
  else
    prompt secret "BETTER_AUTH_SECRET (>=32 random chars)" ""
    [ ${#secret} -ge 32 ] || die "BETTER_AUTH_SECRET must be at least 32 characters."
  fi
  set_env BETTER_AUTH_SECRET "$secret"
  echo >/dev/tty

  choose update_mode "Automatic updates" \
    "Disabled — update manually" \
    "Enabled — Watchtower watches for new release images"
  echo >/dev/tty
  if [ "$update_mode" -eq 1 ]; then
    set_env COMPOSE_PROFILES "autoupdate"
    prompt interval "Update check interval in seconds" "3600"
    set_env OSO_UPDATE_INTERVAL "$interval"
    info "Auto-update enabled."
  else
    set_env COMPOSE_PROFILES ""
    info "Auto-update disabled. Update manually with: docker compose pull && docker compose up -d"
  fi

  # --- Launch --------------------------------------------------------------
  info "Pulling images..."
  compose pull
  info "Starting stack..."
  compose up -d

  print_summary
}

print_summary() {
  local url port
  port="$(get_env OSO_HTTP_PORT || true)"
  url="$(get_env BETTER_AUTH_URL || true)"
  echo >/dev/tty
  info "OhmSweetOhm is starting."
  echo "  Directory:   $(pwd)" >/dev/tty
  echo "  Config:      $(pwd)/.env" >/dev/tty
  [ -n "$url" ] && echo "  App URL:     ${url}" >/dev/tty
  [ -n "$port" ] && echo "  Local port:  ${port}" >/dev/tty
  echo >/dev/tty
  echo "Useful commands (run from $(pwd)):" >/dev/tty
  echo "  View logs:   docker compose logs -f" >/dev/tty
  echo "  Update:      docker compose pull && docker compose up -d" >/dev/tty
  echo "  Stop:        docker compose down" >/dev/tty
}

main "$@"
