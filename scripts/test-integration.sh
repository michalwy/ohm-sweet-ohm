#!/usr/bin/env bash
#
# Run the integration suite against this worktree's own isolated PostgreSQL (#243).
#
# Several sessions work on this repository at once, each in its own git worktree. The e2e database
# used to publish a fixed host port (5433) under Docker Compose's default project name (the
# directory's basename), so a second worktree's container failed with "port is already allocated",
# and two worktrees with the same basename would have shared one database. Now each worktree gets:
#
#   - its own Compose project, `oso-it-<hash of the worktree's absolute path>`, so its own container;
#   - a host port Docker picks (unless OSO_TEST_DB_PORT pins one), read back after the start.
#
# The container is reused by the next run from the same worktree, as before (data on tmpfs, not
# reset or re-seeded). See docs/agents/testing.md § Integration tests.
#
#   scripts/test-integration.sh          start the database, migrate, run tests/integration/**
#   scripts/test-integration.sh up       start the database and print its DATABASE_URL
#   scripts/test-integration.sh down     stop and remove this worktree's database
#
set -euo pipefail

root=$(git rev-parse --show-toplevel)
cd "$root"

hash=$(printf '%s' "$root" | cksum | cut -d' ' -f1)
export COMPOSE_PROJECT_NAME="oso-it-$hash"
compose=(docker compose -f docker-compose.e2e.yml)

db_url() {
  local published port
  published=$("${compose[@]}" port db-e2e 5432)
  port=${published##*:}
  [ -n "$port" ] || { echo "test-integration: no published port for db-e2e" >&2; exit 1; }
  printf 'postgresql://oso:oso_e2e_password@127.0.0.1:%s/ohm_sweet_ohm_e2e?schema=public' "$port"
}

up() {
  "${compose[@]}" up -d --wait db-e2e
}

case "${1:-run}" in
  run)
    up
    DATABASE_URL=$(db_url)
    export DATABASE_URL
    echo "test-integration: $COMPOSE_PROJECT_NAME on ${DATABASE_URL#*@}"
    pnpm exec prisma migrate deploy
    pnpm exec tsx --tsconfig tests/integration/tsconfig.json --test 'tests/integration/**/*.test.ts'
    ;;
  up)
    up
    db_url
    echo
    ;;
  down)
    "${compose[@]}" down
    ;;
  *)
    echo "usage: $0 [run|up|down]" >&2
    exit 2
    ;;
esac
