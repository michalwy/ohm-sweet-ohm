# ADR 0019 — Internal Organization for Design Output Parts

**Status:** Accepted  
**Date:** 2026-06-26

## Context

The Design entity (issue #61) requires each Design to own an output Part. A Part in OSO is always identified by manufacturer organization and catalog number. Design output parts are not purchased from any real supplier — they are assembled in-house — so they need a manufacturer organization that:

- Is invisible to the user in the Organizations list and in the manufacturer autocomplete on the part form.
- Is unique per workspace (one internal org per workspace, shared across all designs in that workspace).
- Is created on demand the first time a Design is created, without requiring manual setup.

## Decision

Each workspace has at most one **internal organization**, identified by `isInternal = true` on the `Organization` model. The internal org is created lazily by `ensureInternalOrganizationForWorkspace()` and reused for all subsequent Design output parts in the same workspace.

### Schema

```prisma
model Organization {
  isInternal Boolean @default(false)
  ...
}
```

### Filtering

All queries that expose organizations to the user — `getOrganizationsForWorkspace()` and `getManufacturerSuggestionsForPartForm()` — apply `where: { isInternal: false }` to exclude the internal org.

### Normalized name

The internal org's `normalizedName` is prefixed with `__internal__` (e.g. `__internal__acme`). This prevents uniqueness collisions with user-created organizations that happen to share the same display name as the workspace.

### Creation

`ensureInternalOrganizationForWorkspace({ workspaceId, workspaceName })`:

1. Check for an existing org with `isInternal: true` in the workspace. Return it if found.
2. Otherwise, create a new org with `isInternal: true`, `normalizedName: "__internal__" + normalize(workspaceName)`, and the `manufacturer` role.

This function is called inside the `createDesign()` transaction, so the internal org is always present before the output part is created.

## Consequences

- The internal org is a first-class database row but is invisible at the application layer unless accessed through the Design domain.
- Renaming the workspace does not rename the internal org (the name is cosmetic and not user-visible).
- If the internal org row is accidentally exposed (e.g. via a raw query), its `isInternal` flag and `__internal__` normalizedName prefix make it identifiable.
- Future system-owned data that requires an invisible manufacturer (e.g. imported parts from an integration) can reuse the same internal org pattern.
