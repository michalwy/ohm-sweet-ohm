"use server";

import { actorHasPermission } from "@/server/access-control/actor";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import { updateWorkspaceDefaultLocationForWorkspace } from "@/server/workspaces/workspaceSettings";

type UpdateInventoryDefaultsInput = {
  workspaceSlug: string;
  defaultLocationId: string | null;
};

type UpdateInventoryDefaultsResult = { ok: true } | { ok: false; error: string };

/** Settings → Inventory (#39): the workspace's fallback default location. */
export async function updateWorkspaceInventoryDefaults(
  input: UpdateInventoryDefaultsInput
): Promise<UpdateInventoryDefaultsResult> {
  const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug: input.workspaceSlug });

  if (!context || !actorHasPermission(context, "admin")) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  try {
    await updateWorkspaceDefaultLocationForWorkspace(
      context.workspace.id,
      input.defaultLocationId || null
    );

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "invalid-default-location") {
      return { ok: false, error: "invalid-default-location" };
    }

    return { ok: false, error: "database-unavailable" };
  }
}
