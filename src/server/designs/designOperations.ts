import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";
import { shoppingListSchema } from "@/server/shopping-lists/shoppingListOperations";

/**
 * Designs, their revisions, BOM line items and shortage analysis in the API and MCP (#283). Pure,
 * so unit tests and the OpenAPI document can load it; the implementations are in `designApi.ts`,
 * over the same domain functions (`designs.ts`, `bomLineItems.ts`, `shortageAnalysis.ts`) as the
 * server actions in `designActions.ts` and `bomActions.ts`.
 */

const designIdSchema = z.string().min(1).describe("The design's id.");
const revisionIdSchema = z.string().min(1).describe("The design revision's id.");
const lineItemIdSchema = z.string().min(1).describe("The BOM line item's id.");

const operatorSchema = z
  .enum(["EQ", "NEQ", "LT", "LTE", "GT", "GTE"])
  .describe("The comparison: part value <operator> matcher value. TEXT, CHOICE and BOOLEAN attributes take only EQ and NEQ.");

const attributeTypeSchema = z
  .enum(["TEXT", "NUMBER", "QUANTITY", "BOOLEAN", "CHOICE"])
  .describe("The attribute's value type.");

const notesSchema = z
  .string()
  .nullable()
  .describe("Free-text notes; surrounding spaces are trimmed, and empty or null clears them.");

const targetQuantitySchema = z.number().int().min(1).describe("How many units of the design to build.");

export const designRevisionSchema = z.object({
  id: z.string().describe("The revision's id."),
  revisionNumber: z.number().int().describe("The revision's number, from 1."),
  notes: z.string().nullable().describe("The revision's notes; null when unset."),
  createdAt: z.iso.datetime().describe("When the revision was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the revision last changed (ISO 8601, UTC).")
});

const designSummaryShape = {
  id: z.string().describe("The design's id."),
  name: z.string().describe("The design's name."),
  description: z.string().nullable().describe("The design's description; null when unset."),
  outputPart: z
    .object({
      id: z.string().describe("The output part's id."),
      catalogNumber: z.string().describe("The output part's catalog number (the design's catalog number)."),
      currentStock: z.string().describe("The output part's current stock, as a decimal string.")
    })
    .describe("The part the design produces: made by the workspace's internal organization when the design is created."),
  revisionCount: z.number().int().describe("How many revisions the design has."),
  latestRevisionNumber: z.number().int().nullable().describe("The newest revision's number; null when none."),
  createdAt: z.iso.datetime().describe("When the design was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the design last changed (ISO 8601, UTC).")
};

export const designSummarySchema = z.object(designSummaryShape);

export const designSchema = z.object({
  ...designSummaryShape,
  revisions: z.array(designRevisionSchema).describe("The design's revisions, oldest first.")
});

const matcherInputSchema = z.object({
  attributeId: z.string().min(1).describe("The attribute to compare (get_category_attributes lists a category's)."),
  operator: operatorSchema,
  rawValue: z
    .string()
    .describe(
      'The value as typed in the UI: text, a number, a quantity with its unit (e.g. "10k" or "10kΩ"), "true"/"false" for BOOLEAN, or a choice option\'s label for CHOICE.'
    )
});

const matchSpecInputShape = {
  categoryId: z
    .string()
    .nullish()
    .describe("Only parts in this category or its descendants; omit or null for any category."),
  pinnedPartId: z
    .string()
    .nullish()
    .describe("Pin the line to exactly this part; the matchers then narrow nothing further."),
  matchers: z
    .array(matcherInputSchema)
    .optional()
    .describe("Attribute conditions a part must meet, at most one per attribute; none when omitted.")
};

const lineItemInputShape = {
  designators: z
    .string()
    .min(1)
    .describe('The line\'s designators, comma-separated, ranges allowed: e.g. "R1, R2" or "R1-R4". Their count is the line\'s quantity per unit.'),
  ...matchSpecInputShape,
  notes: notesSchema.optional()
};

