# ADR 0025 — Create Shopping List From Shortage Analysis

**Status:** Accepted
**Date:** 2026-07-05

## Context

[ADR 0024](0024-shortage-analysis.md) added `analyzeShortage()` and the shared `ShortagePanel`
UI, which reports a leaf-level procurement list of parts the user needs to buy or sub-build
for a Design revision, but offers no path from that insight to action (issue #166). A BOM
line's shortage can be filled by more than one matching part (ADR 0020), and
`analyzeShortage()` already resolves that ambiguity internally — sourcing the unmet
remainder from the first matching candidate, catalog number ascending — purely to compute a
single procurement total per part. ADR 0024 left open whether a smarter or user-driven
sourcing choice should exist.

## Decision

Add a **shopping-list-creation-time** part choice, without touching `analyzeShortage()`'s
existing deterministic output.

### `ProcurementItem.candidates`

`ProcurementItem` (`src/server/designs/shortageAnalysis.ts`) gains a `candidates:
ProcurementCandidate[]` field: the other leaf (purchasable) parts that also matched the
spec(s) contributing to that shortage, alongside the already-chosen `partId`. Candidates are:

- Sourced from the `findMatchingParts()` result each contributing BOM line already computes
  (previously discarded after picking `candidates[0]`).
- **Leaf-only**: any candidate that is itself the output part of another Design is excluded.
  Substitution is offered only among parts the user could actually buy, not among
  sub-assemblies the analysis would otherwise recurse into and build — offering a "build"
  candidate as a shopping-list line would contradict the leaf-only procurement principle
  ADR 0024 already established.
- **Unioned across contributions**: the same leaf part can be the deterministic sourcing
  target for several different BOM lines or recursion branches (shared pool, netted once).
  Each contributing line may have a different candidate set (different specs can still
  source the same part), so `candidates` is the deduplicated union across all of them, not
  just the last line's candidate set.

`partId` and `shortageQty` are completely unchanged: they still reflect the same
deterministic first-candidate sourcing rule as before. `candidates` is read-only, additive
data for the UI.

### Shopping list creation flow

A new dialog, `ShortageToShoppingListDialog` (`src/app/shortage-to-sl-dialog.tsx`), is
triggered from a "Create shopping list" action next to the "To acquire" table in
`ShortagePanel`/`ShortageResults` (`src/app/shortage-panel.tsx`) — surfaced identically in
both places `ShortagePanel` is used (design revision detail panel, build create dialog).

- One row per procurement item, quantity defaulting to `shortageQty` (editable).
- A per-row substitute-part `<select>` appears only when `candidates.length > 1`, defaulting
  to the item's own `partId`.
- The user picks an existing shopping list or creates a new one (same UX as the existing
  single-part quick-add flow, extracted into a shared `useShoppingListTarget` hook).
- On submit, rows are deduplicated/summed by the (possibly overridden) part id client-side,
  then added via the existing bulk-add mutation
  (`addMultipleShoppingListItemsForWorkspace`, from issue #45).

No new permission is introduced: the action is gated on the caller already holding
`shopping-lists:write` (checked where `ShortagePanel`/`ShortageAnalysisModal` are rendered),
and the underlying mutations self-authorize as they already did.

### Resolution of ADR 0024's open question

The override is **purely a shopping-list-creation-time convenience**. It has no effect on
`analyzeShortage()`'s sourcing rule, the shared availability pool, or any other consumer of
the analysis (e.g. the build-create shortage preview). A future smarter sourcing/optimization
policy, if ever added, remains a separate concern.

## Consequences

- Users can go from "what's short" straight to a shopping list without manually looking up
  each part, with a substitution choice when the spec is ambiguous.
- `ProcurementItem` responses grow modestly (an extra small array per item); acceptable at
  the same workshop scale ADR 0024 already accepted for the rest of the analysis.
- Because candidates are unioned across contributing lines/recursions, the substitution
  list for a given shortage is a simplification: it does not track which specific
  contributing line each candidate came from, or guarantee every candidate could fully cover
  every contributing line's portion of the shortage. This mirrors the netted, shared-pool
  simplification ADR 0024 already makes for the shortage totals themselves.

> **Extended by this ADR.** See [ADR 0024](0024-shortage-analysis.md) for the base shortage
> analysis this builds on.
