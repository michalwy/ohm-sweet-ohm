import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Purchase orders in the API and MCP (#282). Pure, so unit tests and the OpenAPI document can load
 * it; the implementations are in `purchaseOrderApi.ts`, over the same domain functions
 * (`purchaseOrderMutations.ts`, `exchangeRates.ts`) as the server actions in
 * `purchaseOrderActions.ts`.
 *
 * Money and quantities are decimal strings, so no precision is lost. Prices sent are net: an order in
 * gross price entry mode only changes how the UI shows and takes prices. As in the UI, an order's
 * currency is fixed once it exists, and its items are priced in it.
 */

const DECIMAL_PATTERN = /^\s*\d+(\.\d+)?\s*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_RANGE_FILTER_PATTERN =
  /^(after:\d{4}-\d{2}-\d{2}|before:\d{4}-\d{2}-\d{2}|between:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2})$/;
const NUMERIC_FILTER_PATTERN = /^(eq|neq|gt|gte|lt|lte):[^:]+$|^(between|not-between):[^:]+:[^:]+$/;

const statusSchema = z
  .enum(["DRAFT", "ORDERED", "RECEIVED"])
  .describe(
    "DRAFT while being put together; ORDERED once marked ordered (its parts count as on order); RECEIVED once every item is received in full."
  );

const orderIdSchema = z.string().min(1).describe("The purchase order's id.");
const itemIdSchema = z.string().min(1).describe("The purchase order item's id.");
const costIdSchema = z.string().min(1).describe("The additional cost's id.");
const partIdSchema = z.string().min(1).describe("The part's id.");

const quantitySchema = z
  .string()
  .regex(DECIMAL_PATTERN)
  .describe("A positive decimal string, e.g. \"10\" or \"2.5\".");

const priceSchema = z
  .string()
  .regex(DECIMAL_PATTERN)
  .describe("A net amount, as a decimal string, e.g. \"0.125\".");

const taxRateSchema = z
  .string()
  .regex(DECIMAL_PATTERN)
  .describe("A tax rate in percent, 0 or more and below 100, as a decimal string, e.g. \"23\".");

const currencySchema = z
  .string()
  .regex(CURRENCY_PATTERN)
  .describe("An ISO 4217 currency code, e.g. \"EUR\".");

const optionalText = (description: string) =>
  z
    .string()
    .nullable()
    .describe(`${description} Surrounding spaces are trimmed; empty or null clears it.`);

const totalsShape = {
  totalNetValue: z.string().nullable().describe("Net total of the priced items and additional costs, in the order's currency."),
  totalGrossValue: z.string().nullable().describe("Gross total, in the order's currency."),
  totalNetValuePrimary: z
    .string()
    .nullable()
    .describe("Net total in the workspace's primary currency; null when no exchange rate is known."),
  totalGrossValuePrimary: z
    .string()
    .nullable()
    .describe("Gross total in the workspace's primary currency; null when no exchange rate is known.")
};

export const purchaseOrderSummarySchema = z.object({
  id: z.string().describe("The purchase order's id."),
  supplierId: z.string().describe("The supplier organization's id."),
  supplierName: z.string().describe("The supplier's name."),
  status: statusSchema,
  orderNumber: z.string().nullable().describe("The workspace's own order number, e.g. PO-2026-001."),
  supplierOrderNumber: z.string().nullable().describe("The supplier's number for this order."),
  currency: z.string().nullable().describe("The order's currency."),
  taxRate: z.string().nullable().describe("The order's default tax rate, in percent."),
  priceEntryMode: z.enum(["net", "gross"]).describe("Whether the UI shows and takes prices net or gross."),
  orderedAt: z.iso.datetime().nullable().describe("When it was ordered (ISO 8601, UTC)."),
  receivedAt: z.iso.datetime().nullable().describe("When it was received in full (ISO 8601, UTC)."),
  notes: z.string().nullable().describe("Free-text notes."),
  createdByName: z.string().nullable().describe("Name of the user who created it; null when unknown."),
  itemCount: z.number().int().describe("How many items (lines) the order has."),
  ...totalsShape,
  createdAt: z.iso.datetime().describe("When it was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When it last changed (ISO 8601, UTC).")
});