export const bomLineItemSchema = z.object({
  id: z.string().describe("The BOM line item's id."),
  designators: z.string().describe("The line's designators as entered."),
  quantity: z.number().int().describe("Parts needed per built unit: the number of designators."),
  sortOrder: z.number().int().describe("The line's position in the BOM, ascending."),
  notes: z.string().nullable().describe("The line's notes; null when unset."),
  category: z
    .object({ id: z.string().describe("The category's id."), name: z.string().describe("The category's name.") })
    .nullable()
    .describe("The category parts must be in (or below); null for any."),
  pinnedPart: z
    .object({ id: z.string().describe("The part's id."), catalogNumber: z.string().describe("Its catalog number.") })
    .nullable()
    .describe("The part the line is pinned to; null when it matches by category and attributes."),
  matchers: z
    .array(
      z.object({
        id: z.string().describe("The matcher's id."),
        attributeId: z.string().describe("The attribute's id."),
        attributeName: z.string().describe("The attribute's name."),
        attributeType: attributeTypeSchema,
        operator: operatorSchema,
        displayValue: z.string().nullable().describe("The compared value, as displayed.")
      })
    )
    .describe("The line's attribute conditions."),
  matchCount: z.number().int().describe("How many parts of the workspace currently satisfy the line.")
});

const matchingPartSchema = z.object({
  id: z.string().describe("The part's id."),
  catalogNumber: z.string().describe("The part's catalog number."),
  description: z.string().nullable().describe("The part's description."),
  manufacturerName: z.string().describe("The part's manufacturer.")
});

const procurementCandidateSchema = z.object({
  partId: z.string().describe("The part's id."),
  catalogNumber: z.string().describe("The part's catalog number."),
  manufacturerName: z.string().describe("The part's manufacturer.")
});

export const shortageAnalysisSchema = z.object({
  lines: z
    .array(
      z.object({
        lineItemId: z.string().describe("The BOM line item's id."),
        designators: z.string().describe("The line's designators."),
        categoryName: z.string().nullable().describe("The line's category; null when none."),
        categoryId: z.string().nullable().describe("The line's category id; null when none."),
        pinnedPartId: z.string().nullable().describe("The part the line is pinned to; null when none."),
        requiredQty: z.number().describe("Parts the line needs for the target quantity."),
        availableQty: z.number().describe("How many of them available stock covers."),
        gapQty: z.number().describe("How many are missing (required − available); 0 when covered."),
        matchCount: z.number().int().describe("How many parts satisfy the line."),
        sourcingDesignId: z
          .string()
          .nullable()
          .describe("When the gap is filled by building a sub-assembly: that design's id; else null."),
        sourcingDesignName: z.string().nullable().describe("That sub-assembly design's name; else null."),
        sourcingLatestRevisionId: z
          .string()
          .nullable()
          .describe("The sub-assembly design's newest revision, which the analysis explodes; null when it has none."),
        matchers: z
          .array(
            z.object({
              attributeId: z.string().describe("The attribute's id."),
              type: attributeTypeSchema,
              operator: operatorSchema,
              displayValue: z.string().nullable().describe("The compared value, as displayed."),
              numberValue: z.string().nullable().describe("For NUMBER: the compared number."),
              booleanValue: z.boolean().nullable().describe("For BOOLEAN: the compared value."),
              choiceOptionId: z.string().nullable().describe("For CHOICE: the compared option's id.")
            })
          )
          .describe("The line's attribute conditions.")
      })
    )
    .describe("One entry per line of the revision's BOM (top level only), in BOM order."),
  procurement: z
    .array(
      z.object({
        partId: z.string().describe("The part to buy (the first matching part, by catalog number)."),
        catalogNumber: z.string().describe("Its catalog number."),
        manufacturerName: z.string().describe("Its manufacturer."),
        shortageQty: z.number().describe("How many to buy, summed over every line and sub-assembly needing it."),
        candidates: z
          .array(procurementCandidateSchema)
          .describe("Purchasable parts that also satisfy the lines behind this shortage (including partId itself): the substitutes add_shortage_to_shopping_list accepts.")
      })
    )
    .describe("What to buy, sub-assemblies exploded into their own BOMs, by catalog number."),
  cycles: z
    .array(z.object({ path: z.array(z.string()).describe("Design names forming the cycle, ending with the repeated one.") }))
    .describe("Designs that transitively require themselves; reported, not followed."),
  requiresIncoming: z
    .boolean()
    .describe("True when every line is covered but some only by incoming stock (on order or in production), not on hand.")
});

