import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import { prisma } from "@/server/db/prisma";
import {
  assembleBuildUnitOperation,
  assembleBuildDesignatorOperation,
  cancelBuildOperation,
  createBuildOperation,
  deleteBuildOperation,
  getBuildAssemblyListOperation,
  getBuildCreateOptionsOperation,
  getBuildOperation,
  getBuildPickListOperation,
  getPartBuildAllocationsOperation,
  getPartProductionBuildsOperation,
  listBuildsOperation,
  reassignBuildDesignatorOperation,
  setBuildAllocationsOperation,
  setBuildLineAllocationsOperation,
  startBuildOperation
} from "@/server/builds/buildOperations";
import {
  assembleBuildUnit,
  assembleDesignator,
  cancelBuild,
  createBuild,
  deleteBuild,
  getBuildAssemblyList,
  getBuildCreateOptions,
  getBuildDetail,
  getBuildPickList,
  getBuildsForWorkspace,
  getPartBuildAllocations,
  getPartProductionBuilds,
  reassignDesignatorAssignment,
  setBuildAllocations,
  setBuildLineAllocations,
  startBuild,
  type BuildDetail,
  type BuildSummary
} from "@/server/builds/builds";
import { assertPartBelongsToWorkspace } from "@/server/shopping-lists/shoppingListMutations";

/**
 * The build operations (#284), over the same domain functions as the server actions in
 * `buildActions.ts`, so they have the same stock effects. Every call is scoped to the actor's
 * workspace; the permission is checked by `executeOperation` before the function runs (and once
 * more by the domain function, against the user's roles, as for the UI).
 *
 * A record below a build in the path (a line, a designator assignment) must belong to that build:
 * one of another build is not found, as one of another workspace is.
 */

type DomainResult<T> = { ok: true; data: T } | { ok: false; error: string };

function unwrap<T>(result: DomainResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.replaceAll("_", "-"));
  }

  return result.data;
}

function iso(date: Date | null) {
  return date ? date.toISOString() : null;
}

function toSummary(summary: BuildSummary) {
  return {
    ...summary,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString()
  };
}

function toBuild(detail: BuildDetail) {
  return {
    ...detail,
    startedAt: iso(detail.startedAt),
    completedAt: iso(detail.completedAt),
    cancelledAt: iso(detail.cancelledAt),
    createdAt: detail.createdAt.toISOString()
  };
}

function scope(actor: WorkspaceActor) {
  return { userId: actor.user.id, workspaceId: actor.workspace.id };
}

async function readBuild(actor: WorkspaceActor, buildId: string) {
  const detail = await getBuildDetail({ ...scope(actor), buildId });

  if (!detail) {
    throw new Error("build-not-found");
  }

  return toBuild(detail);
}

async function readBuildState(actor: WorkspaceActor, buildId: string) {
  const build = await prisma.build.findFirst({
    where: { id: buildId, workspaceId: actor.workspace.id },
    select: { id: true, state: true }
  });

  if (!build) {
    throw new Error("build-not-found");
  }

  return { buildId: build.id, state: build.state };
}

async function assertLineOfBuild(actor: WorkspaceActor, buildId: string, lineIds: string[]) {
  await readBuildState(actor, buildId);

  const found = await prisma.buildLineItem.count({
    where: { id: { in: lineIds }, buildId, workspaceId: actor.workspace.id }
  });

  if (found !== new Set(lineIds).size) {
    throw new Error("build-line-not-found");
  }
}

async function assertAssignmentOfBuild(actor: WorkspaceActor, buildId: string, assignmentId: string) {
  await readBuildState(actor, buildId);

  const assignment = await prisma.buildDesignatorAssignment.findFirst({
    where: { id: assignmentId, workspaceId: actor.workspace.id, buildLineItem: { buildId } },
    select: { id: true }
  });

  if (!assignment) {
    throw new Error("assignment-not-found");
  }
}

export const listBuildsImplementation = implementOperation(listBuildsOperation, async (actor, input) => {
  const page = await getBuildsForWorkspace({
    ...scope(actor),
    cursor: input.cursor,
    pageSize: input.pageSize,
    sortBy: input.sortBy,
    sortDir: input.sortDir,
    searchQuery: input.searchQuery,
    stateFilter: input.stateFilter,
    createdAtFilter: input.createdAtFilter,
    designIdFilter: input.designIdFilter
  });

  return { ...page, items: page.items.map(toSummary) };
});

export const getBuildImplementation = implementOperation(getBuildOperation, async (actor, input) =>
  readBuild(actor, input.buildId)
);

export const getBuildCreateOptionsImplementation = implementOperation(
  getBuildCreateOptionsOperation,
  async (actor) => getBuildCreateOptions(scope(actor))
);

