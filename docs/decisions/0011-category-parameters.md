# 0011. Category Parameters

## Status

Accepted

## Context

Part categories need to describe which typed properties are available for parts assigned to that category. A resistor category may expose `Resistance` and `Power Rating`; a capacitor category may expose `Capacitance` and `Rated Voltage`. Part rows also need a short **Value** column driven by the category's value parameter.

Parts can have a primary category and an optional secondary category, as documented in [0008. Part Categories](0008-part-categories.md). Part forms use the union of parameters from both categories, with primary category configuration taking precedence when the same parameter appears in both categories. The parts-list **Value** column is still driven only by the primary category.

## Decision

Add a workspace-scoped parameter dictionary. A parameter is identified by its database `id`, not by a user-facing key. Parameter names are editable, but normalized names are unique within a workspace after trimming, collapsing whitespace, and comparing case-insensitively.

Parameters have:

- `name`
- `description`
- `type`: `TEXT`, `NUMBER`, `QUANTITY`, `BOOLEAN`, or `CHOICE`
- `baseUnitSymbol`, only for `QUANTITY`
- choice options, only for `CHOICE`

Choice options have stable ids and editable labels. Option labels are unique per parameter after trimming, collapsing whitespace, and comparing case-insensitively. Part values store the option id, not the option label.

Categories attach parameters through `CategoryParameter`. This record represents either a local attachment or an override of an inherited attachment. Category parameter configuration contains:

- `sortOrder`
- optional `defaultValue`
- `isPrimary`, which marks a parameter as a primary part-form parameter

All parameters are optional. There is no `required` flag in this model. Future completeness workflows should use recommendations, reports, filters, or export-specific validation rather than blocking part saves.

The category's value parameter is stored as nullable `PartCategory.valueParameterId`, not as a boolean on `CategoryParameter`. The value parameter controls the parts-list **Value** column and is always shown on the first tab of the part dialog. A category may have no value parameter. If it has one, it must point to a parameter that is effective for that category, either locally attached or inherited.

`CategoryParameter.isPrimary` is separate from `valueParameterId`. A category may mark multiple effective parameters as primary. A value parameter does not need to have `isPrimary` set.

## Inheritance

Categories remain a single-parent tree. Effective parameters are computed dynamically from the ancestor chain:

- A child inherits all parameter attachments from its parent.
- With multiple levels such as `A / B / C`, `B` inherits from `A`, and `C` inherits from the effective set of `B`.
- Adding a parameter to `A` later makes it effective for `B` and `C` automatically.
- A child can attach the same dictionary parameter to override category-level configuration such as `sortOrder` or `defaultValue`.
- A child override can also override `isPrimary`.
- A child cannot disable an inherited parameter in the first version.
- If a child has no `valueParameterId`, it inherits the nearest value parameter from its ancestors.
- A child cannot clear an inherited value parameter without selecting a different effective value parameter.
- Effective parameters are sorted by effective `sortOrder`, then parameter name.

Default values are category-level form defaults. They prefill new or missing values in part forms. If the user saves the form with that value, it becomes a normal `PartParameterValue`. Later changes to defaults do not update existing part values. An override with an empty default intentionally clears an inherited default.

## Typed Values

Part values are stored by `Parameter.id`, independent of the category attachment that made the parameter effective. Server-side validation must ensure submitted values are only accepted for parameters effective in the part's current primary and secondary category union after deduplication.

Changing a part's primary or secondary category does not delete existing `PartParameterValue` records. Values that are not effective in the new category union are hidden from the part form and the parts-list **Value** column, but remain attached to the part. If that parameter later becomes effective for the part again, the previous value should be shown and used.

Typed value storage keeps normalized values for comparison/search and display values for UI:

- `TEXT`: cleaned text display; search/filter comparisons are case-insensitive.
- `NUMBER`: normalized numeric value plus cleaned display value.
- `QUANTITY`: normalized base-unit value plus cleaned display value.
- `BOOLEAN`: boolean value; display is `Yes` or `No`.
- `CHOICE`: choice option id; display uses the option label.

For `QUANTITY`, the parameter defines one base unit. Missing unit input means the base unit. The parser accepts known SI prefixes and aliases, then normalizes display to a canonical unit form while preserving the user's chosen scale. Supported prefixes are `p`, `n`, `µ`/`u`, `m`, no prefix, `k`, `M`, and `G`.

Examples for `Resistance` with base unit `Ω`:

- `10 kohm`, `10 k`, `10kΩ`, and `10000 Ω` normalize to the same base value.
- `10kohm` displays as `10 kΩ`.
- `10000` displays as `10000 Ω`.
- `4,7 kΩ` displays as `4.7 kΩ`.
- Unknown units are rejected.

Tolerances and ranges are not part of `QUANTITY`; they should be modeled as separate parameters when needed.

## Mutation Rules

If any part value exists for a parameter, block changes to the parameter's `type` and `baseUnitSymbol`.

For `CHOICE` parameters:

- Adding an option is allowed.
- Editing an option label is allowed.
- Deleting an option is allowed only when it is not used by any part value or category default.

Deleting a dictionary parameter is allowed only when it is not attached to any category, used as any category value parameter, used by any part value, or used by any default value.

