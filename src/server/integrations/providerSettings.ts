import "server-only";

import type { SupplierProvider } from "@/generated/prisma/enums";
import { prisma } from "@/server/db/prisma";
import type { SupplierProviderKey } from "@/server/integrations/types";

const supplierProviderToKey: Record<SupplierProvider, SupplierProviderKey> = {
  DIGIKEY: "digikey",
  MOUSER: "mouser",
  TME: "tme"
};

const supplierKeyToProvider: Record<SupplierProviderKey, SupplierProvider> = {
  digikey: "DIGIKEY",
  mouser: "MOUSER",
  tme: "TME"
};

export async function getWorkspaceActiveSupplierProvider(
  workspaceId: string
): Promise<SupplierProviderKey | null> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { activeSupplierProvider: true }
  });

  if (!workspace?.activeSupplierProvider) {
    return null;
  }

  return supplierProviderToKey[workspace.activeSupplierProvider];
}

export async function setWorkspaceActiveSupplierProvider(input: {
  workspaceId: string;
  provider: SupplierProviderKey;
}) {
  return prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      activeSupplierProvider: supplierKeyToProvider[input.provider]
    },
    select: {
      id: true,
      activeSupplierProvider: true
    }
  });
}