export const purchaseOrderItemSchema = z.object({
  id: z.string().describe("The item's id."),
  partId: z.string().nullable().describe("The part bought; null for a free-text item."),
  partCatalogNumber: z.string().nullable().describe("The part's catalog number."),
  partDescription: z.string().nullable().describe("The part's description."),
  manufacturerName: z.string().nullable().describe("The part's manufacturer."),
  description: z.string().nullable().describe("A free-text item's description."),
  sourceShoppingListItemId: z
    .string()
    .nullable()
    .describe("The shopping list item this item was converted from; null when added directly."),
  quantity: z.string().describe("How many are ordered, as a decimal string."),
  receivedQuantity: z.string().describe("How many have been received so far."),
  supplierSku: z.string().nullable().describe("The supplier's catalog number for it."),
  unitPrice: z.string().nullable().describe("Net unit price; null when not priced."),
  lineNetValue: z.string().nullable().describe("Net line total."),
  lineGrossValue: z.string().nullable().describe("Gross line total."),
  lineNetValuePrimary: z.string().nullable().describe("Net line total in the workspace's primary currency."),
  lineGrossValuePrimary: z.string().nullable().describe("Gross line total in the workspace's primary currency."),
  currency: z.string().nullable().describe("The item's currency: the order's, or null for the order's."),
  taxRate: z.string().nullable().describe("The item's own tax rate; null means the order's."),
  notes: z.string().nullable().describe("Free-text notes."),
  partDefaultLocationId: z
    .string()
    .nullable()
    .describe("The part's default storage location, where receiving usually puts it.")
});

export const additionalCostSchema = z.object({
  id: z.string().describe("The additional cost's id."),
  label: z.string().describe("What it is, e.g. Shipping."),
  amount: z.string().describe("Net amount, in the order's currency."),
  taxRate: z.string().nullable().describe("Its own tax rate; null means the order's."),
  grossAmount: z.string().nullable().describe("Gross amount."),
  amountPrimary: z.string().nullable().describe("Net amount in the workspace's primary currency."),
  grossAmountPrimary: z.string().nullable().describe("Gross amount in the workspace's primary currency.")
});

export const purchaseOrderSchema = z.object({
  id: z.string().describe("The purchase order's id."),
  supplierId: z.string().describe("The supplier organization's id."),
  supplierName: z.string().describe("The supplier's name."),
  sourceShoppingListId: z
    .string()
    .nullable()
    .describe("The shopping list it was created from; null when created directly."),
  status: statusSchema,
  orderNumber: z.string().nullable().describe("The workspace's own order number."),
  supplierOrderNumber: z.string().nullable().describe("The supplier's number for this order."),
  currency: z.string().nullable().describe("The order's currency."),
  taxRate: z.string().nullable().describe("The order's default tax rate, in percent."),
  priceEntryMode: z.enum(["net", "gross"]).describe("Whether the UI shows and takes prices net or gross."),
  supplierDefaultTaxRate: z.string().nullable().describe("The supplier's default tax rate."),
  supplierDefaultPriceEntryMode: z.string().nullable().describe("The supplier's default price entry mode."),
  orderedAt: z.iso.datetime().nullable().describe("When it was ordered (ISO 8601, UTC)."),
  notes: z.string().nullable().describe("Free-text notes."),
  createdAt: z.iso.datetime().describe("When it was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When it last changed (ISO 8601, UTC)."),
  ...totalsShape,
  additionalCosts: z.array(additionalCostSchema).describe("Shipping, customs and other costs, oldest first."),
  additionalCostsLocked: z
    .boolean()
    .describe("True once anything was received: additional costs can no longer change."),
  items: z.array(purchaseOrderItemSchema).describe("The order's items, oldest first.")
});

