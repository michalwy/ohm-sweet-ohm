# 0008. Part Categories

## Status

Accepted

## Context

OhmSweetOhm parts currently represent real purchasable electronic parts identified by manufacturer name and catalog number. Parts need optional category assignment so a home electronics workshop can organize parts without requiring a complete taxonomy up front.

Category behavior must support a tree. Some categories are only for organizing that tree, for example `Passives`, and cannot be assigned directly to parts. Future category filtering should include all descendants: filtering by `Passives` should include parts assigned to `Passives » Capacitors`, `Passives » Resistors`, and other nested categories.

## Decision

Add workspace-scoped part categories.

Part categories have:

- `parentId` for the direct tree relationship.
- `isAssignable` to identify categories that can be assigned to parts.
- The UI label **Organizational** for categories where `isAssignable` is false.
- The UI label **Assignable** for categories where `isAssignable` is true.

Parts may have no category assignment. When categories are assigned, a part may have:

- A primary category.
- A secondary category only when a primary category is set.

Primary and secondary categories must be different. Both must belong to the part's workspace and both must be assignable.

Use a closure table for category ancestry. Each category has a self-row with depth `0`, and each ancestor/descendant relationship has a row with positive depth. This keeps future filtering by a whole category branch straightforward and database-backed.

Add explicit category permissions:

- `part-categories:read`
- `part-categories:write`

Part forms may read the minimal category data needed for assignment when the user has either `parts:write` or `part-categories:read`. This keeps part editing usable for users who can modify parts while still allowing category management to have its own permissions.

## Consequences

Category management UI can be added later without changing the core authorization model.

Filtering parts by category branch can use the closure table to find descendants and then match parts by primary or secondary category.

The application must maintain closure rows whenever category management starts creating, moving, or deleting categories.
