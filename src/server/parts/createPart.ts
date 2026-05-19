"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";

export async function createPart(formData: FormData) {
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");

  if (!catalogNumber || !manufacturerName) {
    redirect("/?partFormError=missing-required-fields&partDialog=open");
  }

  try {
    await prisma.part.create({
      data: {
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
  const field = getRequiredFormValue(formData, "field");
  const value = getRequiredFormValue(formData, "value");

  if (!id || !value) {
    redirect("/?partUpdateError=missing-required-fields");
  }

  if (field !== "catalogNumber" && field !== "manufacturerName") {
    redirect("/?partUpdateError=unsupported-field");
  }

  try {
    await prisma.part.update({
      where: { id },
      data: {
        [field]: value
      }
    });
  } catch {
    redirect("/?partUpdateError=database-unavailable");
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