const itemPriceFields = {
  supplierSku: optionalText("The supplier's catalog number.").optional(),
  unitPrice: priceSchema.nullable().optional().describe("Net unit price; null clears the price."),
  lineNetTotal: priceSchema
    .nullable()
    .optional()
    .describe(
      "Net line total, kept exactly instead of unit price × quantity (as the UI does when you type a line total). Sent without unitPrice, the unit price is derived from it."
    ),
  taxRate: taxRateSchema.nullable().optional().describe("The item's own tax rate; null means the order's."),
  notes: optionalText("Free-text notes.").optional()
};

export const listPurchaseOrdersOperation = defineOperation({
  name: "list_purchase_orders",
  description:
    "List the workspace's purchase orders, one page at a time, with the purchase orders list's search, filters and sorting. get_purchase_order returns an order's items and additional costs.",
  permission: "purchase-orders:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z
      .enum([
        "supplierName",
        "orderNumber",
        "status",
        "itemCount",
        "createdAt",
        "totalNetValue",
        "totalGrossValue",
        "totalNetValuePrimary",
        "totalGrossValuePrimary",
        "receivedAt"
      ])
      .optional()
      .describe("Sort key; createdAt when omitted."),
    sortDir: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort direction; newest first for createdAt and ascending otherwise when omitted."),
    searchQuery: z
      .string()
      .nullish()
      .describe("Only orders whose order number, notes or supplier name contains this text, ignoring case."),
    status: statusSchema.nullish().describe("Only orders in this status."),
    supplierId: z.string().nullish().describe("Only orders from this supplier organization."),
    orderedAt: z
      .string()
      .regex(DATE_RANGE_FILTER_PATTERN)
      .nullish()
      .describe(
        "Only orders ordered in a date range (UTC days): \"after:YYYY-MM-DD\", \"before:YYYY-MM-DD\" or \"between:YYYY-MM-DD:YYYY-MM-DD\"."
      ),
    receivedAt: z
      .string()
      .regex(DATE_RANGE_FILTER_PATTERN)
      .nullish()
      .describe("Only orders received in a date range, written as orderedAt."),
    totalNetValue: z
      .string()
      .regex(NUMERIC_FILTER_PATTERN)
      .nullish()
      .describe(
        "Filter on the net total: \"<op>:<value>\" with op eq, neq, gt, gte, lt or lte (e.g. \"gte:100\"), or \"between:<min>:<max>\" / \"not-between:<min>:<max>\"."
      )
  }),
  output: listPageOutputSchema(purchaseOrderSummarySchema)
});

export const getPurchaseOrderOperation = defineOperation({
  name: "get_purchase_order",
  description: "One purchase order of the workspace, by id, with its items, additional costs and totals.",
  permission: "purchase-orders:read",
  input: z.object({ orderId: orderIdSchema }),
  output: purchaseOrderSchema
});

export const createPurchaseOrderOperation = defineOperation({
  name: "create_purchase_order",
  description:
    "Create an empty draft purchase order for a supplier (see search_suppliers). A field left out gets what the UI's dialog pre-fills: the next order number, the supplier's currency (else the workspace's primary currency), and the supplier's tax rate and price entry mode (else the workspace's defaults). Send null for no value.",
  permission: "purchase-orders:write",
  input: z.object({
    supplierId: z.string().min(1).describe("The supplier organization's id."),
    orderNumber: optionalText("The order number; the next free PO-<year>-<n> when empty.").optional(),
    currency: currencySchema
      .nullable()
      .optional()
      .describe("The order's currency; it cannot change once the order exists. Items are priced in it."),
    taxRate: taxRateSchema.nullable().optional().describe("The order's default tax rate, in percent."),
    priceEntryMode: z
      .enum(["net", "gross"])
      .nullable()
      .optional()
      .describe("Whether the UI shows and takes prices net or gross."),
    notes: optionalText("Free-text notes.").optional()
  }),
  output: purchaseOrderSchema
});

