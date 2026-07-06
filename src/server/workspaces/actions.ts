"use server";

import { redirect } from "next/navigation";

import { getCurrentSession, getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { applyDemoPreset, type DemoPreset } from "@/server/workspaces/applyDemoPreset";
import { applyStarterDictionaries } from "@/server/workspaces/applyStarterDictionaries";
import {
  archiveWorkspace as archiveWorkspaceMutation,
  restoreWorkspace as restoreWorkspaceMutation
} from "@/server/workspaces/archiveMutations";
import { createWorkspaceForOwner } from "@/server/workspaces/createWorkspace";
import { enqueueWorkspaceDeletion } from "@/server/workspaces/deletionQueue";
import { getPgBoss } from "@/server/db/pgBoss";
import { DEMO_PRESET_FIXTURE } from "@/server/workspaces/demoPresetFixture";
import { wipeDomainData } from "@/server/workspaces/resetMutations";

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
  const preset: DemoPreset | "starter-dictionaries" =
    rawPreset === "parts-only" || rawPreset === "parts-and-orders" || rawPreset === "starter-dictionaries"
      ? rawPreset
      : "empty";

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

    if (preset === "starter-dictionaries") {
      await applyStarterDictionaries(prisma, workspace.id);
    } else if (preset !== "empty") {
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
  redirect("/workspaces");
}

export async function scheduleWorkspaceDeletion(
  workspaceSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      workspace: { slug: workspaceSlug }
    },
    select: {
      workspace: {
        select: { id: true, archivedAt: true, deletionScheduledAt: true }
      }
    }
  });

  if (!membership) {
    return { ok: false, error: "workspace-not-found" };
  }

  if (!membership.workspace.archivedAt) {
    return { ok: false, error: "not-archived" };
  }

  if (membership.workspace.deletionScheduledAt) {
    return { ok: false, error: "already-scheduled" };
  }

  const allowed = await hasWorkspacePermission({
    userId: session.user.id,
    workspaceId: membership.workspace.id,
    permission: "admin"
  }).catch(() => false);

  if (!allowed) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  await enqueueWorkspaceDeletion(membership.workspace.id, "manual", await getPgBoss());
  return { ok: true };
}

export async function resetWorkspaceToDemoPreset(
  workspaceSlug: string,
  preset: "parts-only" | "parts-and-orders"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    return { ok: false, error: "workspace-not-found" };
  }

  const allowed = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  }).catch(() => false);

  if (!allowed) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  await wipeDomainData(context.workspace.id);
  await ensureDefaultUnitsForWorkspace(prisma, context.workspace.id);
  const unitId = await getDefaultPartUnitId(prisma, context.workspace.id);
  await applyDemoPreset(
    prisma,
    context.workspace.id,
    unitId,
    preset,
    DEMO_PRESET_FIXTURE,
    context.workspace.primaryCurrency
  );

  return { ok: true };
}

export async function loadStarterDictionaries(
  workspaceSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

  if (!context) {
    return { ok: false, error: "workspace-not-found" };
  }

  const allowed = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  }).catch(() => false);

  if (!allowed) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  await applyStarterDictionaries(prisma, context.workspace.id);

  return { ok: true };
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
