# ADR 0024 — Shortage Analysis for Design Revisions

**Status:** Accepted  
**Date:** 2026-07-03

> **Extended by [ADR 0025](0025-shortage-to-shopping-list.md).** `ProcurementItem` gained a
> `candidates` field for shopping-list substitution (issue #166).

## Context

A Design revision has a bill of materials (ADR 0020, issue #62) and an output part
(ADR 0019, issue #61), and builds consume stock through a state machine (ADR 0021).
Before committing to a build, a user needs to know — for a chosen target quantity — which
BOM components cannot be fulfilled from current stock and what must be purchased or
sub-built (issue #65). Nothing surfaced this: match counts show whether *any* part matches
a spec, but not whether *enough* stock exists.

Complicating factors: a BOM line can match several parts; a matched part can itself be the
output part of another Design (a sub-assembly); and the same part can be demanded by
several lines or sub-designs.

## Decision

Add a read-only domain service `analyzeShortage()`
(`src/server/designs/shortageAnalysis.ts`) that explodes a revision's BOM against stock for
a target quantity and returns per-line shortages, an exploded leaf-level procurement list,
and any detected cycles. It reuses `findMatchingParts()` (ADR 0020) for spec resolution and
is authorized by `designs:read` — no new permission or schema change.

### Availability

Part availability = `currentStock − reservedQty`. `allocatedQty`, `onOrderQty`, and
`plannedQty` do **not** reduce it. This matches the availability formula already used across
the parts list and build flow.

### Aggregate across matches

A line's available quantity is the summed available stock of **all** parts matching its
spec. A line is short only when the combined pool cannot cover `designatorCount × target`.
This is consistent with builds splitting one line's allocation across multiple parts
(ADR 0023, #64).

### Shared pool, netted once

Each part's available stock is a single pool consumed as the BOM tree is walked, so a part
used by multiple lines or sub-designs competes for one pool. This keeps the procurement
list honest instead of double-counting the same stock.

### Recursive resolution

When a matched part is the output part of another Design, its own available stock is netted
first, then the still-unmet remainder explodes into that Design's **latest** revision
(multiplied by the remaining unit count). Only leaf (non-Design-output) parts land in the
procurement list; intermediate sub-assemblies never appear there.

### Sourcing choice and cycle detection

The unmet remainder of a line is sourced from the **first** matching candidate in the
deterministic order `findMatchingParts()` returns (catalog number ascending): build it if
it is a sub-design output, otherwise add it to procurement. Design ids on the current
recursion path are tracked; re-entering a design is reported as a `CycleReport` (path of
design names) and that branch stops, so cycles are surfaced rather than looped infinitely.

### UI

The analysis is rendered by a shared client component `ShortagePanel`
(`src/app/shortage-panel.tsx`) used in two places: the Design revision details panel (with
its own target-quantity input) and the build create dialog (a preview keyed to the selected
revision and target quantity). It never blocks build creation — it only informs.

## Consequences

- Users get an actionable "what to buy / what to build" answer before starting a build.
- The analysis is computed on demand in application code (like match counts), re-running
  `findMatchingParts()` per line. At workshop scale this is acceptable; if BOMs/inventory
  grow, the pool walk and matching can be pushed toward the query layer later.
- Sourcing the remainder from the first candidate is a deterministic simplification: it does
  not optimize which specific parts to buy when several could satisfy a spec. A future
  revision could add a smarter sourcing/optimization policy without changing the semantics
  above.
- The service is read-only; no migration accompanies this feature.