export const updatePurchaseOrderOperation = defineOperation({
  name: "update_purchase_order",
  description:
    "Change a purchase order that is not received yet. Only the fields sent change; null clears a field. The currency is fixed once the order exists. orderedAt can be changed only on an ordered order, and re-converts its prices at that day's exchange rate.",
  permission: "purchase-orders:write",
  input: z.object({
    orderId: orderIdSchema,
    supplierId: z.string().min(1).optional().describe("Another supplier organization."),
    orderNumber: optionalText("The order number.").optional(),
    supplierOrderNumber: optionalText("The supplier's number for this order.").optional(),
    taxRate: taxRateSchema.nullable().optional().describe("The order's default tax rate, in percent."),
    orderedAt: z.iso
      .datetime()
      .nullable()
      .optional()
      .describe("When it was ordered (ISO 8601); only on an ordered order (order-not-ordered otherwise)."),
    notes: optionalText("Free-text notes.").optional()
  }),
  output: purchaseOrderSchema
});

export const deletePurchaseOrderOperation = defineOperation({
  name: "delete_purchase_order",
  description:
    "Delete a purchase order that is not received yet, with its items. The parts' planned and on-order quantities are put back; items converted from a shopping list count as planned again.",
  permission: "purchase-orders:write",
  input: z.object({ orderId: orderIdSchema }),
  output: z.object({ orderId: z.string().describe("The deleted order's id.") })
});

export const addPurchaseOrderItemOperation = defineOperation({
  name: "add_purchase_order_item",
  description:
    "Add one item to a purchase order that is not received yet: a part (partId), or a free-text item (description). The part's planned quantity rises by it. To add several parts, merging into the lines already there, use add_purchase_order_items.",
  permission: "purchase-orders:write",
  input: z.object({
    orderId: orderIdSchema,
    partId: partIdSchema.nullish().describe("The part to buy; leave out for a free-text item."),
    description: optionalText("A free-text item's description; needed when there is no partId.").optional(),
    quantity: quantitySchema,
    ...itemPriceFields
  }),
  output: z.object({
    itemId: z.string().describe("The new item's id."),
    purchaseOrder: purchaseOrderSchema
  })
});

export const addPurchaseOrderItemsOperation = defineOperation({
  name: "add_purchase_order_items",
  description:
    "Add several parts to a purchase order at once, as the UI's bulk add does: a part already on the order gets its quantity added to that item; any other part becomes a new item, unpriced.",
  permission: "purchase-orders:write",
  input: z.object({
    orderId: orderIdSchema,
    items: z
      .array(z.object({ partId: partIdSchema, quantity: quantitySchema }))
      .min(1)
      .describe("The parts to add, with how many of each.")
  }),
  output: z.object({
    addedCount: z.number().int().describe("How many entries of items were added."),
    purchaseOrder: purchaseOrderSchema
  })
});

export const updatePurchaseOrderItemOperation = defineOperation({
  name: "update_purchase_order_item",
  description:
    "Change an item of a purchase order that is not received yet. Only the fields sent change; null clears a field. When neither quantity nor a price is sent, the line total stays as it is; otherwise it becomes unit price × quantity unless lineNetTotal is sent. On a draft order, the part's planned quantity follows the new quantity.",
  permission: "purchase-orders:write",
  input: z.object({
    orderId: orderIdSchema,
    itemId: itemIdSchema,
    quantity: quantitySchema.optional(),
    description: optionalText("A free-text item's description.").optional(),
    ...itemPriceFields
  }),
  output: purchaseOrderSchema
});

export const removePurchaseOrderItemOperation = defineOperation({
  name: "remove_purchase_order_item",
  description:
    "Remove an item from a purchase order that is not received yet; the part's planned or on-order quantity drops by it.",
  permission: "purchase-orders:write",
  input: z.object({ orderId: orderIdSchema, itemId: itemIdSchema }),
  output: purchaseOrderSchema
});

