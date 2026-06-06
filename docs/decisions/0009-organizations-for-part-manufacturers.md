# 0009. Organizations for part manufacturers

Date: 2026-05-21  
Updated: 2026-06-06

## Status

Accepted

## Context

Parts were initially identified by catalog number and a free-text manufacturer name. The manufacturer now needs to be stored as a reusable database record, but the product should not introduce a manufacturer-only table or UI because the same real-world entity may later act as a supplier, buyer, or another role.

## Decision

Add workspace-scoped organizations as the generic table for real-world entities that can play roles in workshop workflows.

Organizations have:

- `workspaceId`
- `name`
- `normalizedName`

Organization roles are stored separately as string role keys in the `OrganizationRole` join table (composite primary key on `organizationId + role`). Roles are plain strings, not an enum, to allow future extension without schema changes.

Currently implemented roles:

| Role | Constant | Usage |
|------|----------|-------|
| `manufacturer` | `ORGANIZATION_ROLE_MANUFACTURER` | Referenced by parts as `manufacturerId` |
| `supplier` | `ORGANIZATION_ROLE_SUPPLIER` | Referenced by purchase orders as `supplierId` |

One organization can hold multiple roles simultaneously.

### Parts / Manufacturer behavior

Parts reference their manufacturer through `manufacturerId → Organization`. The part form accepts free-text manufacturer input; server-side writes resolve that text to an organization and ensure the `manufacturer` role exists (`ensureOrganizationWithRole`). Manufacturer suggestions in the part form are filtered to organizations with the `manufacturer` role.

### Purchase Orders / Supplier behavior

Purchase orders reference their supplier through `supplierId → Organization`. The supplier dropdown in the purchase order and shopping-list-to-order conversion dialogs is filtered to organizations with the `supplier` role.

### Management UI

A dedicated **Organizations** screen (`/w/[workspaceSlug]/organizations`) allows creating, editing, and deleting organizations and assigning roles. Protected by `organizations:read` and `organizations:write` permissions.

## Consequences

- The same organization can hold multiple roles without duplicating the entity.
- Organization names are normalized and unique per workspace.
- Manufacturer names typed in the part form automatically create/reuse an organization with the `manufacturer` role; users can then add the `supplier` role via the management UI if needed.
- Supplier dropdowns show only organizations with the `supplier` role; if no suppliers are configured, an empty-state message guides users to the Organizations page.
- Buyer workflows and pricing policy still require explicit product decisions before implementation.