Detaching a local parameter attachment from a category is always allowed. Detaching the attachment does not delete existing part values for that parameter. If the local attachment overrides an inherited attachment for the same parameter, detaching the local attachment reveals the inherited effective parameter again. Descendant category overrides are independent local attachments and are not removed by detaching an ancestor attachment.

The application must validate that parameters, categories, parts, choice options, category attachments, defaults, and values all belong to the same workspace. Database foreign keys do not fully express this cross-table workspace invariant, so server-side domain code must enforce it.

## UI Implementation Brief

Build UI in a separate step after the schema/domain layer is in place. Keep the app desktop-only.

Parameter dictionary screen:

- Add a workspace-scoped parameter management surface guarded by `parameters:read` and `parameters:write`.
- Use a dense table layout with columns for name, type, base unit, option summary, and description.
- Use modal dialogs for add/edit workflows.
- Enforce English user-facing copy.
- For `QUANTITY`, show base unit as a required field.
- For `CHOICE`, manage options with stable rows, sort order, and case-insensitive duplicate-label validation.
- Disable or explain blocked edits when a type, base unit, option, or parameter is already used.

Category parameter configuration:

- Extend category management so a selected category shows effective parameters from ancestors and local/override records.
- Clearly distinguish inherited parameters from local attachments/overrides.
- Allow attaching a dictionary parameter to a category.
- Allow overriding `sortOrder`, `defaultValue`, and `isPrimary`.
- Do not offer a control to disable inherited parameters.
- Allow selecting one effective parameter as the category's value parameter, or leaving value unset when no value parameter exists in the ancestor chain.
- If the category inherits a value parameter, do not offer a "clear inherited value" action; changing value requires selecting another effective parameter.
- Allow marking any effective parameter as primary with a checkbox or toggle. Changing `isPrimary` on an inherited parameter creates a local override for that parameter.

Part create/edit form:

- Use two tabs: **Details** and **Parameters**. The dialog still has one logical save action that saves values from both tabs.
- The effective parameter set is the primary category effective parameters plus the secondary category effective parameters, deduplicated by `Parameter.id`.
- When the same parameter appears in both categories, the primary category configuration wins for ordering, default value, `isPrimary`, and value-parameter behavior.
- Overall parameter ordering is all primary category parameters by effective `sortOrder`, followed by secondary category parameters that do not appear in primary category by effective `sortOrder`.
- The **Details** tab shows normal part fields, then separate parameter sections. Empty parameter sections are hidden.
- The **Details** tab parameter sections are: the primary category value parameter, primary parameters from the primary category, and primary parameters from the secondary category.
- The primary category value parameter is shown first on **Details** when it exists. It is not duplicated if it is also marked `isPrimary`.
- A secondary category value parameter does not affect the **Value** column and is shown on **Parameters** unless it is also marked `isPrimary`.
- The **Parameters** tab shows all remaining parameters in separate primary category and secondary category sections.
- Prefill missing values from effective defaults. Primary category defaults win over secondary category defaults for duplicate parameters.
- Store saved values as normal `PartParameterValue` records.
- When changing primary or secondary category, reload the effective parameter list immediately. Values outside the new effective set are hidden but preserved.

Parts list:

- Keep the column label **Value**.
- Resolve the row value from the part's primary category effective value parameter.
- Show the part's display value for that parameter.
- Leave the column empty when there is no effective value parameter on the primary category or the part has no value for it.

## Consequences

This model keeps parameter meaning in one workspace dictionary while leaving category-specific behavior in category attachments, primary parameter flags, and value-parameter selection.

The first implementation deliberately avoids global parameter templates, localization tables, required parameters, category-specific choice subsets, and inherited-parameter disabling. These can be added later when concrete workflows require them.

## Handoff Notes

Implemented so far:

- Parameter dictionary schema, migration, generated Prisma client, permissions, server mutations, and parsing/normalization helpers.
- Parameter dictionary UI at `/w/[workspaceSlug]/parameters` with shared create/edit dialog and draft-based choice option editing.
- Category dialog tabs where parameter attachments are edited inside the same create/edit category dialog.
- Category parameter attachment drafts are only persisted by the dialog-level save action.
- Category parameter defaults use type-aware controls for `CHOICE` and `BOOLEAN`; other types still use text input parsed server-side.
- Part create/edit and list integration for effective category parameters and value parameter display.
- Part values are preserved when category parameter attachments are detached or when a part's primary category changes.
- Detaching a local category parameter override falls back to the inherited parameter when one exists.
- Unit coverage for inheritance and parsing, plus e2e coverage for parameter dictionary and category parameter configuration flows.

Recommended next steps:

- Manually review the category parameter tab in Docker Compose with a realistic set of parameters, especially inherited defaults, local overrides, and the compact grid layout.
- Add focused e2e coverage for inherited primary/default behavior across a three-level category tree.
- Add e2e coverage for editing an existing attached `CHOICE`/`BOOLEAN` default value, not only attaching a new one.
- Consider a clearer loading state for the category parameter tab; the editor is intentionally withheld until effective parameters load to avoid draft overwrite races.
- Consider extracting shared typed default-value controls once part forms and category default controls converge.
- Decide the first filtering/search workflow before adding indexes or UI for normalized parameter value search.