const additionalCostFields = {
  label: z.string().describe("What it is, e.g. Shipping; must not be empty."),
  amount: priceSchema.describe("Net amount in the order's currency, more than 0."),
  taxRate: taxRateSchema.nullable().optional().describe("Its own tax rate; null means the order's.")
};

export const addAdditionalCostOperation = defineOperation({
  name: "add_purchase_order_cost",
  description:
    "Add an additional cost (shipping, customs…) to a purchase order. Receiving spreads additional costs over the items' unit costs, so they cannot change once anything is received.",
  permission: "purchase-orders:write",
  input: z.object({ orderId: orderIdSchema, ...additionalCostFields }),
  output: z.object({
    costId: z.string().describe("The new additional cost's id."),
    purchaseOrder: purchaseOrderSchema
  })
});

export const updateAdditionalCostOperation = defineOperation({
  name: "update_purchase_order_cost",
  description:
    "Change an additional cost of a purchase order, until anything is received. Only the fields sent change; null clears the tax rate.",
  permission: "purchase-orders:write",
  input: z.object({
    orderId: orderIdSchema,
    costId: costIdSchema,
    label: additionalCostFields.label.optional(),
    amount: additionalCostFields.amount.optional(),
    taxRate: additionalCostFields.taxRate
  }),
  output: purchaseOrderSchema
});

export const deleteAdditionalCostOperation = defineOperation({
  name: "delete_purchase_order_cost",
  description: "Delete an additional cost of a purchase order, until anything is received.",
  permission: "purchase-orders:write",
  input: z.object({ orderId: orderIdSchema, costId: costIdSchema }),
  output: purchaseOrderSchema
});

export const markPurchaseOrderOrderedOperation = defineOperation({
  name: "mark_purchase_order_ordered",
  description:
    "Mark a draft purchase order with at least one item as ordered, today: its parts move from planned to on order, and prices are converted to the primary currency at today's rate. Fails with exchange-rate-unavailable (details: from, to, date) when no rate is known; save one with save_exchange_rate and retry.",
  permission: "purchase-orders:write",
  input: z.object({ orderId: orderIdSchema }),
  output: purchaseOrderSchema
});

export const receivePurchaseOrderItemsOperation = defineOperation({
  name: "receive_purchase_order_items",
  description:
    "Receive items of an ordered purchase order, in full or in part, into storage locations: each part item becomes a stock receipt at that location, with its unit cost (including its share of the additional costs). Once every item is received in full, the order becomes RECEIVED.",
  permission: "purchase-orders:write",
  input: z.object({
    orderId: orderIdSchema,
    items: z
      .array(
        z.object({
          itemId: itemIdSchema,
          quantity: quantitySchema.describe("How many arrived; at most what is still outstanding."),
          locationId: z
            .string()
            .nullable()
            .describe(
              "The storage location (not archived) to put a part item into, usually its partDefaultLocationId; null only for a free-text item."
            )
        })
      )
      .min(1)
      .describe("The items received in this delivery.")
  }),
  output: purchaseOrderSchema
});

export const revertPurchaseOrderToDraftOperation = defineOperation({
  name: "revert_purchase_order_to_draft",
  description:
    "Put an ordered purchase order back to draft: its order date is cleared and its parts move from on order back to planned.",
  permission: "purchase-orders:write",
  input: z.object({ orderId: orderIdSchema }),
  output: purchaseOrderSchema
});

export const listDraftPurchaseOrdersOperation = defineOperation({
  name: "list_draft_purchase_orders",
  description:
    "The workspace's draft purchase orders, newest first: the orders a part can still be added to (with add_purchase_order_item or add_purchase_order_items).",
  permission: "purchase-orders:read",
  input: z.object({}),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string().describe("The purchase order's id."),
        orderNumber: z.string().nullable().describe("Its order number."),
        supplierId: z.string().describe("The supplier organization's id."),
        supplierName: z.string().describe("The supplier's name."),
        itemCount: z.number().int().describe("How many items it has.")
      })
    )
  })
});

