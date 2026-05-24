# 0011. Category Attributes

## Status

Accepted

## Context

Part categories need to describe which typed properties are available for parts assigned to that category. A resistor category may expose `Resistance` and `Power Rating`; a capacitor category may expose `Capacitance` and `Rated Voltage`. Part rows also need a short **Value** column driven by the category's value attribute.

Parts can have a primary category and an optional secondary category, as documented in [0008. Part Categories](0008-part-categories.md). Part forms use the union of attributes from both categories, with primary category configuration taking precedence when the same attribute appears in both categories. The parts-list **Value** column is still driven only by the primary category.

## Decision

Add a workspace-scoped attribute dictionary. An attribute is identified by its database `id`, not by a user-facing key. Attribute names are editable, but normalized names are unique within a workspace after trimming, collapsing whitespace, and comparing case-insensitively.

Attributes have:

- `name`
- `description`
- `type`: `TEXT`, `NUMBER`, `QUANTITY`, `BOOLEAN`, or `CHOICE`
- `baseUnitSymbol`, only for `QUANTITY`
- choice options, only for `CHOICE`

Choice options have stable ids and editable labels. Option labels are unique per attribute after trimming, collapsing whitespace, and comparing case-insensitively. Part values store the option id, not the option label.

Categories attach attributes through `CategoryAttribute`. This record represents either a local attachment or an override of an inherited attachment. Category attribute configuration contains:

- `sortOrder`
- optional `defaultValue`
- `isPrimary`, which marks an attribute as a primary part-form attribute

All attributes are optional. There is no `required` flag in this model. Future completeness workflows should use recommendations, reports, filters, or export-specific validation rather than blocking part saves.

The category's value attribute is stored as nullable `PartCategory.valueAttributeId`, not as a boolean on `CategoryAttribute`. The value attribute controls the parts-list **Value** column and is always shown on the first tab of the part dialog. A category may have no value attribute. If it has one, it must point to an attribute that is effective for that category, either locally attached or inherited.

`CategoryAttribute.isPrimary` is separate from `valueAttributeId`. A category may mark multiple effective attributes as primary. A value attribute does not need to have `isPrimary` set.

## Inheritance

Categories remain a single-parent tree. Effective attributes are computed dynamically from the ancestor chain:

- A child inherits all attribute attachments from its parent.
- With multiple levels such as `A » B » C`, `B` inherits from `A`, and `C` inherits from the effective set of `B`.
- Adding an attribute to `A` later makes it effective for `B` and `C` automatically.
- A child can attach the same dictionary attribute to override category-level configuration such as `sortOrder` or `defaultValue`.
- A child override can also override `isPrimary`.
- A child cannot disable an inherited attribute in the first version.
- If a child has no `valueAttributeId`, it inherits the nearest value attribute from its ancestors.
- A child cannot clear an inherited value attribute without selecting a different effective value attribute.
- Effective attributes are sorted by effective `sortOrder`, then attribute name.

Default values are category-level form defaults. They prefill new or missing values in part forms. If the user saves the form with that value, it becomes a normal `PartAttributeValue`. Later changes to defaults do not update existing part values. An override with an empty default intentionally clears an inherited default.

## Typed Values

Part values are stored by `Attribute.id`, independent of the category attachment that made the attribute effective. Server-side validation must ensure submitted values are only accepted for attributes effective in the part's current primary and secondary category union after deduplication.

Changing a part's primary or secondary category does not delete existing `PartAttributeValue` records. Values that are not effective in the new category union are hidden from the part form and the parts-list **Value** column, but remain attached to the part. If that attribute later becomes effective for the part again, the previous value should be shown and used.

Typed value storage keeps normalized values for comparison/search and display values for UI:

- `TEXT`: cleaned text display; search/filter comparisons are case-insensitive.
- `NUMBER`: normalized numeric value plus cleaned display value.
- `QUANTITY`: normalized base-unit value plus cleaned display value.
- `BOOLEAN`: boolean value; display is `Yes` or `No`.
- `CHOICE`: choice option id; display uses the option label.

For `QUANTITY`, the attribute defines one base unit. Missing unit input means the base unit. The parser accepts known SI prefixes and aliases, then normalizes display to a canonical unit form while preserving the user's chosen scale. Supported prefixes are `p`, `n`, `µ`/`u`, `m`, no prefix, `k`, `M`, and `G`.

Examples for `Resistance` with base unit `Ω`:

- `10 kohm`, `10 k`, `10kΩ`, and `10000 Ω` normalize to the same base value.
- `10kohm` displays as `10 kΩ`.
- `10000` displays as `10000 Ω`.
- `4,7 kΩ` displays as `4.7 kΩ`.
- Unknown units are rejected.

Tolerances and ranges are not part of `QUANTITY`; they should be modeled as separate attributes when needed.

## Mutation Rules

If any part value exists for an attribute, block changes to the attribute's `type` and `baseUnitSymbol`.

For `CHOICE` attributes:

- Adding an option is allowed.
- Editing an option label is allowed.
- Deleting an option is allowed only when it is not used by any part value or category default.

Deleting a dictionary attribute is allowed only when it is not attached to any category, used as any category value attribute, used by any part value, or used by any default value.

