"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";

export async function createPart(formData: FormData) {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const partsPath = getPartsPath(workspaceSlug);

  if (!workspaceSlug || !catalogNumber || !manufacturerName) {
    redirect(`${partsPath}?partFormError=missing-required-fields&partDialog=open`);
  }

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      redirect(`${partsPath}?partFormError=database-unavailable&partDialog=open`);
    }

    await authorizeWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "parts:write"
    });

    await prisma.part.create({
      data: {
        workspaceId: context.workspace.id,
        catalogNumber,
        manufacturerName
      }
    });
  } catch {
    redirect(`${partsPath}?partFormError=database-unavailable&partDialog=open`);
  }

  revalidatePath(partsPath);
  redirect(`${partsPath}?partCreated=1`);
}

export async function updatePart(formData: FormData) {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const partsPath = getPartsPath(workspaceSlug);

  if (!workspaceSlug || !id || !catalogNumber || !manufacturerName) {
    redirect(
      `${partsPath}?partUpdateError=missing-required-fields&partEditDialog=${encodeURIComponent(id)}`
    );
  }

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      redirect(
        `${partsPath}?partUpdateError=database-unavailable&partEditDialog=${encodeURIComponent(id)}`
      );
    }

    await authorizeWorkspacePermission({
      userId: context.user.id,
      workspaceId: context.workspace.id,
      permission: "parts:write"
    });

    await prisma.part.updateMany({
      where: {
        id,
        workspaceId: context.workspace.id
      },
      data: {
        catalogNumber,
        manufacturerName
      }
    });
  } catch {
    redirect(
      `${partsPath}?partUpdateError=database-unavailable&partEditDialog=${encodeURIComponent(id)}`
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

function getPartsPath(workspaceSlug: string) {
  if (!workspaceSlug) {
    return "/workspaces";
  }

  return `/w/${encodeURIComponent(workspaceSlug)}/parts`;
}
