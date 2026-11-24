import "server-only";

import { implementOperation } from "@/server/api/execute";
import {
  assertPartInWorkspace,
  createInventoryEntry,
  getInventoryEntryDetail,
  getPartInventoryHistoryPage,
  getPartStockBalances
} from "@/server/inventory/entryMutations";
import {
  createInventoryEntryOperation,
  getLocationStockOperation,
  getPartStockBalancesOperation,
  listInventoryEntriesOperation
} from "@/server/inventory/inventoryOperations";
import {
  buildStorageLocationPaths,
  getStorageLocations
} from "@/server/inventory/locationMutations";
import { getLocationStock } from "@/server/inventory/locationStock";

/**
 * The inventory operations (#280), over the same domain functions as the server actions in
 * `entryActions.ts`. Every call is scoped to the actor's workspace; the permission is checked by
 * `executeOperation` before the function runs.
 */

export const createInventoryEntryImplementation = implementOperation(
  createInventoryEntryOperation,
  async (actor, input) => {
    const entry = await createInventoryEntry({
      workspaceId: actor.workspace.id,
      ...input,
      createdByUserId: actor.user.id
    });

    return getInventoryEntryDetail({ workspaceId: actor.workspace.id, entryId: entry.id });
  }
);

export const listInventoryEntriesImplementation = implementOperation(
  listInventoryEntriesOperation,
  async (actor, input) => getPartInventoryHistoryPage({ workspaceId: actor.workspace.id, ...input })
);

export const getPartStockBalancesImplementation = implementOperation(
  getPartStockBalancesOperation,
  async (actor, input) => {
    const scope = { workspaceId: actor.workspace.id, partId: input.partId };

    await assertPartInWorkspace(scope);

    const [balances, locations] = await Promise.all([
      getPartStockBalances(scope),
      getStorageLocations(actor.workspace.id)
    ]);
    const paths = buildStorageLocationPaths(locations);
    const items = balances.map((balance) => ({
      ...balance,
      locationPath: paths.get(balance.locationId) ?? ""
    }));

    items.sort((left, right) =>
      left.locationPath.localeCompare(right.locationPath, "en", { numeric: true })
    );

    return { items };
  }
);

export const getLocationStockImplementation = implementOperation(
  getLocationStockOperation,
  async (actor, input) => ({
    items: await getLocationStock({
      workspaceId: actor.workspace.id,
      locationId: input.id,
      includeSublocations: input.includeSublocations ?? false
    })
  })
);
