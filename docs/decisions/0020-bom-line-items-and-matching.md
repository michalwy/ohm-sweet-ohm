# ADR 0020 — BOM Line Items with Attribute-Based Part Matching

**Status:** Accepted  
**Date:** 2026-06-29

## Context

A Design revision (ADR 0019, issue #61) had no contents. Issue #62 gives each revision a
**bill of materials (BOM)**: the list of components needed to build the design. The BOM
must support substitution of passive components (resistors, capacitors) without creating
placeholder parts, while still allowing specific components (ICs) to be pinned to one exact
part. Quantities should be derived from reference designators rather than entered by hand.

The challenge is that the existing data model represents a part's identity through several
different concepts: workspace **attributes** (resistance, package, …) stored on
`PartAttributeValue`, plus first-class Part fields (`primaryCategoryId`, `catalogNumber`,
`manufacturerId`). The issue text framed everything — category, catalog number, resistance
— uniformly as "attribute matchers", but only some of these are actually attributes.

## Decision

A BOM line item is a **spec**, not a pointer to a part. It is modeled with two tables plus
one operator enum.

### Schema

```prisma
enum BomMatcherOperator { EQ NEQ LT LTE GT GTE }

model BomLineItem {
  id           String  @id @default(cuid())
  workspaceId  String
  revisionId   String
  categoryId   String?   // optional scope; drives the attribute picker and narrows matching
  pinnedPartId String?   // optional exact-part pin
  designators  String    // raw range string as entered, e.g. "R1, R3, R5-R10"
  quantity     Int       // derived count of expanded designators, cached at write time
  sortOrder    Int     @default(0)
  notes        String?
  matchers     BomMatcher[]
}

model BomMatcher {
  id                String             @id @default(cuid())
  workspaceId       String
  lineItemId        String
  attributeId       String
  operator          BomMatcherOperator
  // normalized value, mirroring PartAttributeValue:
  textValue         String?
  numberValue       Decimal?
  quantityBaseValue Decimal?
  booleanValue      Boolean?
  choiceOptionId    String?
  displayValue      String?
  @@unique([lineItemId, attributeId])
}
```

### Structure: category and pinned part are NOT matchers

Rather than encode category, catalog number, and manufacturer as pseudo-attribute
matchers, the line item carries:

- An optional structured `categoryId` that both narrows matching (to the category and its
  descendants, via the closure table) and drives which attributes the authoring UI offers
  — mirroring the part-form pattern.
- An optional `pinnedPartId`. When set, the line item resolves to exactly that part and
  matchers are **ignored**. This is the "pin to one specific part" path.

`BomMatcher` rows therefore only ever reference real workspace `Attribute`s.

### Matcher values and operators

A matcher value is stored normalized exactly like `PartAttributeValue`, parsed through the
shared `parseAttributeValue()` so a matcher value and a part value are directly comparable
(quantities normalized to base units, choices stored by option id, etc.). Operators are
constrained by attribute type:

- `NUMBER`, `QUANTITY` → `=, ≠, <, ≤, >, ≥`
- `TEXT`, `CHOICE`, `BOOLEAN` → `=, ≠`

This constraint (`MATCHER_OPERATORS_BY_TYPE`) is enforced both server-side at write time
and in the authoring UI.

### Designator grammar

`parseDesignatorRange()` (`src/lib/designators.ts`, pure and unit-tested) splits the raw
string on commas. Each token is a single designator (`R1`) or a same-prefix inclusive
range (`R5-R10`). Ranges expand to individual designators; the full set is de-duplicated
and **duplicates/overlaps are rejected**. Mixed prefixes across tokens (`R1, C2`) are
allowed. `quantity` is the count of unique expanded designators.

### Matching evaluation

`evaluateMatcher()` (`src/server/designs/bomMatcherEvaluation.ts`, pure) compares a part's
value against a matcher as `partValue <operator> matcherValue`. A part with **no value**
for the attribute satisfies only `≠`. `findMatchingParts()` (`matching.ts`) returns a
pinned part directly, or every part in the (optionally category-narrowed) candidate set
that satisfies **all** matchers.

### Authorization

The BOM is part of a design, so it reuses the existing `designs:read` / `designs:write`
permissions. No new permission key was introduced. The authoring dialog reads categories
and the attribute dictionary through a `designs:read`-authorized helper, so designers do
not also need `part-categories:read` / `attributes:read`.

## Consequences

- Passive components are specified by their electrical/mechanical attributes and resolved
  against live inventory; no placeholder parts are needed.
- Exact components use the simple `pinnedPartId` path instead of synthesizing
  catalog-number/manufacturer matchers.
- Match counts/previews are computed on demand by re-running `findMatchingParts`; at
  workshop scale this is evaluated in application code rather than pushed into SQL. If BOMs
  or inventories grow large, matcher evaluation can be moved into the query layer later.
- Build flow and allocation of concrete parts to individual designators (and split
  allocation across multiple matching parts) are explicitly out of scope and tracked
  separately (refs #9).
