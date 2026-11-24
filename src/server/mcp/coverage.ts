/**
 * MCP coverage (#276): every server action is either an MCP tool or excluded with a reason.
 *
 * The owner wants MCP to cover everything the UI can do (ADR 0030, the decisions of #79). A server
 * action is how the UI does something, so each exported function of a `"use server"` module has an
 * entry here, keyed by its file and export name:
 *
 * - `{ tool }` — the MCP tool (the operation's stable `name`) that does the same thing;
 * - `{ excluded }` — why it has no tool: one of the owner's exclusions (demo reset, scheduled
 *   deletion, sign-up/in/out, DigiKey/TME credentials), or a UI-only helper (dialog data, filter
 *   options, "next number" previews) no agent needs to complete a task;
 * - `{ pending }` — the area issue of the milestone that will map it. Each area issue (#277–#286)
 *   replaces its pending entries with tools or exclusions; the milestone is complete when no
 *   pending entry is left.
 *
 * `tests/unit/mcpCoverage.test.ts` fails when an action has no entry, when an entry names an
 * action that no longer exists, and `tests/integration/api-mcp.test.ts` when a `tool` entry names
 * a tool the registry (`tools.ts`) does not offer. This module is pure data: no `server-only`, so
 * the unit test can read it.
 */

export type ServerActionCoverage =
  | { tool: string }
  | { excluded: string }
  | { pending: `#${number}` };

/** Coverage entries by repository-relative file, then by exported action name. */
export type ServerActionCoverageMap = Record<string, Record<string, ServerActionCoverage>>;

const AUTH = "Sign-up, sign-in and sign-out are not exposed (the owner, 2026-11-24, #79).";
const CREDENTIALS =
  "DigiKey and TME credentials are never readable or settable through the API or MCP (the owner, 2026-11-24, #79).";
const API_TOKENS =
  "API tokens are managed by a signed-in user in Settings (#273); no area issue of the milestone exposes token management to a token.";

