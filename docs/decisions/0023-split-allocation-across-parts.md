# ADR 0023 — Split allocation across multiple parts

**Status:** Accepted
**Date:** 2026-07-03

## Context

[ADR 0021](0021-builds-and-stock-state-transitions.md) introduced builds with a **per-line
allocation**: each build line chose a single part and a single source location, shared by all of
its designators. It explicitly deferred *split allocation* — fulfilling one BOM line from more
than one part — to a later change (refs #9).

Issue #64 requires that split. A single BOM line spec (e.g. `R1–R10`, 50 resistors across a 5-board
run) may need to be met from several parts at once — 20 from Yageo, 30 from Royal Ohm — each drawn
from its own storage location. The allocation must be validated against the line's total
requirement, distributed down to individual designators for the assembly list, and overridable per
designator at assembly time when the wrong part is actually used.

Three product decisions shaped the model:

- **Per-unit split.** Quantities are split at the unit level, not only at whole-designator
  boundaries. With `targetQuantity > 1` a single designator's units may come from different parts
  (e.g. `R5` across five boards = 3 Yageo + 2 Royal Ohm). The assembly grain therefore has to be
  finer than "one row per designator."
- **Assembly override to any matching part.** When assembling, the user may switch a designator to
  *any* inventory part that satisfies the line's BOM spec — not only the pre-allocated ones — with
  the reservation moved on the fly.
- **Greedy pre-fill.** On build creation the system greedily pre-fills each line's allocation from
  parts that have stock available, as a starting suggestion the user can override.

## Decision

Separate the **allocation plan** from the **assembly ledger** with two records.

### Data model

```prisma
model BuildLineItem {              // snapshot of one BOM line (no part/location of its own now)
  sourceBomLineItemId String?
  designators         String
  designatorCount     Int
  categoryName        String?
  allocations         BuildLineAllocation[]
  assignments         BuildDesignatorAssignment[]
}

model BuildLineAllocation {        // one part entry in a line's split — the editable plan
  buildLineItemId  String
  partId           String
  sourceLocationId String?
  quantity         Int             // units of this part for the line
}

model BuildDesignatorAssignment {  // per (designator × part) — the assembly ledger
  buildLineItemId   String
  designator        String
  partId            String?        // set by distribution at start
  sourceLocationId  String?
  quantity          Int            // units of this part at this designator
  assembledQuantity Int @default(0)
}
```

`BuildLineItem.partId` / `sourceLocationId` are removed (migration `20260703100000_split_allocation`).

### Allocation plan (`BuildLineAllocation`)

- A line is **fully allocated** when its entries cover `designatorCount × targetQuantity`, each
  entry has a source location, and every entry quantity is a positive integer.
- Allocations are edited only while the build is `CREATED`. The editor holds a draft of **every**
  line and saves them together via `setBuildAllocations`, which replaces the whole build's entries
  in one transaction. A build-wide atomic save is required for correctness: a per-line save
  (`setBuildLineAllocations`, still available as a lower-level operation) can transiently leave the
  build over-allocated if the user, say, moves a part from one line to another but only saves the
  receiving line. An `ALLOCATED` build must be reopened first, keeping the denormalized
  `allocatedQty` consistent.
- **Stock-guarded at edit time.** `setBuildLineAllocations` rejects an allocation that commits more
  of a part than is available (`currentStock − reservedQty`, aggregated across the line's entries
  for that part) or more at a `(part, location)` than that location physically holds. The build is
  still `CREATED`, so it holds no reservation of its own — availability is stock committed
  elsewhere. Stock already allocated by the **build's other lines** is also netted out so two lines
  of one build cannot draw the same units: the server guard re-reads the sibling lines' persisted
  allocations, and the allocation editor nets each line's availability against the **live** drafts
  of the other lines (each line's editor reports its current usage up to the build detail), so
  editing one line immediately re-validates the others before anything is applied. This bounds a
  build's plan to what exists; two *different* builds can still each plan against the same on-hand
  stock (allocation is soft), and the hard availability/location guards at `startBuild` remain the
  safety net for stock that moves between allocation and start.
- The soft `allocatedQty` (at `markBuildAllocated`) and hard `reservedQty` (at `startBuild`) are
  summed **per part across the line entries** — over-allocation of the same part across entries
  simply aggregates.
- On `createBuild`, each line is greedily pre-filled: a pinned line yields a single entry of the
  pinned part (best-stocked location); an unpinned line draws from its matching parts and their
  non-zero locations until the requirement is covered (or stock runs out, leaving a partial
  suggestion). The pass threads a running per-(part, location) usage tally across lines, so lines
  sharing a part do not each claim the same stock. The pure greedy logic lives in
  `src/lib/buildAllocation.ts`.

### Distribution to the assembly ledger

At `startBuild`, after reservation, each line's entries are distributed into
`BuildDesignatorAssignment` rows by `distributeAllocations` (pure, in `src/lib/buildAllocation.ts`):
designators are filled in order, each consuming `targetQuantity` units drawn from the entries in
order. A designator emits one row per part it draws from, so a per-unit split yields multiple rows
for that designator. Rows are created only at start — a `CREATED`/`ALLOCATED` build has none.

### Assembly and override

- `assembleDesignator` issues from the **assignment row's** own `partId`/`sourceLocationId`
  (previously the line's), decrements `reservedQty`, and bumps `assembledQuantity`. Completion is
  unchanged: the build auto-completes when Σ `assembledQuantity` = Σ `quantity` across all rows.
- `reassignDesignatorAssignment` overrides a not-yet-assembled row (`assembledQuantity === 0`) in
  `STARTED`/`IN_PROGRESS`: it accepts any part satisfying the line's live BOM spec (via
  `findMatchingParts`), validates the new source-location balance, and moves the reservation from
  the old part to the new one.

### Stock guards

`startBuild` keeps ADR 0021's two guards, now aggregated across entries: per-part availability
(`currentStock − reservedQty ≥ required`) and, per **(part, source location)**, a physical balance
that covers that pair's aggregated requirement.

## Consequences

- The state machine, `allocated`/`reserved`/`assembled` semantics, `availableQty`, cancellation
  (assembled parts never reversed), and the location-based consumption primitive from ADR 0021 are
  all unchanged. Only the allocation grain changed.
- Cancellation releases the remaining hold from the correct source: `ALLOCATED` from the allocation
  entries (`allocatedQty`), `STARTED`/`IN_PROGRESS` from the un-assembled portion of the designator
  rows (`reservedQty`).
- The allocation math is pure and unit-tested (`tests/unit/buildAllocation.test.ts`); the
  end-to-end split, per-unit split, and reassignment behavior are covered in
  `tests/integration/builds.test.ts`.
- Shortage analysis remains out of scope (refs #9).
