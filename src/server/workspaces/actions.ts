"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/currentContext";
import { createWorkspaceForOwner } from "@/server/workspaces/createWorkspace";

const workspaceCopy = {
  missingName: "missing-name",
  unavailable: "workspace-unavailable"
};

export async function createWorkspace(formData: FormData) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const name = getRequiredFormValue(formData, "name");

  if (!name) {
    redirect(`/workspaces?error=${workspaceCopy.missingName}`);
  }

  let workspaceSlug = "";

  try {
    const workspace = await createWorkspaceForOwner({
      userId: session.user.id,
      name
    });

    workspaceSlug = workspace.slug;
    revalidatePath("/workspaces");
  } catch {
    redirect(`/workspaces?error=${workspaceCopy.unavailable}`);
  }

  if (!workspaceSlug) {
    redirect(`/workspaces?error=${workspaceCopy.unavailable}`);
  }

  redirect(`/w/${encodeURIComponent(workspaceSlug)}/parts`);
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
