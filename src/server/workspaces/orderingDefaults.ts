"use server";

import { Prisma } from "@/generated/prisma/client";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { hasWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";

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
  const context = await getCurrentWorkspaceContextBySlug(input.workspaceSlug);

  if (!context) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  const canWrite = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "admin"
  });

  if (!canWrite) {
    return { ok: false, error: "workspace-permission-denied" };
  }

  let parsedTaxRate: Prisma.Decimal | null = null;

  if (input.defaultTaxRate !== null && input.defaultTaxRate.trim() !== "") {
    const n = parseFloat(input.defaultTaxRate);
    if (isNaN(n) || n < 0 || n >= 100) {
      return { ok: false, error: "invalid-tax-rate" };
    }
    parsedTaxRate = new Prisma.Decimal(input.defaultTaxRate.trim());
  }

  try {
    await prisma.workspace.update({
      where: { id: context.workspace.id },
      data: {
        defaultPriceEntryMode: input.defaultPriceEntryMode,
        defaultTaxRate: parsedTaxRate
      }
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "database-unavailable" };
  }
}
