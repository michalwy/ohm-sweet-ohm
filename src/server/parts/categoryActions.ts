"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import {
  createPartCategory,
  updatePartCategory
} from "@/server/parts/categories";

export async function createPartCategoryFromForm(formData: FormData) {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const name = getRequiredFormValue(formData, "name");
  const parentId = getOptionalFormValue(formData, "parentId");
  const isAssignable = getRequiredFormValue(formData, "type") === "assignable";
  const categoriesPath = getPartCategoriesPath(workspaceSlug);

  if (!workspaceSlug || !name) {
    redirect(
      `${categoriesPath}?categoryError=missing-required-fields&categoryDialog=create`
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
        permission: "part-categories:write"
      });

      await createPartCategory({
        workspaceId: context.workspace.id,
        parentId,
        name,
        isAssignable
      });
    }
  } catch (error) {
    formError = getPartCategoryFormError(error);
  }

  if (formError) {
    redirect(
      `${categoriesPath}?categoryError=${formError}&categoryDialog=create`
    );
  }

  revalidatePath(categoriesPath);
  redirect(`${categoriesPath}?categoryCreated=1`);
}

export async function updatePartCategoryFromForm(formData: FormData) {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const name = getRequiredFormValue(formData, "name");
  const parentId = getOptionalFormValue(formData, "parentId");
  const isAssignable = getRequiredFormValue(formData, "type") === "assignable";
  const categoriesPath = getPartCategoriesPath(workspaceSlug);

  if (!workspaceSlug || !id || !name) {
    redirect(
      `${categoriesPath}?categoryUpdateError=missing-required-fields&categoryEditDialog=${encodeURIComponent(id)}`
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
        permission: "part-categories:write"
      });

      await updatePartCategory({
        id,
        workspaceId: context.workspace.id,
        parentId,
        name,
        isAssignable
      });
    }
  } catch (error) {
    formError = getPartCategoryFormError(error);
  }

  if (formError) {
    redirect(
      `${categoriesPath}?categoryUpdateError=${formError}&categoryEditDialog=${encodeURIComponent(id)}`
    );
  }

  revalidatePath(categoriesPath);
  redirect(`${categoriesPath}?categoryUpdated=1`);
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

function getPartCategoriesPath(workspaceSlug: string) {
  if (!workspaceSlug) {
    return "/workspaces";
  }

  return `/w/${encodeURIComponent(workspaceSlug)}/part-categories`;
}

function getPartCategoryFormError(error: unknown) {
  if (!(error instanceof Error)) {
    return "database-unavailable";
  }

  if (
    error.message === "category_name_required" ||
    error.message === "category_not_found" ||
    error.message === "invalid_parent_category" ||
    error.message === "category_tree_cycle" ||
    error.message === "workspace_permission_denied"
  ) {
    return error.message.replaceAll("_", "-");
  }

  return "database-unavailable";
}
