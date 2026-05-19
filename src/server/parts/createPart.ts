"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/prisma";

export async function createPart(formData: FormData) {
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");

  if (!catalogNumber || !manufacturerName) {
    redirect("/?partFormError=missing-required-fields");
  }

  try {
    await prisma.part.create({
      data: {
        catalogNumber,
        manufacturerName
      }
    });
  } catch {
    redirect("/?partFormError=database-unavailable");
  }

  revalidatePath("/");
  redirect("/?partCreated=1");
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