Detaching a local attribute attachment from a category is always allowed. Detaching the attachment does not delete existing part values for that attribute. If the local attachment overrides an inherited attachment for the same attribute, detaching the local attachment reveals the inherited effective attribute again. Descendant category overrides are independent local attachments and are not removed by detaching an ancestor attachment.

The application must validate that attributes, categories, parts, choice options, category attachments, defaults, and values all belong to the same workspace. Database foreign keys do not fully express this cross-table workspace invariant, so server-side domain code must enforce it.

## UI Implementation Brief

Build UI in a separate step after the schema/domain layer is in place. Keep the app desktop-only.

Attribute dictionary screen:

- Add a workspace-scoped attribute management surface guarded by `attributes:read` and `attributes:write`.
- Use a dense table layout with columns for name, type, base unit, option summary, and description.
- Use modal dialogs for add/edit workflows.
- Enforce English user-facing copy.
- For `QUANTITY`, show base unit as a required field.
- For `CHOICE`, manage options with stable rows, sort order, and case-insensitive duplicate-label validation.
- Disable or explain blocked edits when a type, base unit, option, or attribute is already used.

Category attribute configuration:

- Extend category management so a selected category shows effective attributes from ancestors and local/override records.
- Clearly distinguish inherited attributes from local attachments/overrides.
- Allow attaching a dictionary attribute to a category.
- Allow overriding `sortOrder`, `defaultValue`, and `isPrimary`.
- Do not offer a control to disable inherited attributes.
- Allow selecting one effective attribute as the category's value attribute, or leaving value unset when no value attribute exists in the ancestor chain.
- If the category inherits a value attribute, do not offer a "clear inherited value" action; changing value requires selecting another effective attribute.
- Allow marking any effective attribute as primary with a checkbox or toggle. Changing `isPrimary` on an inherited attribute creates a local override for that attribute.

Part create/edit form:

- Use two tabs: **Details** and **Attributes**. The dialog still has one logical save action that saves values from both tabs.
- The effective attribute set is the primary category effective attributes plus the secondary category effective attributes, deduplicated by `Attribute.id`.
- When the same attribute appears in both categories, the primary category configuration wins for ordering, default value, `isPrimary`, and value-attribute behavior.
- Overall attribute ordering is all primary category attributes by effective `sortOrder`, followed by secondary category attributes that do not appear in primary category by effective `sortOrder`.
- The **Details** tab shows normal part fields, then separate attribute sections. Empty attribute sections are hidden.
- The **Details** tab attribute sections are: the primary category value attribute, primary attributes from the primary category, and primary attributes from the secondary category.
- The primary category value attribute is shown first on **Details** when it exists. It is not duplicated if it is also marked `isPrimary`.
- A secondary category value attribute does not affect the **Value** column and is shown on **Attributes** unless it is also marked `isPrimary`.
- The **Attributes** tab shows all remaining attributes in separate primary category and secondary category sections.
- Prefill missing values from effective defaults. Primary category defaults win over secondary category defaults for duplicate attributes.
- Store saved values as normal `PartAttributeValue` records.
- When changing primary or secondary category, reload the effective attribute list immediately. Values outside the new effective set are hidden but preserved.

Parts list:

- Keep the column label **Value**.
- Resolve the row value from the part's primary category effective value attribute.
- Show the part's display value for that attribute.
- Leave the column empty when there is no effective value attribute on the primary category or the part has no value for it.

## Consequences

This model keeps attribute meaning in one workspace dictionary while leaving category-specific behavior in category attachments, primary attribute flags, and value-attribute selection.

The first implementation deliberately avoids global attribute templates, localization tables, required attributes, category-specific choice subsets, and inherited-attribute disabling. These can be added later when concrete workflows require them.

## Handoff Notes

Implemented so far:

- Attribute dictionary schema, migration, generated Prisma client, permissions, server mutations, and parsing/normalization helpers.
- Attribute dictionary UI at `/w/[workspaceSlug]/attributes` with shared create/edit dialog and draft-based choice option editing.
- Category dialog tabs where attribute attachments are edited inside the same create/edit category dialog.
- Category attribute attachment drafts are only persisted by the dialog-level save action.
- Category attribute defaults use type-aware controls for `CHOICE` and `BOOLEAN`; other types still use text input parsed server-side.
- Part create/edit and list integration for effective category attributes and value attribute display.
- Part values are preserved when category attribute attachments are detached or when a part's primary category changes.
- Detaching a local category attribute override falls back to the inherited attribute when one exists.
- Unit coverage for inheritance and parsing, plus e2e coverage for attribute dictionary and category attribute configuration flows.

Recommended next steps:

- Manually review the category attribute tab in Docker Compose with a realistic set of attributes, especially inherited defaults, local overrides, and the compact grid layout.
- Add focused e2e coverage for inherited primary/default behavior across a three-level category tree.
- Add e2e coverage for editing an existing attached `CHOICE`/`BOOLEAN` default value, not only attaching a new one.
- Consider a clearer loading state for the category attribute tab; the editor is intentionally withheld until effective attributes load to avoid draft overwrite races.
- Consider extracting shared typed default-value controls once part forms and category default controls converge.
- Decide the first filtering/search workflow before adding indexes or UI for normalized attribute value search.
