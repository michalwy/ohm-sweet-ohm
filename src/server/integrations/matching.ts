"use server";

import { requireActorPermission } from "@/server/access-control/actor";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import { getSupplierMatchingSuggestions } from "@/server/integrations/supplierLookup";
import type { SupplierProviderKey } from "@/server/integrations/types";

export async function getSupplierMatchingSuggestionsForWorkspace(input: {
  workspaceSlug: string;
  provider: SupplierProviderKey;
  sourceManufacturerName?: string | null;
  sourceCategory: string | null;
  sourceAttributes: Array<{
    sourceAttribute: string;
    sourceValue: string;
    sourceUnit?: string | null;
  }>;
  targetCategoryId: string | null;
}) {
  const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug: input.workspaceSlug });

  if (!context) {
    return { ok: false as const, error: "database-unavailable" };
  }

  requireActorPermission(context, "parts:write");

  const payload = await getSupplierMatchingSuggestions({
    workspaceId: context.workspace.id,
    provider: input.provider,
    sourceManufacturerName: input.sourceManufacturerName,
    sourceCategory: input.sourceCategory,
    sourceAttributes: input.sourceAttributes,
    targetCategoryId: input.targetCategoryId
  });

  return { ok: true as const, payload };
}
