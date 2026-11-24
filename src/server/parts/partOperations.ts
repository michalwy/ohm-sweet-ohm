import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Parts in the API and MCP (#277): `list_parts`, `get_part`, `create_part`, `update_part` and
 * `delete_part`, served at `/api/v1/parts` and `/api/v1/parts/{id}`. Pure, so unit tests and the
 * OpenAPI document can load it; the implementations are in `partsApi.ts`.
 */

const NONE = "__none__";

const decimalString = (what: string) =>
  z
    .string()
    .nullable()
    .describe(`${what}, as a decimal string in the part's unit (e.g. "12" or "0.5").`);

export const partAttributeValueSchema = z.object({
  attributeId: z.string().describe("The attribute's id."),
  attributeName: z.string().describe("The attribute's name, e.g. \"Resistance\"."),
  displayValue: z
    .string()
    .describe("The value as the app shows it, e.g. \"10 kΩ\"; can be sent back as it is.")
});

export const partSchema = z.object({
  id: z.string().describe("The part's id."),
  catalogNumber: z
    .string()
    .describe("The manufacturer's catalog number; unique in the workspace with the manufacturer."),
  description: z.string().nullable().describe("Free-text description; null when unset."),
  manufacturerName: z.string().describe("The manufacturer organization's name."),
  unitId: z.string().describe("Id of the unit of measure the part is counted in (see list_units)."),
  isAssembled: z
    .boolean()
    .describe("Whether the part is the output of a design (assembled in-house)."),
  primaryCategoryId: z.string().nullable().describe("The primary category's id; null when unset."),
  primaryCategoryPath: z
    .string()
    .nullable()
    .describe("The primary category's full path, e.g. \"Passives / Resistors\"; null when unset."),
  secondaryCategoryId: z
    .string()
    .nullable()
    .describe("The secondary category's id; null when unset."),
  secondaryCategoryPath: z
    .string()
    .nullable()
    .describe("The secondary category's full path; null when unset."),
  defaultLocationId: z
    .string()
    .nullable()
    .describe("The default storage location's id; null when unset."),
  defaultLocationName: z
    .string()
    .nullable()
    .describe("The default storage location's name; null when unset."),
  valueDisplayValue: z
    .string()
    .nullable()
    .describe(
      "The value shown in the parts list's Value column: the primary category's value attribute; null when none."
    ),
  attributeValues: z
    .array(partAttributeValueSchema)
    .describe("The part's stored attribute values, by attribute name."),
  currentStock: decimalString("Quantity in stock across all locations"),
  reservedQuantity: decimalString("Quantity reserved for builds"),
  allocatedQuantity: decimalString("Quantity allocated to planned builds"),
  availableQuantity: decimalString("In stock minus reserved"),
  balanceQuantity: decimalString(
    "Available plus on order plus in production minus allocated (negative means a shortage)"
  ),
  plannedQuantity: decimalString("Quantity planned on shopping lists"),
  onOrderQuantity: decimalString("Quantity on open purchase orders"),
  inProductionQuantity: decimalString("Quantity being built"),
  avgNetCost: z
    .string()
    .nullable()
    .describe("Average net unit cost in the workspace's primary currency; null when unknown."),
  avgGrossCost: z
    .string()
    .nullable()
    .describe("Average gross unit cost in the workspace's primary currency; null when unknown.")
});

export const partListSortFields = [
  "manufacturerName",
  "catalogNumber",
  "description",
  "categories",
  "valueDisplayValue",
  "currentStock",
  "reservedQuantity",
  "allocatedQuantity",
  "availableQuantity",
  "balanceQuantity",
  "plannedQuantity",
  "onOrderQuantity",
  "inProductionQuantity",
  "avgNetCost",
  "avgGrossCost"
] as const;

const numericFilterPattern = /^(eq|neq|gt|gte|lt|lte):[^:]+$|^(between|not-between):[^:]+:[^:]+$/;

export const listPartsOperation = defineOperation({
  name: "list_parts",
  description:
    "List the workspace's parts, one page at a time, with the parts list's search, filters and sorting. Each part carries its categories, manufacturer, attribute values and stock balance.",
  permission: "parts:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z
      .union([z.enum(partListSortFields), z.string().regex(/^attribute:.+$/)])
      .optional()
      .describe(
        "Field to sort by, or \"attribute:<attributeId>\" to sort by an attribute's value; manufacturer then catalog number when omitted."
      ),
    search: z
      .string()
      .optional()
      .describe(
        "Text to look for, case-insensitively, in the catalog number, description, manufacturer, attribute values and category paths."
      ),
    categoryId: z
      .string()
      .optional()
      .describe(
        `Only parts whose primary or secondary category is this category or one below it; "${NONE}" for parts without a category.`
      ),
    manufacturer: z
      .string()
      .optional()
      .describe("Only parts whose manufacturer's name contains this text (case-insensitive)."),
    locationId: z
      .string()
      .optional()
      .describe(
        `Only parts whose default location is this location or one below it; "${NONE}" for parts without one.`
      ),
    stockFilter: z
      .string()
      .regex(numericFilterPattern)
      .optional()
      .describe(
        "Filter on the quantity in stock: \"<op>:<value>\" with op eq, neq, gt, gte, lt or lte (e.g. \"gte:5\"), or \"between:<min>:<max>\" / \"not-between:<min>:<max>\"."
      ),
    attributeFilters: z
      .array(z.string().regex(/^[^=]+=.+$/))
      .optional()
      .describe(
        `Attribute filters, each "<attributeId>=<filter>"; all must match. The filter is text to look for (text attributes), "<op>:<value>" as in stockFilter with values in the attribute's unit such as "gte:10k" (number and quantity attributes), "true" or "false" (yes/no attributes), or a choice option's id or "${NONE}" (choice attributes).`
      )
  }),
  output: listPageOutputSchema(partSchema)
});

