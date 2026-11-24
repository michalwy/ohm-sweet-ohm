import "server-only";

import type { OperationImplementation } from "@/server/api/execute";
import {
  createInventoryEntryImplementation,
  getLocationStockImplementation,
  getPartStockBalancesImplementation,
  listInventoryEntriesImplementation
} from "@/server/inventory/inventoryApi";
import {
  createLocationImplementation,
  deleteLocationImplementation,
  generateLocationsImplementation,
  getLocationImplementation,
  listLocationsImplementation,
  updateLocationImplementation
} from "@/server/inventory/locationApi";
import {
  createOrganizationImplementation,
  deleteOrganizationImplementation,
  getOrganizationImplementation,
  listOrganizationsImplementation,
  updateOrganizationImplementation
} from "@/server/organizations/organizationApi";
import * as buildApi from "@/server/builds/buildApi";
import * as attributeApi from "@/server/parts/attributeApi";
import * as categoryApi from "@/server/parts/categoryApi";
import * as purchaseOrderApi from "@/server/purchase-orders/purchaseOrderApi";
import * as shoppingListApi from "@/server/shopping-lists/shoppingListApi";
import * as unitApi from "@/server/units/unitApi";
import {
  createPartImplementation,
  deletePartImplementation,
  getPartImplementation,
  listPartsImplementation,
  updatePartImplementation
} from "@/server/parts/partsApi";
import * as workspaceApi from "@/server/workspaces/workspaceApi";

/**
 * How a tool behaves, as MCP annotations tell clients (#275). Every tool says whether it only
 * reads; a tool that writes also says whether it can destroy data (delete, overwrite) — clients ask
 * the user before calling a destructive tool. Declared explicitly, never left to the client's
 * defaults (which assume the worst).
 */
export type McpToolBehavior =
  | { readOnly: true }
  | { readOnly: false; destructive: boolean; idempotent?: boolean };

export type McpTool = {
  title: string;
  implementation: OperationImplementation;
  behavior: McpToolBehavior;
};

/**
 * Declares an MCP tool over an operation implementation — the same one the REST endpoint serves.
 * The tool's name, description, input and output schemas come from the operation.
 */
export function defineMcpTool(
  title: string,
  implementation: OperationImplementation,
  behavior: McpToolBehavior
): McpTool {
  return { title, implementation, behavior };
}

/**
 * The registry: every tool the MCP server at `/api/mcp` offers. Each area issue appends its tools
 * here. Tool names are stable once released (ADR 0030).
 */
