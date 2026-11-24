"use server";

import type { Prisma } from "@/generated/prisma/client";

import { actorHasPermission } from "@/server/access-control/actor";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import {
  parseDefaultTaxRate,
  updateWorkspaceOrderingDefaultsForWorkspace
} from "@/server/workspaces/workspaceSettings";

type UpdateOrderingDefaultsInput = {
  workspaceSlug: string;
  defaultPriceEntryMode: "net" | "gross";
  defaultTaxRate: string | null;
};

type UpdateOrderingDefaultsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateWorkspaceOrderingDefaults(
  input: UpdateOrderingDefaultsInput
): Promise<UpdateOrderingDefaultsResult> {
  const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug: input.workspaceSlug });

  if (!context) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  const canWrite = actorHasPermission(context, "admin");

  if (!canWrite) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  let parsedTaxRate: Prisma.Decimal | null;

  try {
    parsedTaxRate = parseDefaultTaxRate(input.defaultTaxRate);
  } catch {
    return { ok: false, error: "invalid-tax-rate" };
  }

  try {
    await updateWorkspaceOrderingDefaultsForWorkspace(context.workspace.id, {
      defaultPriceEntryMode: input.defaultPriceEntryMode,
      defaultTaxRate: parsedTaxRate
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "database-unavailable" };
  }
}
