import { getPgBoss } from "@/server/db/pgBoss";
import { executeWorkspaceDeletion } from "@/server/workspaces/deletionMutations";
import {
  WORKSPACE_DELETION_JOB,
  type WorkspaceDeletionJobData
} from "@/server/workspaces/deletionQueue";

async function main() {
  const boss = await getPgBoss();

  boss.on("error", (err) => {
    console.error(JSON.stringify({ event: "pg-boss-error", error: String(err) }));
  });

  await boss.createQueue(WORKSPACE_DELETION_JOB);

  await boss.work<WorkspaceDeletionJobData>(WORKSPACE_DELETION_JOB, async (jobs) => {
    for (const job of jobs) {
      const { workspaceId, triggeredBy } = job.data;
      console.log(JSON.stringify({ event: "workspace-deletion-started", workspaceId, triggeredBy }));
      await executeWorkspaceDeletion(workspaceId, triggeredBy);
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
