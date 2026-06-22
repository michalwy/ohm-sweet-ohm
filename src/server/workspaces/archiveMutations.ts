import "server-only";

import { prisma } from "@/server/db/prisma";

export async function archiveWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { archivedAt: new Date() }
  });
}

export async function restoreWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { archivedAt: null }
  });
}