export const createBuildImplementation = implementOperation(createBuildOperation, async (actor, input) => {
  const { id } = unwrap(
    await createBuild({
      ...scope(actor),
      designRevisionId: input.designRevisionId,
      targetQuantity: input.targetQuantity,
      outputLocationId: input.outputLocationId,
      createdByUserId: actor.user.id
    })
  );

  return readBuild(actor, id);
});

export const deleteBuildImplementation = implementOperation(deleteBuildOperation, async (actor, input) => {
  unwrap(await deleteBuild({ ...scope(actor), buildId: input.buildId }));

  return { buildId: input.buildId };
});

export const setBuildLineAllocationsImplementation = implementOperation(
  setBuildLineAllocationsOperation,
  async (actor, input) => {
    await assertLineOfBuild(actor, input.buildId, [input.lineId]);
    unwrap(
      await setBuildLineAllocations({
        ...scope(actor),
        buildLineItemId: input.lineId,
        entries: input.entries
      })
    );

    return readBuild(actor, input.buildId);
  }
);

export const setBuildAllocationsImplementation = implementOperation(
  setBuildAllocationsOperation,
  async (actor, input) => {
    await assertLineOfBuild(
      actor,
      input.buildId,
      input.lines.map((line) => line.buildLineItemId)
    );
    unwrap(await setBuildAllocations({ ...scope(actor), buildId: input.buildId, lines: input.lines }));

    return readBuild(actor, input.buildId);
  }
);

export const reassignBuildDesignatorImplementation = implementOperation(
  reassignBuildDesignatorOperation,
  async (actor, input) => {
    await assertAssignmentOfBuild(actor, input.buildId, input.assignmentId);
    unwrap(
      await reassignDesignatorAssignment({
        ...scope(actor),
        assignmentId: input.assignmentId,
        partId: input.partId,
        sourceLocationId: input.sourceLocationId
      })
    );

    return readBuild(actor, input.buildId);
  }
);

export const startBuildImplementation = implementOperation(startBuildOperation, async (actor, input) => {
  unwrap(await startBuild({ ...scope(actor), buildId: input.buildId }));

  return readBuildState(actor, input.buildId);
});

export const assembleBuildDesignatorImplementation = implementOperation(
  assembleBuildDesignatorOperation,
  async (actor, input) => {
    await assertAssignmentOfBuild(actor, input.buildId, input.assignmentId);
    const { completed } = unwrap(
      await assembleDesignator({ ...scope(actor), assignmentId: input.assignmentId })
    );

    return { ...(await readBuildState(actor, input.buildId)), completed };
  }
);

export const assembleBuildUnitImplementation = implementOperation(
  assembleBuildUnitOperation,
  async (actor, input) => {
    const { completed } = unwrap(
      await assembleBuildUnit({ ...scope(actor), buildId: input.buildId, unitIndex: input.unitIndex })
    );

    return { ...(await readBuildState(actor, input.buildId)), completed };
  }
);

export const cancelBuildImplementation = implementOperation(cancelBuildOperation, async (actor, input) => {
  unwrap(await cancelBuild({ ...scope(actor), buildId: input.buildId }));

  return readBuildState(actor, input.buildId);
});

export const getBuildPickListImplementation = implementOperation(
  getBuildPickListOperation,
  async (actor, input) => {
    await readBuildState(actor, input.buildId);
    const pickList = await getBuildPickList({ ...scope(actor), buildId: input.buildId });

    if (!pickList) {
      throw new Error("build-pick-list-unavailable");
    }

    return pickList;
  }
);

export const getBuildAssemblyListImplementation = implementOperation(
  getBuildAssemblyListOperation,
  async (actor, input) => {
    await readBuildState(actor, input.buildId);
    const assemblyList = await getBuildAssemblyList({ ...scope(actor), buildId: input.buildId });

    if (!assemblyList) {
      throw new Error("build-assembly-list-unavailable");
    }

    return assemblyList;
  }
);

export const getPartBuildAllocationsImplementation = implementOperation(
  getPartBuildAllocationsOperation,
  async (actor, input) => {
    await assertPartBelongsToWorkspace(actor.workspace.id, input.id);

    return { items: await getPartBuildAllocations({ ...scope(actor), partId: input.id }) };
  }
);

export const getPartProductionBuildsImplementation = implementOperation(
  getPartProductionBuildsOperation,
  async (actor, input) => {
    await assertPartBelongsToWorkspace(actor.workspace.id, input.id);

    return { items: await getPartProductionBuilds({ ...scope(actor), partId: input.id }) };
  }
);
