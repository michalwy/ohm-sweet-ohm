"use server";

import { getAuthorizedSessionActor } from "@/server/auth/currentActor";
import {
  getPartPreview,
  getPurchaseOrderPreview,
  getShoppingListPreview,
  type PartPreview,
  type PurchaseOrderPreview,
  type ShoppingListPreview
} from "@/server/entity-previews/entityPreviews";

// Hover previews for entity links (#123). Each action needs the read permission of the entity it
// previews, exactly like opening that entity's list.

export type EntityPreviewActionResult<T> = { ok: true; data: T | null } | { ok: false; error: string };

export async function getPartPreviewForWorkspace(input: {
  workspaceSlug: string;
  partId: string;
}): Promise<EntityPreviewActionResult<PartPreview>> {
  try {
    const actor = await getAuthorizedSessionActor(input.workspaceSlug, "parts:read");
    return { ok: true, data: await getPartPreview(actor.workspace.id, input.partId) };
  } catch (error) {
    return failure(error);
  }
}

export async function getPurchaseOrderPreviewForWorkspace(input: {
  workspaceSlug: string;
  orderId: string;
}): Promise<EntityPreviewActionResult<PurchaseOrderPreview>> {
  try {
    const actor = await getAuthorizedSessionActor(input.workspaceSlug, "purchase-orders:read");
    return { ok: true, data: await getPurchaseOrderPreview(actor.workspace.id, input.orderId) };
  } catch (error) {
    return failure(error);
  }
}

export async function getShoppingListPreviewForWorkspace(input: {
  workspaceSlug: string;
  listId: string;
}): Promise<EntityPreviewActionResult<ShoppingListPreview>> {
  try {
    const actor = await getAuthorizedSessionActor(input.workspaceSlug, "shopping-lists:read");
    return { ok: true, data: await getShoppingListPreview(actor.workspace.id, input.listId) };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): { ok: false; error: string } {
  if (!(error instanceof Error)) return { ok: false, error: "database-unavailable" };
  return { ok: false, error: error.message.replaceAll("_", "-") };
}