export const listDesignsOperation = defineOperation({
  name: "list_designs",
  description:
    "List the workspace's designs, one page at a time, with their output part and revision count. get_design returns a design's revisions; list_bom_line_items a revision's BOM.",
  permission: "designs:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z
      .enum(["name", "catalogNumber", "createdAt"])
      .optional()
      .describe("Sort key; name when omitted."),
    searchQuery: z
      .string()
      .nullish()
      .describe("Only designs whose name, description or catalog number contains this text, ignoring case."),
    createdAtFilter: z
      .string()
      .nullish()
      .describe("Only designs created in a date range: after:YYYY-MM-DD, before:YYYY-MM-DD or between:YYYY-MM-DD:YYYY-MM-DD.")
  }),
  output: listPageOutputSchema(designSummarySchema)
});

export const getDesignOperation = defineOperation({
  name: "get_design",
  description: "One design, by id, with its revisions.",
  permission: "designs:read",
  input: z.object({ designId: designIdSchema }),
  output: designSchema
});

export const createDesignOperation = defineOperation({
  name: "create_design",
  description:
    "Create a design, as the UI does: its output part is created with the catalog number, made by the workspace's internal organization, in the default unit; the design gets revision 1 with an empty BOM. Answers the design.",
  permission: "designs:write",
  input: z.object({
    name: z.string().min(1).describe("The design's name."),
    description: z.string().nullish().describe("The design's description; also the output part's description (the name when omitted)."),
    catalogNumber: z
      .string()
      .min(1)
      .optional()
      .describe("The output part's catalog number, unique among the internal organization's parts; the UI's suggestion (DESIGN-0001, …) when omitted.")
  }),
  output: designSchema
});

export const updateDesignOperation = defineOperation({
  name: "update_design",
  description:
    "Change a design's name or description. Only the fields sent change; send description null to clear it. Answers the design.",
  permission: "designs:write",
  input: z.object({
    designId: designIdSchema,
    name: z.string().min(1).optional().describe("The new name."),
    description: z.string().nullable().optional().describe("The new description; null clears it.")
  }),
  output: designSchema
});

export const deleteDesignOperation = defineOperation({
  name: "delete_design",
  description:
    "Delete a design with its revisions, BOMs and output part. Refused while the output part has stock (output-part-has-stock) or any inventory history (output-part-has-inventory-history).",
  permission: "designs:write",
  input: z.object({ designId: designIdSchema }),
  output: z.object({ designId: z.string().describe("The deleted design's id.") })
});

export const addDesignRevisionOperation = defineOperation({
  name: "add_design_revision",
  description: "Add a new revision to a design, numbered after its newest, with an empty BOM. Answers the new revision.",
  permission: "designs:write",
  input: z.object({ designId: designIdSchema, notes: notesSchema.optional() }),
  output: designRevisionSchema
});

export const updateDesignRevisionOperation = defineOperation({
  name: "update_design_revision",
  description: "Change a design revision's notes; send null to clear them. Answers the revision.",
  permission: "designs:write",
  input: z.object({ revisionId: revisionIdSchema, notes: notesSchema.optional() }),
  output: designRevisionSchema
});

