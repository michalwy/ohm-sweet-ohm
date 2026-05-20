import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
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

type WorkspaceContext = {
  user: {
    id: string;
  };
  workspace: {
    id: string;
  };
};

export async function getPartsList(
  context: WorkspaceContext
): Promise<PartsListResult> {
  try {
    await authorizeWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "parts:read"
    });

    const parts = await prisma.part.findMany({
      where: {
        workspaceId: context.workspace.id
      },
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
