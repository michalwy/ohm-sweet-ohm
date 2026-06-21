"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import { getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { applyDemoPreset, type DemoPreset } from "@/server/workspaces/applyDemoPreset";
import { createWorkspaceForOwner } from "@/server/workspaces/createWorkspace";
import { DEMO_PRESET_FIXTURE } from "@/server/workspaces/demoPresetFixture";

const workspaceCopy = {
  missingName: "missing-name",
  missingCurrency: "missing-currency",
  unavailable: "workspace-unavailable"
};

const SUPPORTED_CURRENCIES = new Set([
  "EUR", "USD", "GBP", "PLN", "CZK", "CHF", "SEK", "DKK", "NOK",
  "HUF", "RON", "BGN", "HRK", "RUB", "JPY", "CNY", "CAD", "AUD"
]);

export async function createWorkspace(formData: FormData) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const name = getRequiredFormValue(formData, "name");
  const currency = getRequiredFormValue(formData, "currency").toUpperCase();
  const rawPreset = getRequiredFormValue(formData, "preset");
  const preset: DemoPreset =
    rawPreset === "parts-only" || rawPreset === "parts-and-orders" ? rawPreset : "empty";

  if (!name) {
    redirect(`/workspaces?error=${workspaceCopy.missingName}`);
  }

  if (!currency || !SUPPORTED_CURRENCIES.has(currency)) {
    redirect(`/workspaces?error=${workspaceCopy.missingCurrency}`);
  }

  let workspaceSlug = "";

  try {
    const workspace = await createWorkspaceForOwner({
      userId: session.user.id,
      name,
      primaryCurrency: currency
    });

    workspaceSlug = workspace.slug;
    revalidatePath("/workspaces");

    if (preset !== "empty") {
      const unitId = await getDefaultPartUnitId(prisma, workspace.id);
      await applyDemoPreset(prisma, workspace.id, unitId, preset, DEMO_PRESET_FIXTURE, workspace.primaryCurrency);
    }
  } catch {
    redirect(`/workspaces?error=${workspaceCopy.unavailable}`);
  }

  if (!workspaceSlug) {
    redirect(`/workspaces?error=${workspaceCopy.unavailable}`);
  }

  redirect(`/w/${encodeURIComponent(workspaceSlug)}/parts`);
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
