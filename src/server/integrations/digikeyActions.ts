"use server";

import { revalidatePath } from "next/cache";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  upsertWorkspaceDigiKeyIntegration
} from "@/server/integrations/digikey";

export type DigiKeyIntegrationSettingsResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: "missing-required-fields" | "workspace_permission_denied" | "database-unavailable";
    };

export async function updateDigiKeyIntegrationSettings(
  formData: FormData
): Promise<DigiKeyIntegrationSettingsResult> {
  const workspaceSlug = getRequiredString(formData, "workspaceSlug");
  const clientId = getRequiredString(formData, "clientId");
  const clientSecret = getRequiredString(formData, "clientSecret");

  if (!workspaceSlug || !clientId || !clientSecret) {
    return {
      ok: false,
      error: "missing-required-fields"
    };
  }

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      return {
        ok: false,
        error: "database-unavailable"
      };
    }

    await authorizeWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "admin"
    });

    await upsertWorkspaceDigiKeyIntegration({
      workspaceId: context.workspace.id,
      clientId,
      clientSecret
    });

    revalidatePath(`/w/${workspaceSlug}/settings/integrations`);

    return {
      ok: true
    };
  } catch (error) {
    if (error instanceof Error && error.message === "workspace_permission_denied") {
      return {
        ok: false,
        error: "workspace_permission_denied"
      };
    }

    return {
      ok: false,
      error: "database-unavailable"
    };
  }
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
