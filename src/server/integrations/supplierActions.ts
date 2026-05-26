"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { getSupplierPartSearchProvider } from "@/server/integrations/providers";
import type {
  SupplierPartSearchResult,
  SupplierProviderKey
} from "@/server/integrations/types";

export async function searchSupplierPartsForWorkspace(input: {
  workspaceSlug: string;
  provider: SupplierProviderKey;
  query: string;
  limit?: number;
  offset?: number;
}): Promise<SupplierPartSearchResult> {
  try {
    const context = await getCurrentWorkspaceContextBySlug(input.workspaceSlug);

    if (!context) {
      return {
        ok: false,
        error: "search-request-failed"
      };
    }

    const provider = getSupplierPartSearchProvider(input.provider);

    if (!provider) {
      return {
        ok: false,
        error: "search-request-failed"
      };
    }

    return provider.searchParts({
      workspaceId: context.workspace.id,
      query: input.query,
      limit: input.limit,
      offset: input.offset
    });
  } catch {
    return {
      ok: false,
      error: "search-request-failed"
    };
  }
}
