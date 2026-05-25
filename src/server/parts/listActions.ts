"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  getPartsListPage,
  type PartsListPageInput
} from "@/server/parts/getParts";
import type { PartsListItem } from "@/server/parts/getParts";
import type { ListPage } from "@/server/pagination";

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
