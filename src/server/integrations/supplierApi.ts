import "server-only";

import { implementOperation } from "@/server/api/execute";
import {
  getSupplierMatchingSuggestions,
  getSupplierPartAttributes,
  searchSupplierParts
} from "@/server/integrations/supplierLookup";
import {
  getSupplierMatchingSuggestionsOperation,
  getSupplierPartAttributesOperation,
  searchSupplierPartsOperation,
  SUPPLIER_SEARCH_PAGE_SIZE
} from "@/server/integrations/supplierOperations";

/**
 * Supplier lookup in the API and MCP (#285), over the same functions as the add-part dialog's
 * server actions (`supplierLookup.ts`), so DigiKey and TME receive the same requests. The
 * permission is checked by `executeOperation` before the function runs; every call is scoped to
 * the actor's workspace and its configured supplier.
 */

export const searchSupplierPartsImplementation = implementOperation(
  searchSupplierPartsOperation,
  async (actor, input) => {
    const outcome = await searchSupplierParts({
      workspaceId: actor.workspace.id,
      query: input.query,
      limit: input.limit ?? SUPPLIER_SEARCH_PAGE_SIZE,
      offset: input.offset
    });

    if (!outcome.ok) {
      throw new Error(outcome.error);
    }

    return {
      provider: outcome.provider,
      items: outcome.page.page.items,
      nextOffset: outcome.page.page.nextOffset
    };
  }
);

export const getSupplierPartAttributesImplementation = implementOperation(
  getSupplierPartAttributesOperation,
  (actor, input) =>
    getSupplierPartAttributes({
      workspaceId: actor.workspace.id,
      catalogNumber: input.catalogNumber
    })
);

export const getSupplierMatchingSuggestionsImplementation = implementOperation(
  getSupplierMatchingSuggestionsOperation,
  (actor, input) =>
    getSupplierMatchingSuggestions({
      workspaceId: actor.workspace.id,
      provider: input.provider,
      sourceManufacturerName: input.sourceManufacturerName ?? null,
      sourceCategory: input.sourceCategory,
      sourceAttributes: input.sourceAttributes.map((attribute) => ({
        sourceAttribute: attribute.name,
        sourceValue: attribute.value,
        sourceUnit: attribute.unit
      })),
      targetCategoryId: input.targetCategoryId ?? null
    })
);
