"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  getPartsListPage,
  type PartsListPageInput
} from "@/server/parts/getParts";
import type { PartsListItem } from "@/server/parts/getParts";
import type { ListPage } from "@/server/pagination";
import {
  getPartCategories,
  type PartCategoryListItem
} from "@/server/parts/categories";
import { getManufacturerSuggestionsForPartForm } from "@/server/organizations/organizations";

export type PartsListFilterDataResult =
  | { ok: true; categories: PartCategoryListItem[]; manufacturerNames: string[] }
  | { ok: false; error: string };

export async function getPartsListFilterDataForWorkspace(input: {
  workspaceSlug: string;
}): Promise<PartsListFilterDataResult> {
  try {
    const context = await getCurrentWorkspaceContextBySlug(input.workspaceSlug);

    if (!context) {
      return { ok: false, error: "database-unavailable" };
    }

    const [categories, manufacturers] = await Promise.all([
      getPartCategories(context.workspace.id),
      getManufacturerSuggestionsForPartForm({
        userId: context.user.id,
        workspaceId: context.workspace.id
      })
    ]);

    return {
      ok: true,
      categories,
      manufacturerNames: manufacturers.map((m) => m.name)
    };
  } catch {
    return { ok: false, error: "database-unavailable" };
  }
}

export type PartsListPageActionResult =
  | {
      ok: true;
      page: ListPage<PartsListItem>;
    }
  | {
      ok: false;
      error: string;
    };

export async function getPartsListPageForWorkspace(input: {
  workspaceSlug: string;
} & PartsListPageInput): Promise<PartsListPageActionResult> {
  try {
    const context = await getCurrentWorkspaceContextBySlug(input.workspaceSlug);

    if (!context) {
      return {
        ok: false,
        error: "database-unavailable"
      };
    }

    return {
      ok: true,
      page: await getPartsListPage(context, input)
    };
  } catch {
    return {
      ok: false,
      error: "database-unavailable"
    };
  }
}