const partIdInput = z.string().min(1).describe("The part's id.");

export const getPartOperation = defineOperation({
  name: "get_part",
  description:
    "Get one part with its categories, manufacturer, attribute values and stock balance.",
  permission: "parts:read",
  input: z.object({ id: partIdInput }),
  output: partSchema
});

const attributeValuesInputDescription =
  "Attribute values by attribute id, each as you would type it in the part dialog (e.g. \"10k\", \"10 kΩ\", \"true\", or a choice option's label); null or an empty string clears the value. Only attributes of the part's categories (primary plus secondary) are accepted.";

const partWriteFields = {
  catalogNumber: z.string().trim().min(1).describe("The manufacturer's catalog number."),
  description: z.string().trim().nullable().describe("Free-text description; null clears it."),
  manufacturerName: z
    .string()
    .trim()
    .min(1)
    .describe(
      "The manufacturer organization's name; an organization with that name is created when none exists."
    ),
  unitId: z.string().min(1).describe("Id of the unit of measure (see list_units)."),
  primaryCategoryId: z
    .string()
    .nullable()
    .describe("The primary category's id (an assignable category); null for none."),
  secondaryCategoryId: z
    .string()
    .nullable()
    .describe(
      "The secondary category's id; needs a primary category and must differ from it; null for none."
    ),
  defaultLocationId: z
    .string()
    .nullable()
    .describe("The default storage location's id (not archived); null for none."),
  attributeValues: z
    .record(z.string(), z.string().nullable())
    .describe(attributeValuesInputDescription)
};

export const createPartOperation = defineOperation({
  name: "create_part",
  description:
    "Create a part. A part is unique in the workspace by manufacturer and catalog number (duplicate-part otherwise). Returns the new part.",
  permission: "parts:write",
  input: z.object({
    catalogNumber: partWriteFields.catalogNumber,
    manufacturerName: partWriteFields.manufacturerName,
    unitId: partWriteFields.unitId,
    description: partWriteFields.description.optional(),
    primaryCategoryId: partWriteFields.primaryCategoryId.optional(),
    secondaryCategoryId: partWriteFields.secondaryCategoryId.optional(),
    defaultLocationId: partWriteFields.defaultLocationId.optional(),
    attributeValues: partWriteFields.attributeValues.optional()
  }),
  output: partSchema
});

export const updatePartOperation = defineOperation({
  name: "update_part",
  description:
    "Change a part. Only the fields you send change; attributeValues changes only the attributes it lists. Attribute values survive category changes: a value of an attribute the new categories do not have is kept, hidden, and comes back if the attribute does. Returns the changed part.",
  permission: "parts:write",
  input: z.object({
    id: partIdInput,
    catalogNumber: partWriteFields.catalogNumber.optional(),
    manufacturerName: partWriteFields.manufacturerName.optional(),
    unitId: partWriteFields.unitId.optional(),
    description: partWriteFields.description.optional(),
    primaryCategoryId: partWriteFields.primaryCategoryId.optional(),
    secondaryCategoryId: partWriteFields.secondaryCategoryId.optional(),
    defaultLocationId: partWriteFields.defaultLocationId.optional(),
    attributeValues: partWriteFields.attributeValues.optional()
  }),
  output: partSchema
});

export const deletePartOperation = defineOperation({
  name: "delete_part",
  description:
    "Delete a part and its attribute values. A part still referred to by stock movements, purchase orders, shopping lists, designs or builds cannot be deleted (part-in-use).",
  permission: "parts:write",
  input: z.object({ id: partIdInput }),
  output: z.object({ id: z.string().describe("The deleted part's id.") })
});
