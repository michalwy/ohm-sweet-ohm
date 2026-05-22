import "server-only";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { getPartCategories } from "@/server/parts/categories";

export type PartsListItem = {
  id: string;
  catalogNumber: string;
  manufacturerName: string;
  primaryCategoryId: string | null;
  primaryCategoryPath: string | null;
  secondaryCategoryId: string | null;
  secondaryCategoryPath: string | null;
};

export type PartsListResult = {
  parts: PartsListItem[];
  isDatabaseAvailable: boolean;
};

type WorkspaceContext = {
  user: {
    id: string;
  };
  workspace: {
    id: string;
  };
};

export async function getPartsList(
  context: WorkspaceContext
): Promise<PartsListResult> {
  try {
    await authorizeWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "parts:read"
    });

    const [parts, categories] = await Promise.all([
      prisma.part.findMany({
        where: {
          workspaceId: context.workspace.id
        },
        orderBy: [{ manufacturer: { name: "asc" } }, { catalogNumber: "asc" }],
        select: {
          id: true,
          catalogNumber: true,
          manufacturer: {
            select: {
              name: true
            }
          },
          primaryCategoryId: true,
          secondaryCategoryId: true
        }
      }),
      getPartCategories(context.workspace.id)
    ]);
    const categoryPathsById = new Map(
      categories.map((category) => [category.id, category.path])
    );

    return {
      parts: parts.map((part) => ({
        id: part.id,
        catalogNumber: part.catalogNumber,
        manufacturerName: part.manufacturer.name,
        primaryCategoryId: part.primaryCategoryId,
        primaryCategoryPath: part.primaryCategoryId
          ? categoryPathsById.get(part.primaryCategoryId) ?? null
          : null,
        secondaryCategoryId: part.secondaryCategoryId,
        secondaryCategoryPath: part.secondaryCategoryId
          ? categoryPathsById.get(part.secondaryCategoryId) ?? null
          : null
      })),
      isDatabaseAvailable: true
    };
  } catch {
    return {
      parts: [],
      isDatabaseAvailable: false
    };
  }
}
