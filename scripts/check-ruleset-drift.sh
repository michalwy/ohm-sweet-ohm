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
# A field the caller cannot read is a FAILURE, never an exclusion. A token
# without administration rights gets a reduced view of the ruleset in which
# bypass_actors is missing — and "no bypass for anyone" is the property this
# check most needs to watch. A check that silently cannot see the thing it
# guards reports success, which is worse than no check. CI therefore runs with
# RULESET_READ_TOKEN, which has administration read; losing that secret turns
# this check red rather than quietly narrowing what it compares.
#
# There used to be a flag for declaring such a field unverifiable, for a
# project that did not yet have the credential. Nothing passed it once the
# credential existed, so it was removed rather than kept as an unexercised
# path.
#
# Usage:
#   ./scripts/check-ruleset-drift.sh
#   ./scripts/check-ruleset-drift.sh --write   # adopt live state as the artifact

set -euo pipefail

REPO="${REPO:-michalwy/ohm-sweet-ohm}"
ARTIFACT="${ARTIFACT:-.github/rulesets/main.json}"

write=false

for arg in "$@"; do
  case "$arg" in
    --write) write=true ;;
    *) echo "FAIL: unknown argument '${arg}'."; exit 1 ;;
  esac
done

# Drop everything that is per-instance or per-viewer rather than configuration,
# and sort what GitHub returns in arbitrary order.
#
# `source_type` is deliberately KEPT. It is not provenance of the fetch — it
# answers where the ruleset lives, and a value of "Organization" means the
# artifact no longer describes a ruleset this repository controls, with its
# bypass list administered elsewhere. That is a premise change and should be the
# loudest thing this check can report.
#
# `source` is deliberately dropped. For a repository ruleset it reads back the
# repository's own name, so it carries nothing — but it changes on a repository
# rename, which is not a policy event, and a false failure costs this check the
# credibility that is its entire value.
normalise() {
  jq -S '
    del(.id, .node_id, .created_at, .updated_at, ._links, .source,
        .current_user_can_bypass)
    | .rules |= sort_by(.type)
    | (.rules[] | select(.type == "required_status_checks")
        | .parameters.required_status_checks) |= sort_by(.context)
    | .bypass_actors |= (. // [] | sort)
  '
}

# Select by what a ruleset GATES, never by what it is called. What gates a
# branch is the union of every ruleset matching it, not the one you named — so
# selecting by name makes the artifact's completeness depend on a string, and an
# organisation ruleset called anything else would be invisible: no field would
# change, no diff would appear, and a second gate would simply never be
# mentioned. A second match is drift, whatever it claims to target.
#
# The list endpoint omits `conditions`, so each branch-target ruleset has to be
# fetched to find out whether it covers the default branch.
default_branch="$(gh api "repos/${REPO}" --jq .default_branch)"
branch_ref="refs/heads/${default_branch}"

matching_ids=""
matching_desc=""
raw=""

for rid in $(gh api "repos/${REPO}/rulesets" --jq '.[] | select(.target == "branch") | .id'); do
  detail="$(gh api "repos/${REPO}/rulesets/${rid}")"
  if printf '%s' "$detail" | jq -e --arg b "$branch_ref" '
        ((.conditions.ref_name.include // [])
           | any(. == "~ALL" or . == "~DEFAULT_BRANCH" or . == $b))
        and (((.conditions.ref_name.exclude // []) | any(. == $b)) | not)
      ' >/dev/null; then
    matching_ids="${matching_ids}${rid} "
    matching_desc="${matching_desc}  - ${rid} $(printf '%s' "$detail" | jq -r '"\(.name) [\(.source_type) \(.source)]"')
"
    raw="$detail"
  fi
done

set -- $matching_ids
count=$#

if [ "$count" -eq 0 ]; then
  echo "FAIL: no branch ruleset on ${REPO} covers ${branch_ref}."
  echo "      The gate described in docs/agents/branch-protection.md does not exist."
  exit 1
fi

if [ "$count" -gt 1 ]; then
  echo "FAIL: ${count} rulesets gate ${branch_ref}, and the artifact describes one."
  printf '%s' "$matching_desc"
  echo "      A second gate is drift whatever it claims to target — it can add"
  echo "      requirements or bypass actors this repository never reviewed."
  exit 1
fi

id="$1"

# The credential's expiry is recorded nowhere and cannot be read from the secret
# — its value exists only inside a run. GitHub returns it in a response header
# when the token has one, so this states it rather than leaving a silent time
# bomb: an expired token fails at the fetch with an authentication error, which
# is the least informative of the three failure modes and gives no warning.
expiry="$(gh api -i rate_limit 2>/dev/null | tr -d '\r' \
          | awk -F': ' 'tolower($1)=="github-authentication-token-expiration"{print $2}' || true)"
if [ -n "$expiry" ]; then
  echo "CREDENTIAL: expires ${expiry}"
else
  echo "CREDENTIAL: no expiry reported — this token either does not expire or"
  echo "  GitHub discloses none for it. Nothing here will warn before it stops"
  echo "  working; the run would simply start failing at the fetch."
fi
echo

# A token without administration rights can read the ruleset but gets a reduced
# view: bypass_actors comes back null. See the header — that is a failure.
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
    echo "       Re-run with a token that has administration read."
    exit 1
  fi
  mkdir -p "$(dirname "$ARTIFACT")"
  printf '%s\n' "$raw" | normalise > "$ARTIFACT"
  echo "Wrote live ruleset ${id} to ${ARTIFACT}."
  exit 0
fi

if [ "$invisible" = true ]; then
  echo "FAIL: bypass_actors is absent from this response."
  echo "      NOT COMPARABLE — 'no bypass for anyone' cannot be verified by this"
  echo "      caller. Run with a token that has administration read (CI uses"
  echo "      RULESET_READ_TOKEN; if this is CI, that secret is missing or lacks"
  echo "      the permission)."
  exit 1
fi

live="$(printf '%s' "$raw" | normalise)"

if [ ! -f "$ARTIFACT" ]; then
  echo "FAIL: ${ARTIFACT} is missing. Run with --write to create it."
  exit 1
fi

if diff -u <(normalise < "$ARTIFACT") <(printf '%s\n' "$live") \
     --label "$ARTIFACT" --label "GitHub ruleset ${id}"; then
  echo "OK: ${ARTIFACT} matches the live ruleset, bypass_actors included."
else
  echo
  live_st="$(printf '%s' "$raw" | jq -r '.source_type // "?"')"
  art_st="$(jq -r '.source_type // "?"' "$ARTIFACT")"
  if [ "$live_st" != "$art_st" ]; then
    # source is dropped from the COMPARISON because it fires on a repository
    # rename, but at the moment source_type flips, WHICH organisation now owns
    # the gate is the security-relevant half. Detection and investigation are
    # different jobs.
    echo "SOURCE CHANGED: ${art_st} -> ${live_st}, now owned by $(printf '%s' "$raw" | jq -r '.source // "?"')"
    echo "  The gate is no longer defined where the artifact says it is."
    echo
  fi
  echo "FAIL: the checked-in ruleset and GitHub disagree."
  echo "      Decide which is right. If the live change was intended, re-run"
  echo "      with --write and commit the artifact so the change is reviewed."
  exit 1
fi
