import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { withDomainErrors } from "@/server/api/domainErrors";
import { implementOperation } from "@/server/api/execute";
import { prisma } from "@/server/db/prisma";
import {
  createPartCategory,
  createPartCategoryPath,
  deletePartCategory,
  getPartCategories,
  updatePartCategory
} from "@/server/parts/categories";
import {
  createPartCategoryOperation,
  createPartCategoryPathOperation,
  deletePartCategoryOperation,
  getPartCategoryTreeOperation,
  movePartCategoryOperation,
  updatePartCategoryOperation
} from "@/server/parts/categoryOperations";

/**
 * Part categories in the API and MCP (#278), over the same domain functions as the category
 * dialogs (`categoryActions.ts`).
 */

/** A category as the tree lists it (with its path), after a change. */
async function readCategory(actor: WorkspaceActor, categoryId: string) {
  const categories = await getPartCategories(actor.workspace.id);
  const category = categories.find((candidate) => candidate.id === categoryId);

  if (!category) {
    throw new Error("category-not-found");
  }

  return category;
}

async function changeCategory(
  actor: WorkspaceActor,
  categoryId: string,
  changes: { name?: string; parentId?: string | null; isAssignable?: boolean }
) {
  const current = await prisma.partCategory.findFirst({
    where: { id: categoryId, workspaceId: actor.workspace.id },
    select: { name: true, parentId: true, isAssignable: true }
  });

  if (!current) {
    throw new Error("category-not-found");
  }

  await updatePartCategory({
    id: categoryId,
    workspaceId: actor.workspace.id,
    name: changes.name ?? current.name,
    parentId: changes.parentId === undefined ? current.parentId : changes.parentId,
    isAssignable: changes.isAssignable ?? current.isAssignable
  });

  return readCategory(actor, categoryId);
}

export const getPartCategoryTreeImplementation = implementOperation(
  getPartCategoryTreeOperation,
  async (actor) => ({ categories: await getPartCategories(actor.workspace.id) })
);

export const createPartCategoryImplementation = implementOperation(
  createPartCategoryOperation,
  (actor, input) =>
    withDomainErrors(async () => {
      const created = await createPartCategory({
        workspaceId: actor.workspace.id,
        parentId: input.parentId ?? null,
        name: input.name,
        isAssignable: input.isAssignable
      });

      return readCategory(actor, created.id);
    })
);

export const createPartCategoryPathImplementation = implementOperation(
  createPartCategoryPathOperation,
  (actor, input) =>
    withDomainErrors(async () => {
      const last = await createPartCategoryPath({
        workspaceId: actor.workspace.id,
        parentId: input.parentId ?? null,
        path: input.path,
        finalIsAssignable: input.finalIsAssignable ?? true
      });

      return readCategory(actor, last.id);
    })
);

export const updatePartCategoryImplementation = implementOperation(
  updatePartCategoryOperation,
  (actor, { categoryId, ...changes }) =>
    withDomainErrors(() => changeCategory(actor, categoryId, changes))
);

export const movePartCategoryImplementation = implementOperation(
  movePartCategoryOperation,
  (actor, { categoryId, parentId }) =>
    withDomainErrors(() => changeCategory(actor, categoryId, { parentId }))
);

export const deletePartCategoryImplementation = implementOperation(
  deletePartCategoryOperation,
  (actor, { categoryId }) =>
    withDomainErrors(async () => {
      await deletePartCategory({ id: categoryId, workspaceId: actor.workspace.id });
      return { id: categoryId };
    })
);