export const getPartPurchaseHistoryOperation = defineOperation({
  name: "get_part_purchase_history",
  description:
    "A part's purchase history: the latest 50 purchase order items of the part, most recently ordered first, with unit prices.",
  permission: "purchase-orders:read",
  input: z.object({ id: partIdSchema }),
  output: z.object({
    items: z.array(
      z.object({
        orderId: z.string().describe("The purchase order's id."),
        orderNumber: z.string().nullable().describe("Its order number."),
        supplierName: z.string().describe("The supplier's name."),
        status: statusSchema,
        orderedAt: z.iso.datetime().nullable().describe("When it was ordered."),
        quantity: z.string().describe("How many were ordered."),
        unitPriceNet: z.string().nullable().describe("Net unit price."),
        unitPriceGross: z.string().nullable().describe("Gross unit price."),
        currency: z.string().nullable().describe("The price's currency."),
        unitPriceNetPrimary: z.string().nullable().describe("Net unit price in the primary currency."),
        unitPriceGrossPrimary: z.string().nullable().describe("Gross unit price in the primary currency.")
      })
    )
  })
});

export const searchSuppliersOperation = defineOperation({
  name: "search_suppliers",
  description:
    "The workspace's supplier organizations (organizations with the supplier role), by name, with the defaults a new purchase order takes from them. With searchQuery, at most 20.",
  permission: "purchase-orders:read",
  input: z.object({
    searchQuery: z
      .string()
      .optional()
      .describe("Only suppliers whose name contains this text, ignoring case.")
  }),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string().describe("The supplier organization's id."),
        name: z.string().describe("Its name."),
        currency: z.string().nullable().describe("Its currency."),
        defaultPriceEntryMode: z.string().nullable().describe("Its default price entry mode, net or gross."),
        defaultTaxRate: z.string().nullable().describe("Its default tax rate, in percent.")
      })
    )
  })
});

export const lookupSupplierItemOperation = defineOperation({
  name: "lookup_supplier_item",
  description:
    "Look a part up at the workspace's active supplier integration (DigiKey or TME), by its catalog number, as the purchase order item dialog does, to get the supplier's catalog number (SKU). Answers ok false with a reason when there is no active integration, nothing is found, or the lookup fails.",
  permission: "purchase-orders:read",
  input: z.object({ id: partIdSchema }),
  output: z.object({
    ok: z.boolean().describe("Whether a supplier item was found."),
    supplierSku: z.string().nullable().describe("The supplier's catalog number; null unless ok."),
    reason: z
      .enum(["no-provider", "not-found", "lookup-failed"])
      .nullable()
      .describe("Why nothing was found; null when ok.")
  })
});

const rateFields = {
  from: currencySchema.describe("The currency converted from, e.g. \"USD\"."),
  to: currencySchema.describe("The currency converted to, e.g. \"EUR\"."),
  date: z.string().regex(DATE_PATTERN).describe("The day, YYYY-MM-DD (UTC).")
};

export const getExchangeRateOperation = defineOperation({
  name: "get_exchange_rate",
  description:
    "The exchange rate the app uses to convert 1 unit of from into to on a day: a saved rate, else one fetched from the European Central Bank's reference rates and saved. rate is null when none is known; save one with save_exchange_rate.",
  permission: "purchase-orders:read",
  input: z.object(rateFields),
  output: z.object({
    ...rateFields,
    rate: z.string().nullable().describe("1 from in to, as a decimal string; null when unknown.")
  })
});

export const saveExchangeRateOperation = defineOperation({
  name: "save_exchange_rate",
  description:
    "Save a manual exchange rate for converting from into to on a day, replacing any rate saved for that day. Exchange rates are shared by every workspace of this instance.",
  permission: "purchase-orders:write",
  input: z.object({
    ...rateFields,
    rate: z.string().regex(DECIMAL_PATTERN).describe("1 from in to, more than 0, e.g. \"4.2512\".")
  }),
  output: z.object({ ...rateFields, rate: z.string().describe("The saved rate.") })
});
