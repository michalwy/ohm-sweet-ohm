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
#
# The interview uses whiptail (a native dialog UI, preinstalled on Raspberry Pi
# OS / Debian) when available, and falls back to a pure-bash arrow-key menu
# otherwise, so it works everywhere with no extra dependencies.

set -euo pipefail

REPO="michalwy/ohm-sweet-ohm"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
COMPOSE_FILE_NAME="docker-compose.prod.yml"
NETWORK_FILE_NAME="docker-compose.network.yml"
ENV_EXAMPLE=".env.prod.example"
APP_TITLE="OhmSweetOhm installer"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31mxx \033[0m %s\n' "$*" >&2; }

die() {
  err "$*"
  exit 1
}

# Always restore the cursor, even if interrupted while a fallback menu is drawn.
restore_cursor() { printf '\033[?25h' >/dev/tty 2>/dev/null || true; }
trap restore_cursor EXIT INT TERM

# =============================================================================
# UI layer — whiptail when available, pure-bash fallback otherwise.
# All interaction goes through /dev/tty so it works under `curl ... | bash`.
# =============================================================================

have_whiptail() { [ -e /dev/tty ] && command -v whiptail >/dev/null 2>&1; }

# ui_prompt <var> <question> [default] — free-text input.
ui_prompt() {
  local __var="$1" question="$2" default="${3:-}"
  if have_whiptail; then
    local val
    val=$(whiptail --title "$APP_TITLE" --inputbox "$question" 12 78 "$default" \
      3>&1 1>&2 2>&3 </dev/tty) || die "Installation cancelled."
    printf -v "$__var" '%s' "$val"
  else
    fallback_prompt "$__var" "$question" "$default"
  fi
}

# ui_password <var> <question> — masked input.
ui_password() {
  local __var="$1" question="$2"
  if have_whiptail; then
    local val
    val=$(whiptail --title "$APP_TITLE" --passwordbox "$question" 12 78 \
      3>&1 1>&2 2>&3 </dev/tty) || die "Installation cancelled."
    printf -v "$__var" '%s' "$val"
  else
    fallback_prompt "$__var" "$question" ""
  fi
}

# ui_menu <var> <question> <value1> <label1> <value2> <label2> ...
# Sets <var> to the chosen value.
ui_menu() {
  local __var="$1" question="$2"
  shift 2
  local vals=() labels=()
  while [ "$#" -gt 0 ]; do
    vals+=("$1")
    labels+=("$2")
    shift 2
  done
  local n=${#vals[@]} i
  if have_whiptail; then
    local menu_args=()
    for ((i = 0; i < n; i++)); do menu_args+=("${vals[i]}" "${labels[i]}"); done
    local choice
    choice=$(whiptail --title "$APP_TITLE" --notags --menu "$question" 16 78 "$n" \
      "${menu_args[@]}" 3>&1 1>&2 2>&3 </dev/tty) || die "Installation cancelled."
    printf -v "$__var" '%s' "$choice"
  else
    local idx
    fallback_choose idx "$question" "${labels[@]}"
    printf -v "$__var" '%s' "${vals[idx]}"
  fi
}

# ui_confirm <question> — returns 0 for Yes, non-zero for No/cancel.
ui_confirm() {
  if have_whiptail; then
    whiptail --title "$APP_TITLE" --yesno "$1" 12 78 </dev/tty
  else
    fallback_confirm "$1"
  fi
}

# --- Pure-bash fallbacks -----------------------------------------------------

fallback_prompt() {
  local __var="$1" __question="$2" __default="${3:-}" __reply
  if [ -n "$__default" ]; then
    printf '%s [%s]: ' "$__question" "$__default" >/dev/tty
  else
    printf '%s: ' "$__question" >/dev/tty
  fi
  IFS= read -r __reply </dev/tty || __reply=""
  [ -n "$__reply" ] || __reply="$__default"
  printf -v "$__var" '%s' "$__reply"
}

# Arrow-key single-select menu; sets the named variable to the selected index.
fallback_choose() {
  local __var="$1" __title="$2"
  shift 2
  local __opts=("$@")
  local __count=${#__opts[@]}
  local __sel=0 __key __rest __i __first=1

  printf '\033[1m%s\033[0m\n' "$__title" >/dev/tty
  printf '\033[2m  (↑/↓ to move, Enter to select)\033[0m\n' >/dev/tty
  printf '\033[?25l' >/dev/tty

  while true; do
    if [ "$__first" -eq 1 ]; then
      __first=0
    else
      printf '\033[%dA' "$__count" >/dev/tty
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
    $'\x1b')
      IFS= read -rsn2 __rest </dev/tty || __rest=""
      case "$__rest" in
      '[A') __sel=$(((__sel - 1 + __count) % __count)) ;;
      '[B') __sel=$(((__sel + 1) % __count)) ;;
      esac
      ;;
    'k' | 'K') __sel=$(((__sel - 1 + __count) % __count)) ;;
    'j' | 'J') __sel=$(((__sel + 1) % __count)) ;;
    '') break ;;
    esac
  done

  printf '\033[?25h' >/dev/tty
  printf '\033[1;36m  → %s\033[0m\n' "${__opts[$__sel]}" >/dev/tty
  printf -v "$__var" '%s' "$__sel"
}

