import "server-only";

import {
  authorizeWorkspacePermission,
  hasWorkspacePermission
} from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";

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
