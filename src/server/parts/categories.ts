import "server-only";

import {
  authorizeWorkspacePermission,
  hasWorkspacePermission
} from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export type PartCategoryListItem = {
  id: string;
  parentId: string | null;
  name: string;
  isAssignable: boolean;
  path: string;
};

type WorkspaceContext = {
  user: {
    id: string;
  };
  workspace: {
    id: string;
  };
};

type PartCategoryInput = {
  workspaceId: string;
  parentId: string | null;
  name: string;
  isAssignable: boolean;
};

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function getPartCategoriesForManagement(
  context: WorkspaceContext
): Promise<PartCategoryListItem[]> {
  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "part-categories:read"
  });

  return getPartCategories(context.workspace.id);
}

export async function getPartCategoriesForPartForm(
  context: WorkspaceContext
): Promise<PartCategoryListItem[]> {
  const canWriteParts = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "parts:write"
  });
  const canReadCategories = await hasWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "part-categories:read"
  });

  if (!canWriteParts && !canReadCategories) {
    throw new Error("workspace_permission_denied");
  }

  return getPartCategories(context.workspace.id);
}

export async function getPartCategories(workspaceId: string) {
  const categories = await prisma.partCategory.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      isAssignable: true
    }
  });

  const pathsById = buildPartCategoryPaths(categories);

  return categories
    .map((category) => ({
      ...category,
      path: pathsById.get(category.id) ?? category.name
    }))
    .sort((left, right) =>
      left.path.localeCompare(right.path, "en", { sensitivity: "base" })
    );
}

export function buildPartCategoryPaths(
  categories: Array<{
    id: string;
    parentId: string | null;
    name: string;
  }>
) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const pathsById = new Map<string, string>();

  function getPath(categoryId: string, seen: Set<string>): string {
    const existingPath = pathsById.get(categoryId);

    if (existingPath) {
      return existingPath;
    }

    const category = categoriesById.get(categoryId);

    if (!category) {
      return "";
    }

    if (!category.parentId || seen.has(category.parentId)) {
      pathsById.set(categoryId, category.name);
      return category.name;
    }

    const parentPath = getPath(category.parentId, new Set(seen).add(categoryId));
    const path = parentPath ? `${parentPath} / ${category.name}` : category.name;

    pathsById.set(categoryId, path);
    return path;
  }

  for (const category of categories) {
    getPath(category.id, new Set());
  }

  return pathsById;
}

export async function createPartCategory(input: PartCategoryInput) {
  return prisma.$transaction(async (tx) => {
    const name = input.name.trim();

    if (!name) {
      throw new Error("category_name_required");
    }

    await validateParentCategory({
      tx,
      workspaceId: input.workspaceId,
      parentId: input.parentId
    });

    const category = await tx.partCategory.create({
      data: {
        workspaceId: input.workspaceId,
        parentId: input.parentId,
        name,
        isAssignable: input.isAssignable
      }
    });

    await rebuildPartCategoryClosures(tx, input.workspaceId);

    return category;
  });
}

export async function updatePartCategory({
  id,
  ...input
}: PartCategoryInput & {
  id: string;
}) {
  return prisma.$transaction(async (tx) => {
    const name = input.name.trim();

    if (!name) {
      throw new Error("category_name_required");
    }

    const category = await tx.partCategory.findFirst({
      where: {
        id,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        parentId: true
      }
    });

    if (!category) {
      throw new Error("category_not_found");
    }

    if (input.parentId === id) {
      throw new Error("invalid_parent_category");
    }

    await validateParentCategory({
      tx,
      workspaceId: input.workspaceId,
      parentId: input.parentId
    });

    if (input.parentId) {
      const wouldMoveIntoDescendant = await tx.partCategoryClosure.findFirst({
        where: {
          workspaceId: input.workspaceId,
          ancestorId: id,
          descendantId: input.parentId
        },
        select: {
          ancestorId: true
        }
      });

      if (wouldMoveIntoDescendant) {
        throw new Error("invalid_parent_category");
      }
    }

    const updatedCategory = await tx.partCategory.update({
      where: {
        id
      },
      data: {
        parentId: input.parentId,
        name,
        isAssignable: input.isAssignable
      }
    });

    await rebuildPartCategoryClosures(tx, input.workspaceId);

    return updatedCategory;
  });
}

async function validateParentCategory({
  tx,
  workspaceId,
  parentId
}: {
  tx: PrismaTransaction;
  workspaceId: string;
  parentId: string | null;
}) {
  if (!parentId) {
    return;
  }

  const parent = await tx.partCategory.findFirst({
    where: {
      id: parentId,
      workspaceId
    },
    select: {
      id: true
    }
  });

  if (!parent) {
    throw new Error("invalid_parent_category");
  }
}

async function rebuildPartCategoryClosures(
  tx: PrismaTransaction,
  workspaceId: string
) {
  const categories = await tx.partCategory.findMany({
    where: {
      workspaceId
    },
    select: {
      id: true,
      parentId: true
    }
  });
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const closureRows: Array<{
    workspaceId: string;
    ancestorId: string;
    descendantId: string;
    depth: number;
  }> = [];

  for (const category of categories) {
    closureRows.push({
      workspaceId,
      ancestorId: category.id,
      descendantId: category.id,
      depth: 0
    });

    let depth = 1;
    let parentId = category.parentId;
    const seen = new Set([category.id]);

    while (parentId) {
      if (seen.has(parentId)) {
        throw new Error("category_tree_cycle");
      }

      const parent = categoriesById.get(parentId);

      if (!parent) {
        throw new Error("invalid_parent_category");
      }

      closureRows.push({
        workspaceId,
        ancestorId: parent.id,
        descendantId: category.id,
        depth
      });

      seen.add(parent.id);
      parentId = parent.parentId;
      depth += 1;
    }
  }

  await tx.partCategoryClosure.deleteMany({
    where: {
      workspaceId
    }
  });

  if (closureRows.length > 0) {
    await tx.partCategoryClosure.createMany({
      data: closureRows
    });
  }
}
