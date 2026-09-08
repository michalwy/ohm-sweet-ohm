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
# A blind spot is DECLARED, not inferred (dev-agent decisions/0005). A field the
# caller may be unable to read is named on the command line, committed in the
# workflow, and reviewed like anything else:
#
#   declared, and absent    -> excluded, named in the summary, run PASSES
#   undeclared, and absent  -> not comparable, exit 1
#   declared, but visible   -> compared normally, and the run says to drop it
#
# This is not "downgrade the failure to a warning". The exclusion is written by
# a human rather than inferred at runtime by the thing being excused; anything
# undeclared still fails, so a blind spot cannot grow silently; and it retires
# itself the day the credential arrives. The reason a permanent red is worse:
# a scheduled run's whole delivery channel is the failure mail, so staying red
# for a known gap makes red ambiguous and real drift arrives in the same
# envelope. That kills the primary instrument to protect a secondary one.
#
# The declarable set is an ENUMERATED ALLOWLIST, not "any top-level key" — the
# artifact's top-level keys include `rules`, and allowing that would exclude the
# entire rule set while wearing the appearance of a documented concession.
#
# Usage:
#   ./scripts/check-ruleset-drift.sh
#   ./scripts/check-ruleset-drift.sh --allow-unverifiable=bypass_actors
#   ./scripts/check-ruleset-drift.sh --write   # adopt live state as the artifact

set -euo pipefail

REPO="${REPO:-michalwy/ohm-sweet-ohm}"
RULESET_NAME="${RULESET_NAME:-main}"
ARTIFACT="${ARTIFACT:-.github/rulesets/main.json}"

# Fields the platform has actually been observed to redact from some callers.
# A field joins this list when a caller is seen unable to read it, deliberately
# — never because a flag accepted the string.
DECLARABLE="bypass_actors"

write=false
declared=""

for arg in "$@"; do
  case "$arg" in
    --write) write=true ;;
    --allow-unverifiable=*)
      field="${arg#*=}"
      case " $DECLARABLE " in
        *" $field "*) declared="$field" ;;
        *)
          echo "FAIL: '${field}' is not declarable. The allowlist is: ${DECLARABLE}."
          echo "      Deeper or structural absence is drift, not a blind spot, and"
          echo "      must never be excludable."
          exit 1 ;;
      esac ;;
    *) echo "FAIL: unknown argument '${arg}'."; exit 1 ;;
  esac
done

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
invisible=false
if [ "$(printf '%s' "$raw" | jq -r '.bypass_actors // "missing"')" = "missing" ]; then
  invisible=true
fi

if [ "$write" = true ]; then
  # The declaration deliberately does NOT apply to --write. Not checking a
  # field is a documented concession; recording an artifact without it
  # manufactures an incomplete artifact that looks complete.
  if [ "$invisible" = true ]; then
    echo "REFUSING to write: this token cannot see bypass_actors, so the"
    echo "       artifact would be missing the field that matters most."
    echo "       --allow-unverifiable does not apply to --write, by design."
    echo "       Re-run with a token that has administration read."
    exit 1
  fi
  mkdir -p "$(dirname "$ARTIFACT")"
  printf '%s\n' "$raw" | normalise false > "$ARTIFACT"
  echo "Wrote live ruleset ${id} to ${ARTIFACT}."
  exit 0
fi

# The three states of decisions/0005.
if [ "$invisible" = true ] && [ "$declared" != "bypass_actors" ]; then
  echo "FAIL: bypass_actors is absent from this response and was not declared."
  echo "      NOT COMPARABLE — 'no bypass for anyone' cannot be verified, and"
  echo "      an undeclared blind spot must never pass. Either run with a token"
  echo "      that has administration read, or declare it deliberately with"
  echo "      --allow-unverifiable=bypass_actors and commit that choice."
  exit 1
fi

if [ "$invisible" = false ] && [ "$declared" = "bypass_actors" ]; then
  echo "NOTE: bypass_actors IS readable by this caller, so the declaration"
  echo "      --allow-unverifiable=bypass_actors is unnecessary. Drop it; it"
  echo "      is comparing normally below."
  echo
  declared=""
fi

drop_bypass=false
if [ "$invisible" = true ]; then
  drop_bypass=true
  echo "DECLARED UNVERIFIABLE: bypass_actors"
  echo "  This caller cannot read it, and that exclusion is declared in the"
  echo "  workflow rather than inferred here. 'no bypass for anyone' is NOT"
  echo "  verified by this run. Everything else is compared below, and any"
  echo "  field that is absent WITHOUT a declaration still fails."
  echo "  The declaration retires itself once RULESET_READ_TOKEN exists."
  echo
fi

live="$(printf '%s' "$raw" | normalise "$drop_bypass")"

if [ ! -f "$ARTIFACT" ]; then
  echo "FAIL: ${ARTIFACT} is missing. Run with --write to create it."
  exit 1
fi

if diff -u <(normalise "$drop_bypass" < "$ARTIFACT") <(printf '%s\n' "$live") \
     --label "$ARTIFACT" --label "GitHub ruleset ${id}"; then
  if [ "$drop_bypass" = true ]; then
    echo "PASS (declared gap): everything this caller was asked to check matches"
    echo "     ${ARTIFACT}. bypass_actors was declared unverifiable and was not"
    echo "     compared. What was checked is in the repository."
    exit 0
  fi
  echo "OK: ${ARTIFACT} matches the live ruleset, bypass_actors included."
else
  echo
  echo "FAIL: the checked-in ruleset and GitHub disagree."
  echo "      Decide which is right. If the live change was intended, re-run"
  echo "      with --write and commit the artifact so the change is reviewed."
  exit 1
fi
