import "server-only";

import {
  authorizeWorkspacePermission,
  hasWorkspacePermission
} from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export const PART_CATEGORY_PATH_SEPARATOR = " » ";

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

  // Parts writers need to see categories when creating/editing parts, even without explicit categories:read.
  if (!canWriteParts && !canReadCategories) {
    throw new Error("workspace-permission-denied");
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
    const path = parentPath
      ? `${parentPath}${PART_CATEGORY_PATH_SEPARATOR}${category.name}`
      : category.name;

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
      throw new Error("category-name-required");
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
    await rebuildPartCategorySortPaths(tx, input.workspaceId);

    return category;
  });
}

export async function createPartCategoryPath({
  workspaceId,
  parentId,
  path,
  finalIsAssignable
}: {
  workspaceId: string;
  parentId: string | null;
  path: string;
  finalIsAssignable: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const pathSegments = getCategoryPathSegments(path);

    if (pathSegments.length === 0) {
      throw new Error("category-name-required");
    }

    await validateParentCategory({
      tx,
      workspaceId,
      parentId
    });

    const category = await createPartCategoryPathInTransaction({
      tx,
      workspaceId,
      parentId,
      pathSegments,
      finalIsAssignable
    });

    await rebuildPartCategoryClosures(tx, workspaceId);
    await rebuildPartCategorySortPaths(tx, workspaceId);

    return category;
  });
}

async function createPartCategoryPathInTransaction({
  tx,
  workspaceId,
  parentId,
  pathSegments,
  finalIsAssignable
}: {
  tx: PrismaTransaction;
  workspaceId: string;
  parentId: string | null;
  pathSegments: string[];
  finalIsAssignable: boolean;
}) {
  let currentParentId = parentId;
  let lastCategory: { id: string } | null = null;

  for (const [index, segmentName] of pathSegments.entries()) {
    const shouldBeAssignable =
      index === pathSegments.length - 1 ? finalIsAssignable : false;
    const siblingCategories = await tx.partCategory.findMany({
      where: {
        workspaceId,
        parentId: currentParentId
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        isAssignable: true
      }
    });
    const normalizedSegmentName = normalizeCategoryName(segmentName);
    const existingCategory = siblingCategories.find(
      (category) => normalizeCategoryName(category.name) === normalizedSegmentName
    );

    if (existingCategory) {
      if (existingCategory.isAssignable !== shouldBeAssignable) {
        await tx.partCategory.update({
          where: {
            id: existingCategory.id
          },
          data: {
            isAssignable: shouldBeAssignable
          }
        });
      }

      currentParentId = existingCategory.id;
      lastCategory = existingCategory;
      continue;
    }

    const createdCategory = await tx.partCategory.create({
      data: {
        workspaceId,
        parentId: currentParentId,
        name: segmentName,
        isAssignable: shouldBeAssignable
      },
      select: {
        id: true
      }
    });

    currentParentId = createdCategory.id;
    lastCategory = createdCategory;
  }

  if (!lastCategory) {
    throw new Error("category-name-required");
  }

  return tx.partCategory.findUniqueOrThrow({
    where: {
      id: lastCategory.id
    }
  });
}

function getCategoryPathSegments(rawName: string) {
  return rawName
    .split("/")
    .map((segment) => segment.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
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
      throw new Error("category-name-required");
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
      throw new Error("category-not-found");
    }

    if (input.parentId === id) {
      throw new Error("invalid-parent-category");
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
        throw new Error("invalid-parent-category");
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
    await rebuildPartCategorySortPaths(tx, input.workspaceId);

    return updatedCategory;
  });
}

export async function deletePartCategory({
  workspaceId,
  id
}: {
  workspaceId: string;
  id: string;
}) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.partCategory.findFirst({
      where: {
        id,
        workspaceId
      },
      select: {
        id: true
      }
    });

    if (!category) {
      throw new Error("category-not-found");
    }

    const [partCount, childCount] = await Promise.all([
      tx.part.count({
        where: {
          workspaceId,
          OR: [{ primaryCategoryId: id }, { secondaryCategoryId: id }]
        }
      }),
      tx.partCategory.count({
        where: {
          workspaceId,
          parentId: id
        }
      })
    ]);

    if (partCount > 0) {
      throw new Error("category-in-use-by-parts");
    }

    if (childCount > 0) {
      throw new Error("category-has-children");
    }

    await tx.partCategory.delete({
      where: {
        id
      }
    });

    await rebuildPartCategoryClosures(tx, workspaceId);
    await rebuildPartCategorySortPaths(tx, workspaceId);
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
    throw new Error("invalid-parent-category");
  }
}

async function rebuildPartCategorySortPaths(
  tx: PrismaTransaction,
  workspaceId: string
) {
  const categories = await tx.partCategory.findMany({
    where: { workspaceId },
    select: { id: true, parentId: true, name: true }
  });
  const pathsById = buildPartCategoryPaths(categories);

  for (const [id, path] of pathsById) {
    await tx.partCategory.update({
      where: { id },
      data: { sortPath: path.toLocaleLowerCase("en") }
    });
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
        throw new Error("category-tree-cycle");
      }

      const parent = categoriesById.get(parentId);

      if (!parent) {
        throw new Error("invalid-parent-category");
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
