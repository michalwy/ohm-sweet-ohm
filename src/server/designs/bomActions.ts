"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  createBomLineItem,
  deleteBomLineItem,
  getBomCategoryAttributes,
  getBomDialogData,
  getBomLineItems,
  previewLineItemMatches,
  updateBomLineItem,
  type BomDialogData,
  type BomLineItemInput,
  type BomLineItemSummary,
  type BomMatcherInput
} from "@/server/designs/bomLineItems";
import { analyzeShortage, type ShortageAnalysis } from "@/server/designs/shortageAnalysis";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { MatchingPart } from "@/server/designs/matching";

export type { BomLineItemSummary, BomLineItemInput, BomMatcherInput, BomDialogData };
export type { ShortageAnalysis } from "@/server/designs/shortageAnalysis";

export type BomActionResult<T> =
  | { ok: true; data: T; submittedAt: number }
  | { ok: false; error: string; submittedAt: number };

// --- Queries ---

export async function getBomLineItemsAction(input: {
  workspaceSlug: string;
  revisionId: string;
}): Promise<BomActionResult<BomLineItemSummary[]>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const items = await getBomLineItems({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      revisionId: input.revisionId
    });
    return success(items);
  } catch (error) {
    return failure(error);
  }
}

export async function getBomDialogDataAction(input: {
  workspaceSlug: string;
}): Promise<BomActionResult<BomDialogData>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const data = await getBomDialogData({
      userId: context.user.id,
      workspaceId: context.workspace.id
    });
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function getBomCategoryAttributesAction(input: {
  workspaceSlug: string;
  categoryId: string;
}): Promise<BomActionResult<AttributeListItem[]>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const attributes = await getBomCategoryAttributes({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      categoryId: input.categoryId
    });
    return success(attributes);
  } catch (error) {
    return failure(error);
  }
}

export async function previewLineItemMatchesAction(input: {
  workspaceSlug: string;
  categoryId?: string | null;
  pinnedPartId?: string | null;
  matchers: BomMatcherInput[];
}): Promise<BomActionResult<{ count: number; parts: MatchingPart[] }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await previewLineItemMatches({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      input: {
        categoryId: input.categoryId,
        pinnedPartId: input.pinnedPartId,
        matchers: input.matchers
      }
    });
    if (!result.ok) throw new Error(result.error);
    return success(result.data);
  } catch (error) {
    return failure(error);
  }
}

export async function analyzeShortageAction(input: {
  workspaceSlug: string;
  revisionId: string;
  targetQuantity: number;
}): Promise<BomActionResult<ShortageAnalysis>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const analysis = await analyzeShortage({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      revisionId: input.revisionId,
      targetQuantity: input.targetQuantity
    });
    return success(analysis);
  } catch (error) {
    return failure(error);
  }
}

// --- Mutations ---

export async function createBomLineItemAction(input: {
  workspaceSlug: string;
  revisionId: string;
  lineItem: BomLineItemInput;
}): Promise<BomActionResult<{ id: string }>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await createBomLineItem({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      revisionId: input.revisionId,
      input: input.lineItem
    });
    if (!result.ok) throw new Error(result.error);
    return success(result.data);
  } catch (error) {
    return failure(error);
  }
}

export async function updateBomLineItemAction(input: {
  workspaceSlug: string;
  lineItemId: string;
  lineItem: BomLineItemInput;
}): Promise<BomActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await updateBomLineItem({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      lineItemId: input.lineItemId,
      input: input.lineItem
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBomLineItemAction(input: {
  workspaceSlug: string;
  lineItemId: string;
}): Promise<BomActionResult<null>> {
  try {
    const context = await getContext(input.workspaceSlug);
    const result = await deleteBomLineItem({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      lineItemId: input.lineItemId
    });
    if (!result.ok) throw new Error(result.error);
    return success(null);
  } catch (error) {
    return failure(error);
  }
}

// --- Helpers ---

async function getContext(workspaceSlug: string) {
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);
  if (!context) throw new Error("workspace-not-found");
  return context;
}

function success<T>(data: T): BomActionResult<T> {
  return { ok: true, data, submittedAt: Date.now() };
}

function failure(error: unknown): BomActionResult<never> {
  if (!(error instanceof Error))
    return { ok: false, error: "database-unavailable", submittedAt: Date.now() };
  return { ok: false, error: error.message.replaceAll("_", "-"), submittedAt: Date.now() };
}
