"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/currentContext";
import { createWorkspaceForOwner } from "@/server/workspaces/createWorkspace";

const workspaceCopy = {
  missingName: "missing-name",
  missingCurrency: "missing-currency",
  unavailable: "workspace-unavailable"
};

const SUPPORTED_CURRENCIES = new Set([
  "EUR", "USD", "GBP", "PLN", "CZK", "CHF", "SEK", "DKK", "NOK",
  "HUF", "RON", "BGN", "HRK", "RUB", "JPY", "CNY", "CAD", "AUD"
]);

export async function createWorkspace(formData: FormData) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/sign-in");
  }

  const name = getRequiredFormValue(formData, "name");
  const currency = getRequiredFormValue(formData, "currency").toUpperCase();

  if (!name) {
    redirect(`/workspaces?error=${workspaceCopy.missingName}`);
  }

  if (!currency || !SUPPORTED_CURRENCIES.has(currency)) {
    redirect(`/workspaces?error=${workspaceCopy.missingCurrency}`);
  }

  let workspaceSlug = "";

  try {
    const workspace = await createWorkspaceForOwner({
      userId: session.user.id,
      name,
      primaryCurrency: currency
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
