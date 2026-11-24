"use server";


import { requireActorPermission } from "@/server/access-control/actor";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import {
  upsertWorkspaceDigiKeyIntegration
} from "@/server/integrations/digikey";

export type DigiKeyIntegrationSettingsResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: "missing-required-fields" | "workspace-permission-denied" | "database-unavailable";
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
    const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug: workspaceSlug });

    if (!context) {
      return {
        ok: false,
        error: "database-unavailable"
      };
    }

    requireActorPermission(context, "admin");

    await upsertWorkspaceDigiKeyIntegration({
      workspaceId: context.workspace.id,
      clientId,
      clientSecret
    });


    return {
      ok: true
    };
  } catch (error) {
    if (error instanceof Error && error.message === "workspace-permission-denied") {
      return {
        ok: false,
        error: "workspace-permission-denied"
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
