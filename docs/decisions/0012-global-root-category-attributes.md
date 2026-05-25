# 0012. Global Root Category Attributes

## Status

Accepted

## Context

Workspace categories already support inherited attribute configuration along the category tree.
A requested next step is defining attributes that automatically apply to every root category, and therefore to all descendants through normal category inheritance.

## Decision

Add a new workspace-scoped attachment layer: `WorkspaceAttribute`.

- `WorkspaceAttribute` stores attribute attachment configuration (`sortOrder`, `defaultValue`, `isPrimary`) at workspace level.
- Effective category attributes are resolved from three levels, in order:
  1. workspace-level attachments,
  2. root-to-leaf category chain,
  3. local overrides on the selected category.
- Existing override behavior remains unchanged: a local category attachment for the same attribute overrides inherited configuration.
- This model does not introduce a workspace-level value attribute. Category `valueAttributeId` remains category-scoped.

## Consequences

- Global attribute changes are centralized and automatically affect all root categories.
- Newly created root categories inherit global attributes immediately.
- Existing delete guards for attributes and choice options must include workspace-level defaults/attachments.
- UI gains a dedicated workspace-level global attributes editor from the part categories screen.
