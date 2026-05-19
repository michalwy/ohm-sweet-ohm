import "server-only";

import { prisma } from "@/server/db/prisma";

export type PartsListItem = {
  id: string;
  catalogNumber: string;
  manufacturerName: string;
};

export type PartsListResult = {
  parts: PartsListItem[];
  isDatabaseAvailable: boolean;
};

export async function getPartsList(): Promise<PartsListResult> {
  try {
    const parts = await prisma.part.findMany({
      orderBy: [{ manufacturerName: "asc" }, { catalogNumber: "asc" }],
      select: {
        id: true,
        catalogNumber: true,
        manufacturerName: true
      }
    });

    return {
      parts,
      isDatabaseAvailable: true
    };
  } catch {
    return {
      parts: [],
      isDatabaseAvailable: false
    };
  }
}
