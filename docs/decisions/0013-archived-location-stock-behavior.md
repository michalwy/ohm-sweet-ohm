# 0013 Archived Location Stock Behavior

- Status: Accepted
- Date: 2026-06-01

## Context

OSO supports archiving storage locations. Inventory movement validation already blocks using archived locations as movement endpoints. However, archived locations can still have non-zero balances from historical entries, and behavior around archiving with remaining stock needed to be explicit.

## Decision

For workspace storage locations:

- A location can be archived only when its effective stock balance is zero for every part.
- If stock remains, archiving must fail with a clear validation error.
- Archived locations remain visible in read paths (for example part stock-by-location views) so existing balances do not disappear from inventory context.
- Archived locations remain blocked for new inventory movements.

## Consequences

- Users must move or adjust stock to zero before archiving a location.
- Existing archived locations that still contain stock in historical data remain visible and read-only until stock is reconciled.
- Server-side location update logic must compute per-part location balances from inventory-entry history when evaluating archive requests.
