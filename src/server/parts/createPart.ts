"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { setActionToast } from "@/server/actionToast";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import {
  ensureOrganizationWithRole,
  ORGANIZATION_ROLE_MANUFACTURER
} from "@/server/organizations/organizations";

export type PartFormState = {
  error?: string;
  submittedAt?: number;
};

export async function createPart(
  _state: PartFormState,
  formData: FormData
): Promise<PartFormState> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const partsPath = getPartsPath(workspaceSlug);

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
          await prisma.part.create({
            data: {
              workspaceId: context.workspace.id,
              catalogNumber,
              manufacturerId: manufacturer.id,
              primaryCategoryId,
              secondaryCategoryId
            }
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

  revalidatePath(partsPath);
  await setActionToast({
    type: "part-created",
    catalogNumber,
    manufacturerName
  });
  redirect(partsPath);
}

export async function updatePart(
  _state: PartFormState,
  formData: FormData
): Promise<PartFormState> {
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
          await prisma.part.updateMany({
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

  revalidatePath(partsPath);
  await setActionToast({
    type: "part-updated",
    catalogNumber,
    manufacturerName
  });
  redirect(partsPath);
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

function getFormErrorState(error: string): PartFormState {
  return {
    error,
    submittedAt: Date.now()
  };
}
