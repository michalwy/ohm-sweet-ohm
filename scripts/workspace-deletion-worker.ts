import { getPgBoss } from "@/server/db/pgBoss";
import { executeWorkspaceDeletion } from "@/server/workspaces/deletionMutations";
import {
  WORKSPACE_DELETION_JOB,
  type WorkspaceDeletionJobData
} from "@/server/workspaces/deletionQueue";
import { enqueueExpiredArchivedWorkspaces } from "@/server/workspaces/retentionSweep";

async function main() {
  const boss = await getPgBoss();

  boss.on("error", (err) => {
    console.error(JSON.stringify({ event: "pg-boss-error", error: String(err) }));
  });

  await boss.createQueue(WORKSPACE_DELETION_JOB);

  const RETENTION_CHECK_JOB = "retention-check";
  await boss.createQueue(RETENTION_CHECK_JOB);
  await boss.schedule(RETENTION_CHECK_JOB, "0 2 * * *", {});

  await boss.work(RETENTION_CHECK_JOB, async () => {
    const count = await enqueueExpiredArchivedWorkspaces(boss);
    console.log(JSON.stringify({ event: "retention-sweep-complete", enqueuedCount: count }));
  });

  const allJobs = await boss.findJobs<WorkspaceDeletionJobData>(WORKSPACE_DELETION_JOB);
  const failedIds = allJobs.filter((j) => j.state === "failed").map((j) => j.id);
  if (failedIds.length > 0) {
    await boss.retry(WORKSPACE_DELETION_JOB, failedIds);
    console.log(JSON.stringify({ event: "failed-jobs-rescheduled", count: failedIds.length, ids: failedIds }));
  }

  await boss.work<WorkspaceDeletionJobData>(WORKSPACE_DELETION_JOB, async (jobs) => {
    for (const job of jobs) {
      const { workspaceId, triggeredBy } = job.data;
      console.log(JSON.stringify({ event: "workspace-deletion-started", workspaceId, triggeredBy }));
      try {
        await executeWorkspaceDeletion(workspaceId, triggeredBy);
      } catch (err) {
        console.error(JSON.stringify({ event: "workspace-deletion-error", workspaceId, triggeredBy, error: String(err) }));
        throw err;
      }
    }
  });

  console.log(JSON.stringify({ event: "worker-started", queue: WORKSPACE_DELETION_JOB }));

  async function shutdown() {
    console.log(JSON.stringify({ event: "worker-stopping" }));
    await boss.stop();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(JSON.stringify({ event: "worker-fatal", error: String(err) }));
  process.exit(1);
});
