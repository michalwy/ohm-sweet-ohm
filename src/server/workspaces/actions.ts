"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { applyDemoPreset, type DemoPreset } from "@/server/workspaces/applyDemoPreset";
import {
  archiveWorkspace as archiveWorkspaceMutation,
  restoreWorkspace as restoreWorkspaceMutation
} from "@/server/workspaces/archiveMutations";
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

export async function archiveWorkspace(
  workspaceSlug: string
): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    return { ok: false, error: "workspace-not-found" };
  }

  if (context.workspace.archivedAt) {
    return { ok: false, error: "already-archived" };
  }

  const allowed = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  }).catch(() => false);

  if (!allowed) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  await archiveWorkspaceMutation(context.workspace.id);
  revalidatePath("/workspaces");
  return { ok: true, redirectTo: "/workspaces" };
}

export async function restoreWorkspaceFromPicker(formData: FormData) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const workspaceSlug = formData.get("workspaceSlug");

  if (typeof workspaceSlug !== "string" || !workspaceSlug) {
    redirect("/workspaces?error=missing-slug");
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspace: { slug: workspaceSlug }
    },
    select: {
      workspace: {
        select: { id: true, archivedAt: true }
      }
    }
  });

  if (!membership || !membership.workspace.archivedAt) {
    redirect("/workspaces");
  }

  const allowed = await hasWorkspacePermission({
    userId: session.user.id,
    workspaceId: membership.workspace.id,
    permission: "admin"
  }).catch(() => false);

  if (!allowed) {
    redirect("/workspaces?error=permission-denied");
  }

  await restoreWorkspaceMutation(membership.workspace.id);
  revalidatePath("/workspaces");
  redirect("/workspaces");
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
