# ADR 0026 — Part Balance Quantity

**Status:** Accepted
**Date:** 2026-07-06

## Context

Issue #186 asks for a single at-a-glance figure answering "how well covered is this part
once everything already in motion lands, net of what's already earmarked for planned
builds." Today a user has to mentally combine `availableQty` (ADR 0021,
`currentStock − reservedQty`), `onOrderQty` (incoming via POs), `inProductionQty` (ADR
0021's extension for #184, incoming via other active builds), and `allocatedQty`
(ADR 0021/0025, soft-committed to `ALLOCATING` builds).

## Decision

Add `Part.balanceQty`:

```
balanceQty = availableQty + onOrderQty + inProductionQty − allocatedQty
           = (currentStock − reservedQty) + onOrderQty + inProductionQty − allocatedQty
```

Every input is already a live-maintained plain column on `Part`. Like `availableQty`
(#173), `balanceQty` therefore has **no independent write path** — so it is a Postgres
`GENERATED ALWAYS ... STORED` column, computed and indexed by the database, rather than a
sixth transactionally-maintained field touched by every build/PO mutation site. Postgres
generated columns cannot reference another generated column, so the expression is spelled
out against the base columns (`currentStock`, `reservedQty`, `onOrderQty`,
`inProductionQty`, `allocatedQty`) instead of reusing `availableQty`.

This is purely informational, like `onOrderQty`/`plannedQty`/`inProductionQty` — it does
not feed back into `availableQty` or any allocation guard.

### Display and permissions

Displayed as **Balance**, both as a hidden-by-default parts-list column (consistent with
the other secondary quantity columns, sortable via the same DB-level keyset sort used for
`availableQty`/`inProductionQty`) and as a value in the part details side panel.

`balanceQty` mixes fields gated behind three separate permissions today
(`inventory:read` for `currentStock`/`reservedQty`/`allocatedQty`, `purchase-orders:read`
for `onOrderQty`, `builds:read` for `inProductionQty`). A partially-computed balance that
silently drops a term would misrepresent the figure, so it is shown only when the user
holds **all three** read permissions; otherwise it is omitted entirely, same as any other
gated column.

## Consequences

- No new write sites in `src/server/builds/builds.ts` or
  `src/server/inventory/entryMutations.ts` — the column is always correct by construction.
- `balanceQty` sorts and paginates through the existing `getDecimalFieldSortedPartsListPage`
  helper (ADR-adjacent to #173's sorting work), same as `availableQty`.
- If a future quantity is added to the formula (or the formula itself changes), the
  generated expression must be dropped and recreated — there is no in-place `ALTER
  ... GENERATED` in Postgres.

## Related

- ADR 0021 — Builds and Stock State Transitions (`allocatedQty`, `reservedQty`,
  `availableQty`, `inProductionQty` definitions)
- ADR 0025 — Continuous Build Allocation (current live-maintenance of `allocatedQty`/
  `plannedQty`/`inProductionQty`)
- #173 — parts-list sorting infrastructure and the `availableQty` generated-column
  precedent
- #184 — `inProductionQty`
- #186 — this feature
