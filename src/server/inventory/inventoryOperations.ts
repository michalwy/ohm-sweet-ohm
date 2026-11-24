import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Inventory — stock movements and balances — in the API and MCP (#280). Pure, so unit tests and
 * the OpenAPI document can load it; the implementations are in `inventoryApi.ts`, and the server
 * actions in `entryActions.ts` validate their input through the same schemas.
 */

export const INVENTORY_ENTRY_TYPES = ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"] as const;

const partIdSchema = z.string().min(1).describe("The part's id.");

const quantitySchema = z
  .string()
  .describe("A decimal number as a string, e.g. \"10\" or \"2.5\".");

const entryTypeSchema = z
  .enum(INVENTORY_ENTRY_TYPES)
  .describe(
    "RECEIPT: stock arrives at toLocationId. ISSUE: stock leaves fromLocationId. TRANSFER: stock moves from fromLocationId to toLocationId. ADJUSTMENT: a correction at toLocationId; a negative quantity lowers the stock there."
  );

export const inventoryEntrySchema = z.object({
  id: z.string().describe("The entry's id."),
  partId: z.string().describe("The part moved."),
  entryType: z.enum(INVENTORY_ENTRY_TYPES).describe("The kind of movement."),
  quantity: z
    .string()
    .describe("The quantity moved, a decimal string; negative only for an adjustment that lowers stock."),
  fromLocationId: z.string().nullable().describe("Where the stock left; null for a receipt or adjustment."),
  fromLocationName: z.string().nullable().describe("That location's own name; null when none."),
  toLocationId: z.string().nullable().describe("Where the stock arrived; null for an issue."),
  toLocationName: z.string().nullable().describe("That location's own name; null when none."),
  note: z.string().nullable().describe("The note recorded with the movement; null when none."),
  createdAt: z.iso.datetime().describe("When the movement was recorded (ISO 8601, UTC)."),
  authorName: z
    .string()
    .nullable()
    .describe("Who recorded it; null when it was recorded by the system or the user is gone.")
});

export const createInventoryEntryOperation = defineOperation({
  name: "create_inventory_entry",
  description:
    "Record a stock movement of a part: a receipt, issue, transfer or adjustment. Locations must be assignable and not archived; stock at a location never goes below zero (insufficient-stock); a part whose unit does not allow fractions takes whole quantities only. Receipts recorded this way carry no cost.",
  permission: "inventory:write",
  input: z.object({
    partId: partIdSchema,
    entryType: entryTypeSchema,
    quantity: quantitySchema.describe(
      "The quantity, a decimal string other than zero (e.g. \"10\" or \"2.5\"); only an adjustment may be negative."
    ),
    fromLocationId: z
      .string()
      .min(1)
      .nullish()
      .describe("The source location: required for ISSUE and TRANSFER, absent otherwise."),
    toLocationId: z
      .string()
      .min(1)
      .nullish()
      .describe("The destination location: required for RECEIPT, TRANSFER and ADJUSTMENT, absent for ISSUE."),
    note: z.string().nullish().describe("An optional note recorded with the movement.")
  }),
  output: inventoryEntrySchema
});

export const listInventoryEntriesOperation = defineOperation({
  name: "list_inventory_entries",
  description:
    "A part's stock movement history, newest first unless sortDir is \"asc\", one page at a time.",
  permission: "inventory:read",
  input: z.object({
    ...listPageInputShape,
    sortDir: z
      .enum(["asc", "desc"])
      .optional()
      .describe("\"desc\" (newest first) when omitted; \"asc\" for oldest first."),
    partId: partIdSchema
  }),
  output: listPageOutputSchema(inventoryEntrySchema)
});

const stockBalanceShape = {
  locationId: z.string().describe("The location holding the stock."),
  locationPath: z.string().describe("The location's full path from the top level."),
  quantity: z.string().describe("The stock there, a decimal string: the balance of every movement."),
  availableQuantity: z
    .string()
    .describe("The stock there not held by a running build's reservation, a decimal string.")
};

export const getPartStockBalancesOperation = defineOperation({
  name: "get_part_stock_balances",
  description:
    "Where a part's stock is: its balance and available quantity per location, for every location any movement of the part touched (a balance may be zero).",
  permission: "inventory:read",
  input: z.object({ partId: partIdSchema }),
  output: z.object({
    items: z.array(z.object(stockBalanceShape)).describe("One row per location, sorted by path.")
  })
});

export const getLocationStockOperation = defineOperation({
  name: "get_location_stock",
  description:
    "Which parts are stored at a location — and, with includeSublocations, anywhere below it — one row per part and location with non-zero stock. Archived locations keep showing their stock.",
  permission: "inventory:read",
  input: z.object({
    id: z.string().min(1).describe("The location's id."),
    includeSublocations: z
      .boolean()
      .optional()
      .describe("Also list the stock of every location below this one; false when omitted.")
  }),
  output: z.object({
    items: z
      .array(
        z.object({
          partId: z.string().describe("The part's id."),
          catalogNumber: z.string().describe("The part's catalog number."),
          manufacturerName: z.string().describe("The part's manufacturer."),
          description: z.string().nullable().describe("The part's description; null when none."),
          ...stockBalanceShape,
          locationPath: z
            .string()
            .describe("Where the stock sits relative to the requested location; its own name for stock held directly.")
        })
      )
      .describe("Stock held directly first, then by path, manufacturer and catalog number.")
  })
});
