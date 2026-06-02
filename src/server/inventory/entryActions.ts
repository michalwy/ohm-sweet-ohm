"use server";

import { revalidatePath } from "next/cache";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  createInventoryEntry,
  getPartInventoryHistory,
  getPartLocationBalances,
  type InventoryHistoryItem
} from "@/server/inventory/entryMutations";

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

    await createInventoryEntry({
      workspaceId: context.workspace.id,
      partId: input.partId,
      entryType: input.entryType,
      quantity: input.quantity,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      note: input.note,
      createdByUserId: context.user.id
    });
    revalidatePath(getWorkspacePath(input.workspaceSlug));
    return getSuccessState(null);
  } catch (error) {
    return getErrorState(getInventoryActionError(error));
  }
}

export async function getPartBalancesForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<InventoryActionResult<Array<{ locationId: string; quantity: string }>>> {
  try {
    const context = await getAuthorizedInventoryContext({
      workspaceSlug: input.workspaceSlug,
      permission: "inventory:read"
    });

    const balances = await getPartLocationBalances({
      workspaceId: context.workspace.id,
      partId: input.partId
    });

    return getSuccessState(
      [...balances.entries()].map(([locationId, quantity]) => ({
        locationId,
        quantity: quantity.toString()
      }))
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

async function getAuthorizedInventoryContext({
  workspaceSlug,
  permission
}: {
  workspaceSlug: string;
  permission: "inventory:read" | "inventory:write";
}) {
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);
  if (!context) {
    throw new Error("workspace-not-found");
  }

  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission
  });

  return context;
}

function getWorkspacePath(workspaceSlug: string) {
  return `/w/${encodeURIComponent(workspaceSlug)}`;
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