export const serverActionCoverage: ServerActionCoverageMap = {
  "src/server/api-tokens/apiTokenActions.ts": {
    createApiTokenAction: { excluded: API_TOKENS },
    revokeApiTokenAction: { excluded: API_TOKENS }
  },
  "src/server/auth/actions.ts": {
    signInWithPassword: { excluded: AUTH },
    signUpWithPassword: { excluded: AUTH },
    signOut: { excluded: AUTH }
  },
  "src/server/builds/buildActions.ts": {
    getBuildsPageForWorkspace: { tool: "list_builds" },
    searchDesignsForWorkspace: {
      excluded:
        "UI-only helper: the design picker of the builds list filter; get_build_create_options lists the designs (#79, UI-only helpers)."
    },
    getPartBuildAllocationsForWorkspace: { tool: "get_part_build_allocations" },
    getPartProductionBuildsForWorkspace: { tool: "get_part_production_builds" },
    getBuildDetailAction: { tool: "get_build" },
    getBuildCreateOptionsAction: { tool: "get_build_create_options" },
    createBuildAction: { tool: "create_build" },
    deleteBuildAction: { tool: "delete_build" },
    setBuildLineAllocationsAction: { tool: "set_build_line_allocations" },
    setBuildAllocationsAction: { tool: "set_build_allocations" },
    reassignDesignatorAssignmentAction: { tool: "reassign_build_designator" },
    startBuildAction: { tool: "start_build" },
    assembleDesignatorAction: { tool: "assemble_build_designator" },
    assembleBuildUnitAction: { tool: "assemble_build_unit" },
    cancelBuildAction: { tool: "cancel_build" }
  },
  "src/server/designs/bomActions.ts": {
    getBomLineItemsAction: { tool: "list_bom_line_items" },
    getBomDialogDataAction: {
      excluded: "UI-only helper: data for the BOM line item dialog (#79, UI-only helpers)."
    },
    getBomCategoryAttributesAction: {
      excluded:
        "UI-only helper: the BOM dialog's attribute picker; get_category_attributes answers a category's effective attributes (#79, UI-only helpers)."
    },
    previewLineItemMatchesAction: { tool: "preview_bom_line_item_matches" },
    analyzeShortageAction: { tool: "analyze_shortage" },
    createBomLineItemAction: { tool: "create_bom_line_item" },
    updateBomLineItemAction: { tool: "update_bom_line_item" },
    deleteBomLineItemAction: { tool: "delete_bom_line_item" }
  },
  "src/server/designs/designActions.ts": {
    getDesignsPageForWorkspace: { tool: "list_designs" },
    getDesignDetailAction: { tool: "get_design" },
    getNextDesignCatalogNumberAction: {
      excluded: "UI-only helper: the \"next number\" preview of the design dialog (#79, UI-only helpers)."
    },
    createDesignAction: { tool: "create_design" },
    updateDesignAction: { tool: "update_design" },
    deleteDesignAction: { tool: "delete_design" },
    addRevisionToDesignAction: { tool: "add_design_revision" },
    updateDesignRevisionAction: { tool: "update_design_revision" }
  },
  "src/server/integrations/digikeyActions.ts": {
    updateDigiKeyIntegrationSettings: { excluded: CREDENTIALS }
  },
  "src/server/integrations/matching.ts": {
    getSupplierMatchingSuggestionsForWorkspace: { pending: "#285" }
  },
  "src/server/integrations/settingsActions.ts": {
    updateDigiKeyIntegrationSettings: { excluded: CREDENTIALS },
    updateTmeIntegrationSettings: { excluded: CREDENTIALS },
    updateActiveSupplierProviderSettings: { tool: "update_workspace_settings" }
  },
  "src/server/integrations/supplierActions.ts": {
    searchSupplierPartsForWorkspace: { pending: "#285" },
    getSupplierPartAttributesForWorkspace: { pending: "#285" }
  },
  "src/server/inventory/entryActions.ts": {
    createInventoryEntryForWorkspace: { tool: "create_inventory_entry" },
    getPartBalancesForWorkspace: { tool: "get_part_stock_balances" },
    getPartInventoryHistoryForWorkspace: { tool: "list_inventory_entries" },
    getLocationStockForWorkspace: { tool: "get_location_stock" }
  },
  "src/server/inventory/locationActions.ts": {
    getLocationsForWorkspace: { tool: "list_locations" },
    createLocationForWorkspace: { tool: "create_location" },
    updateLocationForWorkspace: { tool: "update_location" },
    generateLocationsForWorkspace: { tool: "generate_locations" },
    deleteLocationForWorkspace: { tool: "delete_location" }
  },
  "src/server/organizations/organizationActions.ts": {
    getOrganizationsPageForWorkspace: { tool: "list_organizations" },
    createOrganizationAction: { tool: "create_organization" },
    updateOrganizationAction: { tool: "update_organization" },
    deleteOrganizationAction: { tool: "delete_organization" }
  },
  "src/server/parts/attributeActions.ts": {
    getAttributeDictionaryForWorkspace: { tool: "list_attributes" },
    getAttributeDictionaryPageForWorkspace: { tool: "list_attributes" },
    createAttributeForWorkspace: { tool: "create_attribute" },
    updateAttributeForWorkspace: { tool: "update_attribute" },
    deleteAttributeForWorkspace: { tool: "delete_attribute" },
    createChoiceOptionForWorkspace: { tool: "create_attribute_choice_option" },
    updateChoiceOptionForWorkspace: { tool: "update_attribute_choice_option" },
    deleteChoiceOptionForWorkspace: { tool: "delete_attribute_choice_option" },
    getEffectiveCategoryAttributesForWorkspace: { tool: "get_category_attributes" },
    getEffectiveWorkspaceAttributesForWorkspace: { tool: "get_workspace_attributes" },
    attachCategoryAttributeForWorkspace: { tool: "attach_category_attribute" },
    detachCategoryAttributeForWorkspace: { tool: "detach_category_attribute" },
    setCategoryValueAttributeForWorkspace: { tool: "set_category_value_attribute" },
    saveCategoryAttributeConfigurationForWorkspace: { tool: "save_category_attribute_configuration" },
    saveWorkspaceAttributeConfigurationForWorkspace: { tool: "save_workspace_attribute_configuration" }
  },
  "src/server/parts/categoryActions.ts": {
    createPartCategoryFromForm: { tool: "create_part_category" },
    createPartCategoryPathFromForm: { tool: "create_part_category_path" },
    updatePartCategoryFromForm: { tool: "update_part_category" },
    deletePartCategoryFromForm: { tool: "delete_part_category" }
  },
  "src/server/parts/createPart.ts": {
    createPart: { tool: "create_part" },
    updatePart: { tool: "update_part" },
    deletePart: { tool: "delete_part" }
  },
  "src/server/parts/listActions.ts": {
    getPartsListFilterDataForWorkspace: {
      excluded: "UI-only helper: filter options of the parts list (#79, UI-only helpers)."
    },
    getPartsListPageForWorkspace: { tool: "list_parts" }
  },
  "src/server/purchase-orders/purchaseOrderActions.ts": {
    getPurchaseOrdersForWorkspace: { tool: "list_purchase_orders" },
    getPurchaseOrderDetailForWorkspace: { tool: "get_purchase_order" },
    getPartPurchaseOrderHistoryForWorkspace: { tool: "get_part_purchase_history" },
    getNextOrderNumberForWorkspace: {
      excluded: "UI-only helper: the \"next number\" preview of the purchase order dialog (#79, UI-only helpers)."
    },
    searchSupplierOrganizationsForWorkspace: { tool: "search_suppliers" },
    lookupSupplierItemForWorkspace: { tool: "lookup_supplier_item" },
    createPurchaseOrderForWorkspace: { tool: "create_purchase_order" },
    updatePurchaseOrderForWorkspace: { tool: "update_purchase_order" },
    deletePurchaseOrderForWorkspace: { tool: "delete_purchase_order" },
    addOrderItemForWorkspace: { tool: "add_purchase_order_item" },
    updateOrderItemForWorkspace: { tool: "update_purchase_order_item" },
    removeOrderItemForWorkspace: { tool: "remove_purchase_order_item" },
    addAdditionalCostForWorkspace: { tool: "add_purchase_order_cost" },
    updateAdditionalCostForWorkspace: { tool: "update_purchase_order_cost" },
    deleteAdditionalCostForWorkspace: { tool: "delete_purchase_order_cost" },
    markOrderedForWorkspace: { tool: "mark_purchase_order_ordered" },
    receiveItemsForWorkspace: { tool: "receive_purchase_order_items" },
    revertOrderToDraftForWorkspace: { tool: "revert_purchase_order_to_draft" },
    getExchangeRateForWorkspace: { tool: "get_exchange_rate" },
    getDraftPurchaseOrdersForWorkspace: { tool: "list_draft_purchase_orders" },
    addMultipleOrderItemsForWorkspace: { tool: "add_purchase_order_items" },
    saveManualExchangeRateForWorkspace: { tool: "save_exchange_rate" }
  },
  "src/server/shopping-lists/shoppingListActions.ts": {
    getShoppingListsForWorkspace: { tool: "list_shopping_lists" },
    getShoppingListDetailForWorkspace: { tool: "get_shopping_list" },
    getPartShoppingListMembershipForWorkspace: { tool: "get_part_shopping_lists" },
    getAllShoppingListsForWorkspace: { tool: "list_shopping_lists" },
    createShoppingListForWorkspace: { tool: "create_shopping_list" },
    updateShoppingListForWorkspace: { tool: "update_shopping_list" },
    deleteShoppingListForWorkspace: { tool: "delete_shopping_list" },
    addShoppingListItemForWorkspace: { tool: "add_shopping_list_item" },
    updateShoppingListItemForWorkspace: { tool: "update_shopping_list_item" },
    removeShoppingListItemForWorkspace: { tool: "remove_shopping_list_item" },
    convertShoppingListToOrderForWorkspace: { tool: "convert_shopping_list_to_purchase_order" },
    addMultipleShoppingListItemsForWorkspace: { tool: "add_shopping_list_items" }
  },
  "src/server/units/unitActions.ts": {
    getUnitsForWorkspace: { tool: "list_units" },
    getUnitsPageForWorkspace: { tool: "list_units" },
    createUnitForWorkspace: { tool: "create_unit" },
    updateUnitForWorkspace: { tool: "update_unit" },
    deleteUnitForWorkspace: { tool: "delete_unit" }
  },
  "src/server/user/displayPreferences.ts": {
    updateUserDisplayPreferences: { tool: "update_display_preferences" }
  },
  "src/server/workspaces/actions.ts": {
    createWorkspace: { tool: "create_workspace" },
    archiveWorkspace: { tool: "archive_workspace" },
    restoreWorkspaceFromPicker: { tool: "restore_workspace" },
    scheduleWorkspaceDeletion: {
      excluded: "Scheduled workspace deletion is not exposed (the owner, 2026-11-24, #79)."
    },
    resetWorkspaceToDemoPreset: {
      excluded: "Reset to the demo preset is not exposed (the owner, 2026-11-24, #79)."
    },
    loadStarterDictionaries: { tool: "load_starter_dictionaries" }
  },
  "src/server/workspaces/orderingDefaults.ts": {
    updateWorkspaceOrderingDefaults: { tool: "update_workspace_settings" }
  }
};

