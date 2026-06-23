import "server-only";

import type { PgBoss } from "pg-boss";

import { prisma } from "@/server/db/prisma";
import { enqueueWorkspaceDeletion } from "@/server/workspaces/deletionQueue";
import { getRetentionDays } from "@/server/workspaces/retentionConfig";

export async function enqueueExpiredArchivedWorkspaces(boss: PgBoss): Promise<number> {
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const expired = await prisma.workspace.findMany({
    where: {
      archivedAt: { not: null, lte: cutoff },
      deletionScheduledAt: null
    },
    select: { id: true }
  });

  for (const { id } of expired) {
    await enqueueWorkspaceDeletion(id, "retention-expiry", boss);
  }

  return expired.length;
}
