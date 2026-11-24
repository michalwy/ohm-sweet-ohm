import "server-only";

import { actorHasPermission, type WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import { prisma } from "@/server/db/prisma";
import {
  createBomLineItem,
  deleteBomLineItem,
  getBomLineItems,
  previewLineItemMatches,
  updateBomLineItem,
  type BomLineItemInput
} from "@/server/designs/bomLineItems";
import {
  addDesignRevisionOperation,
  addShortageToShoppingListOperation,
  analyzeShortageOperation,
  createBomLineItemOperation,
  createDesignOperation,
  deleteBomLineItemOperation,
  deleteDesignOperation,
  getDesignOperation,
  listBomLineItemsOperation,
  listDesignsOperation,
  previewBomLineItemMatchesOperation,
  updateBomLineItemOperation,
  updateDesignOperation,
  updateDesignRevisionOperation
} from "@/server/designs/designOperations";
import {
  addRevisionToDesign,
  createDesign,
  deleteDesign,
  getDesignDetail,
  getDesignsForWorkspace,
  getNextDesignCatalogNumber,
  updateDesign,
  updateDesignRevision,
  type DesignRevisionSummary,
  type DesignSummary
} from "@/server/designs/designs";
import { analyzeShortage } from "@/server/designs/shortageAnalysis";
import {
  addShoppingListItems,
  getShoppingListDetail
} from "@/server/shopping-lists/shoppingListMutations";
import { getDefaultPartUnitId } from "@/server/units/defaultUnits";
import { mergeShoppingListRows } from "@/lib/shoppingListRowMerge";

/**
 * The design, BOM and shortage operations (#283), over the same domain functions as the server
 * actions in `designActions.ts` and `bomActions.ts`. Every call is scoped to the actor's workspace;
 * the permission is checked by `executeOperation` before the function runs (and once more by the
 * domain function, against the user's roles, as for the UI).
 *
 * The domain functions answer a bare `not_found`; here it becomes the record's own code
 * (`design-not-found`, `revision-not-found`, `line-item-not-found`), so REST answers 404.
 */

type DomainResult = { ok: true } | { ok: false; error: string };

function failWith(error: string, notFound: string): never {
  const code = error.replaceAll("_", "-");

  throw new Error(code === "not-found" ? notFound : code);
}

function scope(actor: WorkspaceActor) {
  return { userId: actor.user.id, workspaceId: actor.workspace.id };
}

function toSummary(summary: DesignSummary) {
  return {
    ...summary,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString()
  };
}

function toRevision(revision: DesignRevisionSummary) {
  return {
    ...revision,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString()
  };
}

async function readDesign(actor: WorkspaceActor, designId: string) {
  const detail = await getDesignDetail({ ...scope(actor), designId });

  if (!detail) {
    throw new Error("design-not-found");
  }

  return { ...toSummary(detail), revisions: detail.revisions.map(toRevision) };
}

async function readRevision(actor: WorkspaceActor, revisionId: string) {
  const revision = await prisma.designRevision.findFirst({
    where: { id: revisionId, workspaceId: actor.workspace.id },
    select: { id: true, revisionNumber: true, notes: true, createdAt: true, updatedAt: true }
  });

  if (!revision) {
    throw new Error("revision-not-found");
  }

  return toRevision(revision);
}

async function readLineItem(actor: WorkspaceActor, lineItemId: string) {
  const line = await prisma.bomLineItem.findFirst({
    where: { id: lineItemId, workspaceId: actor.workspace.id },
    select: { revisionId: true }
  });

  if (!line) {
    throw new Error("line-item-not-found");
  }

  const items = await getBomLineItems({ ...scope(actor), revisionId: line.revisionId });
  const item = items.find((candidate) => candidate.id === lineItemId);

  if (!item) {
    throw new Error("line-item-not-found");
  }

  return item;
}

function toLineItemInput(input: {
  designators: string;
  categoryId?: string | null;
  pinnedPartId?: string | null;
  matchers?: BomLineItemInput["matchers"];
  notes?: string | null;
}): BomLineItemInput {
  return {
    designators: input.designators,
    categoryId: input.categoryId ?? null,
    pinnedPartId: input.pinnedPartId ?? null,
    matchers: input.matchers ?? [],
    notes: input.notes ?? null
  };
}

function check(result: DomainResult, notFound: string) {
  if (!result.ok) {
    failWith(result.error, notFound);
  }
}

export const listDesignsImplementation = implementOperation(listDesignsOperation, async (actor, input) => {
  const page = await getDesignsForWorkspace({
    ...scope(actor),
    cursor: input.cursor,
    pageSize: input.pageSize,
    sortBy: input.sortBy,
    sortDir: input.sortDir,
    searchQuery: input.searchQuery,
    createdAtFilter: input.createdAtFilter
  });

  return { ...page, items: page.items.map(toSummary) };
});

export const getDesignImplementation = implementOperation(getDesignOperation, async (actor, input) =>
  readDesign(actor, input.designId)
);

export const createDesignImplementation = implementOperation(createDesignOperation, async (actor, input) => {
  const unitId = await getDefaultPartUnitId(prisma, actor.workspace.id);

  if (!unitId) {
    throw new Error("no-default-unit");
  }

  const result = await createDesign({
    ...scope(actor),
    workspaceName: actor.workspace.name,
    name: input.name,
    description: input.description,
    catalogNumber: input.catalogNumber ?? (await getNextDesignCatalogNumber(actor.workspace.id)),
    unitId
  });

  if (!result.ok) {
    failWith(result.error, "design-not-found");
  }

  return readDesign(actor, result.id);
});

export const updateDesignImplementation = implementOperation(updateDesignOperation, async (actor, input) => {
  const current = await readDesign(actor, input.designId);

  check(
    await updateDesign({
      ...scope(actor),
      designId: input.designId,
      name: input.name ?? current.name,
      description: input.description === undefined ? current.description : input.description
    }),
    "design-not-found"
  );

  return readDesign(actor, input.designId);
});

export const deleteDesignImplementation = implementOperation(deleteDesignOperation, async (actor, input) => {
  check(await deleteDesign({ ...scope(actor), designId: input.designId }), "design-not-found");

  return { designId: input.designId };
});

export const addDesignRevisionImplementation = implementOperation(
  addDesignRevisionOperation,
  async (actor, input) => {
    const result = await addRevisionToDesign({ ...scope(actor), designId: input.designId, notes: input.notes });

    if (!result.ok) {
      failWith(result.error, "design-not-found");
    }

    return readRevision(actor, result.id);
  }
);

export const updateDesignRevisionImplementation = implementOperation(
  updateDesignRevisionOperation,
  async (actor, input) => {
    const current = await readRevision(actor, input.revisionId);

    check(
      await updateDesignRevision({
        ...scope(actor),
        revisionId: input.revisionId,
        notes: input.notes === undefined ? current.notes : input.notes
      }),
      "revision-not-found"
    );

    return readRevision(actor, input.revisionId);
  }
);

export const listBomLineItemsImplementation = implementOperation(
  listBomLineItemsOperation,
  async (actor, input) => {
    await readRevision(actor, input.revisionId);

    return { items: await getBomLineItems({ ...scope(actor), revisionId: input.revisionId }) };
  }
);

export const createBomLineItemImplementation = implementOperation(
  createBomLineItemOperation,
  async (actor, input) => {
    const result = await createBomLineItem({
      ...scope(actor),
      revisionId: input.revisionId,
      input: toLineItemInput(input)
    });

    if (!result.ok) {
      failWith(result.error, "revision-not-found");
    }

    return readLineItem(actor, result.data.id);
  }
);

export const updateBomLineItemImplementation = implementOperation(
  updateBomLineItemOperation,
  async (actor, input) => {
    const result = await updateBomLineItem({
      ...scope(actor),
      lineItemId: input.lineItemId,
      input: toLineItemInput(input)
    });

    if (!result.ok) {
      failWith(result.error, "line-item-not-found");
    }

    return readLineItem(actor, input.lineItemId);
  }
);

export const deleteBomLineItemImplementation = implementOperation(
  deleteBomLineItemOperation,
  async (actor, input) => {
    const result = await deleteBomLineItem({ ...scope(actor), lineItemId: input.lineItemId });

    if (!result.ok) {
      failWith(result.error, "line-item-not-found");
    }

    return { lineItemId: input.lineItemId };
  }
);

export const previewBomLineItemMatchesImplementation = implementOperation(
  previewBomLineItemMatchesOperation,
  async (actor, input) => {
    const result = await previewLineItemMatches({
      ...scope(actor),
      input: {
        categoryId: input.categoryId,
        pinnedPartId: input.pinnedPartId,
        matchers: input.matchers ?? []
      }
    });

    if (!result.ok) {
      failWith(result.error, "attribute-not-found");
    }

    return result.data;
  }
);

export const analyzeShortageImplementation = implementOperation(
  analyzeShortageOperation,
  async (actor, input) =>
    analyzeShortage({ ...scope(actor), revisionId: input.revisionId, targetQuantity: input.targetQuantity })
);

/**
 * The UI's "Create shopping list" dialog (`shortage-to-sl-dialog.tsx`): every procurement item,
 * at its shortage quantity or the one the caller chose, as its own part or one of its candidates,
 * merged by part (`mergeShoppingListRows`) and added with the bulk add. Reading the analysis needs
 * `designs:read`, which the operation's own permission (`shopping-lists:write`) does not cover.
 */
export const addShortageToShoppingListImplementation = implementOperation(
  addShortageToShoppingListOperation,
  async (actor, input) => {
    if (!actorHasPermission(actor, "designs:read")) {
      throw new Error("permission-denied");
    }

    if (!(await getShoppingListDetail(actor.workspace.id, input.listId))) {
      throw new Error("shopping-list-not-found");
    }

    const analysis = await analyzeShortage({
      ...scope(actor),
      revisionId: input.revisionId,
      targetQuantity: input.targetQuantity
    });
    const procurement = new Map(analysis.procurement.map((item) => [item.partId, item]));
    const overrides = new Map<string, { substitutePartId?: string; quantity?: number }>();

    for (const override of input.overrides ?? []) {
      const item = procurement.get(override.partId);

      if (!item) {
        throw new Error("shortage-item-not-found");
      }

      if (
        override.substitutePartId !== undefined &&
        !item.candidates.some((candidate) => candidate.partId === override.substitutePartId)
      ) {
        throw new Error("invalid-substitute-part");
      }

      overrides.set(override.partId, override);
    }

    const added = mergeShoppingListRows(
      analysis.procurement.map((item) => {
        const override = overrides.get(item.partId);

        return {
          partId: override?.substitutePartId ?? item.partId,
          quantity: String(override?.quantity ?? item.shortageQty)
        };
      })
    );

    if (added.length === 0) {
      throw new Error("nothing-to-add");
    }

    await addShoppingListItems({ workspaceId: actor.workspace.id, listId: input.listId, items: added });

    const list = await getShoppingListDetail(actor.workspace.id, input.listId);

    if (!list) {
      throw new Error("shopping-list-not-found");
    }

    return { added, list };
  }
);
