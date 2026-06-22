"use server";


import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { upsertWorkspaceDigiKeyIntegration } from "@/server/integrations/digikey";
import {
  setWorkspaceActiveSupplierProvider
} from "@/server/integrations/providerSettings";
import { upsertWorkspaceTmeIntegration } from "@/server/integrations/tme";
import type { SupplierProviderKey } from "@/server/integrations/types";

type SettingsError =
  | "missing-required-fields"
  | "invalid-provider"
  | "workspace-permission-denied"
  | "database-unavailable";

type SettingsResult =
  | { ok: true }
  | { ok: false; error: SettingsError };

export async function updateDigiKeyIntegrationSettings(
  formData: FormData
): Promise<SettingsResult> {
  const workspaceSlug = getRequiredString(formData, "workspaceSlug");
  const clientId = getRequiredString(formData, "clientId");
  const clientSecret = getRequiredString(formData, "clientSecret");

  if (!workspaceSlug || !clientId || !clientSecret) {
    return { ok: false, error: "missing-required-fields" };
  }

  try {
    const context = await requireAdminContext(workspaceSlug);

    await upsertWorkspaceDigiKeyIntegration({
      workspaceId: context.workspace.id,
      clientId,
      clientSecret
    });

    return { ok: true };
  } catch (error) {
    return asSettingsError(error);
  }
}

export async function updateTmeIntegrationSettings(
  formData: FormData
): Promise<SettingsResult> {
  const workspaceSlug = getRequiredString(formData, "workspaceSlug");
  const clientId = getRequiredString(formData, "clientId");
  const clientSecret = getRequiredString(formData, "clientSecret");

  if (!workspaceSlug || !clientId || !clientSecret) {
    return { ok: false, error: "missing-required-fields" };
  }

  try {
    const context = await requireAdminContext(workspaceSlug);

    await upsertWorkspaceTmeIntegration({
      workspaceId: context.workspace.id,
      clientId,
      clientSecret
    });

    return { ok: true };
  } catch (error) {
    return asSettingsError(error);
  }
}

export async function updateActiveSupplierProviderSettings(
  formData: FormData
): Promise<SettingsResult> {
  const workspaceSlug = getRequiredString(formData, "workspaceSlug");
  const provider = getRequiredString(formData, "provider");

  if (!workspaceSlug || !provider) {
    return { ok: false, error: "missing-required-fields" };
  }

  if (!isSupplierProviderKey(provider)) {
    return { ok: false, error: "invalid-provider" };
  }

  try {
    const context = await requireAdminContext(workspaceSlug);

    await setWorkspaceActiveSupplierProvider({
      workspaceId: context.workspace.id,
      provider
    });


    return { ok: true };
  } catch (error) {
    return asSettingsError(error);
  }
}

async function requireAdminContext(workspaceSlug: string) {
  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    throw new Error("database-unavailable");
  }

  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  });

  return context;
}

function isSupplierProviderKey(value: string): value is SupplierProviderKey {
  return value === "digikey" || value === "mouser" || value === "tme";
}

function asSettingsError(error: unknown): SettingsResult {
  if (error instanceof Error && error.message === "workspace-permission-denied") {
    return { ok: false, error: "workspace-permission-denied" };
  }

  return { ok: false, error: "database-unavailable" };
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
