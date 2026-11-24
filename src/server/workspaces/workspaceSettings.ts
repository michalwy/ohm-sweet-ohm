import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

/**
 * The workspace's ordering defaults (Settings → Ordering, #286): the server action and the API
 * share the rules.
 */

export type PriceEntryMode = "net" | "gross";

/**
 * A default tax rate as entered: blank or `null` clears it; otherwise a percentage from 0 up to
 * (not including) 100, or `invalid-tax-rate`.
 */
export function parseDefaultTaxRate(raw: string | null): Prisma.Decimal | null {
  if (raw === null || raw.trim() === "") {
    return null;
  }

  const trimmed = raw.trim();
  const value = Number(trimmed);

  if (!Number.isFinite(value) || value < 0 || value >= 100) {
    throw new Error("invalid-tax-rate");
  }

  return new Prisma.Decimal(trimmed);
}

export async function updateWorkspaceOrderingDefaultsForWorkspace(
  workspaceId: string,
  input: { defaultPriceEntryMode: PriceEntryMode; defaultTaxRate: Prisma.Decimal | null }
) {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      defaultPriceEntryMode: input.defaultPriceEntryMode,
      defaultTaxRate: input.defaultTaxRate
    }
  });
}
