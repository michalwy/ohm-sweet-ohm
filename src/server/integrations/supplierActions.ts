"use server";

import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import {
  getSupplierPartAttributes,
  searchSupplierParts
} from "@/server/integrations/supplierLookup";
import type { SupplierPartSearchResult } from "@/server/integrations/types";

export async function searchSupplierPartsForWorkspace(input: {
  workspaceSlug: string;
  query: string;
  limit?: number;
  offset?: number;
}): Promise<SupplierPartSearchResult> {
  try {
    const context = await resolveWorkspaceActor({
      kind: "session",
      workspaceSlug: input.workspaceSlug
    });

    if (!context) {
      return {
        ok: false,
        error: "search-request-failed"
      };
    }

    const outcome = await searchSupplierParts({
      workspaceId: context.workspace.id,
      query: input.query,
      limit: input.limit,
      offset: input.offset
    });

    return outcome.ok ? outcome.page : { ok: false, error: outcome.error };
  } catch {
    return {
      ok: false,
      error: "search-request-failed"
    };
  }
}

export async function getSupplierPartAttributesForWorkspace(input: {
  workspaceSlug: string;
  catalogNumber: string;
}) {
  try {
    const context = await resolveWorkspaceActor({
      kind: "session",
      workspaceSlug: input.workspaceSlug
    });
    if (!context) {
      return {
        ok: false as const,
        reason: "use-search-fallback" as const
      };
    }

    const { sourceAttributes } = await getSupplierPartAttributes({
      workspaceId: context.workspace.id,
      catalogNumber: input.catalogNumber
    });

    if (!sourceAttributes) {
      return {
        ok: false as const,
        reason: "use-search-fallback" as const
      };
    }

    return {
      ok: true as const,
      sourceAttributes
    };
  } catch {
    return {
      ok: false as const,
      reason: "use-search-fallback" as const
    };
  }
}
