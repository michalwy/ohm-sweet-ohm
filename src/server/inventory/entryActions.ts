"use server";


import { parseActionInput } from "@/server/api/actionInput";
import { getAuthorizedSessionActor } from "@/server/auth/currentActor";
import {
  createInventoryEntry,
  getPartInventoryHistory,
  getPartStockBalances,
  type InventoryHistoryItem
} from "@/server/inventory/entryMutations";
import {
  createInventoryEntryOperation,
  getLocationStockOperation
} from "@/server/inventory/inventoryOperations";
import { getLocationStock, type LocationStockItem } from "@/server/inventory/locationStock";

export type InventoryActionResult<T> =
  | {
      ok: true;
      data: T;
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export async function createInventoryEntryForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
  entryType: "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";
  quantity: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  note?: string | null;
}): Promise<InventoryActionResult<null>> {
  try {
    const context = await getAuthorizedInventoryContext({
      workspaceSlug: input.workspaceSlug,
      permission: "inventory:write"
    });

    // The schema strips the workspace slug: the workspace is the session's.
    await createInventoryEntry({
      workspaceId: context.workspace.id,
      ...parseActionInput(createInventoryEntryOperation, input),
      createdByUserId: context.user.id
    });
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getInventoryActionError(error));
  }
}

export async function getPartBalancesForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<
  InventoryActionResult<Array<{ locationId: string; quantity: string; availableQuantity: string }>>
> {
  try {
    const context = await getAuthorizedInventoryContext({
      workspaceSlug: input.workspaceSlug,
      permission: "inventory:read"
    });

    return getSuccessState(
      await getPartStockBalances({
        workspaceId: context.workspace.id,
        partId: input.partId
      })
    );
  } catch (error) {
    return getErrorState(getInventoryActionError(error));
  }
}

export async function getPartInventoryHistoryForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<InventoryActionResult<InventoryHistoryItem[]>> {
  try {
    const context = await getAuthorizedInventoryContext({
      workspaceSlug: input.workspaceSlug,
      permission: "inventory:read"
    });

    const history = await getPartInventoryHistory({
      workspaceId: context.workspace.id,
      partId: input.partId
    });

    return getSuccessState(history);
  } catch (error) {
    return getErrorState(getInventoryActionError(error));
  }
}

export async function getLocationStockForWorkspace(input: {
  workspaceSlug: string;
  locationId: string;
  includeSublocations: boolean;
}): Promise<InventoryActionResult<LocationStockItem[]>> {
  try {
    const context = await getAuthorizedInventoryContext({
      workspaceSlug: input.workspaceSlug,
      permission: "inventory:read"
    });

    const data = parseActionInput(getLocationStockOperation, {
      id: input.locationId,
      includeSublocations: input.includeSublocations
    });
    const stock = await getLocationStock({
      workspaceId: context.workspace.id,
      locationId: data.id,
      includeSublocations: data.includeSublocations ?? false
    });

    return getSuccessState(stock);
  } catch (error) {
    return getErrorState(getInventoryActionError(error));
  }
}

async function getAuthorizedInventoryContext({
  workspaceSlug,
  permission
}: {
  workspaceSlug: string;
  permission: "inventory:read" | "inventory:write";
}) {
  return getAuthorizedSessionActor(workspaceSlug, permission);
}

function getSuccessState<T>(data: T): InventoryActionResult<T> {
  return {
    ok: true,
    data,
    submittedAt: Date.now()
  };
}

function getErrorState(error: string): InventoryActionResult<never> {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getInventoryActionError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  return error.message.replaceAll("_", "-");
}