export const listBomLineItemsOperation = defineOperation({
  name: "list_bom_line_items",
  description:
    "A design revision's BOM: its line items in order, each with its designators, category, pinned part, attribute matchers and how many parts satisfy it.",
  permission: "designs:read",
  input: z.object({ revisionId: revisionIdSchema }),
  output: z.object({ items: z.array(bomLineItemSchema).describe("The BOM's line items, in order.") })
});

export const createBomLineItemOperation = defineOperation({
  name: "create_bom_line_item",
  description:
    "Add a line item at the end of a revision's BOM. A part fits the line when it is the pinned part, or, without one, when it is in the category (or below) and meets every matcher. Answers the new line.",
  permission: "designs:write",
  input: z.object({ revisionId: revisionIdSchema, ...lineItemInputShape }),
  output: bomLineItemSchema
});

export const updateBomLineItemOperation = defineOperation({
  name: "update_bom_line_item",
  description:
    "Replace a BOM line item's designators, category, pinned part, matchers and notes, as the UI's dialog saves it: a field not sent is cleared (matchers to none). Answers the line.",
  permission: "designs:write",
  input: z.object({ lineItemId: lineItemIdSchema, ...lineItemInputShape }),
  output: bomLineItemSchema
});

export const deleteBomLineItemOperation = defineOperation({
  name: "delete_bom_line_item",
  description: "Delete a BOM line item.",
  permission: "designs:write",
  input: z.object({ lineItemId: lineItemIdSchema }),
  output: z.object({ lineItemId: z.string().describe("The deleted line item's id.") })
});

export const previewBomLineItemMatchesOperation = defineOperation({
  name: "preview_bom_line_item_matches",
  description:
    "Which parts would satisfy a BOM line with this category, pinned part and matchers, without saving anything: the count and the first 20 parts by catalog number.",
  permission: "designs:read",
  input: z.object(matchSpecInputShape),
  output: z.object({
    count: z.number().int().describe("How many parts match."),
    parts: z.array(matchingPartSchema).describe("The first 20 matching parts, by catalog number.")
  })
});

export const analyzeShortageOperation = defineOperation({
  name: "analyze_shortage",
  description:
    "What is missing to build a design revision a number of times, as the UI's shortage panel shows it: per BOM line, required, available and missing; and what to buy. Available stock is current − reserved plus incoming (on order, in production), pooled over every part matching a line and shared between lines; a matching part that is another design's output is netted from stock and its remainder exploded into that design's newest revision.",
  permission: "designs:read",
  input: z.object({ revisionId: revisionIdSchema, targetQuantity: targetQuantitySchema }),
  output: shortageAnalysisSchema
});

export const addShortageToShoppingListOperation = defineOperation({
  name: "add_shortage_to_shopping_list",
  description:
    "Add the shortage of a design revision to a shopping list, as the UI's \"Create shopping list\" dialog does: analyze_shortage's procurement items, each at its shortage quantity unless overridden, merged by part and added to the list (a part already on it gets the quantity added). Needs designs:read as well as shopping-lists:write. Create the list first with create_shopping_list when needed. Answers what was added and the whole list.",
  permission: "shopping-lists:write",
  input: z.object({
    revisionId: revisionIdSchema,
    targetQuantity: targetQuantitySchema,
    listId: z.string().min(1).describe("The shopping list to add to."),
    overrides: z
      .array(
        z.object({
          partId: z.string().min(1).describe("A procurement item's partId."),
          substitutePartId: z
            .string()
            .min(1)
            .optional()
            .describe("Buy this part instead: one of the item's candidates."),
          quantity: z
            .number()
            .min(0)
            .optional()
            .describe("How many to buy instead of the shortage quantity; 0 leaves the item out.")
        })
      )
      .optional()
      .describe("Changes to individual procurement items; the others are added as analyzed.")
  }),
  output: z.object({
    added: z
      .array(
        z.object({
          partId: z.string().describe("The part added."),
          quantity: z.string().describe("How many, as a decimal string.")
        })
      )
      .describe("What was added, merged by part."),
    list: shoppingListSchema
  })
});
