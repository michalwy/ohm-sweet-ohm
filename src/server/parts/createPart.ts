"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import {
  ensureOrganizationWithRole,
  ORGANIZATION_ROLE_MANUFACTURER
} from "@/server/organizations/organizations";

export async function createPart(formData: FormData) {
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
    redirect(`${partsPath}?partFormError=missing-required-fields&partDialog=open`);
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

        await prisma.part.create({
          data: {
            workspaceId: context.workspace.id,
            catalogNumber,
            manufacturerId: manufacturer.id,
            primaryCategoryId,
            secondaryCategoryId
          }
        });
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    redirect(`${partsPath}?partFormError=${formError}&partDialog=open`);
  }

  revalidatePath(partsPath);
  redirect(`${partsPath}?partCreated=1`);
}

export async function updatePart(formData: FormData) {
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
    redirect(
      `${partsPath}?partUpdateError=missing-required-fields&partEditDialog=${encodeURIComponent(id)}`
    );
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
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    redirect(
      `${partsPath}?partUpdateError=${formError}&partEditDialog=${encodeURIComponent(id)}`
    );
  }

  revalidatePath(partsPath);
  redirect(`${partsPath}?partUpdated=1`);
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
