"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContext } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";

export async function createPart(formData: FormData) {
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");

  if (!catalogNumber || !manufacturerName) {
    redirect("/?partFormError=missing-required-fields&partDialog=open");
  }

  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      redirect("/?partFormError=database-unavailable&partDialog=open");
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
    redirect("/?partFormError=database-unavailable&partDialog=open");
  }

  revalidatePath("/");
  redirect("/?partCreated=1");
}

export async function updatePart(formData: FormData) {
  const id = getRequiredFormValue(formData, "id");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");

  if (!id || !catalogNumber || !manufacturerName) {
    redirect(
      `/?partUpdateError=missing-required-fields&partEditDialog=${encodeURIComponent(id)}`
    );
  }

  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      redirect(
        `/?partUpdateError=database-unavailable&partEditDialog=${encodeURIComponent(id)}`
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
      `/?partUpdateError=database-unavailable&partEditDialog=${encodeURIComponent(id)}`
    );
  }

  revalidatePath("/");
  redirect("/?partUpdated=1");
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
