import "server-only";

import type { PgBoss } from "pg-boss";

import { prisma } from "@/server/db/prisma";

export type DeletionTrigger = "manual" | "retention-expiry";

export const WORKSPACE_DELETION_JOB = "workspace-deletion";

export type WorkspaceDeletionJobData = {
  workspaceId: string;
  triggeredBy: DeletionTrigger;
};

export async function enqueueWorkspaceDeletion(
  workspaceId: string,
  triggeredBy: DeletionTrigger,
  boss: PgBoss
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { archivedAt: true, deletionScheduledAt: true }
  });

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  if (!workspace.archivedAt) {
    throw new Error(`Workspace ${workspaceId} must be archived before scheduling deletion`);
  }

  if (workspace.deletionScheduledAt) {
    return;
  }

  // Ensure queue exists (idempotent) then enqueue.
  // Enqueue first: if it fails, no visible state change. If the stamp below fails, the
  // worker's safety guard (deletionScheduledAt must be non-null) prevents execution.
  await boss.createQueue(WORKSPACE_DELETION_JOB);
  await boss.send(WORKSPACE_DELETION_JOB, {
    workspaceId,
    triggeredBy
  } satisfies WorkspaceDeletionJobData);

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { deletionScheduledAt: new Date() }
  });
}
