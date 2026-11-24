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
    getBuildsPageForWorkspace: { pending: "#284" },
    searchDesignsForWorkspace: { pending: "#284" },
    getPartBuildAllocationsForWorkspace: { pending: "#284" },
    getPartProductionBuildsForWorkspace: { pending: "#284" },
    getBuildDetailAction: { pending: "#284" },
    getBuildCreateOptionsAction: { pending: "#284" },
    createBuildAction: { pending: "#284" },
    deleteBuildAction: { pending: "#284" },
    setBuildLineAllocationsAction: { pending: "#284" },
    setBuildAllocationsAction: { pending: "#284" },
    reassignDesignatorAssignmentAction: { pending: "#284" },
    startBuildAction: { pending: "#284" },
    assembleDesignatorAction: { pending: "#284" },
    assembleBuildUnitAction: { pending: "#284" },
    cancelBuildAction: { pending: "#284" }
  },
  "src/server/designs/bomActions.ts": {
    getBomLineItemsAction: { pending: "#283" },
    getBomDialogDataAction: {
      excluded: "UI-only helper: data for the BOM line item dialog (#79, UI-only helpers)."
    },
    getBomCategoryAttributesAction: { pending: "#283" },
    previewLineItemMatchesAction: { pending: "#283" },
    analyzeShortageAction: { pending: "#283" },
    createBomLineItemAction: { pending: "#283" },
    updateBomLineItemAction: { pending: "#283" },
    deleteBomLineItemAction: { pending: "#283" }
  },
  "src/server/designs/designActions.ts": {
    getDesignsPageForWorkspace: { pending: "#283" },
    getDesignDetailAction: { pending: "#283" },
    getNextDesignCatalogNumberAction: {
      excluded: "UI-only helper: the \"next number\" preview of the design dialog (#79, UI-only helpers)."
    },
    createDesignAction: { pending: "#283" },
    updateDesignAction: { pending: "#283" },
    deleteDesignAction: { pending: "#283" },
    addRevisionToDesignAction: { pending: "#283" },
    updateDesignRevisionAction: { pending: "#283" }
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
    updateActiveSupplierProviderSettings: { pending: "#286" }
  },
  "src/server/integrations/supplierActions.ts": {
    searchSupplierPartsForWorkspace: { pending: "#285" },
    getSupplierPartAttributesForWorkspace: { pending: "#285" }
  },
  "src/server/inventory/entryActions.ts": {
    createInventoryEntryForWorkspace: { pending: "#280" },
    getPartBalancesForWorkspace: { pending: "#280" },
    getPartInventoryHistoryForWorkspace: { pending: "#280" },
    getLocationStockForWorkspace: { pending: "#280" }
  },
  "src/server/inventory/locationActions.ts": {
    getLocationsForWorkspace: { pending: "#280" },
    createLocationForWorkspace: { pending: "#280" },
    updateLocationForWorkspace: { pending: "#280" },
    generateLocationsForWorkspace: { pending: "#280" },
    deleteLocationForWorkspace: { pending: "#280" }
  },
  "src/server/organizations/organizationActions.ts": {
    getOrganizationsPageForWorkspace: { tool: "list_organizations" },
    createOrganizationAction: { tool: "create_organization" },
    updateOrganizationAction: { tool: "update_organization" },
    deleteOrganizationAction: { tool: "delete_organization" }
  },
  "src/server/parts/attributeActions.ts": {
    getAttributeDictionaryForWorkspace: { pending: "#278" },
    getAttributeDictionaryPageForWorkspace: { pending: "#278" },
    createAttributeForWorkspace: { pending: "#278" },
    updateAttributeForWorkspace: { pending: "#278" },
    deleteAttributeForWorkspace: { pending: "#278" },
    createChoiceOptionForWorkspace: { pending: "#278" },
    updateChoiceOptionForWorkspace: { pending: "#278" },
    deleteChoiceOptionForWorkspace: { pending: "#278" },
    getEffectiveCategoryAttributesForWorkspace: { pending: "#278" },
    getEffectiveWorkspaceAttributesForWorkspace: { pending: "#278" },
    attachCategoryAttributeForWorkspace: { pending: "#278" },
    detachCategoryAttributeForWorkspace: { pending: "#278" },
    setCategoryValueAttributeForWorkspace: { pending: "#278" },
    saveCategoryAttributeConfigurationForWorkspace: { pending: "#278" },
    saveWorkspaceAttributeConfigurationForWorkspace: { pending: "#278" }
  },
  "src/server/parts/categoryActions.ts": {
    createPartCategoryFromForm: { pending: "#278" },
    createPartCategoryPathFromForm: { pending: "#278" },
    updatePartCategoryFromForm: { pending: "#278" },
    deletePartCategoryFromForm: { pending: "#278" }
  },
  "src/server/parts/createPart.ts": {
    createPart: { pending: "#277" },
    updatePart: { pending: "#277" },
    deletePart: { pending: "#277" }
  },
  "src/server/parts/listActions.ts": {
    getPartsListFilterDataForWorkspace: {
      excluded: "UI-only helper: filter options of the parts list (#79, UI-only helpers)."
    },
    getPartsListPageForWorkspace: { pending: "#277" }
  },
  "src/server/purchase-orders/purchaseOrderActions.ts": {
    getPurchaseOrdersForWorkspace: { pending: "#282" },
    getPurchaseOrderDetailForWorkspace: { pending: "#282" },
    getPartPurchaseOrderHistoryForWorkspace: { pending: "#282" },
    getNextOrderNumberForWorkspace: {
      excluded: "UI-only helper: the \"next number\" preview of the purchase order dialog (#79, UI-only helpers)."
    },
    searchSupplierOrganizationsForWorkspace: { pending: "#282" },
    lookupSupplierItemForWorkspace: { pending: "#282" },
    createPurchaseOrderForWorkspace: { pending: "#282" },
    updatePurchaseOrderForWorkspace: { pending: "#282" },
    deletePurchaseOrderForWorkspace: { pending: "#282" },
    addOrderItemForWorkspace: { pending: "#282" },
    updateOrderItemForWorkspace: { pending: "#282" },
    removeOrderItemForWorkspace: { pending: "#282" },
    addAdditionalCostForWorkspace: { pending: "#282" },
    updateAdditionalCostForWorkspace: { pending: "#282" },
    deleteAdditionalCostForWorkspace: { pending: "#282" },
    markOrderedForWorkspace: { pending: "#282" },
    receiveItemsForWorkspace: { pending: "#282" },
    revertOrderToDraftForWorkspace: { pending: "#282" },
    getExchangeRateForWorkspace: { pending: "#282" },
    getDraftPurchaseOrdersForWorkspace: { pending: "#282" },
    addMultipleOrderItemsForWorkspace: { pending: "#282" },
    saveManualExchangeRateForWorkspace: { pending: "#282" }
  },
  "src/server/shopping-lists/shoppingListActions.ts": {
    getShoppingListsForWorkspace: { pending: "#281" },
    getShoppingListDetailForWorkspace: { pending: "#281" },
    getPartShoppingListMembershipForWorkspace: { pending: "#281" },
    getAllShoppingListsForWorkspace: { pending: "#281" },
    createShoppingListForWorkspace: { pending: "#281" },
    updateShoppingListForWorkspace: { pending: "#281" },
    deleteShoppingListForWorkspace: { pending: "#281" },
    addShoppingListItemForWorkspace: { pending: "#281" },
    updateShoppingListItemForWorkspace: { pending: "#281" },
    removeShoppingListItemForWorkspace: { pending: "#281" },
    convertShoppingListToOrderForWorkspace: { pending: "#281" },
    addMultipleShoppingListItemsForWorkspace: { pending: "#281" }
  },
  "src/server/units/unitActions.ts": {
    getUnitsForWorkspace: { pending: "#278" },
    getUnitsPageForWorkspace: { pending: "#278" },
    createUnitForWorkspace: { pending: "#278" },
    updateUnitForWorkspace: { pending: "#278" },
    deleteUnitForWorkspace: { pending: "#278" }
  },
  "src/server/user/displayPreferences.ts": {
    updateUserDisplayPreferences: { pending: "#286" }
  },
  "src/server/workspaces/actions.ts": {
    createWorkspace: { pending: "#286" },
    archiveWorkspace: { pending: "#286" },
    restoreWorkspaceFromPicker: { pending: "#286" },
    scheduleWorkspaceDeletion: {
      excluded: "Scheduled workspace deletion is not exposed (the owner, 2026-11-24, #79)."
    },
    resetWorkspaceToDemoPreset: {
      excluded: "Reset to the demo preset is not exposed (the owner, 2026-11-24, #79)."
    },
    loadStarterDictionaries: { pending: "#286" }
  },
  "src/server/workspaces/orderingDefaults.ts": {
    updateWorkspaceOrderingDefaults: { pending: "#286" }
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
