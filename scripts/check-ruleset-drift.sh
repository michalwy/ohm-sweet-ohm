#!/usr/bin/env bash
#
# Compares the `main` branch ruleset on GitHub against the artifact checked into
# this repository, and exits 1 with a diff when they disagree.
#
# Why: the ruleset is the gate the whole collaboration model rests on, but it
# lives in GitHub's settings where nothing reviews it, nothing versions it, and
# a change leaves no trace in git. Checking the artifact in makes the gate's
# description reviewable; this script is what keeps the description true.
#
# It also catches parameters GitHub adds on its own. Creating this ruleset
# silently set `require_extra_approval_for_unattributed_changes: true`, which in
# a solo repository with 0 required approvals is a deadlock — an author cannot
# approve their own pull request.
#
# Usage:
#   ./scripts/check-ruleset-drift.sh           # compare
#   ./scripts/check-ruleset-drift.sh --write   # adopt live state as the artifact

set -euo pipefail

REPO="${REPO:-michalwy/ohm-sweet-ohm}"
RULESET_NAME="${RULESET_NAME:-main}"
ARTIFACT="${ARTIFACT:-.github/rulesets/main.json}"

# Drop everything that is per-instance or per-viewer rather than configuration,
# and sort what GitHub returns in arbitrary order.
#
# `drop_bypass` removes bypass_actors from BOTH sides when the caller's token
# cannot see it — see the partial-coverage handling below.
normalise() {
  jq -S --argjson drop "${1:-false}" '
    del(.id, .node_id, .created_at, .updated_at, ._links, .source, .source_type,
        .current_user_can_bypass)
    | .rules |= sort_by(.type)
    | (.rules[] | select(.type == "required_status_checks")
        | .parameters.required_status_checks) |= sort_by(.context)
    | if $drop then del(.bypass_actors)
      else .bypass_actors |= (. // [] | sort) end
  '
}

id="$(gh api "repos/${REPO}/rulesets" --jq \
  ".[] | select(.name == \"${RULESET_NAME}\") | .id")"

if [ -z "$id" ]; then
  echo "FAIL: no ruleset named '${RULESET_NAME}' on ${REPO}."
  echo "      The gate described in AGENTS.md does not exist."
  exit 1
fi

raw="$(gh api "repos/${REPO}/rulesets/${id}")"

# A token without administration rights can read the ruleset but gets a reduced
# view: bypass_actors comes back null. That is the field this check most needs
# to watch, so the coverage gap is stated loudly rather than papered over — a
# check that silently cannot see the thing it exists to guard is worse than no
# check, because it reports success.
drop_bypass=false
if [ "$(printf '%s' "$raw" | jq -r '.bypass_actors // "missing"')" = "missing" ]; then
  drop_bypass=true
fi

live="$(printf '%s' "$raw" | normalise "$drop_bypass")"

if [ "${1:-}" = "--write" ]; then
  if [ "$drop_bypass" = true ]; then
    echo "REFUSING to write: this token cannot see bypass_actors, so the"
    echo "       artifact it produced would be missing the field that matters"
    echo "       most. Re-run with a token that has administration read."
    exit 1
  fi
  mkdir -p "$(dirname "$ARTIFACT")"
  printf '%s\n' "$live" > "$ARTIFACT"
  echo "Wrote live ruleset ${id} to ${ARTIFACT}."
  exit 0
fi

if [ "$drop_bypass" = true ]; then
  echo "::warning::Partial check — this token cannot read bypass_actors, so"
  echo "  'no bypass for anyone' was NOT verified. Everything else was compared."
  echo "  To close the gap, run this with a token that has administration read"
  echo "  (set RULESET_TOKEN in the workflow's secrets)."
  echo
fi

if [ ! -f "$ARTIFACT" ]; then
  echo "FAIL: ${ARTIFACT} is missing. Run with --write to create it."
  exit 1
fi

if diff -u <(normalise "$drop_bypass" < "$ARTIFACT") <(printf '%s\n' "$live") \
     --label "$ARTIFACT" --label "GitHub ruleset ${id}"; then
  echo "OK: ${ARTIFACT} matches the live ruleset."
else
  echo
  echo "FAIL: the checked-in ruleset and GitHub disagree."
  echo "      Decide which is right. If the live change was intended, re-run"
  echo "      with --write and commit the artifact so the change is reviewed."
  exit 1
fi
