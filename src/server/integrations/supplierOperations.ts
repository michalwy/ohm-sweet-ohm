import { z } from "zod";

import { defineOperation } from "@/server/api/operations";

/**
 * Supplier lookup in the API and MCP (#285): `search_supplier_parts`,
 * `get_supplier_part_attributes` and `get_supplier_matching_suggestions`, served under
 * `/api/v1/supplier-parts` and `/api/v1/supplier-matching-suggestions`. Accepted matches are
 * recorded by `create_part`'s `supplierMatching`, as the UI records them when a part is created
 * from a supplier result. Pure, so unit tests and the OpenAPI document can load it; the
 * implementations are in `supplierApi.ts`.
 *
 * The permission is `parts:write` throughout: the lookup is the first step of adding a part, and it
 * spends the workspace's supplier credentials. The credentials themselves are never part of any
 * input or output.
 */

/** The page size the add-part dialog asks the supplier for; the API asks for no more. */
export const SUPPLIER_SEARCH_PAGE_SIZE = 10;

export const supplierProviderSchema = z
  .enum(["digikey", "mouser", "tme"])
  .describe("The supplier: digikey or tme (mouser is reserved and has no search).");

export const supplierSourceAttributeSchema = z.object({
  name: z.string().describe("The attribute's name at the supplier, e.g. \"Resistance\"."),
  value: z.string().describe("The value as the supplier gives it, e.g. \"10 kOhms\"."),
  unit: z.string().nullable().describe("The unit the supplier gives separately; null when none.")
});

export const supplierPartSchema = z.object({
  manufacturerName: z.string().describe("The manufacturer's name at the supplier."),
  catalogNumber: z.string().describe("The manufacturer's catalog number (part number)."),
  description: z.string().describe("The supplier's description."),
  sourceCategory: z
    .string()
    .nullable()
    .describe("The supplier's category path, e.g. \"Resistors » Chip Resistor\"; null when none."),
  sourceAttributes: z
    .array(supplierSourceAttributeSchema)
    .describe("The supplier's parameters for the part.")
});

export const searchSupplierPartsOperation = defineOperation({
  name: "search_supplier_parts",
  description:
    "Search the workspace's active supplier (DigiKey or TME) for parts, with the workspace's configured credentials — the search the add-part dialog makes. Errors: missing-credentials when no supplier is active or its credentials are not set; token-request-failed or search-request-failed when the supplier does not answer. Page with offset/nextOffset.",
  permission: "parts:write",
  input: z.object({
    query: z
      .string()
      .trim()
      .min(1)
      .describe("What to search for: a catalog number, a manufacturer or keywords."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(SUPPLIER_SEARCH_PAGE_SIZE)
      .optional()
      .describe(`How many results to ask for, at most ${SUPPLIER_SEARCH_PAGE_SIZE} (the default).`),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("How many results to skip: the nextOffset of the previous page; 0 by default.")
  }),
  output: z.object({
    provider: supplierProviderSchema.describe("The supplier that was searched."),
    items: z.array(supplierPartSchema),
    nextOffset: z
      .number()
      .int()
      .nullable()
      .describe("The offset of the next page; null on the last page.")
  })
});

export const getSupplierPartAttributesOperation = defineOperation({
  name: "get_supplier_part_attributes",
  description:
    "Read a supplier part's attributes from the workspace's active supplier by its catalog number, as the add-part dialog does after a part is picked. Only TME has this lookup: for DigiKey, or when TME returns nothing, sourceAttributes is null — use the sourceAttributes of the search result instead.",
  permission: "parts:write",
  input: z.object({
    catalogNumber: z
      .string()
      .trim()
      .min(1)
      .describe("The supplier part's catalogNumber, from search_supplier_parts.")
  }),
  output: z.object({
    provider: supplierProviderSchema
      .nullable()
      .describe("The workspace's active supplier; null when none is active."),
    sourceAttributes: z
      .array(supplierSourceAttributeSchema)
      .nullable()
      .describe("The part's attributes at the supplier; null to fall back to the search result's.")
  })
});

export const getSupplierMatchingSuggestionsOperation = defineOperation({
  name: "get_supplier_matching_suggestions",
  description:
    "Suggest how to map a supplier part onto the workspace — its category, its manufacturer and, per supplier attribute, a workspace attribute — from the matches accepted when earlier parts were created from supplier results (the add-part dialog's suggestions). Reads only the workspace's own data; makes no request to the supplier. To record accepted matches, pass them to create_part as supplierMatching, with the keys this returns.",
  permission: "parts:write",
  input: z.object({
    provider: supplierProviderSchema.describe("The supplier the part came from (search_supplier_parts' provider)."),
    sourceManufacturerName: z
      .string()
      .nullable()
      .optional()
      .describe("The supplier part's manufacturerName."),
    sourceCategory: z.string().nullable().describe("The supplier part's sourceCategory."),
    sourceAttributes: z
      .array(supplierSourceAttributeSchema)
      .describe("The supplier part's sourceAttributes, as search_supplier_parts or get_supplier_part_attributes returned them."),
    targetCategoryId: z
      .string()
      .nullable()
      .optional()
      .describe(
        "The workspace category the part will have, when already chosen: attribute suggestions are learned per category. Omit or null to ask for the category suggestion first."
      )
  }),
  output: z.object({
    sourceCategoryKey: z
      .string()
      .describe("The supplier category's key; pass it to create_part's supplierMatching."),
    sourceManufacturerKey: z
      .string()
      .describe("The supplier manufacturer's key; pass it to create_part's supplierMatching."),
    suggestedTargetCategoryId: z
      .string()
      .nullable()
      .describe("The workspace category this supplier category was matched to most; null when none."),
    suggestedTargetManufacturerName: z
      .string()
      .nullable()
      .describe("The workspace manufacturer this supplier manufacturer was matched to most; null when none."),
    attributeRows: z
      .array(
        z.object({
          sourceAttribute: z.string().describe("The supplier attribute as the app shows it, with its unit."),
          sourceAttributeName: z.string().describe("The supplier attribute's name."),
          sourceUnit: z.string().nullable().describe("The supplier attribute's unit; null when none."),
          sourceAttributeKey: z
            .string()
            .describe("The supplier attribute's key; pass it to create_part's supplierMatching."),
          sourceValue: z.string().describe("The supplier's value, normalized."),
          suggestedTargetAttributeId: z
            .string()
            .nullable()
            .describe("The workspace attribute this supplier attribute was matched to most; null when none.")
        })
      )
      .describe("One row per supplier attribute with a value.")
  })
});

/** `create_part`'s `supplierMatching`: the matches accepted for a part created from a supplier result. */
export const supplierMatchingInputSchema = z
  .object({
    provider: supplierProviderSchema.describe("The supplier the part came from."),
    sourceCategoryKey: z.string().describe("get_supplier_matching_suggestions' sourceCategoryKey."),
    sourceManufacturerKey: z
      .string()
      .describe("get_supplier_matching_suggestions' sourceManufacturerKey."),
    targetCategoryId: z
      .string()
      .nullable()
      .describe("The workspace category accepted for the supplier category; null for none."),
    attributeMappings: z
      .array(
        z.object({
          sourceAttributeKey: z.string().min(1).describe("A row's sourceAttributeKey."),
          targetAttributeId: z
            .string()
            .min(1)
            .describe("The workspace attribute accepted for it.")
        })
      )
      .describe("The supplier attributes matched to workspace attributes.")
  })
  .describe(
    "Record the supplier matches accepted for this part — its category, manufacturer and attributes — so get_supplier_matching_suggestions suggests them next time, as the add-part dialog does for a part created from a supplier result."
  );
