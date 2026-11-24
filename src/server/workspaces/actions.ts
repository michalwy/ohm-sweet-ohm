"use server";

import { redirect } from "next/navigation";

import { actorHasPermission } from "@/server/access-control/actor";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import { getCurrentSession } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { applyDemoPreset } from "@/server/workspaces/applyDemoPreset";
import { applyStarterDictionaries } from "@/server/workspaces/applyStarterDictionaries";
import {
  archiveWorkspace as archiveWorkspaceMutation,
  restoreWorkspace as restoreWorkspaceMutation
} from "@/server/workspaces/archiveMutations";
import { enqueueWorkspaceDeletion } from "@/server/workspaces/deletionQueue";
import { getPgBoss } from "@/server/db/pgBoss";
import { DEMO_PRESET_FIXTURE } from "@/server/workspaces/demoPresetFixture";
import { wipeDomainData } from "@/server/workspaces/resetMutations";
import { createWorkspaceWithPreset } from "@/server/workspaces/workspaceLifecycle";
import {
  isSupportedWorkspaceCurrency,
  toWorkspaceCreationPreset
} from "@/server/workspaces/workspaceOptions";

const workspaceCopy = {
  missingName: "missing-name",
  missingCurrency: "missing-currency",
  unavailable: "workspace-unavailable"
};

export async function createWorkspace(formData: FormData) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const name = getRequiredFormValue(formData, "name");
  const currency = getRequiredFormValue(formData, "currency").toUpperCase();
  const preset = toWorkspaceCreationPreset(getRequiredFormValue(formData, "preset"));

  if (!name) {
    redirect(`/workspaces?error=${workspaceCopy.missingName}`);
  }

  if (!currency || !isSupportedWorkspaceCurrency(currency)) {
    redirect(`/workspaces?error=${workspaceCopy.missingCurrency}`);
  }

  let workspaceSlug = "";

  try {
    const workspace = await createWorkspaceWithPreset({
      userId: session.user.id,
      name,
      primaryCurrency: currency,
      preset
    });

    workspaceSlug = workspace.slug;
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

  const context = await resolveWorkspaceActor(
    { kind: "session", workspaceSlug },
    { allowArchived: true }
  );

  if (!context) {
    return { ok: false, error: "workspace-not-found" };
  }

  if (context.workspace.archivedAt) {
    return { ok: false, error: "already-archived" };
  }

  const allowed = actorHasPermission(context, "admin");

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

  const actor = await resolveWorkspaceActor(
    { kind: "session", workspaceSlug },
    { allowArchived: true }
  );

  if (!actor || !actor.workspace.archivedAt) {
    redirect("/workspaces");
  }

  if (!actorHasPermission(actor, "admin")) {
    redirect("/workspaces?error=permission-denied");
  }

  await restoreWorkspaceMutation(actor.workspace.id);
  redirect("/workspaces");
}

export async function scheduleWorkspaceDeletion(
  workspaceSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();

  if (!session) {
    return { ok: false, error: "unauthenticated" };
  }

  const actor = await resolveWorkspaceActor(
    { kind: "session", workspaceSlug },
    { allowArchived: true }
  );

  if (!actor) {
    return { ok: false, error: "workspace-not-found" };
  }

  if (!actor.workspace.archivedAt) {
    return { ok: false, error: "not-archived" };
  }

  if (actor.workspace.deletionScheduledAt) {
    return { ok: false, error: "already-scheduled" };
  }

  if (!actorHasPermission(actor, "admin")) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  await enqueueWorkspaceDeletion(actor.workspace.id, "manual", await getPgBoss());
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

  const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug });

  if (!context) {
    return { ok: false, error: "workspace-not-found" };
  }

  const allowed = actorHasPermission(context, "admin");

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

  const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug });

  if (!context) {
    return { ok: false, error: "workspace-not-found" };
  }

  const allowed = actorHasPermission(context, "admin");

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