export const mcpTools: McpTool[] = [
  defineMcpTool("Who am I", workspaceApi.whoamiImplementation, { readOnly: true }),
  // Workspaces, settings and display preferences (#286)
  defineMcpTool("The token's workspace", workspaceApi.getWorkspaceImplementation, { readOnly: true }),
  defineMcpTool("Update workspace settings", workspaceApi.updateWorkspaceSettingsImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Load starter dictionaries", workspaceApi.loadStarterDictionariesImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("List my workspaces", workspaceApi.listWorkspacesImplementation, { readOnly: true }),
  defineMcpTool("Create a workspace", workspaceApi.createWorkspaceImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Archive a workspace", workspaceApi.archiveWorkspaceImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Restore a workspace", workspaceApi.restoreWorkspaceImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("My display preferences", workspaceApi.getDisplayPreferencesImplementation, { readOnly: true }),
  defineMcpTool("Update my display preferences", workspaceApi.updateDisplayPreferencesImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("List organizations", listOrganizationsImplementation, { readOnly: true }),
  defineMcpTool("Get an organization", getOrganizationImplementation, { readOnly: true }),
  defineMcpTool("Create an organization", createOrganizationImplementation, {
    readOnly: false,
    destructive: false
  }),
  defineMcpTool("Update an organization", updateOrganizationImplementation, {
    readOnly: false,
    destructive: true,
    idempotent: true
  }),
  defineMcpTool("Delete an organization", deleteOrganizationImplementation, {
    readOnly: false,
    destructive: true
  }),
  // Part categories (#278)
  defineMcpTool("Part category tree", categoryApi.getPartCategoryTreeImplementation, { readOnly: true }),
  defineMcpTool("Create part category", categoryApi.createPartCategoryImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Create part category path", categoryApi.createPartCategoryPathImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update part category", categoryApi.updatePartCategoryImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("Move part category", categoryApi.movePartCategoryImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("Delete part category", categoryApi.deletePartCategoryImplementation, { readOnly: false, destructive: true }),
  // Attributes (#278)
  defineMcpTool("List attributes", attributeApi.listAttributesImplementation, { readOnly: true }),
  defineMcpTool("Create attribute", attributeApi.createAttributeImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update attribute", attributeApi.updateAttributeImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Delete attribute", attributeApi.deleteAttributeImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Create attribute choice option", attributeApi.createChoiceOptionImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update attribute choice option", attributeApi.updateChoiceOptionImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("Delete attribute choice option", attributeApi.deleteChoiceOptionImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Category attributes", attributeApi.getCategoryAttributesImplementation, { readOnly: true }),
  defineMcpTool("Attach category attribute", attributeApi.attachCategoryAttributeImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("Detach category attribute", attributeApi.detachCategoryAttributeImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Set category value attribute", attributeApi.setCategoryValueAttributeImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("Save category attribute configuration", attributeApi.saveCategoryAttributeConfigurationImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Workspace attributes", attributeApi.getWorkspaceAttributesImplementation, { readOnly: true }),
  defineMcpTool("Save workspace attribute configuration", attributeApi.saveWorkspaceAttributeConfigurationImplementation, { readOnly: false, destructive: true, idempotent: true }),
  // Units (#278)
  defineMcpTool("List units", unitApi.listUnitsImplementation, { readOnly: true }),
  defineMcpTool("Create unit", unitApi.createUnitImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update unit", unitApi.updateUnitImplementation, { readOnly: false, destructive: false, idempotent: true }),
  defineMcpTool("Delete unit", unitApi.deleteUnitImplementation, { readOnly: false, destructive: true }),
  // Parts (#277)
  defineMcpTool("List parts", listPartsImplementation, { readOnly: true }),
  defineMcpTool("Get a part", getPartImplementation, { readOnly: true }),
  defineMcpTool("Create a part", createPartImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Change a part", updatePartImplementation, {
    readOnly: false,
    destructive: true,
    idempotent: true
  }),
  defineMcpTool("Delete a part", deletePartImplementation, { readOnly: false, destructive: true }),
  // Shopping lists (#281)
  defineMcpTool("List shopping lists", shoppingListApi.listShoppingListsImplementation, { readOnly: true }),
  defineMcpTool("Get a shopping list", shoppingListApi.getShoppingListImplementation, { readOnly: true }),
  defineMcpTool("Create a shopping list", shoppingListApi.createShoppingListImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update a shopping list", shoppingListApi.updateShoppingListImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Delete a shopping list", shoppingListApi.deleteShoppingListImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Add a part to a shopping list", shoppingListApi.addShoppingListItemImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Add parts to a shopping list", shoppingListApi.addShoppingListItemsImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update a shopping list item", shoppingListApi.updateShoppingListItemImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Remove a shopping list item", shoppingListApi.removeShoppingListItemImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Shopping lists of a part", shoppingListApi.getPartShoppingListsImplementation, { readOnly: true }),
  defineMcpTool("Convert a shopping list to a purchase order", shoppingListApi.convertShoppingListToPurchaseOrderImplementation, { readOnly: false, destructive: false }),
  // Builds (#284)
  defineMcpTool("List builds", buildApi.listBuildsImplementation, { readOnly: true }),
  defineMcpTool("Get a build", buildApi.getBuildImplementation, { readOnly: true }),
  defineMcpTool("Build creation options", buildApi.getBuildCreateOptionsImplementation, { readOnly: true }),
  defineMcpTool("Create a build", buildApi.createBuildImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Delete a build", buildApi.deleteBuildImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Set a build line's allocation", buildApi.setBuildLineAllocationsImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Set a build's allocations", buildApi.setBuildAllocationsImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Reassign a build designator", buildApi.reassignBuildDesignatorImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Start a build", buildApi.startBuildImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Assemble a build designator", buildApi.assembleBuildDesignatorImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Assemble a build unit", buildApi.assembleBuildUnitImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Cancel a build", buildApi.cancelBuildImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Build pick list", buildApi.getBuildPickListImplementation, { readOnly: true }),
  defineMcpTool("Build assembly list", buildApi.getBuildAssemblyListImplementation, { readOnly: true }),
  defineMcpTool("Build allocations of a part", buildApi.getPartBuildAllocationsImplementation, { readOnly: true }),
  defineMcpTool("Production builds of a part", buildApi.getPartProductionBuildsImplementation, { readOnly: true }),
  // Locations and inventory (#280)
  defineMcpTool("List storage locations", listLocationsImplementation, { readOnly: true }),
  defineMcpTool("Get a storage location", getLocationImplementation, { readOnly: true }),
  defineMcpTool("Create a storage location", createLocationImplementation, {
    readOnly: false,
    destructive: false
  }),
  defineMcpTool("Update or archive a storage location", updateLocationImplementation, {
    readOnly: false,
    destructive: true,
    idempotent: true
  }),
  defineMcpTool("Delete a storage location", deleteLocationImplementation, {
    readOnly: false,
    destructive: true
  }),
  defineMcpTool("Generate a location hierarchy", generateLocationsImplementation, {
    readOnly: false,
    destructive: false,
    idempotent: true
  }),
  defineMcpTool("Stock stored at a location", getLocationStockImplementation, { readOnly: true }),
  defineMcpTool("Record a stock movement", createInventoryEntryImplementation, {
    readOnly: false,
    destructive: false
  }),
  defineMcpTool("A part's stock movement history", listInventoryEntriesImplementation, {
    readOnly: true
  }),
  defineMcpTool("A part's stock per location", getPartStockBalancesImplementation, {
    readOnly: true
  }),
  // Purchase orders (#282)
  defineMcpTool("List purchase orders", purchaseOrderApi.listPurchaseOrdersImplementation, { readOnly: true }),
  defineMcpTool("Get a purchase order", purchaseOrderApi.getPurchaseOrderImplementation, { readOnly: true }),
  defineMcpTool("Create a purchase order", purchaseOrderApi.createPurchaseOrderImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update a purchase order", purchaseOrderApi.updatePurchaseOrderImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Delete a purchase order", purchaseOrderApi.deletePurchaseOrderImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Add an item to a purchase order", purchaseOrderApi.addPurchaseOrderItemImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Add parts to a purchase order", purchaseOrderApi.addPurchaseOrderItemsImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update a purchase order item", purchaseOrderApi.updatePurchaseOrderItemImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Remove a purchase order item", purchaseOrderApi.removePurchaseOrderItemImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Add an additional cost to a purchase order", purchaseOrderApi.addAdditionalCostImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Update an additional cost of a purchase order", purchaseOrderApi.updateAdditionalCostImplementation, { readOnly: false, destructive: true, idempotent: true }),
  defineMcpTool("Delete an additional cost of a purchase order", purchaseOrderApi.deleteAdditionalCostImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("Mark a purchase order ordered", purchaseOrderApi.markPurchaseOrderOrderedImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Receive purchase order items", purchaseOrderApi.receivePurchaseOrderItemsImplementation, { readOnly: false, destructive: false }),
  defineMcpTool("Revert a purchase order to draft", purchaseOrderApi.revertPurchaseOrderToDraftImplementation, { readOnly: false, destructive: true }),
  defineMcpTool("List draft purchase orders", purchaseOrderApi.listDraftPurchaseOrdersImplementation, { readOnly: true }),
  defineMcpTool("Purchase history of a part", purchaseOrderApi.getPartPurchaseHistoryImplementation, { readOnly: true }),
  defineMcpTool("Search suppliers", purchaseOrderApi.searchSuppliersImplementation, { readOnly: true }),
  defineMcpTool("Look up a part at the supplier", purchaseOrderApi.lookupSupplierItemImplementation, { readOnly: true }),
  defineMcpTool("Get an exchange rate", purchaseOrderApi.getExchangeRateImplementation, { readOnly: true }),
  defineMcpTool("Save a manual exchange rate", purchaseOrderApi.saveExchangeRateImplementation, { readOnly: false, destructive: true, idempotent: true })
];
