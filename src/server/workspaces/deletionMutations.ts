import "server-only";

import { prisma } from "@/server/db/prisma";

export async function executeWorkspaceDeletion(
  workspaceId: string,
  triggeredBy: string
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { deletionScheduledAt: true }
  });

  if (!workspace) {
    console.log(
      JSON.stringify({ event: "workspace-deletion-skipped", reason: "already-deleted", workspaceId })
    );
    return;
  }

  if (!workspace.deletionScheduledAt) {
    console.log(
      JSON.stringify({ event: "workspace-deletion-skipped", reason: "not-scheduled", workspaceId })
    );
    return;
  }

  const start = performance.now();

  await prisma.workspace.delete({ where: { id: workspaceId } });

  const durationMs = Math.round(performance.now() - start);
  console.log(
    JSON.stringify({ event: "workspace-deleted", workspaceId, triggeredBy, durationMs })
  );
}
