# 0009. Organizations for part manufacturers

Date: 2026-05-21

## Status

Accepted

## Context

Parts were initially identified by catalog number and a free-text manufacturer name. The manufacturer now needs to be stored as a reusable database record, but the product should not introduce a manufacturer-only table or UI because the same real-world entity may later act as a supplier, buyer, or another role.

Supplier role modeling, buyer workflows, purchase-order behavior, and pricing policy are still undefined and should not be inferred from this decision.

## Decision

Add workspace-scoped organizations as the generic table for real-world entities that can play roles in workshop workflows.

Organizations have:

- `workspaceId`
- `name`
- `normalizedName`

Organization roles are stored separately as string role keys. The only role introduced by this decision is `manufacturer`, because that is the role currently needed by parts.

Parts reference their manufacturer through `manufacturerId`, which points to `Organization`. The parts UI may continue accepting manufacturer text, but server-side writes resolve that text to an organization and ensure the `manufacturer` role exists.

## Consequences

- The same organization can later receive more roles without duplicating the entity.
- Manufacturer names can be reused and normalized per workspace.
- No standalone manufacturer management UI is introduced by this decision.
- Future supplier, buyer, and related behavior still require explicit product decisions before implementation.
