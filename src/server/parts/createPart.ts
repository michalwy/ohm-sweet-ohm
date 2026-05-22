"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import {
  ensureOrganizationWithRole,
  ORGANIZATION_ROLE_MANUFACTURER
} from "@/server/organizations/organizations";
import { getPartCategories } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";

export type PartMutationResult =
  | {
      ok: true;
      part: PartsListItem;
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export async function createPart(
  formData: FormData
): Promise<PartMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const partsPath = getPartsPath(workspaceSlug);
  let part: PartsListItem | null = null;

  if (!workspaceSlug || !catalogNumber || !manufacturerName) {
    return getFormErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "parts:write"
      });

      formError = await validatePartCategoryAssignment({
        workspaceId: context.workspace.id,
        primaryCategoryId,
        secondaryCategoryId
      });

      if (!formError) {
        const manufacturer = await ensureOrganizationWithRole({
          workspaceId: context.workspace.id,
          name: manufacturerName,
          role: ORGANIZATION_ROLE_MANUFACTURER
        });

        try {
          const createdPart = await prisma.part.create({
            data: {
              workspaceId: context.workspace.id,
              catalogNumber,
              manufacturerId: manufacturer.id,
              primaryCategoryId,
              secondaryCategoryId
            }
          });
          part = await getPartListItem({
            id: createdPart.id,
            workspaceId: context.workspace.id
          });
        } catch (error) {
          formError = getPartWriteError(error);
        }
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    return getFormErrorState(formError);
  }

  if (!part) {
    return getFormErrorState("database-unavailable");
  }

  revalidatePath(partsPath);
  return getFormSuccessState(part);
}

export async function updatePart(
  formData: FormData
): Promise<PartMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const partsPath = getPartsPath(workspaceSlug);
  let part: PartsListItem | null = null;

  if (!workspaceSlug || !id || !catalogNumber || !manufacturerName) {
    return getFormErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "parts:write"
      });

      formError = await validatePartCategoryAssignment({
        workspaceId: context.workspace.id,
        primaryCategoryId,
        secondaryCategoryId
      });

      if (!formError) {
        const manufacturer = await ensureOrganizationWithRole({
          workspaceId: context.workspace.id,
          name: manufacturerName,
          role: ORGANIZATION_ROLE_MANUFACTURER
        });

        try {
          const updateResult = await prisma.part.updateMany({
            where: {
              id,
              workspaceId: context.workspace.id
            },
            data: {
              catalogNumber,
              manufacturerId: manufacturer.id,
              primaryCategoryId,
              secondaryCategoryId
            }
          });

          if (updateResult.count === 0) {
            formError = "database-unavailable";
          } else {
            part = await getPartListItem({
              id,
              workspaceId: context.workspace.id
            });
          }
        } catch (error) {
          formError = getPartWriteError(error);
        }
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    return getFormErrorState(formError);
  }

  if (!part) {
    return getFormErrorState("database-unavailable");
  }

  revalidatePath(partsPath);
  return getFormSuccessState(part);
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalFormValue(formData: FormData, name: string) {
  const value = getRequiredFormValue(formData, name);

  return value || null;
}

function getPartsPath(workspaceSlug: string) {
  if (!workspaceSlug) {
    return "/workspaces";
  }

  return `/w/${encodeURIComponent(workspaceSlug)}/parts`;
}

async function validatePartCategoryAssignment({
  workspaceId,
  primaryCategoryId,
  secondaryCategoryId
}: {
  workspaceId: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
}) {
  if (secondaryCategoryId && !primaryCategoryId) {
    return "secondary-without-primary";
  }

  if (
    primaryCategoryId &&
    secondaryCategoryId &&
    primaryCategoryId === secondaryCategoryId
  ) {
    return "duplicate-categories";
  }

  const categoryIds = [primaryCategoryId, secondaryCategoryId].filter(
    (categoryId): categoryId is string => Boolean(categoryId)
  );

  if (categoryIds.length === 0) {
    return null;
  }

  const assignableCategories = await prisma.partCategory.findMany({
    where: {
      id: {
        in: categoryIds
      },
      workspaceId,
      isAssignable: true
    },
    select: {
      id: true
    }
  });

  if (assignableCategories.length !== categoryIds.length) {
    return "invalid-category";
  }

  return null;
}

function getPartWriteError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "duplicate-part";
  }

  return "database-unavailable";
}

function getFormSuccessState(part: PartsListItem): PartMutationResult {
  return {
    ok: true,
    part,
    submittedAt: Date.now()
  };
}

function getFormErrorState(error: string): PartMutationResult {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

async function getPartListItem({
  id,
  workspaceId
}: {
  id: string;
  workspaceId: string;
}) {
  const [part, categories] = await Promise.all([
    prisma.part.findFirst({
      where: {
        id,
        workspaceId
      },
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
    getPartCategories(workspaceId)
  ]);

  if (!part) {
    return null;
  }

  const categoryPathsById = new Map(
    categories.map((category) => [category.id, category.path])
  );

  return {
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
  };
}