/**
 * The problems that fail the check, given the server actions found in the source (by file, then
 * export names). Empty when every action has exactly one entry and every entry names an action.
 */
export function findCoverageProblems(
  actions: ReadonlyMap<string, readonly string[]>,
  coverage: ServerActionCoverageMap
): string[] {
  const problems: string[] = [];

  for (const [file, names] of actions) {
    for (const name of names) {
      if (!Object.hasOwn(coverage[file] ?? {}, name)) {
        problems.push(
          `${file}#${name} is a server action with no MCP coverage entry: map it to an MCP tool, or exclude it with a reason, in src/server/mcp/coverage.ts.`
        );
      }
    }
  }

  for (const [file, entries] of Object.entries(coverage)) {
    const names = actions.get(file) ?? [];

    for (const [name, entry] of Object.entries(entries)) {
      if (!names.includes(name)) {
        problems.push(`${file}#${name} has a coverage entry but is no longer a server action.`);
      } else if ("tool" in entry && entry.tool.trim() === "") {
        problems.push(`${file}#${name} names an empty MCP tool.`);
      } else if ("excluded" in entry && entry.excluded.trim() === "") {
        problems.push(`${file}#${name} is excluded without a reason.`);
      }
    }
  }

  return problems;
}

/** The entries still waiting for their area issue, as `file#name` by issue. */
export function pendingCoverage(coverage: ServerActionCoverageMap): Map<string, string[]> {
  const pending = new Map<string, string[]>();

  for (const [file, entries] of Object.entries(coverage)) {
    for (const [name, entry] of Object.entries(entries)) {
      if ("pending" in entry) {
        pending.set(entry.pending, [...(pending.get(entry.pending) ?? []), `${file}#${name}`]);
      }
    }
  }

  return pending;
}