# Yes/No via the arrow-key menu. Returns 0 for Yes, 1 for No.
fallback_confirm() {
  local __idx
  fallback_choose __idx "$1" "Yes" "No"
  [ "$__idx" -eq 0 ]
}

# =============================================================================
# .env helpers
# =============================================================================

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

# =============================================================================

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
  ui_prompt target_dir "Where should OhmSweetOhm be installed?" "./ohm-sweet-ohm"
  [ -n "$target_dir" ] || target_dir="./ohm-sweet-ohm"
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
  local database_url auth_url http_port secret interval db_mode secret_mode update_mode net_name db_hint

  ui_menu db_mode "How does the app reach your PostgreSQL database?" \
    port "Published host port (or host.docker.internal)" \
    network "Shared Docker network — no exposed DB port"

  if [ "$db_mode" = "network" ]; then
    ui_prompt net_name "Name of the shared Docker network your PostgreSQL container is attached to" "oso"
    [ -n "$net_name" ] || net_name="oso"
    set_env OSO_DB_NETWORK "$net_name"
    set_env COMPOSE_FILE "${COMPOSE_FILE_NAME}:${NETWORK_FILE_NAME}"
    if ! docker network inspect "$net_name" >/dev/null 2>&1; then
      if ui_confirm "The Docker network '$net_name' does not exist yet. Create it now? You will still need to attach your PostgreSQL container to it."; then
        docker network create "$net_name" >/dev/null
        info "Created network '$net_name'. Attach Postgres: docker network connect $net_name <postgres-container>"
      else
        warn "Create it and attach PostgreSQL before starting: docker network create $net_name"
      fi
    fi
    db_hint="Use your PostgreSQL CONTAINER name as the host and its internal port, e.g. postgresql://user:pass@$net_name-postgres:5432/ohm_sweet_ohm?schema=public"
  else
    set_env COMPOSE_FILE "${COMPOSE_FILE_NAME}"
    db_hint="If PostgreSQL runs on this host outside Docker, use host.docker.internal as the host."
  fi

  ui_prompt database_url "External DATABASE_URL

$db_hint" ""
  [ -n "$database_url" ] || die "DATABASE_URL is required."
  set_env DATABASE_URL "$database_url"

  ui_prompt auth_url "Public URL where this deployment will be reachable (BETTER_AUTH_URL)" "http://localhost:3000"
  set_env BETTER_AUTH_URL "$auth_url"

  ui_prompt http_port "Host port to expose the app on" "3000"
  set_env OSO_HTTP_PORT "$http_port"

  ui_menu secret_mode "Authentication secret (BETTER_AUTH_SECRET)" \
    auto "Auto-generate a strong secret (recommended)" \
    manual "Enter my own"
  if [ "$secret_mode" = "auto" ]; then
    secret="$(gen_secret)"
    info "Generated a new auth secret."
  else
    ui_password secret "Enter BETTER_AUTH_SECRET (at least 32 random characters)"
    [ ${#secret} -ge 32 ] || die "BETTER_AUTH_SECRET must be at least 32 characters."
  fi
  set_env BETTER_AUTH_SECRET "$secret"

  ui_menu update_mode "Automatic updates" \
    off "Disabled — update manually" \
    on "Enabled — Watchtower watches for new release images"
  if [ "$update_mode" = "on" ]; then
    set_env COMPOSE_PROFILES "autoupdate"
    ui_prompt interval "Update check interval in seconds" "3600"
    [ -n "$interval" ] || interval="3600"
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
