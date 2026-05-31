import "server-only";

import { prisma } from "@/server/db/prisma";

export type UnitListItem = {
  id: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
};

export async function getUnitsForWorkspace(
  workspaceId: string
): Promise<UnitListItem[]> {
  return prisma.unit.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      symbol: true,
      allowsFraction: true
    }
  });
}
